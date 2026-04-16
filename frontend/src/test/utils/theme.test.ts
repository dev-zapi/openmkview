import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSystemTheme,
  getEffectiveThemeType,
  applyTheme,
  cycleThemeMode,
} from '../../utils/theme';
import type { ThemeMode, ThemeType } from '../../types/app';
import { resetPrefersDark, setPrefersDark } from '../setup';

describe('theme utils', () => {
  beforeEach(() => {
    resetPrefersDark();
  });

  describe('getSystemTheme', () => {
    it('returns dark when system prefers dark', () => {
      setPrefersDark(true);
      expect(getSystemTheme()).toBe('dark');
    });

    it('returns light when system prefers light', () => {
      expect(getSystemTheme()).toBe('light');
    });
  });

  describe('getEffectiveThemeType', () => {
    it('returns light when mode is light', () => {
      expect(getEffectiveThemeType('light')).toBe('light');
    });

    it('returns dark when mode is dark', () => {
      expect(getEffectiveThemeType('dark')).toBe('dark');
    });

    it('returns system theme when mode is system', () => {
      setPrefersDark(true);
      expect(getEffectiveThemeType('system')).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      document.body.className = '';
    });

    it('applies light theme correctly', () => {
      applyTheme({
        themeMode: 'light',
        lightTheme: 'custom-light',
        darkTheme: 'custom-dark',
      });
      expect(document.body.classList.contains('light-theme')).toBe(true);
      expect(document.body.classList.contains('custom-light')).toBe(true);
    });

    it('applies dark theme correctly', () => {
      applyTheme({
        themeMode: 'dark',
        lightTheme: 'custom-light',
        darkTheme: 'custom-dark',
      });
      expect(document.body.classList.contains('dark-theme')).toBe(true);
      expect(document.body.classList.contains('custom-dark')).toBe(true);
    });

    it('removes previous theme type class', () => {
      document.body.classList.add('light-theme', 'light-default');
      applyTheme({
        themeMode: 'dark',
        lightTheme: 'new-light',
        darkTheme: 'new-dark',
      });
      expect(document.body.classList.contains('light-theme')).toBe(false);
      expect(document.body.classList.contains('dark-theme')).toBe(true);
      expect(document.body.classList.contains('new-dark')).toBe(true);
    });
  });

  describe('cycleThemeMode', () => {
    it('cycles from light to dark', () => {
      expect(cycleThemeMode('light')).toBe('dark');
    });

    it('cycles from dark to system', () => {
      expect(cycleThemeMode('dark')).toBe('system');
    });

    it('cycles from system to light', () => {
      expect(cycleThemeMode('system')).toBe('light');
    });
  });
});
