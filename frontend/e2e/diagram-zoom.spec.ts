import { test, expect } from './fixtures';

test.describe('Diagram zoom in markdown preview', () => {
  test.beforeEach(async ({ page }) => {
    // Use the mock dev server (project id 1 = openmkview).
    // The file path must include the leading slash used by the mock file tree.
    await page.goto('/project/1/files/%2Fdocs%2Fdiagrams.md');
    await page.waitForLoadState('domcontentloaded');
  });

  test('opens zoom modal from a rendered mermaid diagram', async ({ page }) => {
    // Wait for the markdown preview and the rendered diagram
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.diagram-placeholder')).toHaveCount(2, { timeout: 15000 });

    // Open the zoom modal by clicking the zoom trigger on the first diagram
    const zoomTrigger = page.locator('.diagram-zoom-trigger').first();
    await zoomTrigger.click({ force: true });

    const overlay = page.locator('.diagram-zoom-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.diagram-zoom-transform svg')).toBeVisible();

    // Zoom in and assert the scale changes
    const scaleLabel = page.locator('.diagram-zoom-scale');
    await expect(scaleLabel).toHaveText('100%');
    await page.locator('[aria-label="放大"]').click();
    await expect(scaleLabel).not.toHaveText('100%');

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });
});
