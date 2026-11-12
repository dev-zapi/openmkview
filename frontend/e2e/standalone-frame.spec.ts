import { test, expect, chromium, type Page, type TestInfo } from '@playwright/test';

const frameStyles = (page: Page) =>
  page.locator('.app-container').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      margin: style.margin,
      borderWidth: style.borderTopWidth,
      borderRadius: style.borderRadius,
    };
  });

const launchPersistentPage = async (testInfo: TestInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('browser-profile'), {
    baseURL: testInfo.project.use.baseURL,
    channel: testInfo.project.use.channel,
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  return { context, page: context.pages()[0] ?? await context.newPage() };
};

test('frames only the installed desktop layout', async ({}, testInfo) => {
  const { context, page } = await launchPersistentPage(testInfo);

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-container')).toBeVisible();
    await expect.poll(() => frameStyles(page)).toEqual({
      margin: '0px',
      borderWidth: '0px',
      borderRadius: '0px',
    });
    await page.screenshot({ path: testInfo.outputPath('browser-light.png'), animations: 'disabled' });

    const manifestId = page.url();
    const session = await page.context().newCDPSession(page);
    await session.send('PWA.install', { manifestId });
    await session.send('PWA.changeAppUserSettings', { manifestId, displayMode: 'standalone' });
    const [appPage] = await Promise.all([
      page.context().waitForEvent('page'),
      session.send('PWA.launch', { manifestId }),
    ]);
    await appPage.waitForLoadState('domcontentloaded');
    await expect(appPage.locator('.app-container')).toBeVisible();
    await expect.poll(() => appPage.evaluate(() => matchMedia('(display-mode: standalone)').matches)).toBe(true);
    await expect.poll(() => frameStyles(appPage)).toEqual({
      margin: '6px',
      borderWidth: '1px',
      borderRadius: '8px',
    });
    await expect(appPage.locator('#root')).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    const appBounds = await appPage.locator('.app-container').boundingBox();
    const settingsBounds = await appPage.locator('.activity-bar button[title="Settings"]').boundingBox();
    expect(appBounds).not.toBeNull();
    expect(settingsBounds).not.toBeNull();
    expect(appBounds!.x).toBe(6);
    expect(appBounds!.y).toBe(6);
    expect(appBounds!.width).toBe(1268);
    expect(appBounds!.height).toBe(788);
    expect(settingsBounds!.y + settingsBounds!.height).toBeLessThanOrEqual(appBounds!.y + appBounds!.height);
    await appPage.locator('.activity-bar-projects button').first().click();
    await expect(appPage.locator('.sidebar')).toBeVisible();
    await appPage.screenshot({ path: testInfo.outputPath('standalone-light.png'), animations: 'disabled' });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await appPage.locator('html').evaluate((element) => element.classList.contains('dark-theme'))) break;
      await appPage.locator('.activity-bar button[title^="Theme:"]').click();
    }
    await expect(appPage.locator('html')).toHaveClass(/dark-theme/);
    await expect(appPage.locator('#root')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
    await appPage.waitForTimeout(350);
    await appPage.screenshot({ path: testInfo.outputPath('standalone-dark.png'), animations: 'disabled' });

    await appPage.setViewportSize({ width: 390, height: 844 });
    await expect(appPage.locator('.mobile-main-content')).toBeVisible();
    await expect(appPage.locator('.app-container')).toHaveCount(0);
    await expect(appPage.locator('#root')).toHaveCSS('padding', '0px');

    await expect.poll(() => frameStyles(page)).toEqual({
      margin: '0px',
      borderWidth: '0px',
      borderRadius: '0px',
    });
    await session.send('PWA.uninstall', { manifestId });
  } finally {
    await context.close();
  }
});
