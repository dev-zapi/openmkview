import { test as base, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface ConsoleMessage {
  type: string;
  text: string;
  url?: string;
  lineNumber?: number;
  timestamp: string;
}

export interface TestFixtures {
  consoleMessages: ConsoleMessage[];
}

export async function loginIfNeeded(page: Page) {
  await page.waitForLoadState('domcontentloaded');

  const username = page.getByRole('textbox', { name: 'Username' });
  if (await username.isVisible().catch(() => false)) {
    const e2eUsername = process.env.E2E_USERNAME;
    const e2ePassword = process.env.E2E_PASSWORD;

    if (!e2eUsername || !e2ePassword) {
      throw new Error('E2E_USERNAME and E2E_PASSWORD are required when the login page is shown');
    }

    await username.fill(e2eUsername);
    await page.getByRole('textbox', { name: 'Password' }).fill(e2ePassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
}

export async function waitForDesktopApp(page: Page) {
  await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.activity-bar')).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.locator('.activity-bar-projects button').count(), {
    timeout: 15000,
  }).toBeGreaterThan(0);
}

/** Click the first README in the file tree, expanding the root when collapsed. */
export async function openReadme(page: Page) {
  await expect(page.getByRole('tree')).toBeVisible();

  const readme = page.getByRole('treeitem', { name: /readme/i }).first();
  if ((await readme.count()) === 0) {
    // The file tree starts collapsed; expand the project root row.
    await page.getByRole('treeitem').first().click();
  }
  await expect(readme).toBeVisible();
  await readme.click();
}

/** Open the configured project's README and switch the view tabs to Edit. */
export async function openReadmeInEdit(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);
  await waitForDesktopApp(page);

  await page.locator('.activity-bar-projects button[title="openmkview"]').click();
  await expect(page.locator('.sidebar-header-name')).toHaveText('openmkview');

  await openReadme(page);
  await page.locator('[class*="viewTabs"]').getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('.editor-status-bar')).toBeVisible();
}

/** A scratch Markdown file inside the first open project. */
export interface FileTarget {
  projectId: number;
  path: string;
}

/** Create a uniquely named Markdown file in the first open project. */
export async function createScratchFile(
  page: Page,
  body: string,
  prefix = 'annotations-e2e'
): Promise<FileTarget> {
  return page.evaluate(async ({ body, prefix }) => {
    const projectsRes = await fetch('/api/projects?open=true');
    if (!projectsRes.ok) throw new Error('cannot list projects');
    const projects = await projectsRes.json();
    const projectId = projects[0]?.id;
    if (!projectId) throw new Error('no open project to annotate');

    const name = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.md`;
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
  }, { body, prefix });
}

/** Delete the scratch file's annotations first, then the file itself. */
export async function removeScratchFile(page: Page, target: FileTarget): Promise<void> {
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

/** Open a scratch file by URL and wait for its top-level heading. */
export async function openScratchFile(
  page: Page,
  target: FileTarget,
  heading: string
): Promise<void> {
  await page.goto(
    `/project/${target.projectId}/files/${encodeURIComponent(target.path)}`,
    { waitUntil: 'domcontentloaded' }
  );
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
}

/** In-page fetch probe: offline assertions must stay in the same page. */
export async function probeFetch(page: Page, url: string): Promise<string> {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u);
      return `status:${res.status}`;
    } catch {
      return 'failed';
    }
  }, url);
}

/** A throwaway project directory seeded through the real project API. */
export interface ScratchProject {
  projectId: number;
  projectDir: string;
  path: string;
}

/**
 * Seed an isolated project + Markdown file. Serial mutation specs use this
 * instead of the shared seeded project so parallel agents cannot interfere.
 * The caller must already be on the app origin (fetch runs in the page).
 */
export async function createScratchProject(
  page: Page,
  fileName: string,
  content: string,
  prefix = 'annotations-e2e'
): Promise<ScratchProject> {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  fs.writeFileSync(path.join(projectDir, fileName), content);

  const project = await page.evaluate(async (dir) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dir }),
    });
    if (!res.ok) throw new Error(`cannot create scratch project: ${res.status}`);
    return res.json();
  }, projectDir);

  return { projectId: project.id, projectDir, path: fileName };
}

/** Delete the file's annotations and the scratch directory. */
export async function removeScratchProject(
  page: Page,
  target: ScratchProject
): Promise<void> {
  await page.evaluate(
    async ({ projectId, relativePath }) => {
      const res = await fetch(
        `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`
      );
      if (res.ok) {
        const annotations = await res.json();
        for (const annotation of annotations) {
          await fetch(`/api/annotations/${annotation.id}`, { method: 'DELETE' });
        }
      }
      // Close the project so later specs never pick this deleted scratch
      // directory as the first open project.
      await fetch(`/api/projects/${projectId}/close`, { method: 'POST' });
    },
    { projectId: target.projectId, relativePath: target.path }
  );

  fs.rmSync(target.projectDir, { recursive: true, force: true });
}

// 扩展 test fixture，添加控制台日志收集
export const test = base.extend<TestFixtures>({
  consoleMessages: async ({ page }, use) => {
    const messages: ConsoleMessage[] = [];

    // 监听控制台消息
    page.on('console', (msg) => {
      const message: ConsoleMessage = {
        type: msg.type(),
        text: msg.text(),
        url: msg.location().url,
        lineNumber: msg.location().lineNumber,
        timestamp: new Date().toISOString(),
      };
      messages.push(message);

      // 在终端输出控制台消息（便于调试）
      const prefix = `[Browser ${msg.type().toUpperCase()}]`;
      console.log(`${prefix} ${msg.text()}`);
    });

    // 监听页面错误
    page.on('pageerror', (error) => {
      const message: ConsoleMessage = {
        type: 'error',
        text: `Uncaught exception: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      messages.push(message);
      console.error(`[Browser PAGE ERROR] ${error.message}`);
    });

    // 监听请求失败
    page.on('requestfailed', (request) => {
      const message: ConsoleMessage = {
        type: 'error',
        text: `Request failed: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
        url: request.url(),
        timestamp: new Date().toISOString(),
      };
      messages.push(message);
      console.error(`[Browser REQUEST FAILED] ${request.url()}`);
    });

    await use(messages);
  },
});

export { expect } from '@playwright/test';
