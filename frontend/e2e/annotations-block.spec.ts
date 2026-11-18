import { test, expect, loginIfNeeded, waitForDesktopApp } from './fixtures';
import type { Page } from '@playwright/test';

// Whole-block annotations are the tracer bullet for spec #15. These specs run
// serial because they mutate the real backend: each test creates its own
// uniquely named Markdown file and removes both the file and its annotations.

test.describe.configure({ mode: 'serial' });

const ANNOTATION_NOTE = 'Annotation **note** body';

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
  }, { body: '# Block Annotation E2E\n\nA paragraph with a **stable** block for annotation.\n\nA second paragraph.\n' });
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
  await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.markdown-content h1')).toHaveText('Block Annotation E2E');
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
    const block = page.locator('.markdown-content > p').first();
    await expect(block).toBeVisible();

    // Hovering the block reveals its marker; clicking it opens the composer.
    await block.hover();
    const marker = block.locator('.annotation-marker');
    await expect(marker).toHaveCSS('opacity', '1');
    await marker.click();

    const composer = page.locator('.annotation-popover .annotation-composer-input');
    await expect(composer).toBeVisible();
    await composer.fill(ANNOTATION_NOTE);
    await page.locator('.annotation-popover').getByRole('button', { name: 'Save' }).click();

    // Saving highlights the block and marks the marker as annotated.
    await expect(block).toHaveClass(/annotation-highlighted/);
    await expect(marker).toHaveClass(/has-annotation/);

    // Clicking the marker opens a popover with the rendered note.
    await marker.click();
    const noteBody = page.locator('.annotation-popover .annotation-note-body');
    await expect(noteBody).toBeVisible();
    await expect(noteBody).toContainText('Annotation note body');
    await expect(noteBody.locator('strong')).toHaveText('note');

    // Reloading re-fetches the API list and re-attaches by block content hash.
    await page.reload({ waitUntil: 'domcontentloaded' });
    const reloadedBlock = page.locator('.markdown-content > p').first();
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });
    await expect(reloadedBlock).toHaveClass(/annotation-highlighted/, { timeout: 15000 });

    await reloadedBlock.hover();
    const reloadedMarker = reloadedBlock.locator('.annotation-marker');
    await expect(reloadedMarker).toHaveClass(/has-annotation/);
    await reloadedMarker.click();
    await expect(page.locator('.annotation-popover .annotation-note-body')).toContainText(
      'Annotation note body'
    );

    // Deleting from the popover clears the highlight.
    await page.locator('.annotation-popover').getByRole('button', { name: 'Delete' }).click();
    await expect(reloadedBlock).not.toHaveClass(/annotation-highlighted/);
  });
});
