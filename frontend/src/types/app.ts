export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeType = 'light' | 'dark';

export interface Theme {
  id: string;
  name: string;
  type: ThemeType;
  builtin: boolean;
}

export interface MarkdownWidthSetting {
  mode: 'full' | 'fixed';
  fixedWidth: string;
}

export interface ServerSettings {
  markdownWidth: MarkdownWidthSetting;
  uiFontFamily: string;
  uiFontSize: string;
  markdownFontFamily: string;
  markdownFontSize: string;
  codeFontFamily: string;
  codeFontSize: string;
  protectedPaths: string[];
  trashExpireDays: number;
  sessionTimeoutMinutes: number;
}

export interface Settings extends ServerSettings {
  themeMode: ThemeMode;
  lightTheme: string;
  darkTheme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  markdownWidth: { mode: 'full', fixedWidth: '900px' },
  themeMode: 'system',
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  codeFontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace',
  uiFontSize: '14px',
  markdownFontSize: '16px',
  codeFontSize: '14px',
  protectedPaths: ['.git', '.github', '.svn', '.hg', 'node_modules', 'target', 'dist', 'build'],
  trashExpireDays: 30,
  sessionTimeoutMinutes: 60,
};

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
  sessionTimeoutMinutes?: number;
  passkeyConfigured: boolean;
  passkeyAvailable: boolean;
  passkeyOrigin?: string;
}

export interface PasskeyCredentialSummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PasskeyListResponse {
  credentials: PasskeyCredentialSummary[];
}

export interface PasskeyCeremonyStart<T = unknown> {
  requestId: string;
  options: T;
}

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH_RATIO = 0.4;
