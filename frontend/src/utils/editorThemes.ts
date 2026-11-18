import type { Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  githubLight,
  xcodeLight,
  vscodeLight,
  solarizedLight,
  quietlight,
  eclipse,
  githubDark,
  vscodeDark,
  nord,
  dracula,
  monokai,
  solarizedDark,
  tokyoNight,
  materialDark,
  gruvboxDark,
  darcula,
} from '@uiw/codemirror-themes-all';

/** Sentinel id: the editor follows the app's own token colors (CSS variables). */
export const EDITOR_THEME_FOLLOW_APP = 'app';

export interface EditorThemeOption {
  label: string;
  value: string;
}

interface EditorThemeEntry extends EditorThemeOption {
  extension: Extension;
}

const lightEntries: EditorThemeEntry[] = [
  { label: 'GitHub Light', value: 'github-light', extension: githubLight },
  { label: 'Xcode Light', value: 'xcode-light', extension: xcodeLight },
  { label: 'VS Code Light', value: 'vscode-light', extension: vscodeLight },
  { label: 'Solarized Light', value: 'solarized-light', extension: solarizedLight },
  { label: 'Quiet Light', value: 'quietlight', extension: quietlight },
  { label: 'Eclipse', value: 'eclipse', extension: eclipse },
];

const darkEntries: EditorThemeEntry[] = [
  { label: 'One Dark', value: 'one-dark', extension: oneDark },
  { label: 'GitHub Dark', value: 'github-dark', extension: githubDark },
  { label: 'VS Code Dark', value: 'vscode-dark', extension: vscodeDark },
  { label: 'Nord', value: 'nord', extension: nord },
  { label: 'Dracula', value: 'dracula', extension: dracula },
  { label: 'Monokai', value: 'monokai', extension: monokai },
  { label: 'Solarized Dark', value: 'solarized-dark', extension: solarizedDark },
  { label: 'Tokyo Night', value: 'tokyo-night', extension: tokyoNight },
  { label: 'Material Dark', value: 'material-dark', extension: materialDark },
  { label: 'Gruvbox Dark', value: 'gruvbox-dark', extension: gruvboxDark },
  { label: 'Darcula', value: 'darcula', extension: darcula },
];

/** Settings-panel options; "Follow App" leads the light list. */
export const editorThemeLightPresets: EditorThemeOption[] = [
  { label: 'Follow App', value: EDITOR_THEME_FOLLOW_APP },
  ...lightEntries,
];

export const editorThemeDarkPresets: EditorThemeOption[] = darkEntries;

/**
 * Resolve the CodeMirror theme extension for a theme id. Returns null for
 * EDITOR_THEME_FOLLOW_APP (and any unknown id in light mode) so the caller
 * falls back to the app-token theme; unknown dark ids fall back to One Dark,
 * the previous hardcoded behavior.
 */
export function resolveEditorThemeExtension(
  themeType: 'light' | 'dark',
  themeId: string | undefined,
): Extension | null {
  if (themeId === EDITOR_THEME_FOLLOW_APP) return null;
  const entries = themeType === 'dark' ? darkEntries : lightEntries;
  const match = entries.find((entry) => entry.value === themeId);
  if (match) return match.extension;
  return themeType === 'dark' ? oneDark : null;
}
