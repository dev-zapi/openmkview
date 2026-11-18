import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, loginIfNeeded } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Annotation column + thread lifecycle (ticket #18). Each test seeds its own
// throwaway project directory and file through the real API, so the spec is
// isolation-safe against a scratch backend (port 4618) and parallel agents.

test.describe.configure({ mode: 'serial' });

const FILE_NAME = 'annotations-column-e2e.md';
const TARGET = 'The target paragraph for the annotation column.';

function scratchMarkdown(): string {
  const filler = Array.from({ length: 24 }, (_, index) => [
    `Filler paragraph ${index + 1}: scrolling context before the annotation.`,
    '',
  ]).flat();
  return [
    '# Column Annotation E2E',
    '',
    'Introductory paragraph.',
    '',
    ...filler,
    TARGET,
    '',
    'A paragraph after the target.',
    '',
  ].join('\n');
}

interface FileTarget {
  projectId: number;
  projectDir: string;
  path: string;
}

async function seedProject(page: Page): Promise<FileTarget> {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openmkview-ann18-'));
  fs.writeFileSync(path.join(projectDir, FILE_NAME), scratchMarkdown());

  const project = await page.evaluate(async ({ dir }) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    if (!res.ok) throw new Error(`cannot create scratch project: ${res.status}`);
    return res.json();
  }, { dir: projectDir });

  await page.goto(`/project/${project.id}/files/${encodeURIComponent(FILE_NAME)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: 'Column Annotation E2E' })).toBeVisible({
    timeout: 15000,
  });

  return { projectId: project.id, projectDir, path: FILE_NAME };
}

async function cleanupProject(page: Page, target: FileTarget): Promise<void> {
  await page.evaluate(async ({ projectId, relativePath }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`,
    );
    if (res.ok) {
      const annotations = await res.json();
      for (const annotation of annotations) {
        await fetch(`/api/annotations/${annotation.id}`, { method: 'DELETE' });
      }
    }
  }, { projectId: target.projectId, relativePath: target.path });

  fs.rmSync(target.projectDir, { recursive: true, force: true });
}

function targetParagraph(page: Page): Locator {
  // The annotation column echoes the same excerpt text; stay in the document.
  return page.locator('.markdown-content').getByText(TARGET, { exact: true });
}

async function createAnnotation(page: Page, body: string): Promise<void> {
  const paragraph = targetParagraph(page);
  await expect(paragraph).toBeVisible();

  await paragraph.hover();
  const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
  await marker.hover();
  await marker.click();

  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();

  await expect(paragraph).toHaveClass(/annotation-highlighted/);
}

async function openColumn(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Annotations', exact: true }).click();
  const column = page.getByRole('region', { name: 'Annotations' });
  await expect(column).toBeVisible();
  return column;
}

async function openViewer(page: Page): Promise<Locator> {
  const paragraph = targetParagraph(page);
  await paragraph.click();
  const viewer = page.getByRole('dialog', { name: 'Annotation' });
  await expect(viewer).toBeVisible();
  return viewer;
}

