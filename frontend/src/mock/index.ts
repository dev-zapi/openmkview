/**
 * Mock 服务插件
 * 在开发环境中拦截 API 请求并返回模拟数据
 */

import type { Plugin } from 'vite';
import { handleProjectsApi, handleFilesApi, handleGitApi } from './handlers';

// 全局配置，由 vite.config.ts 设置
let mockEnabled = true;

/**
 * 设置 Mock 启用状态
 */
export function setMockEnabled(enabled: boolean) {
  mockEnabled = enabled;
}

/**
 * 创建 Mock 服务插件
 */
export function mockServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-mock-server',
    enforce: 'pre', // 在其他插件之前执行

    configResolved(config) {
      // 在开发模式下默认启用 mock
      mockEnabled = config.env.VITE_MOCK_ENABLED !== 'false' && config.mode === 'development';

      if (mockEnabled) {
        console.log('[Mock Server] Mock API server enabled');
      } else {
        console.log('[Mock Server] Mock is disabled');
      }
    },

    configureServer(server) {
      if (!mockEnabled) {
        return;
      }

      // 添加中间件
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 只处理 /api 开头的请求
        if (!url.startsWith('/api')) {
          return next();
        }

        // 记录请求
        console.log(`[Mock Server] ${req.method} ${url}`);

        try {
          // 尝试处理项目 API
          if (await handleProjectsApi(req, res, next)) {
            return;
          }

          // 尝试处理文件 API
          if (await handleFilesApi(req, res, next)) {
            return;
          }

          // 尝试处理 Git API
          if (await handleGitApi(req, res, next)) {
            return;
          }

          // 未找到匹配的 API
          console.log(`[Mock Server] 404 - ${req.method} ${url}`);
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not Found', path: url }));
        } catch (error) {
          console.error('[Mock Server] Error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    },
  };
}

// 导出数据供其他模块使用
export * from './data';