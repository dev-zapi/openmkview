import { Component, createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { api } from '../services/api';
import { highlightSearchMatches, setActiveSearchMatch } from '../utils/searchHighlight';

interface HtmlPreviewProps {
  content: string;
  currentFilePath: string;
  projectId?: number;
  searchQuery?: string;
  currentSearchResult?: number;
  onSearchResultsChange?: (count: number) => void;
}

const HtmlPreview: Component<HtmlPreviewProps> = (props) => {
  let iframeRef: HTMLIFrameElement | undefined;
  let observer: ResizeObserver | undefined;
  const [iframeHeight, setIframeHeight] = createSignal('400px');
  let searchMatches: HTMLElement[] = [];

  const fileUrl = createMemo(() =>
    props.projectId
      ? api.getFileRawUrl(props.currentFilePath, props.projectId)
      : null
  );

  const syncHeight = () => {
    if (!iframeRef?.contentDocument) return;
    const doc = iframeRef.contentDocument;
    const height = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight || 0,
      400
    );
    setIframeHeight(`${height}px`);
  };

  const runSearch = () => {
    if (!iframeRef?.contentDocument?.body) return;
    const query = props.searchQuery || '';
    searchMatches = highlightSearchMatches(iframeRef.contentDocument.body, query);
    props.onSearchResultsChange?.(searchMatches.length);
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  };

  onMount(() => {
    if (iframeRef) {
      iframeRef.addEventListener('load', () => {
        syncHeight();
        runSearch();
        if (iframeRef?.contentDocument?.documentElement) {
          observer = new ResizeObserver(syncHeight);
          observer.observe(iframeRef.contentDocument.documentElement);
        }
      });
    }
    onCleanup(() => {
      observer?.disconnect();
    });
  });

  createEffect(() => {
    fileUrl();
    setIframeHeight('400px');
    window.setTimeout(runSearch, 200);
  });

  createEffect(() => {
    props.searchQuery;
    runSearch();
  });

  createEffect(() => {
    props.currentSearchResult;
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  return (
    <div class="html-preview">
      <Show
        when={fileUrl()}
        fallback={
          <div
            class="html-preview-inline"
            style={{ height: iframeHeight(), overflow: 'auto' }}
            innerHTML={props.content}
          />
        }
      >
        <iframe
          ref={iframeRef}
          class="html-preview-frame"
          src={fileUrl()!}
          style={{ height: iframeHeight() }}
          title="HTML preview"
        />
      </Show>
    </div>
  );
};

export default HtmlPreview;
