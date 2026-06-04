import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test('mobile menu positioning', async ({ page }) => {
  await page.goto('http://localhost:4567');
  await page.waitForLoadState('networkidle');
  
  // Take initial screenshot
  await page.screenshot({ path: '/tmp/mobile_initial.png' });
  
  // Wait for any initial animations
  await page.waitForTimeout(1000);
  
  // Look for the project menu trigger in top bar
  const projectMenuTrigger = page.locator('[class*="topBarProjectName"]');
  
  if (await projectMenuTrigger.count() > 0) {
    // Click to open menu
    await projectMenuTrigger.click();
    await page.waitForTimeout(500);
    
    // Take screenshot with menu open
    await page.screenshot({ path: '/tmp/mobile_menu_open.png' });
    
    // Check if the menu sheet exists
    const menuSheet = page.locator('[class*="projectMenuSheet"]');
    await expect(menuSheet).toBeVisible();
    
    // Get the position of the menu
    const box = await menuSheet.boundingBox();
    if (box) {
      console.log(`Menu position: top=${box.y}, left=${box.x}`);
    }
  } else {
    console.log('No project menu trigger found - no project open?');
    
    // List all buttons for debugging
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const cls = await btn.getAttribute('class');
      console.log(`Button class: ${cls}`);
    }
  }
});