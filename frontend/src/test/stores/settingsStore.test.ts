import { describe, it, expect, beforeEach, vi } from 'vitest';
import { settingsStore } from '../../stores/settingsStore';
import { DEFAULT_SETTINGS } from '../../types/app';

const mockDefaultSettings = vi.hoisted(() => ({
  markdownWidth: { mode: 'full' as const, fixedWidth: '900px' },
  themeMode: 'system' as const,
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
  protectedPaths: ['.git', '.github', '.svn', '.hg', 'node_modules', 'target', 'dist', 'build'],
  trashExpireDays: 30,
  sessionTimeoutMinutes: 60,
}));

vi.mock('../../utils/settings', () => ({
  loadSettings: () => mockDefaultSettings,
  saveSettings: vi.fn(),
  getValidatedSidebarWidth: vi.fn(),
  applyFontSettings: vi.fn(),
}));

vi.mock('../../utils/theme', () => ({
  applyTheme: vi.fn(),
  getEffectiveThemeType: vi.fn((mode) => mode === 'system' ? 'dark' : mode),
  getSystemTheme: vi.fn(() => 'dark'),
}));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.setSettings(DEFAULT_SETTINGS);
  });

  describe('initial state', () => {
    it('loads settings on initialization', () => {
      expect(settingsStore.settings().themeMode).toBe(DEFAULT_SETTINGS.themeMode);
    });
  });

  describe('updateSettings', () => {
    it('updates settings partially', () => {
      settingsStore.updateSettings({ themeMode: 'dark' });
      expect(settingsStore.settings().themeMode).toBe('dark');
      expect(settingsStore.settings().uiFontSize).toBe(DEFAULT_SETTINGS.uiFontSize);
    });

    it('saves settings to storage', async () => {
      const { saveSettings } = await import('../../utils/settings');
      settingsStore.updateSettings({ themeMode: 'dark' });
      expect(saveSettings).toHaveBeenCalled();
    });
  });

  describe('toggleThemeMode', () => {
    it('cycles theme modes', () => {
      settingsStore.setSettings({ ...DEFAULT_SETTINGS, themeMode: 'light' });
      settingsStore.toggleThemeMode();
      expect(settingsStore.settings().themeMode).toBe('dark');
    });

    it('cycles from dark to system', () => {
      settingsStore.setSettings({ ...DEFAULT_SETTINGS, themeMode: 'dark' });
      settingsStore.toggleThemeMode();
      expect(settingsStore.settings().themeMode).toBe('system');
    });

    it('cycles from system to light', () => {
      settingsStore.setSettings({ ...DEFAULT_SETTINGS, themeMode: 'system' });
      settingsStore.toggleThemeMode();
      expect(settingsStore.settings().themeMode).toBe('light');
    });
  });

  describe('setThemeMode', () => {
    it('sets specific theme mode', () => {
      settingsStore.setThemeMode('dark');
      expect(settingsStore.settings().themeMode).toBe('dark');
    });
  });

  describe('reloadSettings', () => {
    it('reloads settings from storage', () => {
      const prevSettings = settingsStore.settings();
      settingsStore.reloadSettings();
      expect(settingsStore.settings()).toEqual(prevSettings);
    });
  });

  describe('getProtectedPaths', () => {
    it('returns protected paths from settings', () => {
      const paths = settingsStore.getProtectedPaths();
      expect(paths.length).toBeGreaterThan(0);
      expect(paths).toContain('.git');
    });
  });

  describe('isProtectedPath', () => {
    it('identifies protected paths', () => {
      expect(settingsStore.isProtectedPath('.git/config')).toBe(true);
      expect(settingsStore.isProtectedPath('node_modules/package')).toBe(true);
    });

    it('returns false for non-protected paths', () => {
      expect(settingsStore.isProtectedPath('src/index.md')).toBe(false);
      expect(settingsStore.isProtectedPath('docs/readme.md')).toBe(false);
    });
  });

  describe('effectiveTheme', () => {
    it('returns light when mode is light', async () => {
      const { getEffectiveThemeType } = await import('../../utils/theme');
      settingsStore.setSettings({ ...DEFAULT_SETTINGS, themeMode: 'light' });
      settingsStore.effectiveTheme;
      expect(getEffectiveThemeType).toHaveBeenCalledWith('light');
    });
  });

  describe('applyThemeSettings', () => {
    it('applies theme to DOM', async () => {
      const { applyTheme } = await import('../../utils/theme');
      settingsStore.applyThemeSettings();
      expect(applyTheme).toHaveBeenCalled();
    });
  });
});
