import {
  test,
  expect,
  loginIfNeeded,
  waitForDesktopApp,
  createScratchFile,
  getHarnessProject,
} from './fixtures';
import type { FileTarget } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Annotation management panel (ticket #22). Every test works inside uniquely
// named scratch files of the seeded open project and cleans up by API, so
// parallel workers and later specs never see leftover rows.
// Assertions stay on user-visible surfaces (roles, text, focus, viewport).

test.describe.configure({ mode: 'serial' });

const TARGET_A = 'The A target paragraph for the management panel.';
const TARGET_B = 'The B target paragraph for the management panel.';
const MANAGED_PREFIX = 'annotations-manage';

function markdown(title: string, target: string): string {
  const filler = Array.from({ length: 24 }, (_, index) => [
    `Filler paragraph ${index + 1}: scrolling context before the target.`,
    '',
  ]).flat();
  return [`# ${title}`, '', 'Introductory paragraph.', '', ...filler, target, '', 'After.', ''].join(
    '\n'
  );
}

function demoAnchor(blockText: string) {
  return {
    version: 1,
    segments: [
      {
        kind: 'block',
        blockHash: `e2e-manage-${Math.random().toString(16).slice(2)}`,
        blockText,
        blockType: 'p',
        headingPath: ['Management'],
      },
    ],
  };
}

async function createAnnotationViaApi(
  page: Page,
  target: FileTarget,
  body: string
): Promise<number> {
  return page.evaluate(
    async ({ projectId, relativePath, body, anchor }) => {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, relativePath, anchor, body }),
      });
      if (!res.ok) throw new Error(`cannot seed annotation: ${res.status}`);
      const created = await res.json();
      return created.id as number;
    },
    {
      projectId: target.projectId,
      relativePath: target.path,
      body,
      anchor: demoAnchor(body),
    }
  );
}

async function openScratch(page: Page, target: FileTarget, heading: string): Promise<void> {
  await page.goto(`/project/${target.projectId}/files/${encodeURIComponent(target.path)}`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
}

async function openColumn(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
  const column = page.getByRole('region', { name: 'Annotations' });
  await expect(column).toBeVisible();
  return column;
}

async function openManager(page: Page): Promise<Locator> {
  await openColumn(page);
  await page.getByRole('button', { name: 'Manage annotations' }).click();
  const manager = page.getByRole('dialog', { name: 'Manage annotations' });
  await expect(manager).toBeVisible();
  return manager;
}

function rowFor(manager: Locator, text: string): Locator {
  return manager.getByRole('row').filter({ hasText: text });
}

async function createBlockAnnotation(page: Page, target: FileTarget, body: string): Promise<void> {
  const paragraph = page.getByRole('paragraph').filter({ hasText: target });
  await expect(paragraph).toBeVisible();
  await paragraph.hover();
  const marker = paragraph.getByRole('button', { name: /Annotate this block/ });
  await marker.hover();
  await marker.click();

  const composer = page.getByRole('dialog', { name: 'New annotation' });
  await expect(composer).toBeVisible();
  await composer.getByRole('textbox').fill(body);
  await composer.getByRole('button', { name: 'Save' }).click();
  await expect(composer).not.toBeVisible();
}

async function cleanup(page: Page, targets: FileTarget[]): Promise<void> {
  if (targets.length === 0) return;
  await page.evaluate(async ({ projectId, prefix, paths }) => {
    const res = await fetch(`/api/annotations/manage?project_id=${projectId}`);
    if (res.ok) {
      const rows = await res.json();
      for (const row of rows) {
        if ((row.relativePath as string).startsWith(prefix)) {
          await fetch(`/api/annotations/${row.id}`, { method: 'DELETE' });
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
  }, { projectId: targets[0].projectId, prefix: MANAGED_PREFIX, paths: targets.map((t) => t.path) });
}

/**
 * Create a project whose directory and content this test owns, so project-wide
 * operations (clear-all) can never touch the shared seeded project. The
 * harness project is re-opened so it keeps heading the activity bar while the
 * temporary project exists (standalone-frame clicks the first project).
 */
async function createOwnedProject(
  page: Page,
  path: string,
  previousProjectPath?: string
): Promise<number> {
  return page.evaluate(
    async ({ projectPath, restorePath }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectPath }),
      });
      if (!res.ok) throw new Error(`cannot create owned project: ${res.status}`);
      const created = await res.json();

      if (restorePath) {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: restorePath }),
        });
      }
      return created.id as number;
    },
    { projectPath: path, restorePath: previousProjectPath }
  );
}

