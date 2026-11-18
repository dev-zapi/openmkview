import { Component, createSignal, createEffect, untrack, For, Show } from 'solid-js';
import { highlightCode } from '../services/shikiService';
import { escapeHtml } from '../utils/html';
import { highlightSearchMatches, setActiveSearchMatch } from '../utils/searchHighlight';
import { annotationStore } from '../stores/annotationStore';
import { locateAnchorInSource } from '../utils/sourceAnchorLocator';
import type { Annotation } from '../types';

interface SourceViewProps {
  content: string;
  fileName?: string;
  theme?: 'light' | 'dark';
  projectId?: number;
  currentFilePath?: string;
  showLineNumbers?: boolean;
  searchQuery?: string;
  currentSearchResult?: number;
  onSearchResultsChange?: (count: number) => void;
}

interface OutdatedSourceAnnotation {
  excerpt: string;
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
  let highlightedRef: HTMLDivElement | undefined;
  const [highlightedHtml, setHighlightedHtml] = createSignal<string>('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [outdatedAnnotations, setOutdatedAnnotations] = createSignal<OutdatedSourceAnnotation[]>([]);
  let searchMatches: HTMLElement[] = [];

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

  createEffect(() => {
    highlightedHtml();
    const query = props.searchQuery || '';

    if (!highlightedRef) {
      props.onSearchResultsChange?.(0);
      return;
    }

    searchMatches = highlightSearchMatches(highlightedRef, query);
    props.onSearchResultsChange?.(searchMatches.length);
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  createEffect(() => {
    props.currentSearchResult;
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  // Source view is another entry point to the same per-file annotations; the
  // store deduplicates when the Preview already loaded them.
  createEffect(() => {
    const projectId = props.projectId;
    const relativePath = props.currentFilePath;
    if (projectId && relativePath) {
      void annotationStore.load(projectId, relativePath);
    }
  });

  const annotationExcerpt = (annotation: Annotation): string =>
    (annotation.anchor?.segments ?? [])
      .map((segment) => (segment.kind === 'text' ? segment.quote : segment.blockText))
      .filter((text) => Boolean(text))
      .join(' … ');

  /**
   * Read-only Source echo. Line highlights are best-effort; an unlocatable
   * Anchor degrades to the Outdated badge instead of a wrong line. Status is
   * published even when highlights are hidden so the annotation column keeps
   * agreeing with the document (ADR-0005).
   */
  const applySourceHighlights = (annotations: Annotation[], visible: boolean): void => {
    const lineElements = highlightedRef
      ? Array.from(highlightedRef.querySelectorAll<HTMLElement>('pre code > .line'))
      : [];

    for (const line of lineElements) {
      line.classList.remove('source-annotation-highlight', 'source-annotation-resolved');
      line.removeAttribute('role');
      line.removeAttribute('aria-label');
      line.removeAttribute('title');
    }

    const annotationsByLine = new Map<number, Annotation[]>();
    const outdated: OutdatedSourceAnnotation[] = [];
    // Canonical status is owned by the Preview; read it untracked so
    // publishing the Source-only fallback cannot loop back into this effect.
    const previewResolved = untrack(() => annotationStore.previewOutdatedResolved());
    const canonicalOutdated = untrack(() => annotationStore.outdatedSnapshots());
    const sourceSnapshots = new Map<number, string>();

    const addRanges = (annotation: Annotation, ranges: { start: number; end: number }[]) => {
      for (const range of ranges) {
        for (let line = range.start; line <= range.end; line += 1) {
          const entries = annotationsByLine.get(line) ?? [];
          if (!entries.some((entry) => entry.id === annotation.id)) {
            entries.push(annotation);
          }
          annotationsByLine.set(line, entries);
        }
      }
    };

    for (const annotation of annotations) {
      // The rendered Preview is the canonical status surface. Mirror its
      // Outdated set exactly and never invent a different state from the
      // coarser raw-Markdown projection.
      if (previewResolved) {
        const canonicalSnapshot = canonicalOutdated.get(annotation.id);
        if (canonicalSnapshot !== undefined) {
          outdated.push({ excerpt: canonicalSnapshot || annotationExcerpt(annotation) });
          continue;
        }

        const location = locateAnchorInSource(props.content, annotation.anchor);
        // An Active annotation the Source projection cannot find is simply
        // not echoed; it must not gain a false Outdated badge here.
        if (location.status === 'located') addRanges(annotation, location.ranges);
        continue;
      }

      const location = locateAnchorInSource(props.content, annotation.anchor);
      if (location.status === 'outdated') {
        const snapshot = annotation.snapshot?.trim() || location.snapshot;
        sourceSnapshots.set(annotation.id, snapshot);
        outdated.push({ excerpt: snapshot || annotationExcerpt(annotation) });
        continue;
      }

      addRanges(annotation, location.ranges);
    }

    // Source-only load (no Preview visit): fill the status the Preview could
    // not provide. Once Preview has resolved, its map stays untouched.
    annotationStore.publishSourceOutdatedSnapshots(sourceSnapshots);
    setOutdatedAnnotations(outdated);

    if (!visible) return;

    for (const [lineNumber, entries] of annotationsByLine) {
      const element = lineElements[lineNumber - 1];
      if (!element) continue;

      element.classList.add('source-annotation-highlight');
      if (entries.every((entry) => entry.resolved)) {
        element.classList.add('source-annotation-resolved');
      }

      const label = entries
        .map((entry) => annotationExcerpt(entry))
        .filter((text) => text.length > 0)
        .join(' … ');
      element.setAttribute('role', 'mark');
      element.setAttribute(
        'aria-label',
        label ? `Annotated source line: ${label}` : 'Annotated source line',
      );
      if (label) element.title = `Annotated: ${label}`;
    }
  };

  createEffect(() => {
    props.content;
    highlightedHtml();
    // The rendered source div only mounts after loading finishes, so the
    // highlight pass must also observe that transition.
    isLoading();
    applySourceHighlights(annotationStore.annotations(), annotationStore.visible());
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

      <Show when={outdatedAnnotations().length > 0 && annotationStore.visible()}>
        <div
          class="source-outdated-panel"
          role="status"
          aria-label="Outdated annotations"
        >
          <For each={outdatedAnnotations()}>
            {(item) => (
              <div class="source-outdated-item">
                <span class="annotation-outdated-badge">Outdated</span>
                <span class="source-outdated-text">{item.excerpt}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!isLoading() && highlightedHtml().length > 0}>
        <div
          ref={highlightedRef}
          class="source-highlighted"
          innerHTML={highlightedHtml()}
        />
      </Show>
    </div>
  );
};

export default SourceView;
