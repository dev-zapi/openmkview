import { test, expect } from '@playwright/test';

// Empty-state guidance: the welcome screen names the next step with a CTA,
// and opening a project surfaces the file tree with its root expanded.

test.describe('mobile empty states', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('welcome offers an Open a project CTA that opens the dialog', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.welcome h1')).toHaveText('OpenMKView');

    const cta = page.getByRole('button', { name: 'Open a project' });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('welcome text meets 4.5:1 contrast (no opacity wash)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const opacity = await page.locator('.welcome p').evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
  });

  test('opening a project switches the empty state and auto-opens the tree', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open the project from the dialog.
    await page.getByRole('button', { name: 'Open a project' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /openmkview/i }).first().click();

    // The empty state now speaks for the project, with a Browse files CTA.
    await expect(page.locator('.welcome h1')).toHaveText(/openmkview/i);
    await expect(page.getByRole('button', { name: 'Browse files' })).toBeVisible();

    // The drawer auto-opened and the tree root is expanded: README is
    // visible without tapping the root chevron first.
    await expect(page.getByRole('treeitem', { name: /readme/i }).first()).toBeVisible();
  });
});
