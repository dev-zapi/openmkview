export const THEME_MAP: Record<string, string> = {
  'github-light': 'github-light',
  'github-dark': 'github-dark',
  'vitesse-light': 'vitesse-light',
  'vitesse-dark': 'vitesse-dark',
  'min-light': 'min-light',
  'min-dark': 'min-dark',
  'solarized-light': 'solarized-light',
  'solarized-dark': 'solarized-dark',
  'one-dark-pro': 'one-dark-pro',
  'nord': 'nord',
  'dracula': 'dracula',
  'monokai': 'monokai',
  'slack': 'slack-dark',
};

export function getEffectiveCodeTheme(
  themeType: 'light' | 'dark',
  codeBlockThemeLight: string,
  codeBlockThemeDark: string
): string {
  const themeSetting = themeType === 'dark' ? codeBlockThemeDark : codeBlockThemeLight;
  return THEME_MAP[themeSetting] || (themeType === 'dark' ? 'github-dark' : 'github-light');
}