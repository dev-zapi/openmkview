import { test, expect, loginIfNeeded, getHarnessProject } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Annotation column + thread lifecycle (ticket #18). Uses a uniquely named
// scratch file inside the seeded open project, like the other annotation
// specs, so it never leaves invalid projects behind for later specs.
// Assertions stay on user-visible surfaces (roles, text, focus, viewport).

test.describe.configure({ mode: 'serial' });

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
  path: string;
}

async function seedProject(page: Page): Promise<FileTarget> {
  const project = await getHarnessProject(page);
  return page.evaluate(async ({ body, projectId }) => {
    const name = `annotations-column-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
    const createRes = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', project_id: projectId, name }),
    });
    if (!createRes.ok) throw new Error(`cannot create scratch file: ${createRes.status}`);

    const saveRes = await fetch('/api/files/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, relativePath: name, content: body }),
    });
    if (!saveRes.ok) throw new Error(`cannot seed scratch file: ${saveRes.status}`);

    return { projectId, path: name };
  }, { body: scratchMarkdown(), projectId: project.id }).then(async (target) => {
    await page.goto(
      `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
      { waitUntil: 'domcontentloaded' },
    );
    await expect(page.getByRole('heading', { name: 'Column Annotation E2E' })).toBeVisible({
      timeout: 15000,
    });
    return target;
  });
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

    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, path: relativePath }),
    });
  }, { projectId: target.projectId, relativePath: target.path });
}

function targetParagraph(page: Page): Locator {
  // Role-based so the annotation-column excerpt cannot match instead.
  return page.getByRole('paragraph').filter({ hasText: TARGET });
}

function markerFor(paragraph: Locator): Locator {
  return paragraph.getByRole('button', { name: /Annotate this block/ });
}

async function createAnnotation(page: Page, body: string): Promise<void> {
  const paragraph = targetParagraph(page);
  await expect(paragraph).toBeVisible();

  await paragraph.hover();
  const marker = markerFor(paragraph);
  await marker.hover();
  await marker.click();

  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();

  // The marker reports the annotation's presence through accessible state.
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
}

