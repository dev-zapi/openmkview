import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Text-selection annotations (#17). Runs against the real backend, serial
// because it mutates shared data, with a uniquely named scratch file per test.

test.describe.configure({ mode: 'serial' });

const SCRATCH_MARKDOWN = [
  '# Selection Annotation E2E',
  '',
  'The quick brown fox jumps over the lazy dog.',
  '',
  'A second paragraph explains the next step in detail.',
  '',
].join('\n');

interface FileTarget {
  projectId: number;
  path: string;
}

async function createScratchFile(page: Page): Promise<FileTarget> {
  return page.evaluate(async ({ body }) => {
    const projectsRes = await fetch('/api/projects?open=true');
    if (!projectsRes.ok) throw new Error('cannot list projects');
    const projects = await projectsRes.json();
    const projectId = projects[0]?.id;
    if (!projectId) throw new Error('no open project to annotate');

    const name = `annotations-selection-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
    const createRes = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', project_id: projectId, name }),
    });
    if (!createRes.ok) throw new Error(`cannot create scratch file: ${createRes.status}`);

    const saveRes = await fetch('/api/files/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, relativePath: name, content: body }),
    });
    if (!saveRes.ok) throw new Error(`cannot seed scratch file: ${saveRes.status}`);

    return { projectId, path: name };
  }, { body: SCRATCH_MARKDOWN });
}

async function removeScratchFile(page: Page, target: FileTarget): Promise<void> {
  await page.evaluate(async ({ projectId, path }) => {
    const listRes = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    if (listRes.ok) {
      const annotations = await listRes.json();
      for (const annotation of annotations) {
        await fetch(`/api/annotations/${annotation.id}`, { method: 'DELETE' });
      }
    }

    await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, path }),
    });
  }, target);
}

async function openScratchFile(page: Page, target: FileTarget): Promise<void> {
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByRole('heading', { name: 'Selection Annotation E2E' })).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Selects from the first occurrence of `startPhrase` through the end of
 * `endPhrase` (inclusive) across rendered content text nodes.
 */
async function selectTextRange(
  page: Page,
  startPhrase: string,
  endPhrase: string
): Promise<void> {
  await page.evaluate(
    ({ startPhrase, endPhrase }) => {
      const content = document.querySelector('.markdown-content');
      if (!content) throw new Error('markdown content not found');

      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let combined = '';
      let node = walker.nextNode() as Text | null;
      while (node) {
        nodes.push(node);
        combined += node.nodeValue || '';
        node = walker.nextNode() as Text | null;
      }

      const locate = (phrase: string, from: number) => {
        const offset = combined.indexOf(phrase, from);
        if (offset === -1) throw new Error(`cannot find phrase: ${phrase} in ${combined.slice(0, 300)}`);
        let remaining = offset;
        for (const text of nodes) {
          const length = text.nodeValue?.length || 0;
          if (remaining <= length) return { node: text, offset: remaining };
          remaining -= length;
        }
        throw new Error(`cannot map phrase: ${phrase}`);
      };

      const startOffset = combined.indexOf(startPhrase);
      const start = locate(startPhrase, 0);
      const endSearchFrom =
        endPhrase === startPhrase ? startOffset : startOffset + startPhrase.length;
      const end = locate(endPhrase, endSearchFrom);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset + endPhrase.length);

      const selection = window.getSelection();
      if (!selection) throw new Error('no selection');
      selection.removeAllRanges();
      selection.addRange(range);
      // jsdom-independent: make the app's selectionchange listener run even
      // when the browser coalesces the event.
      document.dispatchEvent(new Event('selectionchange'));
    },
    { startPhrase, endPhrase }
  );
}

async function saveSelectionAnnotation(page: Page, body: string): Promise<void> {
  const button = page.getByRole('button', { name: 'Annotate selected text' });
  await expect(button).toBeVisible({ timeout: 10000 });
  await button.click();

  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();
}

async function storedSegments(page: Page, target: FileTarget): Promise<any[]> {
  return page.evaluate(async ({ projectId, path }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    const annotations = await res.json();
    return annotations[0]?.anchor?.segments ?? [];
  }, target);
}

test.describe('text-selection annotations', () => {
  let target: FileTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page);
    await openScratchFile(page, target);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('selects words in one block, highlights them, and re-resolves after reload', async ({
    page,
  }) => {
    await selectTextRange(page, 'quick brown fox', 'quick brown fox');
    await saveSelectionAnnotation(page, 'Selected phrase note');

    const highlight = page.locator('mark[data-annotation-id]', {
      hasText: 'quick brown fox',
    });
    await expect(highlight.first()).toBeVisible({ timeout: 10000 });
    expect(await highlight.first().textContent()).toBe('quick brown fox');

    const segments = await storedSegments(page, target);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      kind: 'text',
      quote: 'quick brown fox',
      prefix: 'The ',
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target);

    const reloaded = page.locator('mark[data-annotation-id]', {
      hasText: 'quick brown fox',
    });
    await expect(reloaded.first()).toBeVisible({ timeout: 15000 });
    expect(await reloaded.first().textContent()).toBe('quick brown fox');
  });

  test('selects across blocks into one annotation with every segment highlighted', async ({
    page,
  }) => {
    await selectTextRange(page, 'quick brown fox', 'next step');
    await saveSelectionAnnotation(page, 'Cross-block note');

    const segments = await storedSegments(page, target) as Array<{
      kind: string;
      quote: string;
    }>;
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.every((segment) => segment.kind === 'text')).toBe(true);
    expect(segments[0].quote).toBe('quick brown fox jumps over the lazy dog.');
    expect(segments[segments.length - 1].quote).toContain('next step');

    // Every covered segment carries a highlight for this one Annotation.
    const firstBlockHighlight = page.locator('mark[data-annotation-id]', {
      hasText: 'quick brown fox',
    });
    const lastBlockHighlight = page.locator('mark[data-annotation-id]', {
      hasText: 'next step',
    });
    await expect(firstBlockHighlight.first()).toBeVisible({ timeout: 10000 });
    await expect(lastBlockHighlight.first()).toBeVisible({ timeout: 10000 });

    const firstId = await firstBlockHighlight.first().getAttribute('data-annotation-id');
    const lastId = await lastBlockHighlight.first().getAttribute('data-annotation-id');
    expect(firstId).toBe(lastId);

    // The annotation is one thread with one note.
    await firstBlockHighlight.first().click();
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Cross-block note');
    await expect(viewer.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});
