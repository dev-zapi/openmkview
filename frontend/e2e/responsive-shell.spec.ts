import { test, expect } from '@playwright/test';

// The shell switch must agree with the CSS gate in index.css
// (`(max-width: 768px), (max-height: 500px) and (pointer: coarse)`).
// 768px itself is mobile: the CSS mobile block already hides the desktop
// activity bar and sidebar there, so a desktop shell at exactly 768px is a
// dead end with no way to open a project.

test('767px portrait phone gets the mobile shell', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.mobile-main-content')).toBeVisible();
  await expect(page.locator('.app-container')).toHaveCount(0);
});

test('exactly 768px gets the mobile shell with a project entry point', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.mobile-main-content')).toBeVisible();
  await expect(page.locator('.app-container')).toHaveCount(0);
  // Regression: at 768px the desktop activity bar/sidebar are display:none,
  // so the hamburger menu button must be reachable.
  await expect(page.locator('button[aria-label="Toggle navigation menu"]')).toBeVisible();
});

test('769px gets the desktop shell', async ({ page }) => {
  await page.setViewportSize({ width: 769, height: 1024 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-container')).toBeVisible();
  await expect(page.locator('.mobile-main-content')).toHaveCount(0);
});

test.describe('landscape phone (844x390, touch)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('rotated phone gets the mobile shell, not the desktop three-column', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Self-verify the coarse-pointer arm the layout switch relies on.
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await expect(page.locator('.mobile-main-content')).toBeVisible();
    await expect(page.locator('.app-container')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Toggle navigation menu"]')).toBeVisible();
  });
});
