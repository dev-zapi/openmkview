import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Whole-App tests mount heavy editor/markdown modules; under the full
    // parallel suite the default 5s can elapse before the first paint.
    testTimeout: 15000,
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
    deps: {
      inline: [/solid-js/],
    },
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**', '**/dist/**'],
  },
});