async function openColumn(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
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

/** Selects a phrase inside rendered text so the floating Annotate button appears. */
async function selectTextPhrase(page: Page, phrase: string): Promise<void> {
  await page.evaluate(({ phrase }) => {
    const content = document.querySelector('.markdown-content');
    if (!content) throw new Error('markdown content not found');

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let combined = '';
    let node = walker.nextNode() as Text | null;
    while (node) {
      nodes.push(node);
      combined += node.nodeValue || '';
      node = walker.nextNode() as Text | null;
    }

    const offset = combined.indexOf(phrase);
    if (offset === -1) throw new Error(`cannot find phrase: ${phrase}`);
    let remaining = offset;
    let startNode: Text | null = null;
    let startOffset = 0;
    for (const text of nodes) {
      const length = text.nodeValue?.length || 0;
      if (remaining <= length) {
        startNode = text;
        startOffset = remaining;
        break;
      }
      remaining -= length;
    }
    if (!startNode) throw new Error(`cannot map phrase: ${phrase}`);

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(startNode, startOffset + phrase.length);
    const selection = window.getSelection();
    if (!selection) throw new Error('no selection');
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  }, { phrase });
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

    // Creating the annotation left the target in view; scroll back up through
    // the heading, then jump from the column.
    await page.getByRole('heading', { name: 'Column Annotation E2E' }).scrollIntoViewIfNeeded();
    const paragraph = targetParagraph(page);
    await expect(paragraph).not.toBeInViewport();

    await entry.click();

    // The document scrolls to the anchored block and focuses it.
    await expect(paragraph).toBeInViewport();
    await expect(paragraph).toBeFocused();

    // Later thread mutations must not replay the jump.
    await page.getByRole('heading', { name: 'Column Annotation E2E' }).scrollIntoViewIfNeeded();
    await expect(paragraph).not.toBeInViewport();
    await column.getByRole('button', { name: 'Resolve' }).click();
    await expect(column.getByText('Resolved', { exact: true })).toBeVisible();
    await expect(paragraph).not.toBeInViewport();

    // The outline and annotation columns are independent siblings.
    await page.locator('button[title="Outline"]').click();
    await expect(page.getByRole('heading', { name: 'Outline' })).toBeVisible();
    await expect(column).toBeVisible();
  });

  test('replies append in the column and from the popover', async ({ page }) => {
    await createAnnotation(page, 'Initial note');
    const column = await openColumn(page);

    await column.getByLabel('Reply body').fill('Reply with Markdown');
    await column.getByRole('button', { name: 'Reply' }).click();

    await expect(column.getByText('Initial note')).toBeVisible();
    await expect(column.getByText('Reply with Markdown')).toBeVisible();

    // The same thread appears in the popover, where a further Reply can be
    // submitted and flows back to the column.
    const viewer = await openViewer(page);
    await expect(viewer.getByText('Initial note')).toBeVisible();
    await expect(viewer.getByText('Reply with Markdown')).toBeVisible();

    await viewer.getByLabel('Reply body').fill('Popover reply');
    await viewer.getByRole('button', { name: 'Reply' }).click();
    await expect(viewer.getByText('Popover reply')).toBeVisible();
    await expect(column.getByText('Popover reply')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
  });

  test('note Markdown bodies can be edited in the column and the popover', async ({ page }) => {
    await createAnnotation(page, 'First draft');
    const column = await openColumn(page);

    await column.getByRole('button', { name: 'Edit' }).first().click();
    await column.getByLabel('Note body').fill('Edited **note**');
    await column.getByRole('button', { name: 'Save' }).click();

    await expect(column.getByText(/Edited note/)).toBeVisible();
    await expect(column.getByText('First draft')).toHaveCount(0);

    // Editing through the popover updates the same thread.
    const viewer = await openViewer(page);
    await expect(viewer.getByText(/Edited note/)).toBeVisible();
    await viewer.getByRole('button', { name: 'Edit' }).first().click();
    await viewer.getByLabel('Note body').fill('Refined **note**');
    await viewer.getByRole('button', { name: 'Save' }).click();
    await expect(viewer.getByText(/Refined note/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(column.getByText(/Refined note/)).toBeVisible();
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
    const marker = markerFor(paragraph);
    await paragraph.hover();
    await expect(marker).toHaveAttribute('aria-pressed', 'false');

    // Without a highlight, clicking the content no longer opens the annotation.
    await paragraph.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).not.toBeVisible();
  });

  test('column handles text-range annotations and jumps to the selected text', async ({ page }) => {
    await targetParagraph(page).scrollIntoViewIfNeeded();
    await selectTextPhrase(page, 'target paragraph');
    await page.getByRole('button', { name: 'Annotate selected text' }).click();
    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('Range note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    const column = await openColumn(page);
    const entry = column.getByRole('button', { name: /Jump to annotation/ });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('target paragraph');

    await page.getByRole('heading', { name: 'Column Annotation E2E' }).scrollIntoViewIfNeeded();
    const mark = page.locator('mark[data-annotation-id]', { hasText: 'target paragraph' }).first();
    await expect(mark).not.toBeInViewport();

    await entry.click();

    await expect(mark).toBeInViewport();
    await expect(mark).toBeFocused();
  });

  test('resolve can be filtered out and un-resolve restores the column entry', async ({ page }) => {
    await createAnnotation(page, 'Resolve lifecycle');
    const column = await openColumn(page);

    await column.getByRole('button', { name: 'Resolve' }).click();
    await expect(column.getByText('Resolved', { exact: true })).toBeVisible();
    await expect(column.getByRole('button', { name: 'Unresolve' })).toBeVisible();

    // Filter out resolved annotations.
    await column.getByLabel('Show resolved').uncheck();
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(0);
    await expect(column.getByText('No annotations for this file')).toBeVisible();

    await column.getByLabel('Show resolved').check();
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(1);

    // Un-resolving makes the entry live again and keeps it visible even with
    // the resolved filter turned off.
    await column.getByRole('button', { name: 'Unresolve' }).click();
    await expect(column.getByText('Active', { exact: true })).toBeVisible();
    await column.getByLabel('Show resolved').uncheck();
    await expect(column.getByRole('button', { name: /Jump to annotation/ })).toHaveCount(1);
  });
});
