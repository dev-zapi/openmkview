import {
  test,
  expect,
  loginIfNeeded,
  waitForDesktopApp,
  createScratchFile,
  openScratchFile,
  removeScratchFile,
  createBlockAnnotation,
  replaceDocumentInEditMode,
  openAnnotationColumn,
  type FileTarget,
} from './fixtures';
import type { Page } from '@playwright/test';

// Ticket #25: Edit Mode echoes resolved Anchors as read-only line decorations.
// It is the Edit analogue of the Source echo: no creation/editing affordances,
// Outdated Anchors paint nothing, and the decorations stack with Paragraph
// Focus instead of replacing its dimming. Serial and isolated through a
// per-test scratch file, matching the other annotation specs.

test.describe.configure({ mode: 'serial' });

const PARAGRAPH_ONE = 'The quick brown fox lives in the first paragraph.';
const PARAGRAPH_TWO = 'A second paragraph carries a different thought.';
const PARAGRAPH_THREE = 'The final paragraph closes the argument.';

const INITIAL_MARKDOWN = [
  '# Edit Echo E2E',
  '',
  PARAGRAPH_ONE,
  '',
  PARAGRAPH_TWO,
  '',
  PARAGRAPH_THREE,
  '',
].join('\n');

const REWRITTEN_MARKDOWN = [
  '# Edit Echo E2E',
  '',
  PARAGRAPH_ONE,
  '',
  PARAGRAPH_THREE,
  '',
].join('\n');

async function openAnnotatableFile(page: Page, target: FileTarget): Promise<void> {
  await openScratchFile(page, target, 'Edit Echo E2E');
  // Preview assigns block markers on its next render pass; wait for them so
  // the creation helpers never race the annotation pass.
  await expect(
    page.getByRole('button', { name: /Annotate this block/ }).first(),
  ).toBeAttached({ timeout: 15000 });
}

async function switchToTab(page: Page, tab: 'Edit' | 'Preview'): Promise<void> {
  await page.locator('header').getByRole('button', { name: tab, exact: true }).click();
}

async function switchToEdit(page: Page): Promise<void> {
  await switchToTab(page, 'Edit');
  await expect(page.locator('.editor-status-bar')).toBeVisible();
}

/** The CodeMirror line whose text matches exactly. */
function editorLine(page: Page, text: string) {
  return page.locator('.cm-line').filter({ hasText: text });
}

test.describe('edit mode annotation echo', () => {
  let target: FileTarget;

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);
    target = await createScratchFile(page, INITIAL_MARKDOWN, 'ann25-edit');
    await openAnnotatableFile(page, target);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('shows a read-only highlight for a Preview-created annotation', async ({
    page,
  }) => {
    await createBlockAnnotation(page, PARAGRAPH_ONE, 'Edit echo note');
    await expect(
      page.getByRole('paragraph').filter({ hasText: PARAGRAPH_ONE }),
    ).toHaveClass(/annotation-highlighted/, { timeout: 15000 });

    await switchToEdit(page);

    const mark = page.getByRole('mark');
    await expect(mark).toHaveCount(1);
    await expect(mark.first()).toContainText(PARAGRAPH_ONE);
    await expect(mark.first()).toHaveAttribute(
      'aria-label',
      'Annotated: The quick brown fox lives in the first paragraph.',
    );

    // Edit Mode offers no annotation creation or editing affordances.
    await expect(
      page.getByRole('button', { name: /Annotate this block/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Annotate selected text' }),
    ).toHaveCount(0);

    // The reading-mode toggle drives the echo like every other surface.
    await page.getByRole('button', { name: 'Hide annotations' }).click();
    await expect(page.getByRole('mark')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show annotations' }).click();
    await expect(page.getByRole('mark')).toHaveCount(1);
  });

  test('keeps the echo visible while Paragraph Focus dims its block', async ({
    page,
  }) => {
    await createBlockAnnotation(page, PARAGRAPH_TWO, 'Coexistence note');

    await switchToEdit(page);
    await page.getByRole('button', { name: 'Writing' }).click();
    const focus = page.getByRole('button', { name: 'Focus' });
    await expect(focus).toHaveAttribute('aria-pressed', 'true');

    // The caret starts in the heading block, so the annotated second
    // paragraph is dimmed. Both decoration layers are on the same line.
    const annotated = editorLine(page, PARAGRAPH_TWO);
    await expect(annotated).toHaveCount(1);
    await expect(annotated).toHaveClass(/cm-focus-dim/);
    await expect(annotated).toHaveClass(/cm-annotation-line/);
    await expect(page.getByRole('mark')).toHaveCount(1);
    await expect(editorLine(page, '# Edit Echo E2E')).toHaveClass(/cm-focus-active/);

    // Neither feature disables the other: the block still recedes, but the
    // annotation line stays more legible than an unmarked dimmed block.
    const opacity = (text: string) =>
      page.evaluate((lineText) => {
        const line = Array.from(document.querySelectorAll('.cm-line')).find(
          (candidate) => candidate.textContent === lineText,
        );
        return line ? parseFloat(getComputedStyle(line).opacity) : null;
      }, text);
    await expect.poll(() => opacity(PARAGRAPH_TWO)).toBeGreaterThan(0.4);
    await expect.poll(() => opacity(PARAGRAPH_THREE)).toBeLessThan(0.4);
    await expect.poll(() => opacity(PARAGRAPH_TWO)).toBeLessThan(0.9);

    // Turning Paragraph Focus off leaves the annotation echo in place.
    await focus.click();
    await expect(annotated).not.toHaveClass(/cm-focus-dim/);
    await expect(annotated).toHaveClass(/cm-annotation-line/);
    await expect(page.getByRole('mark')).toHaveCount(1);
  });

  test('renders no decoration for an Outdated anchor', async ({ page }) => {
    const column = await openAnnotationColumn(page);
    await createBlockAnnotation(page, PARAGRAPH_TWO, 'Doomed edit note');

    // Removing the anchored paragraph makes the Anchor Outdated in Preview.
    await replaceDocumentInEditMode(page, REWRITTEN_MARKDOWN, 'Edit Echo E2E');
    await expect(column.getByText('Outdated', { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });

    await switchToEdit(page);

    await expect(page.locator('.cm-annotation-line')).toHaveCount(0);
    await expect(page.getByRole('mark')).toHaveCount(0);
    // The other paragraph is not mistakenly decorated either.
    await expect(editorLine(page, PARAGRAPH_ONE)).toHaveCount(1);
    await expect(editorLine(page, PARAGRAPH_ONE)).not.toHaveClass(/cm-annotation-line/);
  });
});
