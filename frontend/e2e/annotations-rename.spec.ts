import { test, expect, loginIfNeeded, waitForDesktopApp, getHarnessProject } from './fixtures';
import type { Locator, Page } from '@playwright/test';

// Ticket #21: annotations follow a file renamed in the app. This spec mutates
// the real backend, so it creates a uniquely named scratch file and removes
// both the file and its annotations afterwards.

test.describe.configure({ mode: 'serial' });

const SCRATCH_MARKDOWN = [
  '# Rename Annotation E2E',
  '',
  'A paragraph that keeps its annotation through a rename.',
  '',
].join('\n');

const NOTE = 'Annotation **rename** body';

interface RenameTarget {
  projectId: number;
  projectName: string;
  path: string;
  renamedName: string;
  renamedPath: string;
}

async function createScratchFile(page: Page): Promise<RenameTarget> {
  const project = await getHarnessProject(page);
  return page.evaluate(async ({ body, projectId, projectName }) => {
    const name = `annotations-rename-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
    const renamed = name.replace(/\.md$/, '-renamed.md');

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

    const parent = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
    return {
      projectId,
      projectName,
      path: name,
      renamedName: renamed,
      renamedPath: `${parent}${renamed}`,
    };
  }, { body: SCRATCH_MARKDOWN, projectId: project.id, projectName: project.name });
}

async function removeScratchFile(page: Page, target: RenameTarget): Promise<void> {
  await page.evaluate(async ({ projectId, paths }) => {
    for (const path of paths) {
      const listRes = await fetch(
        `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
      );
      if (listRes.ok) {
        const annotations = await listRes.json();
        for (const annotation of annotations) {
          await fetch(`/api/annotations/${annotation.id}`, { method: 'DELETE' });
        }
      }
    }

    for (const path of paths) {
      await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, path }),
      });
    }
  }, { projectId: target.projectId, paths: [target.path, target.renamedPath] });
}

async function annotationCount(page: Page, projectId: number, path: string): Promise<number> {
  return page.evaluate(async ({ projectId, path }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    if (!res.ok) return 0;
    const annotations = await res.json();
    return annotations.length;
  }, { projectId, path });
}

async function revealTreeItem(page: Page, name: string): Promise<Locator> {
  await expect(page.getByRole('tree')).toBeVisible();
  const item = page.getByRole('treeitem', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  if ((await item.count()) === 0) {
    // The tree starts collapsed; expand the project root row.
    await page.getByRole('treeitem').first().click();
  }
  await expect(item).toBeVisible({ timeout: 15000 });
  return item;
}

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

test.describe('annotations follow an in-app rename', () => {
  let target: RenameTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page);
    // Reload so the file tree picks up the scratch file created via the API.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    // Activate the project so the file tree is mounted for the rename journey.
    const escapedName = target.projectName.replace(/"/g, '\\"');
    await page.locator(`.activity-bar-projects button[title="${escapedName}"]`).click();
    await expect(page.locator('.sidebar-header-name')).toHaveText(target.projectName);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('rename in the app keeps annotations attached to the file', async ({ page }) => {
    const item = await revealTreeItem(page, target.path);
    await item.click();

    await expect(page.getByRole('heading', { name: 'Rename Annotation E2E' })).toBeVisible({
      timeout: 15000,
    });

    // Annotate a stable block through the hover marker.
    const paragraph = page.getByText('A paragraph that keeps its annotation through a rename.', {
      exact: true,
    });
    await expect(paragraph).toBeVisible();
    await paragraph.hover();
    const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
    await marker.hover();
    await marker.click();

    const composer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(composer).toBeVisible();
    await composer.getByRole('textbox').fill(NOTE);
    await composer.getByRole('button', { name: 'Save' }).click();
    await expect(composer).not.toBeVisible();

    await openViewerByClicking(page, paragraph);
    await expect(page.getByRole('dialog', { name: 'Annotation' })).toContainText('rename body');
    await page.keyboard.press('Escape');

    // Rename the file through the tree's context menu; the prompt carries the
    // new basename.
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(target.renamedName);
    });
    await item.click({ button: 'right' });
    await page.getByRole('menu').getByRole('button', { name: 'Rename' }).click();

    const renamedItem = page.getByRole('treeitem', {
      name: new RegExp(target.renamedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    });
    await expect(renamedItem).toBeVisible({ timeout: 15000 });

    // The backend migrated the stored relative path to the new name.
    await expect
      .poll(() => annotationCount(page, target.projectId, target.renamedPath), {
        timeout: 15000,
      })
      .toBe(1);
    expect(await annotationCount(page, target.projectId, target.path)).toBe(0);

    // Reopening under the new name re-attaches the annotation by content hash.
    await page.goto(
      `/project/${target.projectId}/files/${encodeURIComponent(target.renamedPath)}`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page.getByRole('heading', { name: 'Rename Annotation E2E' })).toBeVisible({
      timeout: 15000,
    });

    const reopenedParagraph = page.getByText(
      'A paragraph that keeps its annotation through a rename.',
      { exact: true }
    );
    await openViewerByClicking(page, reopenedParagraph);
    const viewer = page.getByRole('dialog', { name: 'Annotation' });
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('rename body');

    await viewer.getByRole('button', { name: 'Delete' }).click();
    await expect(viewer).not.toBeVisible();
  });
});
