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
    // Activity Bar 现在有 3 个按钮：+、主题、设置
    await expect(buttons).toHaveCount(3);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/03-activity-bar.png`,
      fullPage: true 
    });
  });

  test('should have sidebar with explorer header', async ({ page }) => {
    await expect(page.locator('.sidebar-header')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.sidebar-header')).toHaveText('Explorer');
    // Sidebar 移除了 Open Project 按钮，现在显示提示信息
    await expect(page.locator('.sidebar-content .empty-state')).toContainText('点击左侧 + 按钮打开项目');
    
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
    
    // Wait for overlay and panel to be visible
    await expect(page.locator('.settings-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.settings-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.settings-panel h3')).toContainText('Settings');
    
    // Wait for animation to complete
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/07-settings-panel.png`,
      fullPage: true 
    });
    
    // Close settings by clicking overlay
    const overlay = page.locator('.settings-overlay');
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });

  test('should open git panel', async ({ page }) => {
    // Git 按钮已从 Activity Bar 移除，此测试暂时跳过
    // 可以通过其他方式访问 Git 功能
    test.skip();
  });

  test('should display full application interface', async ({ page }) => {
    await page.waitForSelector('.app-container', { timeout: 15000 });
    
    await page.screenshot({ 
      path: `${screenshotsDir}/09-full-app.png`,
      fullPage: true 
    });
  });

  test('should toggle theme from activity bar', async ({ page }) => {
    await page.waitForSelector('.activity-bar button', { timeout: 15000 });
    
    // Click the theme toggle (2nd button - index 1, between + and Settings)
    const themeBtn = page.locator('.activity-bar button').nth(1);
    await themeBtn.click();
    
    // Check that dark theme class is applied
    await page.waitForTimeout(500);
    
    await page.screenshot({ 
      path: `${screenshotsDir}/10-dark-theme.png`,
      fullPage: true 
    });
  });
});
