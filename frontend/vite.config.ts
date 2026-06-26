import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
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
