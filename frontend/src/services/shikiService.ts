import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { settingsStore } from '../stores/settingsStore';

// Theme name mapping (settings use 'slack' but Shiki uses 'slack-dark')
const THEME_MAP: Record<string, string> = {
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

let highlighterInstance: HighlighterCore | null = null;
let initPromise: Promise<HighlighterCore> | null = null;

async function getHighlighter(): Promise<HighlighterCore> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const { createOnigurumaEngine } = await import('shiki/engine/oniguruma');
    
    const engine = await createOnigurumaEngine(import('shiki/wasm'));

    const highlighter = await createHighlighterCore({
      themes: [
        // Light themes
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/vitesse-light.mjs'),
        import('shiki/themes/min-light.mjs'),
        import('shiki/themes/solarized-light.mjs'),
        // Dark themes
        import('shiki/themes/github-dark.mjs'),
        import('shiki/themes/vitesse-dark.mjs'),
        import('shiki/themes/min-dark.mjs'),
        import('shiki/themes/one-dark-pro.mjs'),
        import('shiki/themes/nord.mjs'),
        import('shiki/themes/dracula.mjs'),
        import('shiki/themes/solarized-dark.mjs'),
        import('shiki/themes/monokai.mjs'),
        import('shiki/themes/slack-dark.mjs'),
      ],
      langs: [
        import('@shikijs/langs/javascript'),
        import('@shikijs/langs/typescript'),
        import('@shikijs/langs/rust'),
        import('@shikijs/langs/python'),
        import('@shikijs/langs/bash'),
        import('@shikijs/langs/json'),
        import('@shikijs/langs/css'),
        import('@shikijs/langs/markdown'),
        import('@shikijs/langs/html'),
        import('@shikijs/langs/yaml'),
        import('@shikijs/langs/toml'),
        import('@shikijs/langs/sql'),
        import('@shikijs/langs/go'),
        import('@shikijs/langs/java'),
        import('@shikijs/langs/c'),
        import('@shikijs/langs/cpp'),
        import('@shikijs/langs/jsx'),
        import('@shikijs/langs/tsx'),
        import('@shikijs/langs/vue'),
        import('@shikijs/langs/svelte'),
        import('@shikijs/langs/dockerfile'),
        import('@shikijs/langs/diff'),
      ],
      engine,
    });

    highlighterInstance = highlighter;
    return highlighter;
  })();

  return initPromise;
}

export interface HighlightOptions {
  code: string;
  lang: string;
  theme?: 'light' | 'dark';
}

export interface HighlightResult {
  html: string;
}

export async function highlightCode(options: HighlightOptions): Promise<HighlightResult> {
  const highlighter = await getHighlighter();
  
  // Determine which theme to use based on mode and settings
  const effectiveThemeType = settingsStore.effectiveTheme;
  const themeSetting = effectiveThemeType === 'dark' 
    ? settingsStore.settings().codeBlockThemeDark 
    : settingsStore.settings().codeBlockThemeLight;
  
  // Map to Shiki theme name, fallback to github
  const theme = THEME_MAP[themeSetting] || (effectiveThemeType === 'dark' ? 'github-dark' : 'github-light');
  
  // Override with options.theme if explicitly provided
  const useTheme = options.theme 
    ? THEME_MAP[options.theme === 'dark' ? settingsStore.settings().codeBlockThemeDark : settingsStore.settings().codeBlockThemeLight] || (options.theme === 'dark' ? 'github-dark' : 'github-light')
    : theme;

  let lang = options.lang.toLowerCase();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    lang = 'text';
  }

  const html = highlighter.codeToHtml(options.code, {
    lang,
    theme: useTheme,
  });

  return { html };
}

export async function highlightCodeWithTransformers(
  code: string,
  lang: string,
  theme: 'light' | 'dark',
  transformers: any[] = []
): Promise<string> {
  const highlighter = await getHighlighter();
  
  const themeSetting = theme === 'dark' 
    ? settingsStore.settings().codeBlockThemeDark 
    : settingsStore.settings().codeBlockThemeLight;
  const themeName = THEME_MAP[themeSetting] || (theme === 'dark' ? 'github-dark' : 'github-light');

  let normalizedLang = lang.toLowerCase();
  if (!highlighter.getLoadedLanguages().includes(normalizedLang)) {
    normalizedLang = 'text';
  }

  return highlighter.codeToHtml(code, {
    lang: normalizedLang,
    theme: themeName,
    transformers,
  });
}

export async function loadLanguage(lang: string): Promise<void> {
  const highlighter = await getHighlighter();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    console.warn(`Language ${lang} is not pre-loaded. Only 22 common languages are available.`);
  }
}

export async function getTheme(theme: 'light' | 'dark'): Promise<string> {
  const themeSetting = theme === 'dark' 
    ? settingsStore.settings().codeBlockThemeDark 
    : settingsStore.settings().codeBlockThemeLight;
  return THEME_MAP[themeSetting] || (theme === 'dark' ? 'github-dark' : 'github-light');
}

export function getHighlighterInstance(): HighlighterCore | null {
  return highlighterInstance;
}

export { getHighlighter };