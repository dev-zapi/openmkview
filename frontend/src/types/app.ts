export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeType = 'light' | 'dark';

export interface Theme {
  id: string;
  name: string;
  type: ThemeType;
  builtin: boolean;
}

export interface Settings {
  markdownWidth: 'full' | 'fixed';
  fixedWidth: string;
  themeMode: ThemeMode;
  lightTheme: string;
  darkTheme: string;
  uiFontFamily: string;
  markdownFontFamily: string;
  uiFontSize: string;
  markdownFontSize: string;
  protectedPaths: string[];
  trashExpireDays: number;
  sessionTimeoutMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  themeMode: 'system',
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
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
