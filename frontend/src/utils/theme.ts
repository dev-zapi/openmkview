import type { ThemeMode, ThemeType } from '../types/app';

export const getSystemTheme = (): ThemeType => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const getEffectiveThemeType = (mode: ThemeMode): ThemeType => {
  return mode === 'system' ? getSystemTheme() : mode;
};

export const applyTheme = (settings: { themeMode: ThemeMode; lightTheme: string; darkTheme: string }): void => {
  const effectiveType = getEffectiveThemeType(settings.themeMode);
  const themeId = effectiveType === 'light' ? settings.lightTheme : settings.darkTheme;

  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(`${effectiveType}-theme`, themeId);

  updateBrowserThemeColor();
};

export const updateBrowserThemeColor = (): void => {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeColorMeta) return;

  const computedStyle = getComputedStyle(document.body);
  const bgColor = computedStyle.getPropertyValue('--color-bg-subtle').trim();

  if (bgColor) {
    themeColorMeta.setAttribute('content', bgColor);
  }
};

export const cycleThemeMode = (currentMode: ThemeMode): ThemeMode => {
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  const currentIndex = modes.indexOf(currentMode);
  return modes[(currentIndex + 1) % modes.length];
};