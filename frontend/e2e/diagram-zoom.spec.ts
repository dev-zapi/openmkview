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

    // Default is rendered diagram mode; zoom button is hidden.
    // Switch to source mode to access the zoom button.
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });
    await expect(page.locator('pre')).toBeVisible({ timeout: 5000 });

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

  test('zoom button hidden in diagram mode', async ({ page }) => {
    // Wait for the markdown preview
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Initially in render mode, zoom button should be hidden
    const zoomBtn = page.locator('.diagram-zoom-btn').first();
    await expect(zoomBtn).not.toBeVisible();

    // Click toggle to switch to source mode
    const toggleBtn = page.locator('.diagram-toggle-btn').first();
    await toggleBtn.click({ force: true });

    // Wait for source code to show
    await expect(page.locator('pre')).toBeVisible({ timeout: 5000 });

    // Zoom button should be visible in source mode
    await expect(zoomBtn).toBeVisible();

    // Click toggle again to go back to rendered diagram
    await toggleBtn.click({ force: true });

    // Zoom button should be hidden again in diagram mode
    await expect(zoomBtn).not.toBeVisible();
  });

  test('regular code blocks show source without toggle buttons', async ({ page }) => {
    // Navigate to a page with regular code blocks
    await page.goto('/project/1/files/%2Fdocs%2Fdiagrams.md');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    // Regular code blocks (non-diagram) should not have toggle/zoom buttons
    // and should not be wrapped in .code-block-wrapper
    const allPre = page.locator('pre[data-lang]');
    const count = await allPre.count();

    for (let i = 0; i < count; i++) {
      const pre = allPre.nth(i);
      const lang = await pre.getAttribute('data-lang');

      if (lang !== 'mermaid' && lang !== 'plantuml') {
        // Regular code block - should not be inside a .code-block-wrapper
        const parent = pre.locator('xpath=..');
        const parentClass = await parent.getAttribute('class');
        expect(parentClass || '').not.toContain('code-block-wrapper');

        // No diagram elements near this code block
        await expect(pre.locator('.diagram-toggle-btn')).not.toBeVisible();
        await expect(pre.locator('.diagram-zoom-btn')).not.toBeVisible();
        await expect(pre.locator('.diagram-rendered')).not.toBeVisible();
      }
    }
  });
});
