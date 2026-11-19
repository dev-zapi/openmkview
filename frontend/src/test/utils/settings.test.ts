import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadSidebarWidth,
  saveSidebarWidth,
  getValidatedSidebarWidth,
  loadOutlineWidth,
  saveOutlineWidth,
  getValidatedOutlineWidth,
  loadAnnotationColumnWidth,
  saveAnnotationColumnWidth,
  getValidatedAnnotationColumnWidth,
  getMarkdownStyle,
  applyFontSettings,
  extractServerSettings,
  normalizeSettings,
  resolvedWritingFontSize,
  WRITING_FONT_FAMILIES,
  applyTableDensity,
  applyTableWrap,
  applyCustomStylesheet,
  loadOutlineOpenByFileType,
  saveOutlineOpenByFileType,
} from '../../utils/settings';
import {
  DEFAULT_SETTINGS,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH_RATIO,
  DEFAULT_OUTLINE_WIDTH,
  MIN_OUTLINE_WIDTH,
  MAX_OUTLINE_WIDTH_RATIO,
  DEFAULT_ANNOTATION_COLUMN_WIDTH,
  MIN_ANNOTATION_COLUMN_WIDTH,
  MAX_ANNOTATION_COLUMN_WIDTH_RATIO,
} from '../../types/app';
import type { Settings } from '../../types/app';

