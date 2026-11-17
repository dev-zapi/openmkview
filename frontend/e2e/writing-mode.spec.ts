import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Writing Mode is a per-file sub-mode of Edit for Markdown: prose typography
// in a centered column with gutters hidden. These specs drive the real UI
// against the configured openmkview project and are strictly read-only —
// nothing here saves file content.

type WritingPaint = {
  fontFamily: string;
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
      maxWidthPx: parseFloat(cs.maxWidth),
      chWidth,
      gutterDisplay: gutter ? getComputedStyle(gutter).display : 'missing',
      leftGap: Math.round(contentRect.left - scrollerRect.left),
      rightGap: Math.round(scrollerRect.right - contentRect.right),
    };
  });
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

/** Computed opacity of the rendered line whose text is exactly `text`. */
async function lineOpacity(page: Page, text: string): Promise<number | null> {
  return page.evaluate((lineText) => {
    const line = Array.from(document.querySelectorAll('.cm-line')).find(
      (candidate) => candidate.textContent === lineText,
    );
    return line ? parseFloat(getComputedStyle(line).opacity) : null;
  }, text);
}

const dimmed = (opacity: number | null) => opacity !== null && opacity < 0.5;
const fullContrast = (opacity: number | null) => opacity !== null && opacity > 0.9;

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

    // Sub-toggles stay hidden until Writing Mode is on.
    await expect(page.getByRole('button', { name: 'Focus' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Typewriter' })).toHaveCount(0);

    const codePaint = await readWritingPaint(page);
    expect(codePaint.gutterDisplay).not.toBe('none');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    // Paragraph Focus is available and on by default on first entry.
    const focus = page.getByRole('button', { name: 'Focus' });
    await expect(focus).toBeVisible();
    await expect(focus).toHaveAttribute('aria-pressed', 'true');

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

  test('Paragraph Focus dims non-caret blocks and toggles back to full contrast', async ({ page }) => {
    await page.getByRole('button', { name: 'Writing' }).click();
    const focus = page.getByRole('button', { name: 'Focus' });
    await expect(focus).toHaveAttribute('aria-pressed', 'true');

    // The caret starts in the first block; the following block recedes.
    await expect.poll(() => lineOpacity(page, '# OpenMKView')).toBeGreaterThan(0.9);
    await expect
      .poll(() => lineOpacity(page, 'A modern Markdown viewer and Git Diff tool.'))
      .toBeLessThan(0.5);

    // Moving the caret into another block moves the highlight.
    await page.locator('.cm-line', { hasText: '## Features' }).click();
    await expect.poll(() => lineOpacity(page, '## Features')).toBeGreaterThan(0.9);
    await expect.poll(() => lineOpacity(page, '# OpenMKView')).toBeLessThan(0.5);

    // Turning Focus off restores full contrast everywhere.
    await focus.click();
    await expect(focus).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => lineOpacity(page, '# OpenMKView')).toBeGreaterThan(0.9);
    await expect.poll(() => lineOpacity(page, '## Features')).toBeGreaterThan(0.9);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Array.from(document.querySelectorAll('.cm-line.cm-focus-dim')).length,
        ),
      )
      .toBe(0);
  });

  test('switching theme keeps the writing typography', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Writing' });
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
});
