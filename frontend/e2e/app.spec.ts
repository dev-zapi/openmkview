import { test, expect } from '@playwright/test';

test.describe('OpenMKView E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display main layout', async ({ page }) => {
    await expect(page.locator('.app-container')).toBeVisible();
    await expect(page.locator('.activity-bar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();
  });

  test('should display welcome message', async ({ page }) => {
    await expect(page.locator('.welcome h1')).toHaveText('OpenMKView');
    await expect(page.locator('.welcome p')).toContainText('Open Project');
  });

  test('should have activity bar buttons', async ({ page }) => {
    const buttons = page.locator('.activity-bar button');
    await expect(buttons).toHaveCount(4);
  });

  test('should have sidebar with explorer header', async ({ page }) => {
    await expect(page.locator('.sidebar-header')).toHaveText('Explorer');
    await expect(page.locator('.btn')).toHaveText('Open Project');
  });

  test('should have tabs in main area', async ({ page }) => {
    const tabs = page.locator('.tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveText('Preview');
    await expect(tabs.nth(1)).toHaveText('Diff');
    await expect(tabs.nth(2)).toHaveText('Source');
  });

  test('should switch tabs', async ({ page }) => {
    const diffTab = page.locator('.tab').nth(1);
    await diffTab.click();
    await expect(page.locator('.diff-selector')).toBeVisible();
  });
});
