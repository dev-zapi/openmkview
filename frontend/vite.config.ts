import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { mockServerPlugin } from './src/mock';

export default defineConfig(({ mode }) => {
  // 在开发模式下默认启用 mock
  const isDev = mode === 'development';
  const mockEnabled = process.env.VITE_MOCK_ENABLED !== 'false' && isDev;
  const frontendBuildTime = new Date().toISOString();

  return {
    define: {
      'import.meta.env.VITE_FRONTEND_BUILD_TIME': JSON.stringify(frontendBuildTime),
    },
    plugins: [
      solid(),
      tailwindcss(),
      mockServerPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        // 使用 public/manifest.json 中已有的清单，插件不再生成
        manifest: false,
        workbox: {
          // shiki worker (~2.8MB) 是语法高亮必需，离线也要可用
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // iframe 预览 HTML 文件也是 navigation 请求，不能被 SPA fallback
          // 拦截成 index.html，否则 /api/files/raw 会显示应用首页
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // 认证相关请求永不缓存：challenge 是一次性的，缓存必坏
              urlPattern: /\/api\/auth\//,
              handler: 'NetworkOnly',
            },
            {
              // 文件树/文件内容：LRU 200 条、30 天过期
              urlPattern: /\/api\/files\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-files',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
            {
              // 其余只读 API（项目列表、设置、主题等）
              urlPattern: /\/api\//,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'api-data',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
        devOptions: {
          // dev 下不启用，避免与 HMR 冲突；用 build + preview 验证
          enabled: false,
        },
      }),
    ],
    resolve: {
      dedupe: [
        'shiki',
        '@shikijs/core',
        '@shikijs/engine-oniguruma',
        '@shikijs/engine-javascript',
        '@shikijs/langs',
        '@shikijs/themes',
        '@shikijs/types',
        '@shikijs/transformers',
      ],
    },
    optimizeDeps: {
      include: ['debug', 'extend'],
    },
    server: {
      host: '0.0.0.0',
      port: 3001,
      proxy: {
        // 当 mock 禁用时，代理到后端服务
        ...(!mockEnabled && {
          '/api': {
            target: 'http://localhost:4567',
            changeOrigin: true,
          },
        }),
      },
    },
    build: {
      target: 'esnext',
      outDir: '../dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500,
    },
  };
});
