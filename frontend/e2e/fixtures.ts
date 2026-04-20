import { test as base, expect, Page } from '@playwright/test';

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
