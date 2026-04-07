/**
 * Mock service plugin
 * Intercepts API requests in development environment and returns mock data
 */

import type { Plugin } from 'vite';
import { handleProjectsApi, handleFilesApi, handleGitApi } from './handlers';

// Global configuration, set by vite.config.ts
let mockEnabled = true;

/**
 * Set Mock enabled status
 */
export function setMockEnabled(enabled: boolean) {
  mockEnabled = enabled;
}

/**
 * Create Mock service plugin
 */
export function mockServerPlugin(): Plugin {
  return {
    name: 'vite-plugin-mock-server',
    enforce: 'pre', // Execute before other plugins

    configResolved(config) {
      // Enable mock by default in development mode
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

      // Add middleware
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // Only handle requests starting with /api
        if (!url.startsWith('/api')) {
          return next();
        }

        // Log request
        console.log(`[Mock Server] ${req.method} ${url}`);

        try {
          // Try to handle projects API
          if (await handleProjectsApi(req, res, next)) {
            return;
          }

          // Try to handle files API
          if (await handleFilesApi(req, res, next)) {
            return;
          }

          // Try to handle Git API
          if (await handleGitApi(req, res, next)) {
            return;
          }

          // No matching API found
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

// Export data for other modules to use
export * from './data';