describe('settings utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('window', {
      innerWidth: 1920,
    });
  });

  describe('loadSettings', () => {
    it('returns default settings when localStorage is empty', () => {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('returns parsed settings from localStorage', () => {
      const customSettings: Settings = {
        ...DEFAULT_SETTINGS,
        themeMode: 'dark',
        uiFontSize: '16px',
      };
      localStorage.setItem('openmkview-settings', JSON.stringify(customSettings));
      expect(loadSettings()).toEqual(customSettings);
    });

    it('returns default settings on parse error', () => {
      localStorage.setItem('openmkview-settings', 'invalid-json');
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('merges partial settings with defaults', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ themeMode: 'dark' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe('dark');
      expect(settings.uiFontSize).toBe(DEFAULT_SETTINGS.uiFontSize);
    });

    it('migrates legacy theme field to themeMode', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ theme: 'dark' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe('dark');
      expect(settings.lightTheme).toBe(DEFAULT_SETTINGS.lightTheme);
      expect(settings.darkTheme).toBe(DEFAULT_SETTINGS.darkTheme);
    });

    it('falls back to default themeMode for invalid stored values', () => {
      localStorage.setItem('openmkview-settings', JSON.stringify({ theme: 'sepia', themeMode: 'contrast' }));
      const settings = loadSettings();
      expect(settings.themeMode).toBe(DEFAULT_SETTINGS.themeMode);
    });
  });

  describe('saveSettings', () => {
    it('saves settings to localStorage', () => {
      saveSettings(DEFAULT_SETTINGS);
      const saved = localStorage.getItem('openmkview-settings');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('loadSidebarWidth', () => {
    it('returns default width when localStorage is empty', () => {
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns saved width when valid', () => {
      localStorage.setItem('filetree-sidebar-width', '300');
      expect(loadSidebarWidth()).toBe(300);
    });

    it('returns default width when saved width is too small', () => {
      localStorage.setItem('filetree-sidebar-width', '100');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns default width when saved width is too large', () => {
      localStorage.setItem('filetree-sidebar-width', '1000');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('returns default width on parse error', () => {
      localStorage.setItem('filetree-sidebar-width', 'invalid');
      expect(loadSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });
  });

  describe('saveSidebarWidth', () => {
    it('saves width to localStorage', () => {
      saveSidebarWidth(300);
      expect(localStorage.getItem('filetree-sidebar-width')).toBe('300');
    });
  });

  describe('getValidatedSidebarWidth', () => {
    it('returns width within valid range', () => {
      expect(getValidatedSidebarWidth(300)).toBe(300);
    });

    it('returns minimum width when input is too small', () => {
      expect(getValidatedSidebarWidth(100)).toBe(MIN_SIDEBAR_WIDTH);
    });

    it('returns maximum width when input is too large', () => {
      const maxWidth = 1920 * MAX_SIDEBAR_WIDTH_RATIO;
      expect(getValidatedSidebarWidth(1000)).toBe(maxWidth);
    });
  });

  describe('loadOutlineWidth', () => {
    it('returns default width when localStorage is empty', () => {
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns saved width when valid', () => {
      localStorage.setItem('outline-panel-width', '300');
      expect(loadOutlineWidth()).toBe(300);
    });

    it('returns default width when saved width is too small', () => {
      localStorage.setItem('outline-panel-width', '100');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns default width when saved width is too large', () => {
      localStorage.setItem('outline-panel-width', '1000');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });

    it('returns default width on parse error', () => {
      localStorage.setItem('outline-panel-width', 'invalid');
      expect(loadOutlineWidth()).toBe(DEFAULT_OUTLINE_WIDTH);
    });
  });

  describe('saveOutlineWidth', () => {
    it('saves width to localStorage', () => {
      saveOutlineWidth(300);
      expect(localStorage.getItem('outline-panel-width')).toBe('300');
    });
  });

  describe('getValidatedOutlineWidth', () => {
    it('returns width within valid range', () => {
      expect(getValidatedOutlineWidth(300)).toBe(300);
    });

    it('returns minimum width when input is too small', () => {
      expect(getValidatedOutlineWidth(100)).toBe(MIN_OUTLINE_WIDTH);
    });

    it('returns maximum width when input is too large', () => {
      const maxWidth = 1920 * MAX_OUTLINE_WIDTH_RATIO;
      expect(getValidatedOutlineWidth(1000)).toBe(maxWidth);
    });
  });

  describe('annotation column width', () => {
    it('returns the default width when no saved width is available', () => {
      expect(loadAnnotationColumnWidth()).toBe(DEFAULT_ANNOTATION_COLUMN_WIDTH);
    });

    it('loads a valid saved width', () => {
      localStorage.setItem('annotation-column-width', '360');
      expect(loadAnnotationColumnWidth()).toBe(360);
    });

    it('rejects invalid saved widths', () => {
      localStorage.setItem('annotation-column-width', '100');
      expect(loadAnnotationColumnWidth()).toBe(DEFAULT_ANNOTATION_COLUMN_WIDTH);
      localStorage.setItem('annotation-column-width', 'invalid');
      expect(loadAnnotationColumnWidth()).toBe(DEFAULT_ANNOTATION_COLUMN_WIDTH);
    });

    it('saves the width', () => {
      saveAnnotationColumnWidth(360);
      expect(localStorage.getItem('annotation-column-width')).toBe('360');
    });

    it('clamps the width to its valid range', () => {
      expect(getValidatedAnnotationColumnWidth(100)).toBe(MIN_ANNOTATION_COLUMN_WIDTH);
      expect(getValidatedAnnotationColumnWidth(360)).toBe(360);
      expect(getValidatedAnnotationColumnWidth(1000)).toBe(
        1920 * MAX_ANNOTATION_COLUMN_WIDTH_RATIO,
      );
    });
  });

  describe('getMarkdownStyle', () => {
    it('returns empty object for full width', () => {
      const settings = { ...DEFAULT_SETTINGS, markdownWidth: { mode: 'full' as const, fixedWidth: '900px' } };
      expect(getMarkdownStyle(settings)).toEqual({});
    });

    it('returns style object for fixed width', () => {
      const settings = { ...DEFAULT_SETTINGS, markdownWidth: { mode: 'fixed' as const, fixedWidth: '800px' } };
      expect(getMarkdownStyle(settings)).toEqual({
        'max-width': '800px',
        'margin-left': 'auto',
        'margin-right': 'auto',
      });
    });
  });

  describe('extractServerSettings', () => {
    it('includes editor font size in the server payload', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, editorFontSize: '18px' };
      expect(extractServerSettings(settings).editorFontSize).toBe('18px');
    });

    it('includes editor theme selection in the server payload', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        editorThemeLight: 'xcode-light',
        editorThemeDark: 'nord',
      };
      const payload = extractServerSettings(settings);
      expect(payload.editorThemeLight).toBe('xcode-light');
      expect(payload.editorThemeDark).toBe('nord');
    });
  });

  describe('applyFontSettings', () => {
    it('applies font settings to DOM', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        uiFontFamily: 'Arial',
        uiFontSize: '16px',
        markdownFontFamily: 'Georgia',
        markdownFontSize: '18px',
      };
      applyFontSettings(settings);
      expect(document.body.style.fontFamily).toBe('Arial');
      expect(document.body.style.fontSize).toBe('16px');
      expect(document.documentElement.style.getPropertyValue('--markdown-font')).toBe('Georgia');
      expect(document.documentElement.style.getPropertyValue('--markdown-size')).toBe('18px');
    });

    it('applies explicit editor font size independently of code size', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        codeFontSize: '13px',
        editorFontSize: '18px',
      };
      applyFontSettings(settings);
      expect(document.documentElement.style.getPropertyValue('--editor-size')).toBe('18px');
      expect(document.documentElement.style.getPropertyValue('--code-size')).toBe('13px');
    });

    it('removes the editor size override when editor font size is empty', () => {
      const explicit: Settings = {
        ...DEFAULT_SETTINGS,
        codeFontSize: '16px',
        editorFontSize: '18px',
      };
      applyFontSettings(explicit);
      expect(document.documentElement.style.getPropertyValue('--editor-size')).toBe('18px');

      const following: Settings = { ...explicit, editorFontSize: '' };
      applyFontSettings(following);
      expect(document.documentElement.style.getPropertyValue('--editor-size')).toBe('');
      expect(document.documentElement.style.getPropertyValue('--code-size')).toBe('16px');
    });
  });

  describe('normalizeSettings', () => {
    it('defaults editor font size to unset for partial settings', () => {
      expect(normalizeSettings({ themeMode: 'dark' }).editorFontSize).toBe('');
    });
  });

  describe('writing settings', () => {
    it('defaults writing typography for partial settings', () => {
      const settings = normalizeSettings({ themeMode: 'dark' });
      expect(settings.writingFontFamily).toBe('serif');
      expect(settings.writingFontSize).toBe('');
      expect(settings.writingWidth).toEqual({ mode: 'fixed', fixedWidth: '65ch' });
    });

    it('clamps an invalid writing font family to serif', () => {
      const settings = normalizeSettings({ writingFontFamily: 'monospace' as any });
      expect(settings.writingFontFamily).toBe('serif');
    });

    it('clamps a non-string writing font size to unset', () => {
      const settings = normalizeSettings({ writingFontSize: 42 as any });
      expect(settings.writingFontSize).toBe('');
    });

    it('preserves a valid writing font family and size', () => {
      const settings = normalizeSettings({ writingFontFamily: 'sans', writingFontSize: '20px' });
      expect(settings.writingFontFamily).toBe('sans');
      expect(settings.writingFontSize).toBe('20px');
    });

    it('clamps an invalid writing width to the default centered column', () => {
      const settings = normalizeSettings({ writingWidth: { mode: 'bogus', fixedWidth: 7 } as any });
      expect(settings.writingWidth).toEqual({ mode: 'fixed', fixedWidth: '65ch' });
    });

    it('preserves a valid writing width including full mode', () => {
      const fixed = normalizeSettings({ writingWidth: { mode: 'fixed', fixedWidth: '70ch' } });
      expect(fixed.writingWidth).toEqual({ mode: 'fixed', fixedWidth: '70ch' });

      const full = normalizeSettings({ writingWidth: { mode: 'full', fixedWidth: '70ch' } });
      expect(full.writingWidth.mode).toBe('full');
    });

    it('resolves writing font size through writing → editor → code chain', () => {
      const followCode: Settings = {
        ...DEFAULT_SETTINGS,
        writingFontSize: '',
        editorFontSize: '',
        codeFontSize: '13px',
      };
      expect(resolvedWritingFontSize(followCode)).toBe('13px');

      const followEditor: Settings = {
        ...followCode,
        editorFontSize: '16px',
      };
      expect(resolvedWritingFontSize(followEditor)).toBe('16px');
    });

    it('lets an explicit writing size win over the chain', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        writingFontSize: '21px',
        editorFontSize: '16px',
        codeFontSize: '13px',
      };
      expect(resolvedWritingFontSize(settings)).toBe('21px');
    });

    it('includes writing settings in the server payload', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        writingFontFamily: 'sans',
        writingFontSize: '20px',
        writingWidth: { mode: 'full', fixedWidth: '70ch' },
      };
      const payload = extractServerSettings(settings);
      expect(payload.writingFontFamily).toBe('sans');
      expect(payload.writingFontSize).toBe('20px');
      expect(payload.writingWidth).toEqual({ mode: 'full', fixedWidth: '70ch' });
    });

    it('maps each writing font family preset to a CSS stack', () => {
      expect(WRITING_FONT_FAMILIES.serif).toContain('serif');
      expect(WRITING_FONT_FAMILIES.serif).toContain('Noto Serif SC');
      expect(WRITING_FONT_FAMILIES.sans).toContain('sans-serif');
      expect(WRITING_FONT_FAMILIES.sans).toContain('Noto Sans SC');
      expect(WRITING_FONT_FAMILIES.system).toContain('system-ui');
    });

    it('applies the writing font, size and width CSS variables', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        writingFontFamily: 'sans',
        writingFontSize: '',
        editorFontSize: '',
        codeFontSize: '13px',
        writingWidth: { mode: 'fixed', fixedWidth: '70ch' },
      };
      applyFontSettings(settings);

      expect(document.documentElement.style.getPropertyValue('--writing-font')).toBe(
        WRITING_FONT_FAMILIES.sans,
      );
      expect(document.documentElement.style.getPropertyValue('--writing-size')).toBe('13px');
      expect(document.documentElement.style.getPropertyValue('--writing-width')).toBe('70ch');
    });

    it('applies none as the writing width for full mode', () => {
      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        writingWidth: { mode: 'full', fixedWidth: '65ch' },
      };
      applyFontSettings(settings);
      expect(document.documentElement.style.getPropertyValue('--writing-width')).toBe('none');
    });
  });

  describe('loadOutlineOpenByFileType', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should return default state when localStorage is empty', () => {
      const result = loadOutlineOpenByFileType();
      expect(result).toEqual({
        markdown: false,
        html: false,
        other: false,
      });
    });

    it('should load state from localStorage', () => {
      const savedState = { markdown: true, html: false, other: false };
      localStorage.setItem('outline-open-by-filetype', JSON.stringify(savedState));
      const result = loadOutlineOpenByFileType();
      expect(result).toEqual(savedState);
    });

    it('should handle partial state with defaults', () => {
      const partialState = { markdown: true };
      localStorage.setItem('outline-open-by-filetype', JSON.stringify(partialState));
      const result = loadOutlineOpenByFileType();
      expect(result).toEqual({
        markdown: true,
        html: false,
        other: false,
      });
    });

    it('should handle JSON parse errors gracefully', () => {
      localStorage.setItem('outline-open-by-filetype', 'invalid-json');
      const result = loadOutlineOpenByFileType();
      expect(result).toEqual({
        markdown: false,
        html: false,
        other: false,
      });
    });
  });

  describe('saveOutlineOpenByFileType', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should save state to localStorage', () => {
      const state = { markdown: true, html: false, other: false };
      saveOutlineOpenByFileType(state);
      const saved = localStorage.getItem('outline-open-by-filetype');
      expect(saved).toBe(JSON.stringify(state));
    });
  });

  describe('applyTableDensity', () => {
    it('sets data-table-density attribute on documentElement', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, tableDensity: 'small' };
      applyTableDensity(settings);
      expect(document.documentElement.getAttribute('data-table-density')).toBe('small');
    });

    it('defaults to medium when not specified', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS };
      applyTableDensity(settings);
      expect(document.documentElement.getAttribute('data-table-density')).toBe('medium');
    });

    it('updates attribute when density changes', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, tableDensity: 'large' };
      applyTableDensity(settings);
      expect(document.documentElement.getAttribute('data-table-density')).toBe('large');
    });
  });

  describe('applyTableWrap', () => {
    it('sets data-table-wrap attribute on documentElement', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, tableWrap: 'nowrap' };
      applyTableWrap(settings);
      expect(document.documentElement.getAttribute('data-table-wrap')).toBe('nowrap');
    });

    it('defaults to wrap when not specified', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS };
      applyTableWrap(settings);
      expect(document.documentElement.getAttribute('data-table-wrap')).toBe('wrap');
    });
  });

  describe('applyCustomStylesheet', () => {
    beforeEach(() => {
      const existing = document.getElementById('omkv-custom-stylesheet');
      if (existing) existing.remove();
    });

    it('injects a scoped style element with the correct id', () => {
      applyCustomStylesheet('table { color: red }');
      const el = document.getElementById('omkv-custom-stylesheet') as HTMLStyleElement;
      expect(el).toBeTruthy();
      expect(el.tagName).toBe('STYLE');
      expect(el.textContent).toContain('@scope (.markdown-view)');
      expect(el.textContent).toContain('table { color: red }');
    });

    it('empties content when css is blank', () => {
      applyCustomStylesheet('table { color: red }');
      applyCustomStylesheet('');
      const el = document.getElementById('omkv-custom-stylesheet') as HTMLStyleElement;
      expect(el).toBeTruthy();
      expect(el.textContent).toBe('');
    });

    it('caps length at CUSTOM_STYLESHEET_MAX', () => {
      const huge = 'a'.repeat(200_000);
      applyCustomStylesheet(huge);
      const el = document.getElementById('omkv-custom-stylesheet') as HTMLStyleElement;
      // The content is wrapped: @scope (.markdown-view) {\n<css>\n}
      // The inner css should be capped at 100_000
      const inner = el.textContent!.replace(/^@scope \(.markdown-view\) \{\n/, '').replace(/\n\}$/, '');
      expect(inner.length).toBeLessThanOrEqual(100_000);
    });

    it('appends the style as last child of head', () => {
      applyCustomStylesheet('h1 { color: blue }');
      const el = document.getElementById('omkv-custom-stylesheet');
      expect(el).toBe(document.head.lastElementChild);
    });
  });
});
