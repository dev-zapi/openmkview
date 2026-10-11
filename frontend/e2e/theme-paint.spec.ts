import { test, expect } from '@playwright/test';

/**
 * Regression spec: theme toggle must repaint the whole app, not just the
 * activity bar. Root cause class this guards against: legacy `--color-*`
 * aliases declared on `:root` while theme classes land on a different
 * element — CSS custom properties substitute at the declaring element, so
 * body-level token overrides never re-resolve root-level aliases and the
 * app paint freezes on one theme (jsdom cannot catch this; only a real
 * cascade can).
 */

type PaintState = {
  backgroundToken: string; // e.g. "240 10% 3.9%"
  bodyBg: string; // e.g. "rgb(10, 10, 16)"
};

async function readPaint(page: import('@playwright/test').Page): Promise<PaintState> {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return {
      backgroundToken: cs.getPropertyValue('--background').trim(),
      bodyBg: cs.backgroundColor,
    };
  });
}

function tokenLightness(token: string): number {
  const m = token.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!m) throw new Error(`unexpected --background token format: ${token}`);
  return parseFloat(m[3]);
}

function bgChannels(bg: string): number[] {
  const m = bg.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!m) throw new Error(`unexpected background-color format: ${bg}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

test('theme toggle repaints the app body, and paint always tracks the active --background token', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('button[title^="Theme:"]');

  // Drive to a light starting point (cycle order: light → dark → system).
  for (let i = 0; i < 4; i++) {
    const s = await readPaint(page);
    if (tokenLightness(s.backgroundToken) > 50) break;
    await page.click('button[title^="Theme:"]');
    await page.waitForTimeout(150);
  }
  const light = await readPaint(page);
  expect(tokenLightness(light.backgroundToken)).toBeGreaterThan(50);

  // The user action: toggle to dark.
  for (let i = 0; i < 4; i++) {
    const s = await readPaint(page);
    if (tokenLightness(s.backgroundToken) < 20) break;
    await page.click('button[title^="Theme:"]');
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(500); // let the 0.3s color transition settle
  const dark = await readPaint(page);
  expect(tokenLightness(dark.backgroundToken)).toBeLessThan(20);

  // Symptom 1: the app background must actually change with the toggle.
  expect(dark.bodyBg).not.toBe(light.bodyBg);

  // Symptom 2 (mechanism): paint must track the token — dark token, dark paint.
  for (const ch of bgChannels(dark.bodyBg)) {
    expect(ch).toBeLessThan(60);
  }
});
