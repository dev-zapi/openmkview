import { test, expect } from '@playwright/test';

// 44px minimum touch targets on the mobile shell (iOS HIG / Android 48dp
// ballpark). Measures rendered geometry, not CSS declarations.

test.describe('mobile touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open a project' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /openmkview/i }).first().click();
    await page.getByRole('treeitem', { name: /readme/i }).first().click();
    await expect(page.getByTestId('mobile-topbar-title')).toHaveText(/readme/i);
  });

  test('header, view bar, rail, and tree rows are at least 44px', async ({ page }) => {
    const measure = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });

    expect(await measure('button[aria-label="Toggle navigation menu"]')).toEqual({ w: 44, h: 44 });
    const fileNameButton = await measure('button[aria-label="Show file path"]');
    expect(fileNameButton.h).toBeGreaterThanOrEqual(44);
    expect(await measure('button[aria-label="More actions"]')).toEqual({ w: 44, h: 44 });
    expect(await measure('nav[aria-label="View"] button')).toEqual({ w: expect.any(Number), h: 44 });

    // Tree rows live in the Pierre shadow DOM, inside the (currently closed) drawer.
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    const rowHeight = await page.evaluate(() => {
      const host = document.querySelector('.pierre-file-tree-host');
      const row = host?.shadowRoot?.querySelector('[role="treeitem"]');
      return row ? Math.round(row.getBoundingClientRect().height) : 0;
    });
    expect(rowHeight).toBeGreaterThanOrEqual(44);
  });

  test('drawer rail buttons are 44px', async ({ page }) => {
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    const rail = page.locator('button[aria-label="Open Project"]');
    await expect(rail).toBeVisible();
    const box = await rail.boundingBox();
    expect(box?.width).toBe(44);
    expect(box?.height).toBe(44);
  });

  test('code block copy button is at least 44px tall', async ({ page }) => {
    const copy = page.locator('.copy-button').first();
    await expect(copy).toBeVisible();
    const box = await copy.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('mobile activity bar geometry', () => {
  test.use({ viewport: { width: 440, height: 956 } });

  test('project buttons are not clipped by the scroll container', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Toggle navigation menu' }).click();

    const projects = page.locator('[class*="activityBarProjects"]');
    await expect(projects.getByRole('button').first()).toBeVisible();
    const clippedTitles = await projects.evaluate((container) => {
      const clip = container.getBoundingClientRect();
      return Array.from(container.querySelectorAll('button[title]'))
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.left < clip.left || rect.right > clip.right;
        })
        .map((button) => button.getAttribute('title'));
    });

    expect(clippedTitles).toEqual([]);
  });
});
