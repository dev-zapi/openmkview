import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Whole-block annotations are the tracer bullet for spec #15. These specs run
// serial because they mutate the real backend: each test creates its own
// uniquely named Markdown file and removes both the file and its annotations.

test.describe.configure({ mode: 'serial' });

const ANNOTATION_NOTE = ['Annotation **note** body', '', '- reply item'].join('\n');

const SCRATCH_MARKDOWN = [
  '# Block Annotation E2E',
  '',
  'A paragraph with a stable block for annotation.',
  '',
  'A second paragraph.',
  '',
  '```rust',
  'const value = 1;',
  '```',
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

    const name = `annotations-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
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
  await expect(page.getByRole('heading', { name: 'Block Annotation E2E' })).toBeVisible({
    timeout: 15000,
  });
}

async function storedBlockText(page: Page, target: FileTarget): Promise<string | undefined> {
  return page.evaluate(async ({ projectId, path }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    const annotations = await res.json();
    return annotations[0]?.anchor?.segments?.[0]?.blockText;
  }, target);
}

/**
 * Clicking anchored content opens the viewer once the annotation list has
 * loaded; retry the click so the test waits on user-visible behavior rather
 * than on internal attachment state.
 */
async function openViewerByClicking(page: Page, content: Locator): Promise<void> {
  const viewer = page.getByRole('dialog', { name: 'Annotation' });
  await expect
    .poll(
      async () => {
        if (await viewer.isVisible().catch(() => false)) return true;
        await content.click();
        return viewer.isVisible().catch(() => false);
      },
      { timeout: 15000 }
    )
    .toBe(true);
}

test.describe('whole-block annotations', () => {
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

  test('hover, create, highlight, popover, and re-attach after reload', async ({ page }) => {
    const paragraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await expect(paragraph).toBeVisible();

    // Hovering the block reveals its marker; clicking it opens the composer.
    await paragraph.hover();
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await marker.hover();
    await marker.click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill(ANNOTATION_NOTE);
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // Clicking the highlighted block opens a popover with the rendered note.
    await openViewerByClicking(page, paragraph);
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Annotation note body');
    await expect(viewer.getByRole('listitem')).toHaveText('reply item');
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();

    // Clicking the marker opens the same popover.
    await marker.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).toContainText(
      'Annotation note body'
    );
    await page.keyboard.press('Escape');

    // Reloading re-fetches the API list and re-attaches by block content hash.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target);

    const reloadedParagraph = page.getByText('A paragraph with a stable block for annotation.', {
      exact: true,
    });
    await openViewerByClicking(page, reloadedParagraph);
    const reloadedViewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(reloadedViewer).toBeVisible();
    await expect(reloadedViewer.getByRole('listitem')).toHaveText('reply item');

    // Deleting from the popover clears the annotation from the document.
    await reloadedViewer.getByRole('button', { name: 'Delete' }).click();
    await expect(reloadedViewer).not.toBeVisible();
    await reloadedParagraph.click();
    await expect(page.getByRole('dialog', { name: 'Annotation' })).not.toBeVisible();
  });

  test('code block anchors use source text and survive reload', async ({ page }) => {
    const codeText = page.getByText('const value = 1;', { exact: false }).first();
    await codeText.hover();

    const marker = page.getByRole('button', { name: /const value = 1/ });
    await marker.click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill('Code block note');
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    // The anchor stores the code source, not the injected language/Copy chrome.
    expect(await storedBlockText(page, target)).toBe('const value = 1;');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openScratchFile(page, target);

    const reloadedCode = page.getByText('const value = 1;', { exact: false }).first();
    await openViewerByClicking(page, reloadedCode);
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('Code block note');

    await viewer.getByRole('button', { name: 'Delete' }).click();
  });
});
