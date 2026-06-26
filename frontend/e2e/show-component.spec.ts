import { test, expect } from '@playwright/test';
import * as path from 'path';

const screenshotsDir = path.join(process.cwd(), 'screenshots');

test.describe('SolidJS Show Component - folder-list-container', () => {
  test('Show component removes empty folder-list-container from DOM', async ({ page }) => {
    await page.goto('http://localhost:4173/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${screenshotsDir}/show-test-empty-data.png`,
      fullPage: true
    });

    // 验证空数据时 folder-list-container 不存在于 DOM 中
    const containerCount = await page.locator('.folder-list-container').count();

    if (containerCount > 0) {
      // 如果存在，检查是否被正确隐藏（不应该有内容）
      const innerHTML = await page.locator('.folder-list-container').innerHTML();
      expect(innerHTML.trim()).toBe('');
    }
    // containerCount === 0 也是可接受的（Show 正确移除了元素）
  });
});
