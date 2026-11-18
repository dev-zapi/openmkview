import {
  test,
  expect,
  loginIfNeeded,
  createScratchFile,
  openScratchFile,
  removeScratchFile,
  createBlockAnnotation,
  openAnnotationColumn,
} from './fixtures';
import type { FileTarget } from './fixtures';

// Reply authorship (ticket #29): the web UI stamps the logged-in username,
// API-authored agent replies are visibly marked, and legacy notes with no
// author render as an em dash. Uses a scratch file so shared project state
// stays clean.

test.describe.configure({ mode: 'serial' });

const HEADING = 'Authorship E2E';
const TARGET = 'The target paragraph for authorship.';

function scratchMarkdown(): string {
  return ['# ' + HEADING, '', TARGET, '', 'A paragraph after the target.', ''].join('\n');
}

async function annotationIdFor(page: import('@playwright/test').Page, target: FileTarget) {
  return page.evaluate(async ({ projectId, path }) => {
    const res = await fetch(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(path)}`
    );
    if (!res.ok) throw new Error(`cannot list annotations: ${res.status}`);
    const annotations = await res.json();
    if (annotations.length === 0) throw new Error('annotation was not created');
    return annotations[0].id as number;
  }, target);
}

async function replyThroughApi(
  page: import('@playwright/test').Page,
  annotationId: number,
  payload: Record<string, unknown>
) {
  const status = await page.evaluate(
    async ({ id, body }) => {
      const res = await fetch(`/api/annotations/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.status;
    },
    { id: annotationId, body: payload }
  );
  expect(status).toBe(200);
}

test.describe('annotation authorship', () => {
  let target: FileTarget;

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await loginIfNeeded(page);
    target = await createScratchFile(page, scratchMarkdown(), 'annotations-authorship');
    await openScratchFile(page, target, HEADING);
  });

  test.afterEach(async ({ page }) => {
    if (target) await removeScratchFile(page, target);
  });

  test('human replies show the logged-in username', async ({ page }) => {
    const username = process.env.E2E_USERNAME;
    if (!username) throw new Error('E2E_USERNAME is required for the authorship spec');

    await createBlockAnnotation(page, TARGET, 'Human note');
    const column = await openAnnotationColumn(page);

    const firstNote = column.locator('.annotation-note').first();
    await expect(firstNote.locator('.annotation-note-author-name')).toHaveText(username);
    await expect(firstNote.locator('.annotation-note-agent-badge')).toHaveCount(0);
  });

  test('agent replies created through the API show an agent badge', async ({ page }) => {
    await createBlockAnnotation(page, TARGET, 'Human note');
    const annotationId = await annotationIdFor(page, target);
    await replyThroughApi(page, annotationId, {
      body: 'Agent reply',
      author: 'openmkview-agent',
      isAgent: true,
    });

    // Re-open the file so the thread reloads the API-created reply.
    await openScratchFile(page, target, HEADING);
    const column = await openAnnotationColumn(page);

    const agentNote = column.locator('.annotation-note').nth(1);
    await expect(agentNote.locator('.annotation-note-author-name')).toHaveText(
      'openmkview-agent'
    );
    await expect(agentNote.locator('.annotation-note-agent-badge')).toHaveText('Agent');
  });

  test('legacy notes without an author render an em dash', async ({ page }) => {
    await createBlockAnnotation(page, TARGET, 'Human note');
    const annotationId = await annotationIdFor(page, target);
    // Omitted author/isAgent is the legacy/older-client payload shape.
    await replyThroughApi(page, annotationId, { body: 'Legacy reply' });

    await openScratchFile(page, target, HEADING);
    const column = await openAnnotationColumn(page);

    const legacyNote = column.locator('.annotation-note').nth(1);
    await expect(legacyNote.locator('.annotation-note-author-name')).toHaveText('—');
    await expect(legacyNote.locator('.annotation-note-agent-badge')).toHaveCount(0);
  });
});
