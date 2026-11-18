import {
  test,
  expect,
  loginIfNeeded,
  createScratchProject,
  removeScratchProject,
  saveComposer,
  createBlockAnnotation,
  selectTextRange,
  replaceDocumentInEditMode,
  openAnnotationColumn,
  type ScratchProject,
} from './fixtures';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Ticket #20: the Source view echoes Anchors as read-only line highlights.
// Best-effort by design; a quote the raw Markdown cannot locate degrades to
// the Outdated badge rather than a wrong line. Serial and isolated: each test
// seeds its own scratch project so parallel agents never share annotation data.

test.describe.configure({ mode: 'serial' });

const FILE_NAME = 'annotations-source-e2e.md';
const MEDIA_FILE = 'annotations-source-media.md';
const TEXT_FILE = 'annotations-source-notes.txt';
const PARAGRAPH_ONE = 'The quick brown fox lives in the first paragraph.';
const PARAGRAPH_TWO = 'A second paragraph carries a different thought.';
const PARAGRAPH_THREE = 'The final paragraph closes the argument.';

const INITIAL_MARKDOWN = [
  '# Source Echo E2E',
  '',
  PARAGRAPH_ONE,
  '',
  PARAGRAPH_TWO,
  '',
  PARAGRAPH_THREE,
  '',
].join('\n');

const REWRITTEN_MARKDOWN = [
  '# Source Echo E2E',
  '',
  PARAGRAPH_ONE,
  '',
  PARAGRAPH_THREE,
  '',
].join('\n');

const MEDIA_MARKDOWN = ['# Media E2E', '', '![A diagram](diagram.png)', '', 'Body text.', ''].join(
  '\n'
);

const PLAIN_TEXT = ['# Plain Notes', '', 'A plain text sentence with a target quote.', ''].join(
  '\n'
);

async function seedProjectFile(
  page: Page,
  projectId: number,
  name: string,
  content: string
): Promise<void> {
  await page.evaluate(
    async ({ projectId, name, content }) => {
      const createRes = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', project_id: projectId, name }),
      });
      if (!createRes.ok) throw new Error(`cannot create ${name}: ${createRes.status}`);

      const saveRes = await fetch('/api/files/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, relativePath: name, content }),
      });
      if (!saveRes.ok) throw new Error(`cannot seed ${name}: ${saveRes.status}`);
    },
    { projectId, name, content }
  );
}

async function seedTextAnnotation(
  page: Page,
  target: { projectId: number; path: string },
  quote: string,
  blockText: string
): Promise<void> {
  await page.evaluate(
    async ({ projectId, path, quote, blockText }) => {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          relativePath: path,
          anchor: {
            version: 1,
            segments: [
              {
                kind: 'text',
                blockHash: 'blk-stale',
                blockText,
                blockType: 'p',
                headingPath: [],
                quote,
                prefix: '',
                suffix: '',
              },
            ],
          },
          body: 'Seeded note',
        }),
      });
      if (!res.ok) throw new Error(`cannot seed annotation: ${res.status}`);
    },
    { projectId: target.projectId, path: target.path, quote, blockText }
  );
}

async function openFile(
  page: Page,
  target: { projectId: number; path: string },
  heading: string
): Promise<void> {
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({
    timeout: 15000,
  });
  // The annotation render pass assigns blocks on the next task; wait for its
  // markers so selection-based tests never race the pass.
  await expect(
    page.getByRole('button', { name: /Annotate this block/ }).first()
  ).toBeAttached({ timeout: 15000 });
}

async function switchToSource(page: Page): Promise<void> {
  await page.locator('header').getByRole('button', { name: 'Source', exact: true }).click();
  await expect(page.locator('.source-highlighted')).toBeVisible({ timeout: 15000 });
}

