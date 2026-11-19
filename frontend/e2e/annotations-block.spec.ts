import {
  test,
  expect,
  loginIfNeeded,
  waitForDesktopApp,
  createScratchFile,
  removeScratchFile,
  openScratchFile,
  type FileTarget,
} from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Whole-block annotations are the tracer bullet for spec #15. These specs run
// serial because they mutate the real backend: each test creates its own
// uniquely named Markdown file and removes both the file and its annotations.

test.describe.configure({ mode: 'serial' });

const ANNOTATION_NOTE = ['Annotation **note** body', '', '- reply item'].join('\n');

const SCRATCH_MARKDOWN = [
  '# Block Annotation E2E',
  '',
  'A paragraph with a stable block for annotation.',
  '',
  'A second paragraph.',
  '',
  '- A list item whose marker must stay aligned.',
  '- Another list item for comparison.',
  '',
  '```rust',
  'const value = 1;',
  '```',
  '',
].join('\n');

async function storedBlockText(page: Page, target: FileTarget): Promise<string | undefined> {
  return page.evaluate(async ({ projectId, path }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    const annotations = await res.json();
    return annotations[0]?.anchor?.segments?.[0]?.blockText;
  }, target);
}

/**
 * Clicking anchored content opens the viewer once the annotation list has
 * loaded; retry the click so the test waits on user-visible behavior rather
 * than on internal attachment state.
 */
async function openViewerByClicking(page: Page, content: Locator): Promise<void> {
  const viewer = page.getByRole('dialog', { name: 'Annotation' });
  await expect
    .poll(
      async () => {
        if (await viewer.isVisible().catch(() => false)) return true;
        await content.click();
        return viewer.isVisible().catch(() => false);
      },
      { timeout: 15000 }
    )
    .toBe(true);
}

test.describe('whole-block annotations', () => {
  let target: FileTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page, SCRATCH_MARKDOWN);
    await openScratchFile(page, target, 'Block Annotation E2E');
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('hover, create, highlight, popover, and re-attach after reload', async ({ page }) => {
    const paragraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await expect(paragraph).toBeVisible();

    // Hovering the block reveals its marker; clicking it opens the composer.
    await paragraph.hover();
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await marker.hover();
    await marker.click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill(ANNOTATION_NOTE);
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // Clicking the highlighted block opens a popover with the rendered note.
    await openViewerByClicking(page, paragraph);
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Annotation note body');
    await expect(viewer.getByRole('listitem')).toHaveText('reply item');
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();

    // Clicking the marker opens the same popover.
    await marker.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).toContainText(
      'Annotation note body'
    );
    await page.keyboard.press('Escape');

    // Reloading re-fetches the API list and re-attaches by block content hash.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target, 'Block Annotation E2E');

    const reloadedParagraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await openViewerByClicking(page, reloadedParagraph);
    const reloadedViewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(reloadedViewer).toBeVisible();
    await expect(reloadedViewer.getByRole('listitem')).toHaveText('reply item');

    // Deleting from the popover clears the annotation from the document.
    await reloadedViewer.getByRole('button', { name: 'Delete' }).click();
    await expect(reloadedViewer).not.toBeVisible();
    await reloadedParagraph.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).not.toBeVisible();
  });

  test('annotation does not shift list content and uses a subtle background', async ({ page }) => {
    const list = page.locator('.markdown-content > ul');
    const item = list.getByRole('listitem').first();
    const marker = list.getByRole('button', { name: /Annotate this block/ });
    await expect(item).toBeVisible();

    const before = await item.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = element.firstChild;
      if (text) range.selectNode(text);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });

    await list.hover();
    await marker.click();
    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await composer.getByRole('textbox').fill('List layout note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();
    await expect(list).toHaveClass(/annotation-highlighted/);

    const after = await item.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = element.firstChild;
      if (text) range.selectNode(text);
      const rect = range.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(after.y).toBeCloseTo(before.y, 1);
    await expect(list).toHaveCSS('padding-left', '43px');
    await expect(list).toHaveCSS('margin-left', '-11px');
    await expect(list).toHaveCSS('background-image', /\/ 0\.05\)/);
  });

  test('marker stays reachable across a real mouse transit into the rail', async ({ page }) => {
    const paragraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await expect(paragraph).toBeVisible();

    // Hovering the text reveals the marker; wait out the 150ms fade-in.
    await paragraph.hover();
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await expect(marker).toHaveCSS('opacity', '1');

    // A real pointer travels through the wrapper padding between the text
    // and the rail marker, where no element lives. Stepped moves reproduce
    // that transit — locator.hover() teleports and cannot catch the hover
    // dropout that used to fade the marker out mid-flight.
    const from = await paragraph.boundingBox();
    const to = await marker.boundingBox();
    if (!from || !to) throw new Error('missing paragraph or marker box');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 40 });

    // The marker must still be fully lit at the end of the transit, and a
    // click at its center must open the composer.
    await expect(marker).toHaveCSS('opacity', '1');
    await page.mouse.click(to.x + to.width / 2, to.y + to.height / 2);
    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(composer).not.toBeVisible();
  });

  test('offers a chooser when a block carries multiple annotations', async ({ page }) => {
    const paragraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await paragraph.hover();
    await paragraph.getByRole('button', { name: /Annotate this block/ }).click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('First block note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // Second annotation shares the exact same whole-block Anchor.
    await page.evaluate(async ({ projectId, path }) => {
      const listRes = await fetch(
        `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
      );
      const annotations = await listRes.json();
      const createRes = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          relativePath: path,
          anchor: annotations[0].anchor,
          body: 'Second block note',
        }),
      });
      if (!createRes.ok) throw new Error(`cannot create second annotation: ${createRes.status}`);
    }, target);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target, 'Block Annotation E2E');

    const reloaded = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await expect(reloaded).toHaveClass(/annotation-highlighted/, { timeout: 15000 });
    const ids = (await reloaded.getAttribute('data-annotation-ids'))?.split(',') ?? [];
    expect(ids).toHaveLength(2);

    await reloaded.click();
    const chooser = page.getByRole('dialog', { name: 'Annotations here' });
    await expect(chooser).toBeVisible();
    const items = chooser.locator('.annotation-chooser-item');
    await expect(items).toHaveCount(2);

    await items.first().click();
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText(/First block note|Second block note/);
    await page.keyboard.press('Escape');
  });

  test('code block anchors use source text and survive reload', async ({ page }) => {
    const codeText = page.getByText('const value = 1;', { exact: false }).first();
    await codeText.hover();

    const marker = page.getByRole('button', { name: /const value = 1/ });
    await marker.click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('Code block note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // The anchor stores the code source, not the injected language/Copy chrome.
    expect(await storedBlockText(page, target)).toBe('const value = 1;');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target, 'Block Annotation E2E');

    const reloadedCode = page.getByText('const value = 1;', { exact: false }).first();
    await openViewerByClicking(page, reloadedCode);
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Code block note');

    await viewer.getByRole('button', { name: 'Delete' }).click();
  });
});
