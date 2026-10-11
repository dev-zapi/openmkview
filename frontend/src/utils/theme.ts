import type { ThemeMode, ThemeType } from '../types/app';

export const getSystemTheme = (): ThemeType => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const getEffectiveThemeType = (mode: ThemeMode): ThemeType => {
  return mode === 'system' ? getSystemTheme() : mode;
};

let previousThemeId: string | null = null;

export const __resetPreviousThemeId = (): void => {
  previousThemeId = null;
};

// Theme classes live on <html>, not <body>: the legacy --color-* aliases are
// declared on :root as hsl(var(--background)…) and custom properties substitute
// at the declaring element, so a body-level class can never re-resolve them.
export const applyTheme = (settings: { themeMode: ThemeMode; lightTheme: string; darkTheme: string }): void => {
  const effectiveType = getEffectiveThemeType(settings.themeMode);
  const themeId = effectiveType === 'light' ? settings.lightTheme : settings.darkTheme;

  const root = document.documentElement;
  root.classList.remove('light-theme', 'dark-theme');
  if (previousThemeId) {
    root.classList.remove(previousThemeId);
  }

  root.classList.add(`${effectiveType}-theme`, themeId);
  previousThemeId = themeId;

  updateBrowserThemeColor();
};

export const updateBrowserThemeColor = (): void => {
  requestAnimationFrame(() => {
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) return;

    const computedStyle = getComputedStyle(document.body);
    const bgColor = computedStyle.getPropertyValue('--color-topbar-bg').trim()
      || computedStyle.getPropertyValue('--color-bg').trim();

    if (bgColor) {
      themeColorMeta.setAttribute('content', bgColor);
    }
  });
};

export const cycleThemeMode = (currentMode: ThemeMode): ThemeMode => {
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  const currentIndex = modes.indexOf(currentMode);
  return modes[(currentIndex + 1) % modes.length];
};
