import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Writing Mode is a per-file sub-mode of Edit for Markdown: prose typography
// in a centered column with gutters hidden. These specs drive the real UI
// against the configured openmkview project and are strictly read-only —
// nothing here saves file content.

type WritingPaint = {
  fontFamily: string;
  fontSizePx: number;
  maxWidth: string;
  maxWidthPx: number;
  chWidth: number;
  gutterDisplay: string;
  leftGap: number;
  rightGap: number;
};

async function readWritingPaint(page: Page): Promise<WritingPaint> {
  return page.evaluate(() => {
    const content = document.querySelector('.cm-content');
    const gutter = document.querySelector('.cm-gutters');
    const scroller = content?.closest('.cm-scroller');
    if (!content || !scroller) throw new Error('editor content is not mounted');

    const contentRect = content.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const cs = getComputedStyle(content);

    // Browsers resolve `65ch` to px; measure one `ch` in the same font so the
    // assertion stays semantic (column is ~65 characters wide).
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;font-family:${cs.fontFamily};font-size:${cs.fontSize}`;
    probe.textContent = '0';
    document.body.appendChild(probe);
    const chWidth = probe.getBoundingClientRect().width;
    probe.remove();

    return {
      fontFamily: cs.fontFamily,
      fontSizePx: parseFloat(cs.fontSize),
      maxWidth: cs.maxWidth,
      maxWidthPx: parseFloat(cs.maxWidth),
      chWidth,
      gutterDisplay: gutter ? getComputedStyle(gutter).display : 'missing',
      leftGap: Math.round(contentRect.left - scrollerRect.left),
      rightGap: Math.round(scrollerRect.right - contentRect.right),
    };
  });
}

async function openFontsSettings(page: Page) {
  await page.locator('button[title="Settings"]').click();
  const panel = page.locator('.settings-panel');
  await expect(panel).toBeVisible();
  await panel.locator('.settings-nav button', { hasText: 'Fonts' }).click();
  await expect(page.locator('#settings-fonts')).toBeInViewport();
}

async function openReadme(page: Page) {
  await expect(page.getByRole('tree')).toBeVisible();

  const readme = page.getByRole('treeitem', { name: /readme/i }).first();
  if ((await readme.count()) === 0) {
    // The file tree starts collapsed; expand the project root row.
    await page.getByRole('treeitem').first().click();
  }
  await expect(readme).toBeVisible();
  await readme.click();
}

async function openReadmeInEdit(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);
  await waitForDesktopApp(page);

  await page.locator('.activity-bar-projects button[title="openmkview"]').click();
  await expect(page.locator('.sidebar-header-name')).toHaveText('openmkview');

  await openReadme(page);
  await page.locator('[class*="viewTabs"]').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.editor-status-bar')).toBeVisible();
}

test.describe('writing mode on desktop', () => {
  test.beforeEach(async ({ page }) => {
    // Cold Vite dev-server module compilation can exceed the 30s default.
    test.setTimeout(120000);
    await openReadmeInEdit(page);
  });

  test('status-bar toggle restyles Markdown as centered serif prose', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Writing' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    // Sub-toggle buttons belong to later tickets and must not appear yet.
    await expect(page.getByRole('button', { name: 'Typewriter' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Focus' })).toHaveCount(0);

    const codePaint = await readWritingPaint(page);
    expect(codePaint.gutterDisplay).not.toBe('none');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(async () => (await readWritingPaint(page)).fontFamily).toContain('serif');

    const prosePaint = await readWritingPaint(page);
    expect(prosePaint.fontFamily).toContain('serif');
    // CJK fallbacks are part of the serif preset.
    expect(prosePaint.fontFamily).toContain('Noto Serif SC');
    // 65ch: compare the capped width against the measured character width.
    expect(Math.abs(prosePaint.maxWidthPx - 65 * prosePaint.chWidth)).toBeLessThanOrEqual(prosePaint.chWidth);
    expect(prosePaint.gutterDisplay).toBe('none');
    // Centered column: the content is inset equally on both sides.
    expect(prosePaint.leftGap).toBeGreaterThan(0);
    expect(Math.abs(prosePaint.leftGap - prosePaint.rightGap)).toBeLessThanOrEqual(2);
  });

  test('Mod+Alt+W toggles writing mode from the keyboard', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Writing' });
    await page.locator('.cm-content').click();

    await page.keyboard.press('Control+Alt+w');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect((await readWritingPaint(page)).gutterDisplay).toBe('none');

    // Chromium on Linux moves focus to the browser menu after an Alt chord;
    // refocus the page (as a user would) before pressing again.
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+Alt+w');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect((await readWritingPaint(page)).gutterDisplay).not.toBe('none');
  });

  test('switching theme keeps the writing typography', async ({ page }) => {    const toggle = page.getByRole('button', { name: 'Writing' });
    await toggle.click();
    await expect.poll(async () => (await readWritingPaint(page)).fontFamily).toContain('serif');

    // The theme control cycles light → dark → system; whichever theme lands,
    // the editor rebuild must recompute the writing extension. Wait for the
    // theme mode to actually advance before checking typography.
    const themeButton = page.locator('button[title^="Theme:"]');
    let previousTitle = await themeButton.getAttribute('title');

    for (let i = 0; i < 3; i += 1) {
      await themeButton.click();
      await expect
        .poll(() => themeButton.getAttribute('title'), {
          message: 'theme mode should advance on each click',
        })
        .not.toBe(previousTitle);
      previousTitle = await themeButton.getAttribute('title');

      // A light/dark theme class proves the new theme was applied.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.className))
        .toMatch(/(light|dark)-theme/);

      const paint = await readWritingPaint(page);
      expect(paint.fontFamily).toContain('serif');
      expect(Math.abs(paint.maxWidthPx - 65 * paint.chWidth)).toBeLessThanOrEqual(paint.chWidth);
      expect(paint.gutterDisplay).toBe('none');
    }
  });

  test('settings knobs restyle an open writing editor live', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Writing' });
    await toggle.click();
    await expect.poll(async () => (await readWritingPaint(page)).fontFamily).toContain('serif');

    await openFontsSettings(page);

    // Font family preset: serif → sans, without leaving or rebuilding the editor.
    await page.getByLabel('Writing Font Family').selectOption('sans');
    await expect
      .poll(async () => (await readWritingPaint(page)).fontFamily)
      .toContain('sans-serif');
    expect((await readWritingPaint(page)).gutterDisplay).toBe('none');

    // Explicit writing size wins over the editor/code chain.
    await page.getByLabel('Writing Font Size').fill('22px');
    await expect.poll(async () => (await readWritingPaint(page)).fontSizePx).toBe(22);

    // Full width drops the centered column cap...
    await page.getByLabel('Writing Column Width', { exact: true }).selectOption('full');
    await expect.poll(async () => (await readWritingPaint(page)).maxWidth).toBe('none');

    // ...and fixed mode honors the configured width value.
    await page.getByLabel('Writing Column Width', { exact: true }).selectOption('fixed');
    await page.getByLabel('Writing Column Width Value').fill('50ch');
    await expect
      .poll(async () => {
        const paint = await readWritingPaint(page);
        return Math.abs(paint.maxWidthPx - 50 * paint.chWidth) <= paint.chWidth;
      })
      .toBe(true);
  });
});

test.describe('writing mode on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the Writing toggle is reachable and works on a phone viewport', async ({ page }) => {
    // Cold Vite dev-server module compilation can exceed the 30s default.
    test.setTimeout(120000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page
      .getByRole('dialog', { name: 'Navigation drawer' })
      .getByRole('button', { name: 'openmkview', exact: true })
      .click();
    await expect(page.locator('.mobile-main-content')).toBeVisible();
    await openReadme(page);
    await expect(page.getByTestId('mobile-topbar-title')).toHaveText(/readme/i);

    const bar = page.locator('nav[aria-label="View"]');
    await bar.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('.editor-status-bar')).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Writing' });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeInViewport();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readWritingPaint(page)).fontFamily).toContain('serif');

    const paint = await readWritingPaint(page);
    expect(paint.gutterDisplay).toBe('none');
  });

  test('an explicit writing size below 16px is floored on mobile', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page
      .getByRole('dialog', { name: 'Navigation drawer' })
      .getByRole('button', { name: 'openmkview', exact: true })
      .click();
    await expect(page.locator('.mobile-main-content')).toBeVisible();
    await openReadme(page);

    const bar = page.locator('nav[aria-label="View"]');
    await bar.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page.locator('.editor-status-bar')).toBeVisible();

    const toggle = page.getByRole('button', { name: 'Writing' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.locator('button[aria-label="Toggle navigation menu"]').click();
    await page.locator('button[title="Settings"]').click();
    const panel = page.locator('.settings-panel');
    await expect(panel).toBeVisible();
    await panel.locator('.settings-nav button', { hasText: 'Fonts' }).click();
    await page.getByLabel('Writing Font Size').fill('12px');
    await page.locator('.settings-panel .close-btn').click();

    // The iOS focus-zoom guard floors the writing size at 16px on phones.
    await expect.poll(async () => (await readWritingPaint(page)).fontSizePx).toBe(16);
  });
});