async function storedNotes(page: Page, target: FileTarget): Promise<string[]> {
  return page.evaluate(async ({ projectId, relativePath }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`,
    );
    const annotations = await res.json();
    return (annotations[0]?.notes ?? []).map((note: { body: string }) => note.body);
  }, { projectId: target.projectId, relativePath: target.path });
}

test.describe('annotation column lifecycle', () => {
  let target: FileTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    target = await seedProject(page);
  });

  test.afterEach(async ({ page }) => {
    if (target) await cleanupProject(page, target);
  });

  test('column lists the file annotations and jumps to the anchored content', async ({ page }) => {
    await createAnnotation(page, 'Column jump note');
    const column = await openColumn(page);

    const entry = column.getByRole('button', { name: /Jump to annotation/ });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText(TARGET);
    await expect(column.getByText('Active', { exact: true })).toBeVisible();

    // Creating the annotation scrolled the target into view; go back to the
    // top so the column jump is the thing that moves the document.
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('.content-main')!.scrollTop = 0;
    });
    const scrollBefore = await page.evaluate(
      () => document.querySelector<HTMLElement>('.content-main')!.scrollTop,
    );
    expect(scrollBefore).toBe(0);

    await entry.click();

    // The document scrolls to the anchored block and marks it as focused.
    await expect.poll(async () =>
      page.evaluate(() => document.querySelector<HTMLElement>('.content-main')!.scrollTop),
    ).toBeGreaterThan(0);
    await expect(page.locator('.annotation-jump-target')).toHaveCount(1);
    await expect(targetParagraph(page)).toBeInViewport();

    // The outline and annotation columns are independent siblings.
    await page.locator('button[title="Outline"]').click();
    await expect(page.locator('.outline-panel')).toBeVisible();
    await expect(column).toBeVisible();
  });

  test('replies append in time order in the column and the popover', async ({ page }) => {
    await createAnnotation(page, 'Initial note');
    const column = await openColumn(page);

    const item = column.locator('.annotation-column-item').first();
    await item.getByLabel('Reply body').fill('Reply with Markdown');
    await item.getByRole('button', { name: 'Reply' }).click();

    const bodies = column.locator('.annotation-note-body');
    await expect(bodies).toHaveCount(2);
    await expect(bodies.nth(1)).toContainText('Reply with Markdown');
    await expect.poll(() => storedNotes(page, target)).toEqual([
      'Initial note',
      'Reply with Markdown',
    ]);

    // The same thread is visible inside the anchored popover.
    const viewer = await openViewer(page);
    await expect(viewer.locator('.annotation-note-body')).toHaveCount(2);
    await expect(viewer.locator('.annotation-note-body').nth(1)).toContainText(
      'Reply with Markdown',
    );
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
  });

  test('note Markdown bodies can be edited in the column and the popover', async ({ page }) => {
    await createAnnotation(page, 'First draft');
    const column = await openColumn(page);

    const item = column.locator('.annotation-column-item').first();
    await item.getByRole('button', { name: 'Edit' }).first().click();
    await item.getByLabel('Note body').fill('Edited **note**');
    await item.getByRole('button', { name: 'Save' }).click();

    await expect(item.locator('.annotation-note-body').first()).toContainText('Edited note');
    await expect.poll(() => storedNotes(page, target)).toEqual(['Edited **note**']);

    // Editing through the popover updates the same thread.
    const viewer = await openViewer(page);
    await viewer.getByRole('button', { name: 'Edit' }).first().click();
    await viewer.getByLabel('Note body').fill('Refined **note**');
    await viewer.getByRole('button', { name: 'Save' }).click();
    await expect(viewer.locator('.annotation-note-body').first()).toContainText('Refined note');
    await page.keyboard.press('Escape');
  });

  test('deleting an annotation removes highlight, marker, and column entry', async ({ page }) => {
    await createAnnotation(page, 'Delete me');
    const column = await openColumn(page);
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(1);

    const viewer = await openViewer(page);
    await viewer.getByRole('button', { name: 'Delete' }).click();
    await expect(viewer).not.toBeVisible();

    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(0);
    await expect(column.getByText('No annotations for this file')).toBeVisible();

    const paragraph = targetParagraph(page);
    await expect(paragraph).not.toHaveClass(/annotation-highlighted/);
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await expect(marker).not.toHaveClass(/has-annotation/);
    await expect.poll(async () => {
      const notes = await storedNotes(page, target);
      return notes.length;
    }).toBe(0);
  });

  test('resolve dims the highlight and un-resolve restores it, with a column filter', async ({ page }) => {
    await createAnnotation(page, 'Resolve lifecycle');
    const column = await openColumn(page);
    const paragraph = targetParagraph(page);

    const item = column.locator('.annotation-column-item').first();
    await item.getByRole('button', { name: 'Resolve' }).click();

    await expect(paragraph).toHaveClass(/annotation-resolved/);
    await expect(item.getByText('Resolved', { exact: true })).toBeVisible();
    await expect(item.getByRole('button', { name: 'Unresolve' })).toBeVisible();

    // Filter out resolved annotations.
    await column.getByLabel('Show resolved').uncheck();
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(0);
    await expect(column.getByText('No annotations for this file')).toBeVisible();

    await column.getByLabel('Show resolved').check();
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(1);

    // Un-resolving restores the live highlight and state.
    await item.getByRole('button', { name: 'Unresolve' }).click();
    await expect(paragraph).not.toHaveClass(/annotation-resolved/);
    await expect(item.getByText('Active', { exact: true })).toBeVisible();

    await expect.poll(async () =>
      page.evaluate(async ({ projectId, relativePath }) => {
        const res = await fetch(
          `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`,
        );
        const annotations = await res.json();
        return Boolean(annotations[0]?.resolved);
      }, { projectId: target.projectId, relativePath: target.path }),
    ).toBe(false);
  });
});
