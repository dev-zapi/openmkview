import { Component, createSignal, createEffect, createMemo, onCleanup, Show } from 'solid-js';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { highlightCode, getHighlighter } from '../services/shikiService';
import type { Heading } from '../types';
import { parseFrontmatter, hasFrontmatter } from '../utils/frontmatter';
import { escapeHtml, unescapeHtml } from '../utils/html';
import { generateHeadingId, resolveImagePath } from '../utils/markdown';
import { highlightSearchMatches, setActiveSearchMatch } from '../utils/searchHighlight';
import FrontmatterPanel from './FrontmatterPanel';

interface MarkdownViewProps {
  content: string;
  class?: string;
  theme?: 'light' | 'dark';
  onHeadingsExtracted?: (headings: Heading[]) => void;
  currentFilePath?: string;
  projectId?: number;
  searchQuery?: string;
  currentSearchResult?: number;
  onSearchResultsChange?: (count: number) => void;
}

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  const [renderedHtml, setRenderedHtml] = createSignal<string>('');
  const [isRendering, setIsRendering] = createSignal(false);
  let searchMatches: HTMLElement[] = [];

  const parsed = createMemo(() => parseFrontmatter(props.content));
  const frontmatterData = () => parsed().data;
  const markdownBody = () => parsed().content;

  const extractHeadingsFromHtml = (): Heading[] => {
    if (!containerRef) return [];

    const headingElements = containerRef.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headings: Heading[] = [];

    headingElements.forEach((el) => {
      const level = parseInt(el.tagName.charAt(1));
      const text = el.textContent || '';
      const id = el.id || generateHeadingId(text);

      if (!el.id) {
        el.id = id;
      }

      headings.push({
        depth: level,
        text: text.trim(),
        id,
      });
    });

    return headings;
  };

  const renderMarkdown = async () => {
    const content = markdownBody();
    if (!content) {
      setRenderedHtml('');
      return;
    }

    setIsRendering(true);

    try {
      await getHighlighter();

      const marked = new Marked({
        gfm: true,
        breaks: true,
      });

      marked.use({
        async: true,
        renderer: {
          heading({ tokens, depth }) {
            const text = this.parser.parseInline(tokens);
            const id = generateHeadingId(text);
            return `<h${depth} id="${id}">${text}</h${depth}>\n`;
          },
          code({ text, lang }) {
            const language = lang || 'text';
            return `<pre class="shiki-code-block" data-lang="${language}"><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
          },
          image({ href, title, text }) {
            let imageUrl = href || '';

            if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('//')) {
              if (props.currentFilePath && props.projectId) {
                const absolutePath = resolveImagePath(props.currentFilePath, href);
                imageUrl = `/api/files/raw?path=${encodeURIComponent(absolutePath)}&project_id=${props.projectId}`;
              }
            }

            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const altText = text || '';
            return `<img src="${imageUrl}" alt="${escapeHtml(altText)}"${titleAttr} loading="lazy" decoding="async" />`;
          },
        },
      });

      let html = await marked.parse(content) as string;

      html = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'loading', 'decoding'],
        ADD_TAGS: ['mark'],
      });

      html = html.replace(/<table>/g, '<div class="table-wrapper"><table>')
        .replace(/<\/table>/g, '</table></div>');

      const codeBlockRegex = /<pre class="shiki-code-block" data-lang="([^"]*)"><code class="language-[^"]*">([\s\S]*?)<\/code><\/pre>/g;
      const codeBlocks: { lang: string; code: string }[] = [];

      let matchResult;
      while ((matchResult = codeBlockRegex.exec(html)) !== null) {
        codeBlocks.push({
          lang: matchResult[1],
          code: unescapeHtml(matchResult[2]),
        });
      }

      const highlightPromises = codeBlocks.map(async (block) => {
        try {
          const result = await highlightCode({
            code: block.code,
            lang: block.lang,
            theme: props.theme,
          });
          return result.html;
        } catch {
          return `<pre><code class="language-${block.lang}">${escapeHtml(block.code)}</code></pre>`;
        }
      });

      const highlightedBlocks = await Promise.all(highlightPromises);

      let index = 0;
      html = html.replace(/<pre class="shiki-code-block"[^>]*><code[^>]*>[\s\S]*?<\/code><\/pre>/g, () => {
        return highlightedBlocks[index++] || '';
      });

      setRenderedHtml(html);

      setTimeout(() => {
        if (containerRef && props.onHeadingsExtracted) {
          const headings = extractHeadingsFromHtml();
          props.onHeadingsExtracted?.(headings);
        }
      }, 0);
    } catch (error) {
      console.error('Failed to render markdown:', error);
      setRenderedHtml(`<div class="error">Failed to render markdown</div>`);
    } finally {
      setIsRendering(false);
    }
  };

  createEffect(() => {
    props.content;
    props.theme;
    renderMarkdown();
  });

  createEffect(() => {
    renderedHtml();
    const query = props.searchQuery || '';

    if (!contentRef) {
      props.onSearchResultsChange?.(0);
      return;
    }

    searchMatches = highlightSearchMatches(contentRef, query);
    props.onSearchResultsChange?.(searchMatches.length);
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  createEffect(() => {
    props.currentSearchResult;
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  onCleanup(() => {});

  return (
    <div
      ref={containerRef}
      class={`markdown-view ${props.class || ''} ${isRendering() ? 'rendering' : ''}`}
    >
      <Show when={isRendering()}>
        <div class="markdown-loading-overlay">
          <div class="markdown-loading-spinner"></div>
        </div>
      </Show>
      {hasFrontmatter(frontmatterData()) && (
        <FrontmatterPanel data={frontmatterData()} />
      )}
      <div ref={contentRef} class="markdown-content" innerHTML={renderedHtml()} />
    </div>
  );
};

export default MarkdownView;
