import { test, expect } from '@playwright/test';

// The mock server has no /api/themes route (404), which is exactly the
// failure that used to turn the Settings gear into a dead button:
// loadThemes set themes to undefined and themes().filter crashed the panel.

test.describe('mobile settings', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('settings panel survives a themes API failure', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Open the left drawer and start Settings from the activity rail.
  await page.locator('button[aria-label="Toggle navigation menu"]').click();
  const settingsButton = page.locator('button[title="Settings"]');
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();

  const panel = page.locator('.settings-panel');
  await expect(panel).toBeVisible();

  // The panel rendered instead of crashing, and names the problem with a retry.
  await expect(page.locator('.settings-load-error')).toBeVisible();
  await expect(page.locator('.settings-load-error')).toContainText("Couldn't load the theme list");
  await expect(page.locator('.settings-retry')).toBeVisible();

  // Built-in fallback keeps the pickers functional. <option> reports hidden
  // inside a closed <select>, so assert via count instead of visibility.
  const lightOptions = page.locator('#light-theme option');
  await expect(lightOptions).toHaveCount(3);
  await expect(page.locator('#light-theme option[value="light-default"]')).toHaveCount(1);

  // Retry still fails (mock keeps 404) but must not break the panel.
  await page.locator('.settings-retry').click();
  await expect(panel).toBeVisible();
  await expect(page.locator('.settings-load-error')).toBeVisible();

  // The mobile section nav is a visible chip rail, not display:none.
  await expect(page.locator('.settings-nav')).toBeVisible();
  await expect(page.locator('.settings-nav button', { hasText: 'Markdown' })).toBeVisible();

  // Section jump actually scrolls: Markdown chip moves its section into view.
  await page.locator('.settings-nav button', { hasText: 'Markdown' }).click();
  await expect(page.locator('#settings-markdown')).toBeInViewport();
  });
});
