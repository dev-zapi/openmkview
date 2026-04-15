import { createSignal, createEffect } from 'solid-js';
import type { Settings, ThemeMode } from '../types/app';
import { DEFAULT_SETTINGS } from '../types/app';
import { loadSettings, saveSettings } from '../utils/settings';
import { applyTheme, getEffectiveThemeType, getSystemTheme } from '../utils/theme';
import { applyFontSettings } from '../utils/settings';

const [settings, setSettings] = createSignal<Settings>(loadSettings());
const [systemTheme, setSystemTheme] = createSignal<'light' | 'dark'>(getSystemTheme());

export const settingsStore = {
  settings,
  setSettings,
  systemTheme,
  setSystemTheme,

  get effectiveTheme(): 'light' | 'dark' {
    return getEffectiveThemeType(settings().themeMode);
  },

  updateSettings(newSettings: Partial<Settings>) {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      saveSettings(updated);
      return updated;
    });
  },

  toggleThemeMode() {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentMode = settings().themeMode;
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.updateSettings({ themeMode: nextMode });
  },

  setThemeMode(mode: ThemeMode) {
    this.updateSettings({ themeMode: mode });
  },

  reloadSettings() {
    setSettings(loadSettings());
  },

  applyThemeSettings() {
    applyTheme({
      themeMode: settings().themeMode,
      lightTheme: settings().lightTheme,
      darkTheme: settings().darkTheme,
    });
  },

  applyFontSettings() {
    applyFontSettings(settings());
  },

  updateSystemTheme(theme: 'light' | 'dark') {
    setSystemTheme(theme);
    if (settings().themeMode === 'system') {
      this.applyThemeSettings();
    }
  },

  getProtectedPaths(): string[] {
    return settings().protectedPaths || DEFAULT_SETTINGS.protectedPaths;
  },

  isProtectedPath(path: string): boolean {
    const protectedPaths = this.getProtectedPaths();
    const pathSegments = path.toLowerCase().split(/[/\\]/);
    return protectedPaths.some(p =>
      pathSegments.includes(p.toLowerCase())
    );
  },
};

export function initSettingsEffects() {
  createEffect(() => {
    settingsStore.applyThemeSettings();
  });

  createEffect(() => {
    settingsStore.applyFontSettings();
  });
}

export default settingsStore;