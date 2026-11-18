import {
  test,
  expect,
  loginIfNeeded,
  createScratchProject,
  removeScratchProject,
  type ScratchProject,
} from './fixtures';
import type { Page } from '@playwright/test';

// Ticket #20: the Source view echoes Anchors as read-only line highlights.
// Best-effort by design; a quote the raw Markdown cannot locate degrades to
// the Outdated badge rather than a wrong line. Serial and isolated: each test
// seeds its own scratch project so parallel agents never share annotation data.

test.describe.configure({ mode: 'serial' });

const FILE_NAME = 'annotations-source-e2e.md';
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

async function openScratch(page: Page, target: ScratchProject): Promise<void> {
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByRole('heading', { name: 'Source Echo E2E' })).toBeVisible({
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

async function saveComposer(page: Page, body: string): Promise<void> {
  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();
}

async function createBlockAnnotation(
  page: Page,
  paragraphText: string,
  body: string
): Promise<void> {
  const paragraph = page.getByRole('paragraph').filter({ hasText: paragraphText });
  await expect(paragraph).toBeVisible();
  await paragraph.hover();
  await paragraph.getByRole('button', { name: /Annotate this block/ }).click();
  await saveComposer(page, body);
}

/** Selects from `startPhrase` through the end of `endPhrase` in Preview. */
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

      const locateBoundary = (offset: number) => {
        let remaining = offset;
        for (const text of nodes) {
          const length = text.nodeValue?.length || 0;
          if (remaining <= length) return { node: text, offset: remaining };
          remaining -= length;
        }
        const last = nodes[nodes.length - 1];
        return { node: last, offset: last.nodeValue?.length || 0 };
      };

      /** Keeps the start inside real content, never a whitespace-only node. */
      const locatePhraseStart = (offset: number) => {
        let remaining = offset;
        for (let index = 0; index < nodes.length; index += 1) {
          const text = nodes[index];
          const length = text.nodeValue?.length || 0;
          if (remaining < length) return { node: text, offset: remaining };
          if (remaining === length) {
            const next = nodes[index + 1];
            if (next && !(text.nodeValue || '').trim()) {
              return { node: next, offset: 0 };
            }
            return { node: text, offset: length };
          }
          remaining -= length;
        }
        const last = nodes[nodes.length - 1];
        return { node: last, offset: last.nodeValue?.length || 0 };
      };

      const startOffset = combined.indexOf(startPhrase);
      if (startOffset === -1) throw new Error(`cannot find phrase: ${startPhrase}`);
      const endSearchFrom =
        endPhrase === startPhrase ? startOffset : startOffset + startPhrase.length;
      const endOffset = combined.indexOf(endPhrase, endSearchFrom);
      if (endOffset === -1) throw new Error(`cannot find phrase: ${endPhrase}`);

      const start = locatePhraseStart(startOffset);
      const end = locateBoundary(endOffset + endPhrase.length);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);

      const selection = window.getSelection();
      if (!selection) throw new Error('no selection');
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    },
    { startPhrase, endPhrase }
  );
}

async function replaceDocumentInEditMode(page: Page, content: string): Promise<void> {
  const header = page.locator('header');
  await header.getByRole('button', { name: 'Edit', exact: true }).click();
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

  await page.locator('header').getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Source Echo E2E' })).toBeVisible();
}

async function openAnnotationColumn(page: Page) {
  await page.getByRole('button', { name: 'Annotation column', exact: true }).first().click();
  const column = page.getByRole('region', { name: 'Annotations' });
  await expect(column).toBeVisible();
  return column;
}

test.describe('source view annotation echo', () => {
  let target: ScratchProject;

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    target = await createScratchProject(page, FILE_NAME, INITIAL_MARKDOWN, 'ann20-source');
    await openScratch(page, target);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchProject(page, target);
  });

  test('highlights the source lines of an annotation created in Preview', async ({ page }) => {
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
    await replaceDocumentInEditMode(page, REWRITTEN_MARKDOWN);
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
});
