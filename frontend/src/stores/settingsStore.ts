import { createSignal, createEffect } from 'solid-js';
import type { Settings, ThemeMode } from '../types/app';
import { DEFAULT_SETTINGS } from '../types/app';
import { loadSettings, saveSettings, normalizeSettings } from '../utils/settings';
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

  async fetchSettings() {
    const res = await fetch('/api/settings');
    if (!res.ok) {
      throw new Error(`Failed to load settings: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const normalized = normalizeSettings(data);
    saveSettings(normalized);
    setSettings(normalized);
    return normalized;
  },

  async saveServerSettings(nextSettings: Settings) {
    const normalized = normalizeSettings(nextSettings);
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errorData.error || `Failed to save settings: ${res.status}`);
    }

    const data = normalizeSettings(await res.json());
    saveSettings(data);
    setSettings(data);
    return data;
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
