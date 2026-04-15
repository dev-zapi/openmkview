import type { Settings } from '../types/app';
import { DEFAULT_SETTINGS, DEFAULT_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH_RATIO } from '../types/app';

const SETTINGS_KEY = 'openmkview-settings';
const SIDEBAR_WIDTH_KEY = 'filetree-sidebar-width';

export const loadSettings = (): Settings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
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
  if (settings.markdownWidth === 'fixed' && settings.fixedWidth) {
    return {
      'max-width': settings.fixedWidth,
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