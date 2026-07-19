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

    // Default is rendered diagram mode; zoom button is visible.
    const zoomBtn = page.locator('.diagram-zoom-btn').first();
    await expect(zoomBtn).toBeVisible();

    // Open the zoom modal by clicking the zoom button
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

    // Initially should show rendered diagram (default mode)
    const firstWrapper = page.locator('.code-block-wrapper').first();
    await expect(firstWrapper.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });
    await expect(firstWrapper.locator('pre')).not.toBeVisible();

    // Click toggle to switch to source code
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });

    // Should now show source code
    await expect(firstWrapper.locator('pre')).toBeVisible({ timeout: 5000 });
    await expect(firstWrapper.locator('.diagram-rendered')).not.toBeVisible();

    // Click toggle again to go back to rendered diagram
    await toggleBtn.click({ force: true });

    // Should show rendered diagram again
    await expect(firstWrapper.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });
    await expect(firstWrapper.locator('pre')).not.toBeVisible();
  });

  test('zoom button visible in rendered diagram mode', async ({ page }) => {
    // Wait for the markdown preview
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Initially in render mode, zoom button should be visible
    const zoomBtn = page.locator('.diagram-zoom-btn').first();
    await expect(zoomBtn).toBeVisible();

    // Toggle button should also be visible
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await expect(toggleBtn).toBeVisible();

    // Click toggle to switch to source mode
    await toggleBtn.click({ force: true });

    // Wait for source code to show
    await expect(page.locator('pre')).toBeVisible({ timeout: 5000 });

    // Zoom button should be hidden in source mode
    await expect(zoomBtn).not.toBeVisible();

    // Toggle button should still be visible in source mode
    await expect(toggleBtn).toBeVisible();

    // Click toggle again to go back to rendered diagram
    await toggleBtn.click({ force: true });

    // Zoom button should be visible again in rendered mode
    await expect(zoomBtn).toBeVisible();
  });

  test('toggle button shows correct icon in each mode', async ({ page }) => {
    // Wait for the markdown preview
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    const iconSource = page.locator('.diagram-toggle-btn .icon-source').first();
    const iconRender = page.locator('.diagram-toggle-btn .icon-render').first();

    // In render mode: source icon visible, render icon hidden
    await expect(iconSource).toBeVisible();
    await expect(iconRender).not.toBeVisible();

    // Toggle to source mode
    await toggleBtn.click({ force: true });
    await expect(page.locator('pre')).toBeVisible({ timeout: 5000 });

    // In source mode: render icon visible, source icon hidden
    await expect(iconRender).toBeVisible();
    await expect(iconSource).not.toBeVisible();

    // Toggle back to render mode
    await toggleBtn.click({ force: true });
    await expect(page.locator('.diagram-rendered')).toBeVisible({ timeout: 15000 });

    // Back in render mode: source icon visible, render icon hidden
    await expect(iconSource).toBeVisible();
    await expect(iconRender).not.toBeVisible();
  });

  test('non-diagram code blocks do not render zoom or toggle buttons', async ({ page }) => {
    // Navigate to a page with regular code blocks
    await page.goto('/project/1/files/%2FREADME.md');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Wait for code blocks to render
    await expect(page.locator('pre[data-lang]')).toHaveCount(await page.locator('pre[data-lang]').count(), { timeout: 10000 });

    // Non-diagram code blocks should not have toggle/zoom buttons in the DOM
    await expect(page.locator('.diagram-toggle-btn')).toHaveCount(0);
    await expect(page.locator('.diagram-zoom-btn')).toHaveCount(0);
    await expect(page.locator('.code-block-wrapper')).toHaveCount(0);

    // Verify regular code blocks exist with correct structure
    const allPre = page.locator('pre[data-lang]');
    const count = await allPre.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const pre = allPre.nth(i);
      const lang = await pre.getAttribute('data-lang');

      // None of these should be diagram languages
      expect(lang).not.toBe('mermaid');
      expect(lang).not.toBe('plantuml');

      // Should not be inside a .code-block-wrapper
      const parent = pre.locator('xpath=..');
      const parentClass = await parent.getAttribute('class');
      expect(parentClass || '').not.toContain('code-block-wrapper');
    }
  });
});
