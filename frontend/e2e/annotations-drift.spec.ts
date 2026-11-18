import {
  test,
  expect,
  loginIfNeeded,
  createScratchProject,
  removeScratchProject,
  type ScratchProject,
} from './fixtures';
import type { Page } from '@playwright/test';

// Ticket #19: document drift. An in-app Edit Mode save re-resolves every
// Anchor: a surviving quote keeps its highlight, a deleted block becomes
// Outdated (badge + snapshot, no highlight), and manual re-anchoring revives
// it against a freshly selected range. Serial because it mutates the backend;
// an isolated scratch project keeps parallel agents apart.

test.describe.configure({ mode: 'serial' });

const FILE_NAME = 'annotations-drift-e2e.md';
const SURVIVING_QUOTE = 'quick brown fox';
const DELETED_PARAGRAPH = 'A paragraph that will be deleted entirely.';
const DESTINATION_QUOTE = 'fresh destination paragraph';

const INITIAL_MARKDOWN = [
  '# Drift Annotation E2E',
  '',
  'The quick brown fox jumps over the lazy dog.',
  '',
  DELETED_PARAGRAPH,
  '',
  'A fresh destination paragraph for re-anchoring.',
  '',
].join('\n');

const REWRITTEN_MARKDOWN = [
  '# Drift Annotation E2E',
  '',
  'Today, the quick brown fox jumps over the lazy dog again.',
  '',
  'A fresh destination paragraph for re-anchoring.',
  '',
].join('\n');

async function openScratchProject(page: Page, target: ScratchProject): Promise<void> {
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByRole('heading', { name: 'Drift Annotation E2E' })).toBeVisible({
    timeout: 15000,
  });
}

/** Selects from `startPhrase` through the end of `endPhrase`. */
async function selectTextRange(
  page: Page,
  startPhrase: string,
  endPhrase: string
): Promise<void> {
  await page.evaluate(
    ({ startPhrase, endPhrase }) => {
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

      const locate = (phrase: string, from: number) => {
        const offset = combined.indexOf(phrase, from);
        if (offset === -1) {
          throw new Error(`cannot find phrase: ${phrase} in ${combined.slice(0, 300)}`);
        }
        let remaining = offset;
        for (const text of nodes) {
          const length = text.nodeValue?.length || 0;
          if (remaining <= length) return { node: text, offset: remaining };
          remaining -= length;
        }
        throw new Error(`cannot map phrase: ${phrase}`);
      };

      const startOffset = combined.indexOf(startPhrase);
      const start = locate(startPhrase, 0);
      const endSearchFrom =
        endPhrase === startPhrase ? startOffset : startOffset + startPhrase.length;
      const end = locate(endPhrase, endSearchFrom);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + endPhrase.length);

      const selection = window.getSelection();
      if (!selection) throw new Error('no selection');
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    },
    { startPhrase, endPhrase }
  );
}

async function saveComposer(page: Page, body: string): Promise<void> {
  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();
}

async function createSelectionAnnotation(page: Page, body: string): Promise<void> {
  await selectTextRange(page, SURVIVING_QUOTE, SURVIVING_QUOTE);
  const button = page.getByRole('button', { name: 'Annotate selected text' });
  await expect(button).toBeVisible();
  await button.click();
  await saveComposer(page, body);
}

async function createBlockAnnotation(page: Page, body: string): Promise<void> {
  const paragraph = page.getByRole('paragraph').filter({ hasText: DELETED_PARAGRAPH });
  await expect(paragraph).toBeVisible();
  await paragraph.hover();
  const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
  await marker.click();
  await saveComposer(page, body);
}

/** Saves a whole new document body through Edit Mode. */
async function replaceDocumentInEditMode(page: Page, content: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.editor-status-bar')).toBeVisible();

  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(content);

  const saveButton = page.locator('button[title="Save (Ctrl+S)"]').first();
  await expect(saveButton).toBeEnabled({ timeout: 10000 });

  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/api/files/content') &&
      response.request().method() === 'PUT'
  );
  await saveButton.click();
  await saved;

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Drift Annotation E2E' })).toBeVisible();
}

