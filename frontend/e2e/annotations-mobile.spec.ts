import {
  test,
  expect,
  loginIfNeeded,
  selectTextRange,
} from './fixtures';
import type { Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ticket #24: touch equivalents of the two annotation entry points and a
// mobile presentation for the annotation column. Runs against the real
// backend on the mobile shell, one isolated scratch project per test.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test.describe.configure({ mode: 'serial' });

const LONG_PRESS_MS = 650;

interface ScratchFile {
  projectId: number;
  projectDir: string;
  path: string;
}

function scratchMarkdown(): string {
  const filler = Array.from({ length: 24 }, (_, index) => [
    `Filler paragraph ${index + 1}: scrolling context before the annotation.`,
    '',
  ]).flat();
  return [
    '# Mobile Annotation E2E',
    '',
    'A paragraph with a stable block for long-press annotation.',
    '',
    'The quick brown fox jumps over the lazy dog.',
    '',
    ...filler,
    'The target paragraph for the mobile annotation column.',
    '',
  ].join('\n');
}

/**
 * Seeds an isolated open project with one Markdown file through the real API.
 * The mobile shell has no file tree in view, so navigating straight to the
 * file URL keeps the journey focused on annotations.
 */
async function seedScratchFile(page: Page): Promise<ScratchFile> {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'annotations-mobile-'));
  const fileName = 'mobile-annotations.md';
  fs.writeFileSync(path.join(projectDir, fileName), scratchMarkdown());

  const project = await page.evaluate(async ({ dir }) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    if (!res.ok) throw new Error(`cannot create scratch project: ${res.status}`);
    return res.json();
  }, { dir: projectDir });

  const target: ScratchFile = { projectId: project.id, projectDir, path: fileName };
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(page.getByRole('heading', { name: 'Mobile Annotation E2E' })).toBeVisible({
    timeout: 15000,
  });

  // Opening a project through the API (instead of the mobile tree) leaves the
  // navigation drawer covering the document; a real tree tap closes it.
  const drawer = page.getByRole('dialog', { name: 'Navigation drawer' });
  if (await drawer.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  }
  return target;
}

async function cleanupScratchFile(page: Page, target: ScratchFile | undefined): Promise<void> {
  if (!target) return;
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
    await fetch(`/api/projects/${projectId}/close`, { method: 'POST' });
  }, { projectId: target.projectId, relativePath: target.path });
  fs.rmSync(target.projectDir, { recursive: true, force: true });
}

function paragraphWith(page: Page, text: string): Locator {
  return page.getByRole('paragraph').filter({ hasText: text });
}

/**
 * Long-presses a rendered block with a real touch pointer sequence. Playwright
 * has no hold gesture, so the pointer is pressed, held past the app's
 * threshold, then released. The browser's synthetic click is not emitted for
 * dispatched pointer events, keeping the assertion on the app's own gesture.
 */
async function longPressBlock(page: Page, text: string): Promise<void> {
  const paragraph = paragraphWith(page, text);
  await expect(paragraph).toBeVisible();
  await paragraph.scrollIntoViewIfNeeded();
  await expect(paragraph).toBeInViewport();
  const box = await paragraph.boundingBox();
  if (!box) throw new Error(`no box for ${text}`);

  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 12);

  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y);
    if (!target) throw new Error('no element at long-press point');
    const init = {
      bubbles: true,
      cancelable: true,
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
    };
    target.dispatchEvent(new PointerEvent('pointerdown', init));
    (window as unknown as { __releaseLongPress?: () => void }).__releaseLongPress = () => {
      target.dispatchEvent(new PointerEvent('pointerup', init));
    };
  }, { x, y });

  await page.waitForTimeout(LONG_PRESS_MS);
  await page.evaluate(() => {
    (window as unknown as { __releaseLongPress?: () => void }).__releaseLongPress?.();
  });
}

async function saveComposer(page: Page, body: string): Promise<void> {
  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();
}

async function openAnnotationDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Annotation column/ }).click();
  const column = page.getByRole('region', { name: 'Annotations' });
  await expect(column).toBeVisible();
  return column;
}

test.describe('mobile annotations', () => {
  let target: ScratchFile;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await expect(page.locator('.mobile-main-content')).toBeVisible({ timeout: 15000 });
    target = await seedScratchFile(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupScratchFile(page, target);
  });

  test('long-press opens the whole-block composer and the saved note highlights', async ({
    page,
  }) => {
    await longPressBlock(page, 'A paragraph with a stable block for long-press annotation.');

    await saveComposer(page, 'Long-press note');

    // The highlight is user-visible: tapping the annotated block opens its
    // thread in a popover without a marker or hover.
    const paragraph = paragraphWith(
      page,
      'A paragraph with a stable block for long-press annotation.',
    );
    const box = await paragraph.boundingBox();
    if (!box) throw new Error('no annotated block box');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Long-press note');
  });

  test('a mouse press-and-hold never opens the composer', async ({ page }) => {
    const paragraph = paragraphWith(
      page,
      'A paragraph with a stable block for long-press annotation.',
    );
    const box = await paragraph.boundingBox();
    if (!box) throw new Error('no paragraph box');

    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 12));
    await page.mouse.down();
    await page.waitForTimeout(LONG_PRESS_MS);
    await page.mouse.up();

    await expect(page.getByRole('dialog', { name: 'New annotation' })).not.toBeVisible();
  });

  test('touch text selection exposes a touch-sized annotate button that creates a highlight', async ({
    page,
  }) => {
    await selectTextRange(page, 'quick brown fox', 'quick brown fox');

    const button = page.getByRole('button', { name: 'Annotate selected text' });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    if (!box) throw new Error('no selection button box');
    expect(box.height).toBeGreaterThanOrEqual(44);

    // A real touch tap on the floating button, not a mouse click.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await saveComposer(page, 'Touch selection note');

    await expect(
      page.locator('mark[data-annotation-id]', { hasText: 'quick brown fox' }).first(),
    ).toBeVisible();
  });

  test('the annotation column is a right drawer with list, filter, and jump', async ({ page }) => {
    await longPressBlock(page, 'The target paragraph for the mobile annotation column.');
    await saveComposer(page, 'Column note');

    let column = await openAnnotationDrawer(page);
    const entry = column.getByRole('button', { name: /Jump to annotation/ });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('The target paragraph for the mobile annotation column.');
    await expect(column.getByText('Active', { exact: true })).toBeVisible();

    // The resolved filter hides and restores the entry.
    await column.getByRole('button', { name: 'Resolve' }).click();
    await expect(column.getByText('Resolved', { exact: true })).toBeVisible();
    await column.getByLabel('Show resolved').uncheck();
    await expect(entry).toHaveCount(0);
    await column.getByLabel('Show resolved').check();
    await expect(entry).toHaveCount(1);

    // Close the drawer, move the target out of view, then jump from the drawer.
    await column.getByRole('button', { name: 'Close annotations' }).click();
    await expect(column).not.toBeVisible();
    await page.getByRole('heading', { name: 'Mobile Annotation E2E' }).scrollIntoViewIfNeeded();
    const paragraph = paragraphWith(
      page,
      'The target paragraph for the mobile annotation column.',
    );
    await expect(paragraph).not.toBeInViewport();

    column = await openAnnotationDrawer(page);
    await column.getByRole('button', { name: /Jump to annotation/ }).tap();

    // Jumping closes the drawer and lands on the anchored block.
    await expect(column).not.toBeVisible();
    await expect(paragraph).toBeInViewport();
    await expect(paragraph).toBeFocused();
  });
});
