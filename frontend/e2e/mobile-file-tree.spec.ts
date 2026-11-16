import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('mobile file tree stays at the bottom after scrolling', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Toggle navigation menu' }).click();
  await page.getByRole('button', { name: 'Open Project' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /openmkview/i }).first().click();
  await expect(page.getByRole('tree')).toBeVisible();

  for (let i = 0; i < 30; i += 1) {
    const collapsed = page.getByRole('treeitem', { expanded: false });
    if (await collapsed.count() === 0) break;
    await collapsed.first().click();
  }

  const result = await page.getByRole('treeitem').first().evaluate(async (row) => {
    let scroller = row.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (!scroller) throw new Error('File tree scroll container not found');

    const max = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = max;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { max, settled: scroller.scrollTop };
  });

  expect(result.max).toBeGreaterThan(0);

  // The rendered 44px rows and the virtualizer's itemHeight must agree;
  // otherwise its scroll handler clamps every positive scrollTop back to 0.
  expect(result.settled).toBe(result.max);
});
