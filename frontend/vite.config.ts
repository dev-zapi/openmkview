import { defineConfig, type Plugin } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { mockServerPlugin } from './src/mock';

// Impeccable live 助手只绑定 localhost，且 live.js 内部端点硬编码 http://localhost:8400，
// 局域网设备（手机/平板）无法直连。此插件把助手代理到同源路径 /__impeccable，
// 并注入 shim 把 fetch/EventSource 重定向过去 —— 仅在助手存活时生效，平时零影响。
function impeccableLanProxy(): Plugin {
  const HELPER_PORT = 8400;
  const PROXY_BASE = '/__impeccable';
  let alive = false;
  let probedAt = 0;

  async function probe(): Promise<boolean> {
    if (Date.now() - probedAt < 5000) return alive;
    probedAt = Date.now();
    try {
      const res = await fetch(`http://127.0.0.1:${HELPER_PORT}/`, {
        signal: AbortSignal.timeout(400),
      });
      // 401/404 都说明助手在监听（未带 token 会被拒）
      alive = res.status > 0;
    } catch {
      alive = false;
    }
    return alive;
  }

  return {
    name: 'impeccable-lan-proxy',
    apply: 'serve',
    config() {
      return {
        server: {
          proxy: {
            [PROXY_BASE]: {
              target: `http://127.0.0.1:${HELPER_PORT}`,
              changeOrigin: true,
              rewrite: (path) => path.replace(PROXY_BASE, ''),
            },
          },
        },
      };
    },
    async transformIndexHtml(html) {
      if (!(await probe())) return html;
      const rewritten = html.replace(
        new RegExp(`http://localhost:${HELPER_PORT}/(live\\.js[^"']*)`, 'g'),
        `${PROXY_BASE}/$1`,
      );
      if (rewritten === html) return html;
      // 必须在 live.js 执行前生效；注入到 </head> 前保证顺序
      const shim = `<script>(function(){var A='http://localhost:${HELPER_PORT}',B='${PROXY_BASE}';function r(u){return typeof u==='string'&&u.startsWith(A)?B+u.slice(A.length):u}var F=window.fetch;window.fetch=function(i,init){i=r(i);if(i&&i.url&&i.url.startsWith(A))i=new Request(B+i.url.slice(A.length),i);return F.call(this,i,init)};var E=window.EventSource;window.EventSource=function(u,c){return new E(r(u),c)}})();</script>`;
      return rewritten.replace('</head>', `${shim}</head>`);
    },
  };
}

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
      impeccableLanProxy(),
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
          // 清理旧缓存
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              // 认证相关请求永不缓存：challenge 是一次性的，缓存必坏
              urlPattern: /\/api\/auth\//,
              handler: 'NetworkOnly',
            },
            {
              // 文件树/文件内容：优先网络，失败才用缓存，保证获取最新内容
              urlPattern: /\/api\/files\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-files',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                networkTimeoutSeconds: 3,
              },
            },
            {
              // 其余只读 API（项目列表、设置、主题等）：优先网络
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-data',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                networkTimeoutSeconds: 3,
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
