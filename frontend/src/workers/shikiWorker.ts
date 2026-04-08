import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import githubLight from 'shiki/themes/github-light.mjs';
import githubDark from 'shiki/themes/github-dark.mjs';
import javascript from 'shiki/langs/javascript.mjs';
import typescript from 'shiki/langs/typescript.mjs';
import rust from 'shiki/langs/rust.mjs';
import python from 'shiki/langs/python.mjs';
import bash from 'shiki/langs/bash.mjs';
import json from 'shiki/langs/json.mjs';
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

interface HighlightRequest {
  id: number;
  type: 'highlight';
  code: string;
  lang: string;
  theme: 'light' | 'dark';
}

interface HighlightResponse {
  id: number;
  type: 'highlight-result';
  html: string;
  error?: string;
}

interface InitResponse {
  type: 'initialized';
}

type WorkerMessage = HighlightRequest;
type WorkerResponse = HighlightResponse | InitResponse;

let highlighter: HighlighterCore | null = null;

async function initHighlighter(): Promise<void> {
  if (highlighter) return;

  const { loadWasm } = await import('shiki/engine/oniguruma');
  
  const onigWasm = await import(
    /* @vite-ignore */
    'shiki/onig.wasm?init'
  ).then((m) => m.default);
  
  await loadWasm(onigWasm);

  highlighter = await createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [
      javascript,
      typescript,
      rust,
      python,
      bash,
      json,
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
    ],
  });

  self.postMessage({ type: 'initialized' } as InitResponse);
}

async function handleHighlight(request: HighlightRequest): Promise<HighlightResponse> {
  if (!highlighter) {
    await initHighlighter();
  }

  const themeName = request.theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  let lang = request.lang.toLowerCase();

  if (!highlighter!.getLoadedLanguages().includes(lang)) {
    lang = 'text';
  }

  try {
    const html = highlighter!.codeToHtml(request.code, {
      lang,
      theme: themeName,
    });

    return {
      id: request.id,
      type: 'highlight-result',
      html,
    };
  } catch (error) {
    return {
      id: request.id,
      type: 'highlight-result',
      html: `<pre><code>${escapeHtml(request.code)}</code></pre>`,
      error: String(error),
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'highlight') {
    const response = await handleHighlight(message);
    self.postMessage(response);
  }
};

initHighlighter().catch((error) => {
  console.error('Failed to initialize Shiki worker:', error);
});