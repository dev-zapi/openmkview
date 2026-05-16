import { Component, createEffect, createMemo, createSignal } from 'solid-js';
import { api } from '../services/api';
import { resolveImagePath } from '../utils/markdown';
import { highlightSearchMatches, setActiveSearchMatch } from '../utils/searchHighlight';

interface HtmlPreviewProps {
  content: string;
  currentFilePath: string;
  projectId?: number;
  searchQuery?: string;
  currentSearchResult?: number;
  onSearchResultsChange?: (count: number) => void;
}

const rewriteRelativeResourceUrls = (content: string, currentFilePath: string, projectId?: number): string => {
  if (!projectId || !content) {
    return content;
  }

  const template = document.createElement('template');
  template.innerHTML = content;

  const rewriteAttribute = (selector: string, attribute: string) => {
    template.content.querySelectorAll(selector).forEach((element) => {
      const value = element.getAttribute(attribute);
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(value)) {
        return;
      }

      element.setAttribute(attribute, api.getFileRawUrl(resolveImagePath(currentFilePath, value), projectId));
    });
  };

  rewriteAttribute('[src]', 'src');
  rewriteAttribute('link[href]', 'href');
  rewriteAttribute('a[href]', 'href');

  return `${template.innerHTML}
<style>
mark.search-match { background: rgba(245, 158, 11, 0.28); color: inherit; border-radius: 3px; padding: 0 1px; }
mark.search-match-current { background: rgba(59, 130, 246, 0.35); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.65); }
</style>`;
};

const HtmlPreview: Component<HtmlPreviewProps> = (props) => {
  let iframeRef: HTMLIFrameElement | undefined;
  const [iframeHeight, setIframeHeight] = createSignal('100%');
  let searchMatches: HTMLElement[] = [];

  const srcDoc = createMemo(() => rewriteRelativeResourceUrls(props.content, props.currentFilePath, props.projectId));

  const resizeFrame = () => {
    const doc = iframeRef?.contentDocument;
    if (!doc) return;

    const height = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
      400
    );
    setIframeHeight(`${height}px`);
  };

  const syncSearchHighlights = () => {
    const body = iframeRef?.contentDocument?.body;
    if (!body) {
      props.onSearchResultsChange?.(0);
      return;
    }

    searchMatches = highlightSearchMatches(body, props.searchQuery || '');
    props.onSearchResultsChange?.(searchMatches.length);
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
    resizeFrame();
  };

  createEffect(() => {
    srcDoc();
    setIframeHeight('100%');
    window.setTimeout(() => {
      resizeFrame();
      syncSearchHighlights();
    }, 0);
  });

  createEffect(() => {
    props.searchQuery;
    srcDoc();
    syncSearchHighlights();
  });

  createEffect(() => {
    props.currentSearchResult;
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  return (
    <div class="html-preview">
      <iframe
        ref={iframeRef}
        class="html-preview-frame"
        srcdoc={srcDoc()}
        sandbox="allow-same-origin"
        style={{ height: iframeHeight() }}
        onLoad={() => {
          resizeFrame();
          syncSearchHighlights();
        }}
        title="HTML preview"
      />
    </div>
  );
};

export default HtmlPreview;
