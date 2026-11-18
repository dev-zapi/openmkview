import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Offline assertions must run in-page: Chromium stops enforcing offline mode
// after a full-page navigation (ADR-0002), so this follows offline.spec.ts.
test.describe.configure({ mode: 'serial' });

const SCRATCH_MARKDOWN = [
  '# Offline Annotations E2E',
  '',
  'A paragraph whose annotation must survive offline.',
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

    const name = `annotations-offline-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
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

/** Another root-level markdown file, used as the in-page "navigate away" hop. */
async function findOtherMarkdownFile(
  page: Page,
  excludePath: string,
  projectId: number
): Promise<string | null> {
  return page.evaluate(async ({ excludePath, projectId }) => {
    const treeRes = await fetch(`/api/files/tree?project_id=${projectId}`);
    if (!treeRes.ok) return null;
    const tree = await treeRes.json();

    const rootMarkdown: string[] = [];
    for (const node of tree) {
      if (node.isFolder || !String(node.path).endsWith('.md')) continue;
      if (node.path !== excludePath) rootMarkdown.push(node.path);
    }
    return rootMarkdown[0] ?? null;
  }, { excludePath, projectId });
}

const fileUrl = (projectId: number, path: string) =>
  `/project/${projectId}/files/${encodeURIComponent(path)}`;

const annotationsUrl = (target: FileTarget) =>
  `/api/annotations?project_id=${target.projectId}&relativePath=${encodeURIComponent(target.path)}`;

/** Client-side navigation, never a full-page navigation. */
async function navigateInPage(page: Page, projectId: number, path: string): Promise<void> {
  await page.evaluate(({ projectId, path }) => {
    window.history.pushState(
      { projectId, filePath: path },
      '',
      `/project/${projectId}/files/${encodeURIComponent(path)}`
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { projectId, path });
}

async function probeFetch(page: Page, url: string): Promise<string> {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u);
      return `status:${res.status}`;
    } catch {
      return 'failed';
    }
  }, url);
}

test.describe('annotations offline read-only', () => {
  let target: FileTarget;
  let otherFile: string | null;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page);
    otherFile = await findOtherMarkdownFile(page, target.path, target.projectId);
  });

  test.afterEach(async ({ page, context }) => {
    await context.setOffline(false).catch(() => {});
    if (target) await removeScratchFile(page, target);
  });

  test('a previously viewed file renders its annotations offline with writes disabled', async ({
    page,
    context,
  }) => {
    test.skip(!otherFile, 'needs a second root-level markdown file for in-page navigation');

    // Online: view the file and create an annotation through the UI.
    await navigateInPage(page, target.projectId, target.path);
    await expect(page.getByRole('heading', { name: 'Offline Annotations E2E' })).toBeVisible({
      timeout: 15000,
    });
    const paragraph = page.getByText('A paragraph whose annotation must survive offline.', {
      exact: true,
    });
    await expect(paragraph).toBeVisible();
    await paragraph.hover();
    await paragraph.getByRole('button', { name: /Annotate this block/ }).click();
    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('Offline note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // Reload online so the non-empty annotation list GET enters the runtime
    // cache (the generic blacklist-based /api/ policy covers annotation GETs).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Offline Annotations E2E' })).toBeVisible({
      timeout: 15000,
    });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    // Warm the cache for the other file too, then return to the annotated one.
    await navigateInPage(page, target.projectId, otherFile!);
    await expect(page.locator('.markdown-wrapper, .load-error')).toBeVisible({ timeout: 15000 });
    await navigateInPage(page, target.projectId, target.path);
    await expect(paragraph).toHaveClass(/annotation-highlighted/);

    await context.setOffline(true);
    await expect(page.locator('.offline-indicator')).toBeVisible();

    // The annotation list itself is served from the runtime cache offline.
    expect(await probeFetch(page, annotationsUrl(target))).toBe('status:200');

    // Re-open the previously viewed file in-page: content and annotations
    // render purely from cache.
    await navigateInPage(page, target.projectId, otherFile!);
    await expect(page.locator('.markdown-wrapper, .load-error')).toBeVisible({ timeout: 15000 });
    await navigateInPage(page, target.projectId, target.path);
    await expect(page.getByRole('heading', { name: 'Offline Annotations E2E' })).toBeVisible({
      timeout: 15000,
    });

    const offlineParagraph = page.getByText('A paragraph whose annotation must survive offline.', {
      exact: true,
    });
    await expect(offlineParagraph).toHaveClass(/annotation-highlighted/);
    const marker = offlineParagraph.getByRole('button', { name: /Annotate this block/ });
    await expect(marker).toBeVisible();
    await expect(marker).toBeDisabled();
    await expect(marker).toHaveAttribute('title', 'Unavailable offline');

    // Clicking the highlight still opens the cached popover.
    await offlineParagraph.click();
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Offline note');

    // Editing controls are visibly disabled rather than failing mid-use.
    await expect(viewer.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await expect(viewer.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'title',
      'Unavailable offline'
    );
    await expect(viewer).toContainText('Read-only while offline');
    await expect(page.getByRole('dialog', { name: 'New annotation' })).not.toBeVisible();
    await expect(page.locator('.annotation-error')).not.toBeVisible();
  });
});
