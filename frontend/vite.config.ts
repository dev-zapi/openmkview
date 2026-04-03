import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import tailwindcss from '@tailwindcss/vite';
import { mockServerPlugin } from './src/mock';

export default defineConfig(({ mode }) => {
  // 在开发模式下默认启用 mock
  const isDev = mode === 'development';
  const mockEnabled = process.env.VITE_MOCK_ENABLED !== 'false' && isDev;

  return {
    plugins: [
      solid(),
      tailwindcss(),
      // 在开发模式下启用 mock 服务
      mockServerPlugin(),
    ],
    optimizeDeps: {
      include: ['debug'],
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
    },
  };
});
