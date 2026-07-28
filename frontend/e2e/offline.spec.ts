import { test, expect } from './fixtures';
import { loginIfNeeded, waitForDesktopApp } from './fixtures';

interface MarkdownFileTarget {
  projectId: number;
  path: string;
}

// 通过 API 直接在页面上下文里找项目中的 markdown 文件，避免依赖文件树的 DOM 结构
async function findMarkdownFiles(page: import('@playwright/test').Page): Promise<MarkdownFileTarget[]> {
  return page.evaluate(async () => {
    const projectsRes = await fetch('/api/projects?open=true');
    if (!projectsRes.ok) return [];
    const projects = await projectsRes.json();
    const projectId = projects[0]?.id;
    if (!projectId) return [];

    const treeRes = await fetch(`/api/files/tree?project_id=${projectId}`);
    if (!treeRes.ok) return [];
    const tree = await treeRes.json();

    const results: { projectId: number; path: string }[] = [];
    const walk = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isFolder && node.path.endsWith('.md')) {
          results.push({ projectId, path: node.path });
        }
        if (node.children) walk(node.children);
      }
    };
    walk(tree);
    return results;
  });
}

const contentUrl = (f: MarkdownFileTarget) =>
  `/api/files/content?relativePath=${encodeURIComponent(f.path)}&project_id=${f.projectId}`;

// 页面内 fetch 探测：断网后不做整页导航时请求是真被阻断的
// （Chromium 的离线模拟在整页导航后会失效，因此离线断言必须在同一页面内完成）
async function probeFetch(page: import('@playwright/test').Page, url: string): Promise<string> {
  return page.evaluate(async (u) => {
    try {
      const res = await fetch(u);
      return `status:${res.status}`;
    } catch {
      return 'failed';
    }
  }, url);
}

test.describe('PWA offline mode', () => {
  test('app shell and cached content work offline; uncached content shows empty state', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await loginIfNeeded(page);
    await waitForDesktopApp(page);

    // service worker 激活并控制当前页面
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    const files = await findMarkdownFiles(page);
    test.skip(files.length < 2, '需要后端项目里至少有两个 markdown 文件');

    // 优先选根目录文件：文件树默认折叠，嵌套文件不展开点不到
    const rootFiles = files.filter((f) => !f.path.includes('/'));
    const pickFrom = rootFiles.length >= 2 ? rootFiles : files;

    // 在线打开第一个文件，使其内容进入运行时缓存
    const cached = pickFrom[0];
    const uncached = pickFrom[1];
    await page.goto(`/project/${cached.projectId}/files/${encodeURIComponent(cached.path)}`);
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    await context.setOffline(true);

    // --- 同一页面内的离线断言（此时请求真被阻断） ---
    // 应用壳已被预缓存，离线可启动
    expect(await probeFetch(page, '/index.html')).toBe('status:200');
    // 访问过的文件内容命中运行时缓存
    expect(await probeFetch(page, contentUrl(cached))).toBe('status:200');
    // 未访问过的文件内容离线不可用
    expect(await probeFetch(page, contentUrl(uncached))).toBe('failed');

    // 离线标识出现
    await expect(page.locator('.offline-indicator')).toBeVisible();

    // 打开未缓存的文件（客户端导航，不整页刷新）：显示空态提示
    const uncachedItem = page.getByRole('treeitem', {
      name: uncached.path.split('/').pop()!,
    });
    if (await uncachedItem.first().isVisible().catch(() => false)) {
      await uncachedItem.first().click();
      await expect(page.locator('.load-error')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.load-error')).toContainText('离线');
    }

    // 再打开已缓存的文件：内容正常显示
    const cachedItem = page.getByRole('treeitem', {
      name: cached.path.split('/').pop()!,
    });
    if (await cachedItem.first().isVisible().catch(() => false)) {
      await cachedItem.first().click();
      await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });
    }

    // 最后整页刷新：应用仍能启动（Chromium 离线模拟在导航后可能失效，
    // 此断言只验证启动流程不崩，离线能力由上面的页面内断言保证）
    await page.reload();
    await expect(page.locator('.app-container')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.markdown-wrapper')).toBeVisible({ timeout: 15000 });

    await context.setOffline(false);
  });
});
