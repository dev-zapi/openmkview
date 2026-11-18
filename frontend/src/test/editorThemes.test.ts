import { describe, it, expect } from 'vitest';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  EDITOR_THEME_FOLLOW_APP,
  editorThemeDarkPresets,
  editorThemeLightPresets,
  resolveEditorThemeExtension,
} from '../utils/editorThemes';

describe('resolveEditorThemeExtension', () => {
  it('returns null for the follow-app sentinel in either mode', () => {
    expect(resolveEditorThemeExtension('light', EDITOR_THEME_FOLLOW_APP)).toBeNull();
    expect(resolveEditorThemeExtension('dark', EDITOR_THEME_FOLLOW_APP)).toBeNull();
  });

  it('returns null for missing or unknown light ids (app-token theme)', () => {
    expect(resolveEditorThemeExtension('light', undefined)).toBeNull();
    expect(resolveEditorThemeExtension('light', 'nope')).toBeNull();
  });

  it('resolves a known dark id to its preset extension', () => {
    expect(resolveEditorThemeExtension('dark', 'one-dark')).toBe(oneDark);
  });

  it('falls back to One Dark for unknown dark ids, preserving old behavior', () => {
    expect(resolveEditorThemeExtension('dark', 'nope')).toBe(oneDark);
    expect(resolveEditorThemeExtension('dark', undefined)).toBe(oneDark);
  });

  it('exposes preset lists whose values all resolve in their own mode', () => {
    for (const preset of editorThemeLightPresets) {
      const resolved = resolveEditorThemeExtension('light', preset.value);
      if (preset.value === EDITOR_THEME_FOLLOW_APP) {
        expect(resolved).toBeNull();
      } else {
        expect(resolved).not.toBeNull();
      }
    }
    for (const preset of editorThemeDarkPresets) {
      expect(resolveEditorThemeExtension('dark', preset.value)).not.toBeNull();
    }
  });
});
