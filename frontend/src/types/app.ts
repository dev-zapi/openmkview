export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeType = 'light' | 'dark';
export type WritingFontFamily = 'serif' | 'sans' | 'system';

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
  editorFontSize: string;
  writingFontFamily: WritingFontFamily;
  writingFontSize: string;
  writingWidth: MarkdownWidthSetting;
  protectedPaths: string[];
  placeholderDirs: string[];
  ignoredFiles: string[];
  trashExpireDays: number;
  sessionTimeoutMinutes: number;
  codeBlockThemeLight: string;
  codeBlockThemeDark: string;
  editorThemeLight: string;
  editorThemeDark: string;
  tableDensity: 'small' | 'medium' | 'large';
  customStylesheet: string;
  tableWrap: 'wrap' | 'nowrap';
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
  editorFontSize: '',
  writingFontFamily: 'serif',
  writingFontSize: '',
  writingWidth: { mode: 'fixed', fixedWidth: '65ch' },
  protectedPaths: ['.git', '.github', '.svn', '.hg', 'node_modules', 'target', 'dist', 'build'],
  placeholderDirs: ['node_modules', 'target', 'dist', 'build', '.git', '.svn', '.hg'],
  ignoredFiles: ['.DS_Store', 'Thumbs.db'],
  trashExpireDays: 30,
  sessionTimeoutMinutes: 60,
  codeBlockThemeLight: 'github-light',
  codeBlockThemeDark: 'github-dark',
  editorThemeLight: 'app',
  editorThemeDark: 'one-dark',
  tableDensity: 'medium',
  customStylesheet: '',
  tableWrap: 'wrap',
};

export interface AuthStatus {
  authRequired: boolean;
  authenticated: boolean;
  /** Logged-in username; null/absent when unauthenticated or auth is off. */
  username?: string | null;
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

export interface ToolSessionSummary {
  id: number;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PasskeyCeremonyStart<T = unknown> {
  requestId: string;
  options: T;
}

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const MIN_SIDEBAR_WIDTH = 200;
export const MAX_SIDEBAR_WIDTH_RATIO = 0.4;

export const DEFAULT_OUTLINE_WIDTH = 280;
export const MIN_OUTLINE_WIDTH = 200;
export const MAX_OUTLINE_WIDTH_RATIO = 0.4;

export const DEFAULT_ANNOTATION_COLUMN_WIDTH = 300;
export const MIN_ANNOTATION_COLUMN_WIDTH = 200;
export const MAX_ANNOTATION_COLUMN_WIDTH_RATIO = 0.4;