test.describe('annotation management panel', () => {
  let targets: FileTarget[] = [];

  test.beforeEach(async ({ page }) => {
    targets = [];
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page, targets);
    targets = [];
  });

  test('lists annotations across files and jumps into the right document', async ({ page }) => {
    const fileA = await createScratchFile(page, markdown('Management A', TARGET_A), MANAGED_PREFIX);
    const fileB = await createScratchFile(page, markdown('Management B', TARGET_B), MANAGED_PREFIX);
    targets = [fileA, fileB];

    await openScratch(page, fileA, 'Management A');
    await createBlockAnnotation(page, TARGET_A, 'A note from the document');

    await openScratch(page, fileB, 'Management B');
    await createBlockAnnotation(page, TARGET_B, 'B note from the document');

    // Return to A: the jump must open B and focus its annotation.
    await openScratch(page, fileA, 'Management A');
    const manager = await openManager(page);

    const rowA = rowFor(manager, 'A note from the document');
    const rowB = rowFor(manager, 'B note from the document');
    await expect(rowA).toContainText(fileA.path);
    await expect(rowA).toContainText(TARGET_A);
    await expect(rowA).toContainText('Active');
    await expect(rowB).toContainText(fileB.path);

    await rowB.getByRole('button', { name: 'Jump' }).click();
    await expect(manager).not.toBeVisible();

    const targetB = page.getByRole('paragraph').filter({ hasText: TARGET_B });
    await expect(page.getByRole('heading', { name: 'Management B' })).toBeVisible();
    await expect(targetB).toBeInViewport();
    await expect(targetB).toBeFocused();
  });

  test('shows Outdated state for rows in a different file', async ({ page }) => {
    const healthy = await createScratchFile(
      page,
      markdown('Management Healthy', TARGET_A),
      MANAGED_PREFIX
    );
    const drifted = await createScratchFile(
      page,
      markdown('Management Drifted', TARGET_B),
      MANAGED_PREFIX
    );
    targets = [healthy, drifted];

    // The anchor text is absent from the drifted file, so its row must resolve
    // Outdated from that file's own content, not from the open file's status.
    await createAnnotationViaApi(page, drifted, 'cross-file outdated note');

    await openScratch(page, healthy, 'Management Healthy');
    await createBlockAnnotation(page, TARGET_A, 'healthy note');
    const manager = await openManager(page);

    const driftedRow = rowFor(manager, 'cross-file outdated note');
    await expect(driftedRow).toContainText('Outdated');
    await expect(driftedRow.getByRole('button', { name: 'Jump' })).toHaveCount(0);
    await expect(rowFor(manager, 'healthy note').getByRole('button', { name: 'Jump' })).toBeVisible();
  });

  test('missing-file rows explain why they cannot jump', async ({ page }) => {
    const healthy = await createScratchFile(
      page,
      markdown('Management Healthy', TARGET_A),
      MANAGED_PREFIX
    );
    const missingFile = await createScratchFile(
      page,
      markdown('Management Gone', TARGET_B),
      MANAGED_PREFIX
    );
    targets = [healthy, missingFile];

    await createAnnotationViaApi(page, missingFile, 'missing file note');
    await page.evaluate(async ({ projectId, path }) => {
      await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, path }),
      });
    }, missingFile);

    await openScratch(page, healthy, 'Management Healthy');
    // A real UI anchor so the row stays locatable (not Outdated).
    await createBlockAnnotation(page, TARGET_A, 'healthy note');
    const manager = await openManager(page);

    const missingFileRow = rowFor(manager, 'missing file note');
    await expect(missingFileRow).toContainText(missingFile.path);
    await expect(missingFileRow).toContainText('File missing — cannot jump');
    await expect(missingFileRow.getByRole('button', { name: 'Jump' })).toHaveCount(0);

    await expect(rowFor(manager, 'healthy note').getByRole('button', { name: 'Jump' })).toBeVisible();
  });

  test('multi-select delete removes the selected annotations in one action', async ({ page }) => {
    const file = await createScratchFile(
      page,
      markdown('Management Delete', TARGET_A),
      MANAGED_PREFIX
    );
    targets = [file];

    await createAnnotationViaApi(page, file, 'delete note one');
    await createAnnotationViaApi(page, file, 'delete note two');
    await createAnnotationViaApi(page, file, 'keep note three');

    await openScratch(page, file, 'Management Delete');
    const manager = await openManager(page);

    await rowFor(manager, 'delete note one').getByRole('checkbox').check();
    await rowFor(manager, 'delete note two').getByRole('checkbox').check();
    await expect(manager.getByText('2 selected')).toBeVisible();

    await manager.getByRole('button', { name: 'Delete selected' }).click();

    await expect(rowFor(manager, 'delete note one')).toHaveCount(0);
    await expect(rowFor(manager, 'delete note two')).toHaveCount(0);
    await expect(rowFor(manager, 'keep note three')).toBeVisible();
    // The panel is project-wide, so other specs may have rows here too; only
    // assert that our selected rows were the ones removed.
  });

  test('multi-select Resolved toggle works in one action each way', async ({ page }) => {
    const file = await createScratchFile(
      page,
      markdown('Management Resolve', TARGET_A),
      MANAGED_PREFIX
    );
    targets = [file];

    await createAnnotationViaApi(page, file, 'resolve note one');
    await createAnnotationViaApi(page, file, 'resolve note two');

    await openScratch(page, file, 'Management Resolve');
    const manager = await openManager(page);

    // Select only this test's rows: the shared project may carry rows from
    // concurrently running annotation specs.
    await rowFor(manager, 'resolve note one').getByRole('checkbox').check();
    await rowFor(manager, 'resolve note two').getByRole('checkbox').check();
    await expect(manager.getByText('2 selected')).toBeVisible();
    await manager.getByRole('button', { name: 'Resolve selected' }).click();

    await expect(rowFor(manager, 'resolve note one').getByText('Resolved')).toBeVisible();
    await expect(rowFor(manager, 'resolve note two').getByText('Resolved')).toBeVisible();

    await rowFor(manager, 'resolve note one').getByRole('checkbox').check();
    await rowFor(manager, 'resolve note two').getByRole('checkbox').check();
    await manager.getByRole('button', { name: 'Unresolve selected' }).click();

    await expect(rowFor(manager, 'resolve note one').getByText('Active')).toBeVisible();
    await expect(rowFor(manager, 'resolve note two').getByText('Active')).toBeVisible();
  });

  test('clear-all requires explicit confirmation and removes the project annotations', async ({
    page,
  }) => {
    // Clear-all is project-wide, so it runs against a project this test owns:
    // parallel annotation specs share the seeded project and must never be
    // wiped by this journey.
    const projectDir = mkdtempSync(join(tmpdir(), 'openmkview-manage-clear-'));
    const filePath = 'clear-target.md';
    writeFileSync(join(projectDir, filePath), markdown('Management Clear', TARGET_A));

    let projectId: number | undefined;
    let previousProjectPath: string | undefined;
    try {
      const previous = await getHarnessProject(page);
      previousProjectPath = previous.path;
      projectId = await createOwnedProject(page, projectDir, previousProjectPath);
      const target = { projectId, path: filePath };
      await createAnnotationViaApi(page, target, 'clear note one');
      await createAnnotationViaApi(page, target, 'clear note two');

      await openScratch(page, target, 'Management Clear');
      const manager = await openManager(page);

      await manager.getByRole('button', { name: /^Clear all annotations/ }).click();
      const confirm = manager.getByRole('group', { name: 'Confirm clear all annotations' });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText('Delete all 2 annotations in this project?');

      // Cancelling leaves every row in place.
      await confirm.getByRole('button', { name: 'Cancel' }).click();
      await expect(confirm).not.toBeVisible();
      await expect(rowFor(manager, 'clear note one')).toBeVisible();

      await manager.getByRole('button', { name: /^Clear all annotations/ }).click();
      await manager
        .getByRole('group', { name: 'Confirm clear all annotations' })
        .getByRole('button', { name: 'Clear all', exact: true })
        .click();

      await expect(manager.getByText('No annotations in this project')).toBeVisible();
      await expect(manager.getByRole('row').filter({ hasText: 'clear note' })).toHaveCount(0);
    } finally {
      if (projectId !== undefined) {
        await page.evaluate(
          async ({ id, restorePath }) => {
            await fetch(`/api/annotations/project/${id}`, { method: 'DELETE' });
            await fetch(`/api/projects/${id}/close`, { method: 'POST' });
            // Restore the harness project at the head of the activity bar.
            if (restorePath) {
              await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: restorePath }),
              });
            }
          },
          { id: projectId, restorePath: previousProjectPath }
        );
      }
      rmSync(projectDir, { recursive: true, force: true });
    }

    // The harness project must head the activity bar again immediately after
    // the temporary project closes (standalone-frame clicks the first one).
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const res = await fetch('/api/projects?open=true');
            const projects = await res.json();
            return projects[0]?.path as string | undefined;
          }),
        { timeout: 10000 }
      )
      .toBe(previousProjectPath);
  });
});
