import { test, expect } from '@playwright/test';
import * as path from 'path';

const screenshotsDir = path.join(process.cwd(), 'screenshots');

test.describe('OpenMKView E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display main layout', async ({ page }) => {
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.activity-bar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();
    
    await page.screenshot({ 
      path: `${screenshotsDir}/01-main-layout.png`,
      fullPage: true 
    });
  });

  test('should display welcome message', async ({ page }) => {
    await expect(page.locator('.welcome h1')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.welcome h1')).toHaveText('OpenMKView');
    await expect(page.locator('.welcome p')).toContainText('Open Project');
    
    await page.screenshot({ 
      path: `${screenshotsDir}/02-welcome-message.png`,
      fullPage: true 
    });
  });

  test('should have activity bar buttons', async ({ page }) => {
    await page.waitForSelector('.activity-bar button', { timeout: 15000 });
    const buttons = page.locator('.activity-bar button');
    await expect(buttons).toHaveCount(3);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/03-activity-bar.png`,
      fullPage: true 
    });
  });

  test('should have sidebar with explorer header', async ({ page }) => {
    await expect(page.locator('.sidebar-header')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.sidebar-header')).toHaveText('Explorer');
    await expect(page.locator('.btn')).toContainText('Open Project');
    
    await page.screenshot({ 
      path: `${screenshotsDir}/04-sidebar.png`,
      fullPage: true 
    });
  });

  test('should have tabs in main area', async ({ page }) => {
    await page.waitForSelector('.tab', { timeout: 15000 });
    const tabs = page.locator('.tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveText('Preview');
    await expect(tabs.nth(1)).toHaveText('Diff');
    await expect(tabs.nth(2)).toHaveText('Source');
  });

  test('should switch to source tab', async ({ page }) => {
    await page.waitForSelector('.tab', { timeout: 15000 });
    const sourceTab = page.locator('.tab').nth(2);
    await sourceTab.click();
    await expect(sourceTab).toHaveClass(/active/);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/05-source-tab.png`,
      fullPage: true 
    });
  });

  test('should switch to diff tab', async ({ page }) => {
    await page.waitForSelector('.tab', { timeout: 15000 });
    const diffTab = page.locator('.tab').nth(1);
    await diffTab.click();
    await expect(diffTab).toHaveClass(/active/);
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/06-diff-tab.png`,
      fullPage: true 
    });
  });

  test('should open settings panel', async ({ page }) => {
    const settingsBtn = page.locator('.activity-bar button[title="Settings"]');
    await settingsBtn.click();
    
    await expect(page.locator('.settings-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.settings-panel h3')).toContainText('Settings');
    
    await page.screenshot({ 
      path: `${screenshotsDir}/07-settings-panel.png`,
      fullPage: true 
    });
    
    // Close settings
    const closeBtn = page.locator('.settings-panel .close-btn');
    await closeBtn.click();
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });

  test('should open git panel', async ({ page }) => {
    const gitBtn = page.locator('.activity-bar button[title="Git"]');
    await gitBtn.click();
    
    await expect(page.locator('.git-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.git-panel h3')).toContainText('Git');
    
    await page.screenshot({ 
      path: `${screenshotsDir}/08-git-panel.png`,
      fullPage: true 
    });
    
    // Close git panel
    const closeBtn = page.locator('.git-panel .close-btn');
    await closeBtn.click();
    await expect(page.locator('.git-panel')).not.toBeVisible();
  });

  test('should display full application interface', async ({ page }) => {
    await page.waitForSelector('.app-container', { timeout: 15000 });
    
    await page.screenshot({ 
      path: `${screenshotsDir}/09-full-app.png`,
      fullPage: true 
    });
  });
});
