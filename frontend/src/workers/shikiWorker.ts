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
    themes: [
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ],
    langs: COMMON_LANGS.map((lang) => import(`shiki/langs/${lang}.mjs`)),
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