import { test, expect } from '@playwright/test';

// Mobile header IA: the filename owns the header (ellipsis + tap for the full
// path); view switching lives in the bottom bar, in the thumb zone.

test.describe('mobile header IA', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page.locator('button[aria-label="Open Project"]').click();
    // Open Project dialog: pick the first project row.
    await page.getByRole('dialog').getByRole('button', { name: /openmkview/i }).first().click();
    await expect(page.locator('.mobile-main-content')).toBeVisible();
    // Open a markdown file from the tree (the root starts collapsed).
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page.getByRole('treeitem').first().click();
    await page.getByRole('treeitem', { name: /readme/i }).first().click();
    await expect(page.getByTestId('mobile-topbar-title')).toHaveText(/readme/i);
  });

  test('header carries the filename only; views are the bottom bar', async ({ page }) => {
    // No text tabs in the header anymore.
    await expect(page.locator('header button', { hasText: 'Preview' })).toHaveCount(0);
    await expect(page.locator('header button', { hasText: 'Diff' })).toHaveCount(0);

    // Bottom view bar with four icon buttons, Preview active.
    const bar = page.locator('nav[aria-label="View"]');
    await expect(bar).toBeVisible();
    for (const name of ['Preview', 'Source', 'Edit', 'Diff']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await expect(bar.getByRole('button', { name: 'Preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('tapping the filename reveals project and full path', async ({ page }) => {
    await page.getByRole('button', { name: 'Show file path' }).click();
    const popover = page.locator('[aria-label="File path"]');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('openmkview');
    await expect(popover.locator('[class*="pathPopoverPath"]')).toContainText('README');

    // Tapping outside closes it.
    await page.locator('.pathPopoverBackdrop, [class*="pathPopoverBackdrop"]').first().click();
    await expect(popover).toHaveCount(0);
  });

  test('switching to Edit from the bottom bar surfaces Save in the header', async ({ page }) => {
    const bar = page.locator('nav[aria-label="View"]');
    await bar.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('header button[title="Save (Ctrl+S)"]')).toBeVisible();
    // And back: the bar still reports the active view.
    await bar.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.locator('header button[title="Save (Ctrl+S)"]')).toHaveCount(0);
  });
});
