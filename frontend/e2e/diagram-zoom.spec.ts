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
    await expect(page.locator('.code-block-wrapper')).toHaveCount(2, { timeout: 15000 });

    // Click toggle button to render diagram
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });

    // Wait for diagram to render
    await expect(page.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });

    // Open the zoom modal by clicking the zoom button
    const zoomBtn = page.locator('.diagram-zoom-btn').first();
    await zoomBtn.click({ force: true });

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

  test('toggle between source and rendered diagram', async ({ page }) => {
    // Wait for the markdown preview
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Initially should show source code
    const firstWrapper = page.locator('.code-block-wrapper').first();
    await expect(firstWrapper.locator('pre.shiki-code-block')).toBeVisible();

    // Click toggle to render diagram
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });

    // Should now show rendered diagram
    await expect(firstWrapper.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });
    await expect(firstWrapper.locator('pre.shiki-code-block')).not.toBeVisible();

    // Click toggle again to go back to source
    await toggleBtn.click({ force: true });

    // Should show source code again
    await expect(firstWrapper.locator('pre.shiki-code-block')).toBeVisible();
    await expect(firstWrapper.locator('.diagram-rendered')).not.toBeVisible();
  });

  test('zoom button hidden in diagram mode', async ({ page }) => {
    // Wait for the markdown preview
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Zoom button should be visible in source mode
    const zoomBtn = page.locator('.diagram-zoom-btn').first();
    await expect(zoomBtn).toBeVisible();

    // Click toggle to render diagram
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });

    // Wait for diagram to render
    await expect(page.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });

    // Zoom button should be hidden in diagram mode
    await expect(zoomBtn).not.toBeVisible();

    // Click toggle again to go back to source
    await toggleBtn.click({ force: true });

    // Zoom button should be visible again
    await expect(zoomBtn).toBeVisible();
  });
});
