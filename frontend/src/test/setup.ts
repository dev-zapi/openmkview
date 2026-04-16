/// <reference types="vitest/globals" />

import { vi } from 'vitest';

let prefersDark = false;

export const setPrefersDark = (value: boolean) => {
  prefersDark = value;
};

export const resetPrefersDark = () => {
  prefersDark = false;
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
