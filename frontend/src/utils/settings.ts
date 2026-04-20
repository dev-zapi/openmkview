import type { Settings, ThemeMode, MarkdownWidthSetting } from '../types/app';
import { DEFAULT_SETTINGS, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH_RATIO } from '../types/app';

const SETTINGS_KEY = 'openmkview-settings';
const SIDEBAR_WIDTH_KEY = 'filetree-sidebar-width';

const isThemeMode = (value: unknown): value is ThemeMode => {
  return value === 'light' || value === 'dark' || value === 'system';
};

export const loadSettings = (): Settings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return normalizeSettings({
        ...parsed,
        themeMode: isThemeMode(parsed.themeMode)
          ? parsed.themeMode
          : isThemeMode(parsed.theme)
            ? parsed.theme
            : DEFAULT_SETTINGS.themeMode,
      });
    }

    return DEFAULT_SETTINGS;
  } catch (e) {
    console.error('Failed to load settings:', e);
    return DEFAULT_SETTINGS;
  }
};

const normalizeMarkdownWidth = (raw: unknown, legacyFixedWidth?: unknown): MarkdownWidthSetting => {
  // Handle old flat format: markdownWidth was a string 'full' | 'fixed'
  if (typeof raw === 'string') {
    return {
      mode: raw === 'fixed' ? 'fixed' : 'full',
      fixedWidth: typeof legacyFixedWidth === 'string' && legacyFixedWidth
        ? legacyFixedWidth
        : DEFAULT_SETTINGS.markdownWidth.fixedWidth,
    };
  }
  if (raw && typeof raw === 'object' && 'mode' in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      mode: obj.mode === 'fixed' ? 'fixed' : 'full',
      fixedWidth: typeof obj.fixedWidth === 'string' && obj.fixedWidth
        ? obj.fixedWidth
        : DEFAULT_SETTINGS.markdownWidth.fixedWidth,
    };
  }
  return DEFAULT_SETTINGS.markdownWidth;
};

export const normalizeSettings = (settings: Settings | (Partial<Settings> & Record<string, unknown>)): Settings => {
  const themeMode = isThemeMode(settings.themeMode)
    ? settings.themeMode
    : DEFAULT_SETTINGS.themeMode;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    themeMode,
    markdownWidth: normalizeMarkdownWidth(settings.markdownWidth, settings['fixedWidth']),
    lightTheme: settings.lightTheme || DEFAULT_SETTINGS.lightTheme,
    darkTheme: settings.darkTheme || DEFAULT_SETTINGS.darkTheme,
    sessionTimeoutMinutes:
      typeof settings.sessionTimeoutMinutes === 'number' && settings.sessionTimeoutMinutes > 0
        ? settings.sessionTimeoutMinutes
        : DEFAULT_SETTINGS.sessionTimeoutMinutes,
  };
};

export const saveSettings = (settings: Settings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
};

export const loadSidebarWidth = (): number => {
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      const maxWidth = window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO;
      if (width >= MIN_SIDEBAR_WIDTH && width <= maxWidth) {
        return width;
      }
    }
  } catch (e) {
    console.error('Failed to load sidebar width:', e);
  }
  return DEFAULT_SIDEBAR_WIDTH;
};

export const saveSidebarWidth = (width: number): void => {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  } catch (e) {
    console.error('Failed to save sidebar width:', e);
  }
};

export const getValidatedSidebarWidth = (width: number): number => {
  const maxWidth = window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO;
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, width));
};

export const getMarkdownStyle = (settings: Settings): Record<string, string> => {
  if (settings.markdownWidth.mode === 'fixed' && settings.markdownWidth.fixedWidth) {
    return {
      'max-width': settings.markdownWidth.fixedWidth,
      'margin-left': 'auto',
      'margin-right': 'auto',
    };
  }
  return {};
};

export const applyFontSettings = (settings: Settings): void => {
  document.body.style.fontFamily = settings.uiFontFamily;
  document.body.style.fontSize = settings.uiFontSize;
  document.documentElement.style.setProperty('--markdown-font', settings.markdownFontFamily);
  document.documentElement.style.setProperty('--markdown-size', settings.markdownFontSize);
};
