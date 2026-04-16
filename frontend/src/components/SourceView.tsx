import { Component, createSignal, createEffect, Show } from 'solid-js';
import { highlightCode } from '../services/shikiService';
import { escapeHtml } from '../utils/html';

interface SourceViewProps {
  content: string;
  fileName?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
}

const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    ps1: 'powershell',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    markdown: 'markdown',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    vue: 'vue',
    svelte: 'svelte',
  };
  return langMap[ext] || 'text';
};

const SourceView: Component<SourceViewProps> = (props) => {
  const [highlightedHtml, setHighlightedHtml] = createSignal<string>('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const highlightSource = async () => {
    if (!props.content) {
      setHighlightedHtml('');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const lang = props.fileName
        ? getLanguageFromFileName(props.fileName)
        : 'text';

      const result = await highlightCode({
        code: props.content,
        lang,
        theme: props.theme,
      });

      setHighlightedHtml(result.html);
    } catch (err) {
      console.error('Failed to highlight source:', err);
      setError(String(err));
      setHighlightedHtml(
        `<pre class="shiki"><code>${escapeHtml(props.content)}</code></pre>`
      );
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    props.content;
    props.fileName;
    props.theme;
    highlightSource();
  });

  return (
    <div class="source-view-wrapper">
      <Show when={isLoading()}>
        <div class="source-loading">
          <div class="loading-spinner"></div>
          <span>Highlighting...</span>
        </div>
      </Show>

      <Show when={error() !== null}>
        <div class="source-error">
          <span>Warning: {error()}</span>
        </div>
      </Show>

      <Show when={!isLoading() && highlightedHtml().length > 0}>
        <div
          class="source-highlighted"
          innerHTML={highlightedHtml()}
        />
      </Show>
    </div>
  );
};

export default SourceView;
