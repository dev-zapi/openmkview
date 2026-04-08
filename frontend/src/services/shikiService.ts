import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import githubLight from 'shiki/themes/github-light.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import rust from 'shiki/langs/rust.mjs';
import python from 'shiki/langs/python.mjs';
import bash from 'shiki/langs/bash.mjs';
import jsonLang from 'shiki/langs/json.mjs';
import css from 'shiki/langs/css.mjs';
import markdown from 'shiki/langs/markdown.mjs';
import html from 'shiki/langs/html.mjs';
import yaml from 'shiki/langs/yaml.mjs';
import toml from 'shiki/langs/toml.mjs';
import sql from 'shiki/langs/sql.mjs';
import go from 'shiki/langs/go.mjs';
import java from 'shiki/langs/java.mjs';
import c from 'shiki/langs/c.mjs';
import cpp from 'shiki/langs/cpp.mjs';
import jsx from 'shiki/langs/jsx.mjs';
import tsx from 'shiki/langs/tsx.mjs';
import vue from 'shiki/langs/vue.mjs';
import svelte from 'shiki/langs/svelte.mjs';
import dockerfile from 'shiki/langs/dockerfile.mjs';
import diff from 'shiki/langs/diff.mjs';

const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

const LOADED_LANGUAGES = [
  javascript,
  typescript,
  rust,
  python,
  bash,
  jsonLang,
  css,
  markdown,
  html,
  yaml,
  toml,
  sql,
  go,
  java,
  c,
  cpp,
  jsx,
  tsx,
  vue,
  svelte,
  dockerfile,
  diff,
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
    const { createOnigurumaEngine } = await import('shiki/engine/oniguruma');
    
    const onigWasm = await import(
      /* @vite-ignore */
      'shiki/onig.wasm?init'
    ).then((m) => m.default);
    
    const engine = await createOnigurumaEngine(onigWasm);

    const highlighter = await createHighlighterCore({
      themes: [githubLight, githubDark],
      langs: LOADED_LANGUAGES,
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

const LANG_MAP: Record<string, any> = {
  javascript,
  typescript,
  rust,
  python,
  bash,
  json: jsonLang,
  css,
  markdown,
  html,
  yaml,
  toml,
  sql,
  go,
  java,
  c,
  cpp,
  jsx,
  tsx,
  vue,
  svelte,
  dockerfile,
  diff,
};

export async function loadLanguage(lang: string): Promise<void> {
  const highlighter = await getHighlighter();
  if (!highlighter.getLoadedLanguages().includes(lang)) {
    const langModule = LANG_MAP[lang.toLowerCase()];
    if (langModule) {
      try {
        await highlighter.loadLanguage(langModule);
      } catch {
        console.warn(`Failed to load language: ${lang}`);
      }
    } else {
      console.warn(`Language not available: ${lang}`);
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