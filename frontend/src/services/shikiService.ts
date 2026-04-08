import { createHighlighterCore, type HighlighterCore } from 'shiki/core';

const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

const COMMON_LANGS = [
  'javascript',
  'typescript',
  'rust',
  'python',
  'bash',
  'json',
  'css',
  'markdown',
  'html',
  'yaml',
  'toml',
  'sql',
  'go',
  'java',
  'c',
  'cpp',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'dockerfile',
  'diff',
];

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
    const { loadWasm } = await import('shiki/engine/oniguruma');
    
    const onigWasm = await import(
      /* @vite-ignore */
      'shiki/onig.wasm?init'
    ).then((m) => m.default);
    
    await loadWasm(onigWasm);

    const highlighter = await createHighlighterCore({
      themes: [
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark.mjs'),
      ],
      langs: COMMON_LANGS.map((lang) => import(`shiki/langs/${lang}.mjs`)),
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
  const theme = options.theme === 'dark' ? DARK_THEME : LIGHT_THEME;

  let lang = options.lang.toLowerCase();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    lang = 'text';
  }

  const html = highlighter.codeToHtml(options.code, {
    lang,
    theme,
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
  const themeName = theme === 'dark' ? DARK_THEME : LIGHT_THEME;

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
    try {
      await highlighter.loadLanguage(import(`shiki/langs/${lang}.mjs`));
    } catch {
      console.warn(`Failed to load language: ${lang}`);
    }
  }
}

export async function getTheme(theme: 'light' | 'dark'): Promise<string> {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getHighlighterInstance(): HighlighterCore | null {
  return highlighterInstance;
}

export { getHighlighter };