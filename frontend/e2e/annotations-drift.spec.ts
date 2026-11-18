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
async function createSelectionAnnotation(page: Page, body: string): Promise<void> {
  await selectTextRange(page, SURVIVING_QUOTE, SURVIVING_QUOTE);
  const button = page.getByRole('button', { name: 'Annotate selected text' });
  await expect(button).toBeVisible();
  await button.click();
  await saveComposer(page, body);
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
    await createBlockAnnotation(page, DELETED_PARAGRAPH, 'Doomed note');

    await expect(page.locator('mark', { hasText: SURVIVING_QUOTE }).first()).toBeVisible();

    // In-app save after rewording the surviving paragraph and deleting the
    // doomed one. Preview must redraw from the fresh content.
    await replaceDocumentInEditMode(page, REWRITTEN_MARKDOWN, 'Drift Annotation E2E');

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
