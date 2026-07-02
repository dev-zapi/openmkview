import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { escapeHtml } from '../utils/html';
import { THEME_MAP } from '../utils/codeThemes';

// Note: Theme imports below must match shikiService.ts theme imports.
// Both service and worker load themes separately as they run in different contexts
// (main thread vs worker thread). Duplication is intentional and necessary.

// Default themes for fallback
const LIGHT_THEME = 'github-light';
const DARK_THEME = 'github-dark';

interface HighlightRequest {
  id: number;
  type: 'highlight';
  code: string;
  lang: string;
  theme: 'light' | 'dark';
  codeTheme: string; // The actual theme setting value from settings
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

  self.postMessage({ type: 'initialized' } as InitResponse);
}

async function handleHighlight(request: HighlightRequest): Promise<HighlightResponse> {
  if (!highlighter) {
    await initHighlighter();
  }

  // Use the codeTheme from the request, mapped to Shiki theme name
  // Fallback to default themes if codeTheme is not provided or not in map
  const themeName = THEME_MAP[request.codeTheme] || (request.theme === 'dark' ? DARK_THEME : LIGHT_THEME);
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
