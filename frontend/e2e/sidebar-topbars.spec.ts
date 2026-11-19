import { expect, test } from '@playwright/test';
import { loginIfNeeded } from './fixtures';

test('document and sidebar top bars share the document toolbar height', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/project/1/files/%2FREADME.md', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);

  const toolbar = page.locator('[data-document-toolbar]');
  const outline = page.locator('.outline-panel-header');
  const annotations = page.locator('.annotation-column-header');
  await expect(toolbar).toBeVisible();

  if (!(await outline.isVisible())) {
    await page.getByRole('button', { name: 'Document outline', exact: true }).click();
  }
  if (!(await annotations.isVisible())) {
    await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
  }

  await expect(outline).toBeVisible();
  await expect(annotations).toBeVisible();
  expect(await toolbar.evaluate((element) => element.getBoundingClientRect().height)).toBe(46);
  for (const header of [page.locator('.sidebar-header'), outline, annotations]) {
    const rect = await header.evaluate((element) => {
      const { height, top } = element.getBoundingClientRect();
      return { height, top };
    });
    expect(rect).toEqual({ height: 46, top: 0 });
  }

  for (const header of [toolbar, outline, annotations]) {
    const material = await header.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, backdropFilter: style.backdropFilter };
    });
    expect(material.background).toMatch(/0\.82\)$/);
    expect(material.backdropFilter).toBe('blur(16px) saturate(1.2)');
  }
});

test('file tree rows scroll beneath its translucent header without moving search', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 250 });
  await page.goto('/project/1', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);

  const host = page.locator('.pierre-file-tree-host');
  await expect(host).toBeVisible();
  await host.locator('[data-item-path="/"]').click();
  await host.locator('[data-item-path="/docs/"]').click();
  await host.locator('[data-item-path="/src/"]').click();
  await expect(host.locator('[data-item-path="/docs/README.md"]')).toBeVisible();

  const scroll = host.locator('[data-file-tree-virtualized-scroll="true"]');
  const search = host.locator('[data-file-tree-search-container="true"]');
  const initial = await page.evaluate(() => {
    const hostElement = document.querySelector('.pierre-file-tree-host')!;
    const root = hostElement.shadowRoot!;
    return {
      searchTop: root.querySelector('[data-file-tree-search-container="true"]')!.getBoundingClientRect().top,
      scrollBottom: root.querySelector('[data-file-tree-virtualized-scroll="true"]')!.getBoundingClientRect().bottom,
    };
  });

  await scroll.evaluate((element) => { element.scrollTop = 98; });
  await expect.poll(() => host.evaluate((element) => element.style.getPropertyValue('--file-tree-scroll-lift'))).toBe('98px');

  const scrolled = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar')!;
    const header = document.querySelector('.sidebar-header')!;
    const hostElement = document.querySelector('.pierre-file-tree-host')!;
    const root = hostElement.shadowRoot!;
    const scrollElement = root.querySelector('[data-file-tree-virtualized-scroll="true"]')!;
    const headerRect = header.getBoundingClientRect();
    const scrollRect = scrollElement.getBoundingClientRect();
    const rowRects = [...root.querySelectorAll('[role="treeitem"]')].map((element) => {
      const { top, bottom } = element.getBoundingClientRect();
      return { top, bottom };
    });
    const headerStyle = getComputedStyle(header);
    return {
      searchTop: root.querySelector('[data-file-tree-search-container="true"]')!.getBoundingClientRect().top,
      scrollTop: scrollRect.top,
      scrollBottom: scrollRect.bottom,
      sidebarTop: sidebar.getBoundingClientRect().top,
      hasRowBehindHeader: rowRects.some((rect) => rect.top < headerRect.bottom && rect.bottom > headerRect.top),
      headerBackground: headerStyle.backgroundColor,
      headerBackdropFilter: headerStyle.backdropFilter,
    };
  });

  expect(scrolled.searchTop).toBe(initial.searchTop);
  expect(scrolled.scrollBottom).toBe(initial.scrollBottom);
  expect(scrolled.scrollTop).toBe(scrolled.sidebarTop);
  expect(scrolled.hasRowBehindHeader).toBe(true);
  expect(scrolled.headerBackground).toMatch(/0\.82\)$/);
  expect(scrolled.headerBackdropFilter).toBe('none');

  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => host.locator('[data-item-path="/tsconfig.json"]').evaluate((element) => {
    const root = document.querySelector('.pierre-file-tree-host')!.shadowRoot!;
    const scrollBottom = root.querySelector('[data-file-tree-virtualized-scroll="true"]')!.getBoundingClientRect().bottom;
    return scrollBottom - element.getBoundingClientRect().bottom;
  })).toBe(0);
});

test('outline and annotation rows scroll beneath their frosted headers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto('/project/1/files/%2FREADME.md', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);

  const outline = page.locator('.outline-panel-header');
  const annotations = page.locator('.annotation-column-header');
  if (!(await outline.isVisible())) {
    await page.getByRole('button', { name: 'Document outline', exact: true }).click();
  }
  if (!(await annotations.isVisible())) {
    await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
  }
  await expect(outline).toBeVisible();
  await expect(annotations).toBeVisible();

  await page.evaluate(() => {
    const outlineContent = document.querySelector('.outline-panel-content')!;
    for (let index = 0; index < 20; index++) {
      const item = document.createElement('div');
      item.className = 'outline-item';
      item.textContent = `Outline test ${index}`;
      outlineContent.appendChild(item);
    }

    const annotationContent = document.querySelector('.annotation-column-content')!;
    for (let index = 0; index < 20; index++) {
      const item = document.createElement('div');
      item.className = 'annotation-column-item';
      item.textContent = `Annotation test ${index}`;
      item.style.minHeight = '60px';
      annotationContent.appendChild(item);
    }
  });

  const outlineContent = page.locator('.outline-panel-content');
  const annotationContent = page.locator('.annotation-column-content');
  await outlineContent.evaluate((element) => { element.scrollTop = 70; });
  await annotationContent.evaluate((element) => { element.scrollTop = 250; });

  const geometry = await page.evaluate(() => {
    const intersectsHeader = (rowSelector: string, headerSelector: string) => {
      const row = document.querySelector(rowSelector)!.getBoundingClientRect();
      const header = document.querySelector(headerSelector)!.getBoundingClientRect();
      return row.top < header.bottom && row.bottom > header.top;
    };
    const filter = document.querySelector('.annotation-column-filter')!.getBoundingClientRect();
    return {
      outlineBehindHeader: intersectsHeader('.outline-item', '.outline-panel-header'),
      annotationBehindHeader: intersectsHeader('.annotation-column-item', '.annotation-column-header'),
      filterTop: filter.top,
      filterHeight: filter.height,
    };
  });

  expect(geometry.outlineBehindHeader).toBe(true);
  expect(geometry.annotationBehindHeader).toBe(true);
  expect(geometry.filterTop).toBe(46);
  expect(geometry.filterHeight).toBe(35);
});
