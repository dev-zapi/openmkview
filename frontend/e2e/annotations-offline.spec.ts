import {
  test,
  expect,
  loginIfNeeded,
  waitForDesktopApp,
  createScratchFile,
  removeScratchFile,
  probeFetch,
  type FileTarget,
} from './fixtures';
import type { Page } from '@playwright/test';

// Offline assertions must run in-page: Chromium stops enforcing offline mode
// after a full-page navigation (ADR-0002), so this follows offline.spec.ts.
test.describe.configure({ mode: 'serial' });

const SCRATCH_MARKDOWN = [
  '# Offline Annotations E2E',
  '',
  'A paragraph whose annotation must survive offline.',
  '',
  'An unannotated paragraph.',
  '',
].join('\n');

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

test.describe('annotations offline read-only', () => {
  let target: FileTarget;
  let otherFile: string | null;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    target = await createScratchFile(page, SCRATCH_MARKDOWN, 'annotations-offline');
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
    await expect(paragraph.getByRole('button', { name: /Annotate this block/ })).toBeVisible();

    // Start a draft on an unannotated block, then lose connectivity.
    const unannotated = page.getByText('An unannotated paragraph.', { exact: true });
    await unannotated.hover();
    const creationMarker = unannotated.getByRole('button', { name: /Annotate this block/ });
    await creationMarker.click();
    const draftComposer = page.getByRole('dialog', { name: 'New annotation' });
    await expect(draftComposer).toBeVisible();
    const draftInput = draftComposer.getByRole('textbox');
    await draftInput.fill('Draft written while connected');

    await context.setOffline(true);
    await expect(page.locator('.offline-indicator')).toBeVisible();

    // The open composer stays open with the draft preserved, but its controls
    // are visibly disabled instead of failing on Save.
    await expect(draftComposer).toBeVisible();
    await expect(draftInput).toHaveValue('Draft written while connected');
    await expect(draftInput).toBeDisabled();
    await expect(draftComposer.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(draftComposer).toContainText('Read-only while offline');
    await draftComposer.getByRole('button', { name: 'Cancel' }).click();
    await expect(draftComposer).not.toBeVisible();

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
    const viewerMarker = offlineParagraph.getByRole('button', { name: /Annotate this block/ });
    await expect(viewerMarker).toBeVisible();
    // Annotated markers only open the cached viewer, so they stay enabled.
    await expect(viewerMarker).not.toBeDisabled();

    // Clicking the highlight opens the cached popover.
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
    await expect(page.locator('.annotation-error')).not.toBeVisible();

    // Creation markers on unannotated blocks are disabled with an affordance,
    // and clicking the block cannot open a new composer.
    const unannotatedMarker = page
      .getByText('An unannotated paragraph.', { exact: true })
      .getByRole('button', { name: /Annotate this block/ });
    await expect(unannotatedMarker).toBeDisabled();
    await expect(unannotatedMarker).toHaveAttribute('title', 'Unavailable offline');
    await page.getByText('An unannotated paragraph.', { exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'New annotation' })).not.toBeVisible();
  });
});
