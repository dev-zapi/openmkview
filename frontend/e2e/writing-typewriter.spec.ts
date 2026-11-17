import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Typewriter Scrolling is the Writing Mode sub-toggle that keeps the caret's
// line vertically centered while typing. These specs drive the real editor
// against the mock dev server and are strictly read-only: typing makes the
// buffer dirty, but nothing here saves file content.

type CaretGeometry = {
  caretMid: number;
  caretHeight: number;
  viewportMid: number;
  viewportBottom: number;
};

async function readCaretGeometry(page: Page): Promise<CaretGeometry> {
  return page.evaluate(() => {
    const scroller = document.querySelector('.cm-scroller');
    const activeLine = document.querySelector('.cm-activeLine');
    if (!scroller || !activeLine) throw new Error('editor caret line is not mounted');

    const viewport = scroller.getBoundingClientRect();
    const line = activeLine.getBoundingClientRect();

    return {
      caretMid: (line.top + line.bottom) / 2,
      caretHeight: line.height,
      viewportMid: (viewport.top + viewport.bottom) / 2,
      viewportBottom: viewport.bottom,
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

/** Clicking status-bar buttons steals focus; put the caret back in the editor. */
async function focusEditor(page: Page) {
  await page.locator('.cm-content').click();
}

async function pressKeys(page: Page, key: string, times: number) {
  for (let i = 0; i < times; i += 1) {
    await page.keyboard.press(key);
  }
}

/** Wait two frames so any pending typewriter scroll animation has settled. */
async function settleFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test.describe('typewriter scrolling', () => {
  test.beforeEach(async ({ page }) => {
    // Cold Vite dev-server module compilation can exceed the 30s default.
    test.setTimeout(120000);
    await openReadmeInEdit(page);
  });

  test('the sub-toggle appears only inside writing mode and remembers its state', async ({ page }) => {
    const writing = page.getByRole('button', { name: 'Writing' });
    const typewriter = page.getByRole('button', { name: 'Typewriter' });

    await expect(writing).toBeVisible();
    await expect(typewriter).toHaveCount(0);

    await writing.click();
    await expect(typewriter).toBeVisible();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'true');
    await expect(typewriter).toBeInViewport();

    await typewriter.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'false');

    // Leaving and re-entering Writing Mode keeps the per-file preference.
    await writing.click();
    await expect(typewriter).toHaveCount(0);

    await writing.click();
    await expect(typewriter).toBeVisible();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'false');
  });

  test('mouse drag-selection does not auto-scroll the editor', async ({ page }) => {
    const writing = page.getByRole('button', { name: 'Writing' });
    await writing.click();
    await expect(page.getByRole('button', { name: 'Typewriter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await focusEditor(page);
    await page.keyboard.press('Control+Home');
    // Sit mid-document and type once so Typewriter scrolls the view down.
    await pressKeys(page, 'ArrowDown', 25);
    await page.keyboard.type('x');

    const scroller = page.locator('.cm-scroller');
    await expect
      .poll(async () => scroller.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);
    await settleFrames(page);

    const before = await scroller.evaluate((el) => el.scrollTop);
    const contentBox = await page.locator('.cm-content').boundingBox();
    const scrollerBox = await scroller.boundingBox();
    if (!contentBox || !scrollerBox) throw new Error('editor has no layout box');

    // Drag inside the upper part of the viewport. A margin-based typewriter
    // would treat that band as invisible and auto-scroll the view.
    const startX = contentBox.x + contentBox.width / 2;
    const startY = scrollerBox.y + 80;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 30, startY + 100, { steps: 12 });
    await page.mouse.up();

    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);

    // Re-enabling Typewriter recenters the existing caret immediately, without
    // needing another keystroke: scroll the caret away, toggle off and on.
    await page.mouse.move(startX, startY);
    await page.mouse.wheel(0, -400);

    const typewriter = page.getByRole('button', { name: 'Typewriter' });
    await typewriter.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'false');
    await typewriter.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'true');

    await expect
      .poll(async () => {
        const geometry = await readCaretGeometry(page);
        return Math.abs(geometry.caretMid - geometry.viewportMid);
      })
      .toBeLessThan(80);
  });

  test('toggling Paragraph Focus does not move the scroll position', async ({ page }) => {
    const writing = page.getByRole('button', { name: 'Writing' });
    await writing.click();
    await expect(page.getByRole('button', { name: 'Typewriter' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await focusEditor(page);
    await page.keyboard.press('Control+Home');
    await pressKeys(page, 'ArrowDown', 25);
    await page.keyboard.type('x');

    const scroller = page.locator('.cm-scroller');
    await expect
      .poll(async () => scroller.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(100);

    const contentBox = await page.locator('.cm-content').boundingBox();
    const scrollerBox = await scroller.boundingBox();
    if (!contentBox || !scrollerBox) throw new Error('editor has no layout box');

    // Wheel away from the centered caret, then toggle an unrelated sub-toggle.
    await page.mouse.move(contentBox.x + contentBox.width / 2, scrollerBox.y + 80);
    await page.mouse.wheel(0, -250);
    await settleFrames(page);

    const before = await scroller.evaluate((el) => el.scrollTop);
    const focus = page.getByRole('button', { name: 'Focus' });
    await expect(focus).toHaveAttribute('aria-pressed', 'true');
    await focus.click();
    await expect(focus).toHaveAttribute('aria-pressed', 'false');
    await settleFrames(page);

    const after = await scroller.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });

  test('the caret line stays centered while typing with it on and scrolls away with it off', async ({ page }) => {
    const writing = page.getByRole('button', { name: 'Writing' });
    const typewriter = page.getByRole('button', { name: 'Typewriter' });

    await writing.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'true');

    await focusEditor(page);

    // Grow the document so a centered caret has room both above and below,
    // then work from a line in the middle rather than the clamped doc end.
    await page.keyboard.press('Control+End');
    await pressKeys(page, 'Enter', 40);
    await page.keyboard.press('Control+Home');
    await pressKeys(page, 'ArrowDown', 40);
    await pressKeys(page, 'Enter', 3);

    await expect
      .poll(async () => {
        const geometry = await readCaretGeometry(page);
        return Math.abs(geometry.caretMid - geometry.viewportMid);
      })
      .toBeLessThan(80);

    // Turning the sub-toggle off restores ordinary minimal scrolling: type
    // far enough that the caret reaches and stays at the viewport bottom.
    await typewriter.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'false');
    await focusEditor(page);
    await pressKeys(page, 'Enter', 40);

    await expect
      .poll(async () => {
        const geometry = await readCaretGeometry(page);
        return geometry.viewportBottom - geometry.caretMid;
      })
      .toBeLessThan(80);

    const normalScroll = await readCaretGeometry(page);
    expect(normalScroll.caretMid).toBeGreaterThan(normalScroll.viewportMid + 80);

    // Turning it back on recenters the caret without rebuilding the editor.
    // Move into the middle of the long document: the doc end cannot scroll
    // far enough to center the last line.
    await typewriter.click();
    await expect(typewriter).toHaveAttribute('aria-pressed', 'true');
    await focusEditor(page);
    await page.keyboard.press('Control+Home');
    await pressKeys(page, 'ArrowDown', 40);
    await page.keyboard.press('Enter');

    await expect
      .poll(async () => {
        const geometry = await readCaretGeometry(page);
        return Math.abs(geometry.caretMid - geometry.viewportMid);
      })
      .toBeLessThan(80);
  });
});
