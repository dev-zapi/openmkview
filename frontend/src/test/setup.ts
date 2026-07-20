/// <reference types="vitest/globals" />

import { vi } from 'vitest';

if (typeof CSS === 'undefined') {
  (globalThis as any).CSS = {
    escape: (str: string) => str.replace(/([^\w-])/g, '\\$1'),
  };
}

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
