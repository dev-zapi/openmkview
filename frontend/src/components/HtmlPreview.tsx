import { Component, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { api } from '../services/api';
import { resolveImagePath } from '../utils/markdown';

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

  return `${template.innerHTML}
<style>
mark.search-match { background: rgba(245, 158, 11, 0.28); color: inherit; border-radius: 3px; padding: 0 1px; }
mark.search-match-current { background: rgba(59, 130, 246, 0.35); box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.65); }
</style>
<script>
(() => {
  const SEARCH_MARK_ATTR = 'data-openmkview-search-highlight';
  const SEARCH_MATCH_CLASS = 'search-match';
  const SEARCH_MATCH_CURRENT_CLASS = 'search-match-current';

  const postToParent = (payload) => {
    window.parent.postMessage({ source: 'openmkview-html-preview', ...payload }, '*');
  };

  const postHeight = () => {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0,
      400
    );
    postToParent({ type: 'resize', height });
  };

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id) || document.querySelector(\`a[name="\${CSS.escape(id)}"]\`);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(postHeight, 500);
  });

  const shouldSkipTextNode = (node) => {
    const parent = node.parentElement;
    return !parent || parent.closest(\`mark[\${SEARCH_MARK_ATTR}]\`) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName);
  };

  const clearHighlights = () => {
    document.querySelectorAll(\`mark[\${SEARCH_MARK_ATTR}]\`).forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      parent.normalize();
    });
  };

  const setActiveMatch = (matches, currentMatchIndex) => {
    matches.forEach((match) => match.classList.remove(SEARCH_MATCH_CURRENT_CLASS));
    if (!matches.length || currentMatchIndex < 1) return;
    const normalizedIndex = ((currentMatchIndex - 1) % matches.length + matches.length) % matches.length;
    const activeMatch = matches[normalizedIndex];
    activeMatch.classList.add(SEARCH_MATCH_CURRENT_CLASS);
    activeMatch.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  };

  const highlight = (query, currentMatchIndex) => {
    clearHighlights();
    const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
    if (!normalizedQuery) return 0;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        const value = node.nodeValue || '';
        if (!value.trim() || !value.toLocaleLowerCase().includes(normalizedQuery)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    const matches = [];
    textNodes.forEach((textNode) => {
      const value = textNode.nodeValue || '';
      const lowerValue = value.toLocaleLowerCase();
      const fragment = document.createDocumentFragment();
      let start = 0;
      let index = lowerValue.indexOf(normalizedQuery, start);

      while (index !== -1) {
        if (index > start) {
          fragment.appendChild(document.createTextNode(value.slice(start, index)));
        }
        const mark = document.createElement('mark');
        mark.setAttribute(SEARCH_MARK_ATTR, 'true');
        mark.className = SEARCH_MATCH_CLASS;
        mark.textContent = value.slice(index, index + normalizedQuery.length);
        fragment.appendChild(mark);
        matches.push(mark);
        start = index + normalizedQuery.length;
        index = lowerValue.indexOf(normalizedQuery, start);
      }

      if (start < value.length) {
        fragment.appendChild(document.createTextNode(value.slice(start)));
      }
      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    setActiveMatch(matches, Number(currentMatchIndex) || 0);
    return matches.length;
  };

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== 'openmkview' || data.type !== 'search') return;
    const count = highlight(data.query, data.current);
    postToParent({ type: 'search-results', count });
    postHeight();
  });

  window.addEventListener('load', postHeight);
  if (window.ResizeObserver) {
    new ResizeObserver(postHeight).observe(document.documentElement);
  }
  window.setTimeout(postHeight, 0);
})();
</script>`;
};

const HtmlPreview: Component<HtmlPreviewProps> = (props) => {
  let iframeRef: HTMLIFrameElement | undefined;
  const [iframeHeight, setIframeHeight] = createSignal('400px');

  const srcDoc = createMemo(() => rewriteRelativeResourceUrls(props.content, props.currentFilePath, props.projectId));

  const sendSearchRequest = () => {
    iframeRef?.contentWindow?.postMessage({
      source: 'openmkview',
      type: 'search',
      query: props.searchQuery || '',
      current: props.currentSearchResult || 0,
    }, '*');
  };

  createEffect(() => {
    srcDoc();
    setIframeHeight('400px');
    window.setTimeout(sendSearchRequest, 0);
  });

  createEffect(() => {
    props.searchQuery;
    srcDoc();
    sendSearchRequest();
  });

  createEffect(() => {
    props.currentSearchResult;
    sendSearchRequest();
  });

  onMount(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef?.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== 'openmkview-html-preview') return;

      if (data.type === 'resize' && Number.isFinite(data.height)) {
        setIframeHeight(`${Math.max(data.height, 400)}px`);
      }

      if (data.type === 'search-results' && Number.isFinite(data.count)) {
        props.onSearchResultsChange?.(data.count);
      }
    };

    window.addEventListener('message', handleMessage);
    onCleanup(() => window.removeEventListener('message', handleMessage));
  });

  return (
    <div class="html-preview">
      <iframe
        ref={iframeRef}
        class="html-preview-frame"
        srcdoc={srcDoc()}
        sandbox="allow-scripts"
        style={{ height: iframeHeight() }}
        onLoad={sendSearchRequest}
        title="HTML preview"
      />
    </div>
  );
};

export default HtmlPreview;
