import { createHighlighterCore, type HighlighterCore } from 'shiki/core';

const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

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
    
    const onigWasmUrl = await import(
      /* @vite-ignore */
      'shiki/onig.wasm?url'
    ).then((m) => m.default);
    
    const wasmResponse = await fetch(onigWasmUrl);
    const engine = await createOnigurumaEngine(wasmResponse.arrayBuffer());

    const highlighter = await createHighlighterCore({
      themes: [
        import('shiki/themes/github-light.mjs'),
        import('shiki/themes/github-dark.mjs'),
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
    console.warn(`Language ${lang} is not pre-loaded. Only 22 common languages are available.`);
  }
}

export async function getTheme(theme: 'light' | 'dark'): Promise<string> {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

export function getHighlighterInstance(): HighlighterCore | null {
  return highlighterInstance;
}

export { getHighlighter };