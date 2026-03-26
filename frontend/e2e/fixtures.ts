import { test as base, Page, BrowserContext } from '@playwright/test';

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