async function openAnnotationColumn(page: Page) {
  await page.getByRole('button', { name: 'Annotation column', exact: true }).first().click();
  const column = page.getByRole('region', { name: 'Annotations' });
  await expect(column).toBeVisible();
  return column;
}

test.describe('document drift', () => {
  let target: ScratchProject;

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    target = await createScratchProject(page, FILE_NAME, INITIAL_MARKDOWN, 'ann19-drift');
    await openScratchProject(page, target);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchProject(page, target);
  });

  test('edit save re-resolves anchors, badges Outdated, and re-anchors', async ({ page }) => {
    await createSelectionAnnotation(page, 'Survivor note');
    await createBlockAnnotation(page, 'Doomed note');

    await expect(page.locator('mark', { hasText: SURVIVING_QUOTE }).first()).toBeVisible();

    // In-app save after rewording the surviving paragraph and deleting the
    // doomed one. Preview must redraw from the fresh content.
    await replaceDocumentInEditMode(page, REWRITTEN_MARKDOWN);

    // Fuzzy match: the stored quote still resolves inside reworded text.
    const survivorHighlight = page.locator('mark', { hasText: SURVIVING_QUOTE });
    await expect(survivorHighlight.first()).toBeVisible({ timeout: 15000 });

    // The deleted paragraph is gone; its annotation must be Outdated, never
    // silently re-attached to nearby text.
    await expect(
      page.getByRole('paragraph').filter({ hasText: DELETED_PARAGRAPH })
    ).toHaveCount(0);
    await expect(page.locator('mark', { hasText: DELETED_PARAGRAPH })).toHaveCount(0);

    const column = await openAnnotationColumn(page);
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible();
    await expect(
      column.getByText(DELETED_PARAGRAPH, { exact: false }).first()
    ).toBeVisible();
    await expect(column.getByText('Doomed note')).toBeVisible();

    // Hiding highlights is a reading-mode preference only: the independent
    // column must keep reporting Outdated status.
    await page.getByRole('button', { name: 'Hide annotations' }).click();
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Show annotations' }).click();

    // An Outdated annotation has no highlight to click; its column entry
    // opens the viewer with the snapshot and the Re-anchor action.
    await column.getByRole('button', { name: /Open outdated annotation/ }).click();
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText('Outdated', { exact: true }).first()).toBeVisible();
    await expect(viewer.getByText('Originally anchored text')).toBeVisible();
    await expect(
      viewer.getByText(DELETED_PARAGRAPH, { exact: false }).first()
    ).toBeVisible();

    // Re-anchor the Outdated annotation to the fresh destination paragraph.
    await viewer.getByRole('button', { name: 'Re-anchor' }).click();
    await expect(viewer).not.toBeVisible();
    await selectTextRange(page, DESTINATION_QUOTE, DESTINATION_QUOTE);

    const reanchorButton = page.getByRole('button', {
      name: 'Re-anchor annotation to selected text',
    });
    await expect(reanchorButton).toBeVisible();

    const reanchored = page.waitForResponse(
      (response) =>
        /\/api\/annotations\/\d+\/anchor$/.test(response.url()) &&
        response.request().method() === 'PUT'
    );
    await reanchorButton.click();
    await reanchored;

    // The annotation revives at the newly selected text and the badge clears.
    await expect(
      page.locator('mark', { hasText: DESTINATION_QUOTE }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(column.getByText('Outdated', { exact: true })).toHaveCount(0);
    await expect(column.getByText('Doomed note')).toBeVisible();

    // The revived anchor survives a reload (re-resolved on load).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchProject(page, target);
    await expect(
      page.locator('mark', { hasText: DESTINATION_QUOTE }).first()
    ).toBeVisible({ timeout: 15000 });

    const reloadedColumn = await openAnnotationColumn(page);
    await expect(reloadedColumn.getByText('Outdated', { exact: true })).toHaveCount(0);
  });
});
