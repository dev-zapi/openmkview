import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH_RATIO,
  type ThemeMode,
  type ThemeType,
  type Theme,
  type Settings,
} from '../../types/app';

describe('app types', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('has valid default values', () => {
      expect(DEFAULT_SETTINGS.markdownWidth).toBe('full');
      expect(DEFAULT_SETTINGS.themeMode).toBe('system');
      expect(DEFAULT_SETTINGS.trashExpireDays).toBe(30);
    });

    it('has protected paths defined', () => {
      expect(DEFAULT_SETTINGS.protectedPaths.length).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.protectedPaths).toContain('.git');
      expect(DEFAULT_SETTINGS.protectedPaths).toContain('node_modules');
    });
  });

  describe('constants', () => {
    it('DEFAULT_SIDEBAR_WIDTH is valid', () => {
      expect(DEFAULT_SIDEBAR_WIDTH).toBe(280);
    });

    it('MIN_SIDEBAR_WIDTH is valid', () => {
      expect(MIN_SIDEBAR_WIDTH).toBe(200);
    });

    it('MAX_SIDEBAR_WIDTH_RATIO is valid', () => {
      expect(MAX_SIDEBAR_WIDTH_RATIO).toBe(0.4);
    });

    it('MIN_SIDEBAR_WIDTH is less than DEFAULT_SIDEBAR_WIDTH', () => {
      expect(MIN_SIDEBAR_WIDTH).toBeLessThan(DEFAULT_SIDEBAR_WIDTH);
    });
  });

  describe('type definitions', () => {
    it('ThemeMode allows valid values', () => {
      const light: ThemeMode = 'light';
      const dark: ThemeMode = 'dark';
      const system: ThemeMode = 'system';
      expect([light, dark, system]).toBeTruthy();
    });

    it('ThemeType allows valid values', () => {
      const light: ThemeType = 'light';
      const dark: ThemeType = 'dark';
      expect([light, dark]).toBeTruthy();
    });

    it('Theme interface is correctly typed', () => {
      const theme: Theme = {
        id: 'light-default',
        name: 'Light',
        type: 'light',
        builtin: true,
      };
      expect(theme.id).toBe('light-default');
      expect(theme.builtin).toBe(true);
    });

    it('Settings interface is correctly typed', () => {
      const settings: Settings = DEFAULT_SETTINGS;
      expect(settings.markdownWidth).toBe('full');
      expect(typeof settings.protectedPaths).toBe('object');
    });
  });
});