test.describe('source view annotation echo', () => {
  let target: ScratchProject;

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    target = await createScratchProject(page, FILE_NAME, INITIAL_MARKDOWN, 'ann20-source');
    await seedProjectFile(page, target.projectId, MEDIA_FILE, MEDIA_MARKDOWN);
    // The save API only accepts Markdown/HTML, so write the Source-fallback
    // `.txt` fixture straight into the scratch project directory.
    fs.writeFileSync(path.join(target.projectDir, TEXT_FILE), PLAIN_TEXT);
    await openFile(page, target, 'Source Echo E2E');
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchProject(page, target);
  });

  test('highlights preview-created annotations and respects visibility', async ({ page }) => {
    await createBlockAnnotation(page, PARAGRAPH_ONE, 'Source echo note');
    await expect(
      page.getByRole('paragraph').filter({ hasText: PARAGRAPH_ONE })
    ).toHaveClass(/annotation-highlighted/, { timeout: 15000 });

    await switchToSource(page);

    const marks = page.getByRole('mark');
    await expect(marks).toHaveCount(1);
    await expect(marks.first()).toContainText(PARAGRAPH_ONE);
    await expect(
      page.getByRole('status', { name: 'Outdated annotations' })
    ).toHaveCount(0);

    // The reading-mode toggle hides every echo, then restores it.
    await page.getByRole('button', { name: 'Hide annotations' }).click();
    await expect(page.getByRole('mark')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show annotations' }).click();
    await expect(page.getByRole('mark')).toHaveCount(1);
  });

  test('highlights every source range of a cross-block annotation', async ({ page }) => {
    await selectTextRange(page, PARAGRAPH_ONE, PARAGRAPH_THREE);
    const annotate = page.getByRole('button', { name: 'Annotate selected text' });
    await expect(annotate).toBeVisible();
    await annotate.click();
    await saveComposer(page, 'Cross-block source note');

    await switchToSource(page);

    const marks = page.getByRole('mark');
    await expect(marks).toHaveCount(3);
    await expect(marks.filter({ hasText: PARAGRAPH_ONE })).toHaveCount(1);
    await expect(marks.filter({ hasText: PARAGRAPH_TWO })).toHaveCount(1);
    await expect(marks.filter({ hasText: PARAGRAPH_THREE })).toHaveCount(1);
  });

  test('unlocatable quotes show Outdated with no highlight', async ({ page }) => {
    const column = await openAnnotationColumn(page);
    await createBlockAnnotation(page, PARAGRAPH_TWO, 'Doomed source note');

    // Remove the anchored paragraph through Edit Mode; Preview re-resolves the
    // Anchor to Outdated.
    await replaceDocumentInEditMode(page, REWRITTEN_MARKDOWN, 'Source Echo E2E');
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });

    await switchToSource(page);

    // No wrong line is echoed, and the Source view itself surfaces the badge.
    await expect(page.getByRole('mark')).toHaveCount(0);
    const outdatedPanel = page.getByRole('status', { name: 'Outdated annotations' });
    await expect(outdatedPanel).toBeVisible();
    await expect(outdatedPanel.getByText('Outdated', { exact: true })).toBeVisible();
    await expect(outdatedPanel).toContainText(PARAGRAPH_TWO);

    // The independent column agrees with the Source view's status.
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible();
  });

  test('keeps the canonical Preview status when Source could locate the quote', async ({
    page,
  }) => {
    // Image alt text exists in raw Markdown but not in the rendered block text,
    // so Preview marks the Anchor Outdated while the raw locator can find it.
    const media = { projectId: target.projectId, path: MEDIA_FILE };
    await seedTextAnnotation(page, media, 'A diagram', 'A diagram');

    await openFile(page, media, 'Media E2E');
    const column = await openAnnotationColumn(page);
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });

    await switchToSource(page);

    // Never echo an annotation the Preview considers Outdated, and never flip
    // the shared column back to Active.
    await expect(page.getByRole('mark')).toHaveCount(0);
    const outdatedPanel = page.getByRole('status', { name: 'Outdated annotations' });
    await expect(outdatedPanel).toBeVisible();
    await expect(outdatedPanel).toContainText('A diagram');
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible();
  });

  test('loads annotations in Source without a Preview visit', async ({ page }) => {
    // `.txt` opens straight into the Source fallback: the rendered Preview
    // never mounts, so SourceView must load and resolve the annotations itself.
    const notes = { projectId: target.projectId, path: TEXT_FILE };
    await seedTextAnnotation(page, notes, 'target quote', 'A plain text sentence with a target quote.');

    await page.goto(
      `/project/${notes.projectId}/files/${encodeURIComponent(notes.path)}`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page.locator('.source-highlighted')).toBeVisible({ timeout: 15000 });

    const marks = page.getByRole('mark');
    await expect(marks).toHaveCount(1);
    await expect(marks.first()).toContainText('target quote');
  });

  test('offers no creation affordances in the Source view', async ({ page }) => {
    await switchToSource(page);

    // No block markers and no selection toolbar exist on the raw source.
    await expect(page.getByRole('button', { name: /Annotate this block/ })).toHaveCount(0);

    await page.evaluate(() => {
      const source = document.querySelector('.source-highlighted');
      if (!source) throw new Error('source view not found');
      const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
      const node = walker.nextNode();
      if (!node || !node.nodeValue) throw new Error('no source text');
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(10, node.nodeValue.length));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    await expect(
      page.getByRole('button', { name: 'Annotate selected text' })
    ).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'New annotation' })).toHaveCount(0);
  });
});
