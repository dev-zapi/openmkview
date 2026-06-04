import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test('mobile menu positioning', async ({ page, context }) => {
  // Clear cache
  await context.clearCookies();
  
  // Force no cache
  await page.route('**', async route => {
    const headers = {
      ...route.request().headers(),
      'Cache-Control': 'no-cache',
    };
    await route.continue({ headers });
  });
  
  await page.goto('http://localhost:4567', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Login
  const usernameInput = page.locator('input[type="text"]').first();
  const passwordInput = page.locator('input[type="password"]').first();
  
  if (await usernameInput.isVisible()) {
    await usernameInput.fill('test');
    await passwordInput.fill('test');
    await page.locator('button').first().click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
  }
  
  await page.waitForTimeout(1000);
  
  // Open drawer
  await page.locator('[class*="menuButton"]').first().click();
  await page.waitForTimeout(500);
  
  // Click first project
  await page.locator('[class*="activityBarButton"]').first().click();
  await page.waitForTimeout(1000);
  
  // Open project menu
  const projectMenuButton = page.locator('[class*="sidebarHeaderMenuButton"]');
  if (await projectMenuButton.count() > 0) {
    await projectMenuButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/mobile_menu_test.png' });
    
    // Check computed styles
    const menuOverlay = page.locator('[class*="projectMenuOverlay"]');
    const styles = await menuOverlay.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        paddingTop: style.paddingTop,
        className: el.className,
        cssVariable: el.style.getPropertyValue('--mobile-menu-offset'),
      };
    });
    console.log('Styles:', JSON.stringify(styles));
    
    // The padding-top should be 120px
    const expectedPadding = '120px';
    console.log(`Expected padding: ${expectedPadding}, Actual: ${styles.paddingTop}`);
    
    // Check sheet position
    const menuSheet = page.locator('[class*="projectMenuSheet"]');
    const box = await menuSheet.boundingBox();
    console.log(`Sheet y position: ${box?.y}`);
    
    // Expected y position should be around 136px (120px padding + 16px regular padding)
    expect(box?.y).toBeGreaterThan(100);
  }
});