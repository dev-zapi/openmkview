import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadSidebarWidth,
  saveSidebarWidth,
  getValidatedSidebarWidth,
  loadOutlineWidth,
  saveOutlineWidth,
  getValidatedOutlineWidth,
  getMarkdownStyle,
  applyFontSettings,
} from '../../utils/settings';
import { DEFAULT_SETTINGS, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH_RATIO, DEFAULT_OUTLINE_WIDTH, MIN_OUTLINE_WIDTH, MAX_OUTLINE_WIDTH_RATIO } from '../../types/app';
import type { Settings } from '../../types/app';

describe('settings utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', {
      innerWidth: 1920,
    });
  });

  describe('loadSettings', () => {
    it('returns default settings when localStorage is empty', () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('returns parsed settings from localStorage', () => {
      const customSettings: Settings = {
        ...DEFAULT_SETTINGS,
        themeMode: 'dark',
        uiFontSize: '16px',
      };
      localStorage.setItem('openmkview-settings', JSON.stringify(customSettings));
      expect(loadSettings()).toEqual(customSettings);
    });

    it('returns default settings on parse error', () => {
      localStorage.setItem('openmkview-settings', 'invalid-json');
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('merges partial settings with defaults', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ themeMode: 'dark' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe('dark');
      expect(settings.uiFontSize).toBe(DEFAULT_SETTINGS.uiFontSize);
    });

    it('migrates legacy theme field to themeMode', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ theme: 'dark' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe('dark');
      expect(settings.lightTheme).toBe(DEFAULT_SETTINGS.lightTheme);
      expect(settings.darkTheme).toBe(DEFAULT_SETTINGS.darkTheme);
    });

    it('falls back to default themeMode for invalid stored values', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ theme: 'sepia', themeMode: 'contrast' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe(DEFAULT_SETTINGS.themeMode);
    });
  });

  describe('saveSettings', () => {
    it('saves settings to localStorage', () => {
      saveSettings(DEFAULT_SETTINGS);
      const saved = localStorage.getItem('openmkview-settings');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('loadSidebarWidth', () => {
    it('returns default width when localStorage is empty', () => {
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns saved width when valid', () => {
      localStorage.setItem('filetree-sidebar-width', '300');
      expect(loadSidebarWidth()).toBe(300);
    });

    it('returns default width when saved width is too small', () => {
      localStorage.setItem('filetree-sidebar-width', '100');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns default width when saved width is too large', () => {
      localStorage.setItem('filetree-sidebar-width', '1000');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns default width on parse error', () => {
      localStorage.setItem('filetree-sidebar-width', 'invalid');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });
  });

  describe('saveSidebarWidth', () => {
    it('saves width to localStorage', () => {
      saveSidebarWidth(300);
      expect(localStorage.getItem('filetree-sidebar-width')).toBe('300');
    });
  });

  describe('getValidatedSidebarWidth', () => {
    it('returns width within valid range', () => {
      expect(getValidatedSidebarWidth(300)).toBe(300);
    });

    it('returns minimum width when input is too small', () => {
      expect(getValidatedSidebarWidth(100)).toBe(MIN_SIDEBAR_WIDTH);
    });

    it('returns maximum width when input is too large', () => {
      const maxWidth = 1920 * MAX_SIDEBAR_WIDTH_RATIO;
      expect(getValidatedSidebarWidth(1000)).toBe(maxWidth);
    });
  });

  describe('loadOutlineWidth', () => {
    it('returns default width when localStorage is empty', () => {
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns saved width when valid', () => {
      localStorage.setItem('outline-panel-width', '300');
      expect(loadOutlineWidth()).toBe(300);
    });

    it('returns default width when saved width is too small', () => {
      localStorage.setItem('outline-panel-width', '100');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns default width when saved width is too large', () => {
      localStorage.setItem('outline-panel-width', '1000');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns default width on parse error', () => {
      localStorage.setItem('outline-panel-width', 'invalid');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });
  });

  describe('saveOutlineWidth', () => {
    it('saves width to localStorage', () => {
      saveOutlineWidth(300);
      expect(localStorage.getItem('outline-panel-width')).toBe('300');
    });
  });

  describe('getValidatedOutlineWidth', () => {
    it('returns width within valid range', () => {
      expect(getValidatedOutlineWidth(300)).toBe(300);
    });

    it('returns minimum width when input is too small', () => {
      expect(getValidatedOutlineWidth(100)).toBe(MIN_OUTLINE_WIDTH);
    });

    it('returns maximum width when input is too large', () => {
      const maxWidth = 1920 * MAX_OUTLINE_WIDTH_RATIO;
      expect(getValidatedOutlineWidth(1000)).toBe(maxWidth);
    });
  });

  describe('getMarkdownStyle', () => {
    it('returns empty object for full width', () => {
      const settings = { ...DEFAULT_SETTINGS, markdownWidth: { mode: 'full' as const, fixedWidth: '900px' } };
      expect(getMarkdownStyle(settings)).toEqual({});
    });

    it('returns style object for fixed width', () => {
      const settings = { ...DEFAULT_SETTINGS, markdownWidth: { mode: 'fixed' as const, fixedWidth: '800px' } };
      expect(getMarkdownStyle(settings)).toEqual({
        'max-width': '800px',
        'margin-left': 'auto',
        'margin-right': 'auto',
      });
    });
  });

  describe('applyFontSettings', () => {
    it('applies font settings to DOM', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        uiFontFamily: 'Arial',
        uiFontSize: '16px',
        markdownFontFamily: 'Georgia',
        markdownFontSize: '18px',
      };
      applyFontSettings(settings);
      expect(document.body.style.fontFamily).toBe('Arial');
      expect(document.body.style.fontSize).toBe('16px');
      expect(document.documentElement.style.getPropertyValue('--markdown-font')).toBe('Georgia');
      expect(document.documentElement.style.getPropertyValue('--markdown-size')).toBe('18px');
    });
  });
});
