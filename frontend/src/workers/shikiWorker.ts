import { createHighlighterCore, type HighlighterCore } from 'shiki/core';

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

  const { createOnigurumaEngine } = await import('shiki/engine/oniguruma');
  
  const engine = await createOnigurumaEngine(import('shiki/wasm'));

  highlighter = await createHighlighterCore({
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