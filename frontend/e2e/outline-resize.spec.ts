import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('outline resize follows the pointer when annotations are open', async ({ page }) => {
  await page.goto('/project/1/files/README.md', { waitUntil: 'domcontentloaded' });
  await page.locator('button[title="Outline"]').click();
  const outline = page.locator('.outline-panel');
  await expect(outline).toBeVisible();
  await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Annotations' })).toBeVisible();
  await expect(page.locator('.annotation-column')).toHaveCSS('width', '300px');

  const bounds = await outline.locator('.outline-resize-handle').boundingBox();
  if (!bounds) throw new Error('outline resize handle is not visible');
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + 100;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe('col-resize');
  await expect.poll(() => outline.evaluate((element) => element.style.transition)).toBe('none');
  await expect.poll(() => outline.evaluate((element) => element.getBoundingClientRect().width)).toBe(280);

  for (const delta of [-120, 80, -40]) {
    await page.mouse.move(x + delta, y, { steps: 5 });
    await expect.poll(() => outline.evaluate((element) => element.getBoundingClientRect().width)).toBe(280 - delta);
    await expect.poll(() => outline.evaluate((element) => element.getBoundingClientRect().left)).toBeGreaterThanOrEqual(bounds.x + delta - 2);
    await expect.poll(() => outline.evaluate((element) => element.getBoundingClientRect().left)).toBeLessThanOrEqual(bounds.x + delta + 2);
  }
  await page.mouse.up();
  expect(await page.evaluate(() => localStorage.getItem('outline-panel-width'))).toBe('320');
});

test('outline resize remains responsive through sustained pointer movement', async ({ page }) => {
  await page.goto('/project/1/files/README.md', { waitUntil: 'domcontentloaded' });
  await page.locator('button[title="Outline"]').click();
  const outline = page.locator('.outline-panel');
  await expect(outline).toBeVisible();
  await expect.poll(() => outline.evaluate((element) => element.getBoundingClientRect().width)).toBe(280);
  const bounds = await outline.locator('.outline-resize-handle').boundingBox();
  if (!bounds) throw new Error('outline resize handle is not visible');
  await page.mouse.move(bounds.x + 2, bounds.y + 100);
  await page.mouse.down();
  await expect.poll(() => outline.evaluate((element) => element.style.transition)).toBe('none');

  const frameDurations = await page.evaluate(async () => {
    const samples: number[] = [];
    let previous = performance.now();
    for (let index = 0; index < 120; index++) {
      const handle = document.querySelector('.outline-resize-handle')!;
      const x = handle.getBoundingClientRect().left + 2;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: x }));
      const now = await new Promise(requestAnimationFrame);
      samples.push(now - previous);
      previous = now;
    }
    return samples;
  });
  await page.mouse.up();
  // Ignore startup and allow a generous margin for loaded CI hosts.
  expect(frameDurations.slice(10).reduce((sum, duration) => sum + duration, 0) / 110).toBeLessThan(34);
});
