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
import type { Page } from '@playwright/test';

// The visibility toggle mutates real backend state (a scratch file plus one
// annotation), so this spec is serial like annotations-block.spec.ts.
test.describe.configure({ mode: 'serial' });

const SCRATCH_MARKDOWN = [
  '# Visibility E2E',
  '',
  'A paragraph for toggling annotations.',
  '',
].join('\n');

const toggleButton = (page: Page, action: 'Hide' | 'Show') =>
  page.getByRole('button', { name: `${action} annotations` });

test.describe('annotation visibility toggle', () => {
  let target: FileTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page, SCRATCH_MARKDOWN, 'annotations-visibility');
    await openScratchFile(page, target, 'Visibility E2E');
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('hides and shows every highlight and marker, and survives reload', async ({ page }) => {
    const paragraph = page.getByText('A paragraph for toggling annotations.', { exact: true });
    await expect(paragraph).toBeVisible();

    // Create one annotation so there is a highlight and a marker to hide.
    await paragraph.hover();
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await marker.click();
    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('Toggle note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // Default state: annotations are visible.
    await expect(marker).toBeVisible();
    await expect(toggleButton(page, 'Hide')).toBeVisible();

    // Toggling off hides the highlight and the marker for pure reading.
    await toggleButton(page, 'Hide').click();
    await expect(toggleButton(page, 'Show')).toBeVisible();
    await expect(marker).toBeHidden();

    // Hidden means hidden: clicking the previously highlighted block must not
    // open the annotation popover.
    await paragraph.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).not.toBeVisible();

    // The preference is client-side and survives a reload.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Visibility E2E' })).toBeVisible({
      timeout: 15000,
    });
    const reloadedParagraph = page.getByText('A paragraph for toggling annotations.', {
      exact: true,
    });
    await expect(toggleButton(page, 'Show')).toBeVisible();
    await expect(
      reloadedParagraph.getByRole('button', { name: /Annotate this block/ })
    ).toBeHidden();

    // Toggling back restores the highlight, the marker, and the popover.
    await toggleButton(page, 'Show').click();
    await expect(toggleButton(page, 'Hide')).toBeVisible();
    await expect(
      reloadedParagraph.getByRole('button', { name: /Annotate this block/ })
    ).toBeVisible();

    await reloadedParagraph.click();
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Toggle note');
  });
});
