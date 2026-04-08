import { Component, createSignal, createEffect, createMemo, onCleanup, Show } from 'solid-js';
import { Marked } from 'marked';
import { highlightCode, getHighlighter } from '../services/shikiService';
import type { Heading } from '../types';
import { parseFrontmatter, hasFrontmatter } from '../utils/frontmatter';
import FrontmatterPanel from './FrontmatterPanel';

interface MarkdownViewProps {
  content: string;
  class?: string;
  theme?: 'light' | 'dark';
  onHeadingsExtracted?: (headings: Heading[]) => void;
}

const generateHeadingId = (text: string): string => {
  return text
    .toLowerCase()
    .split('')
    .filter((c) => /[\p{L}\p{N}\s-]/u.test(c))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  const [renderedHtml, setRenderedHtml] = createSignal<string>('');
  const [isRendering, setIsRendering] = createSignal(false);

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
        },
      });

      let html = await marked.parse(content) as string;

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
      <div class="markdown-content" innerHTML={renderedHtml()} />
    </div>
  );
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export default MarkdownView;