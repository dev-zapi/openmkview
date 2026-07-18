import { Component, createSignal, createEffect, createMemo, onCleanup, Show } from 'solid-js';
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { highlightCode, getHighlighter } from '../services/shikiService';
import { renderDiagram, type DiagramType } from '../services/diagramService';
import DiagramZoomModal from './DiagramZoomModal';
import type { ZoomDiagramSource } from '../services/diagramZoomService';
import type { Heading } from '../types';
import { parseFrontmatter, hasFrontmatter } from '../utils/frontmatter';
import { escapeHtml, unescapeHtml } from '../utils/html';
import { generateHeadingId, resolveImagePath, isDiagramLanguage, encodeDiagramCode, decodeDiagramCode } from '../utils/markdown';
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
  onFileOpen?: (path: string) => void;
}

const MarkdownView: Component<MarkdownViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  const [renderedHtml, setRenderedHtml] = createSignal<string>('');
  const [isRendering, setIsRendering] = createSignal(false);
  const [zoomModalOpen, setZoomModalOpen] = createSignal(false);
  const [zoomSource, setZoomSource] = createSignal<ZoomDiagramSource | null>(null);
  let searchMatches: HTMLElement[] = [];
  let renderTimer: ReturnType<typeof setTimeout> | undefined;

  const parsed = createMemo(() => parseFrontmatter(props.content));
  const frontmatterData = () => parsed().data;
  const markdownBody = () => parsed().content;

  const addCodeBlockHeaders = (container: HTMLElement) => {
    const preElements = container.querySelectorAll('pre');
    
    preElements.forEach((pre) => {
      // Prevent duplicate headers
      if (pre.querySelector('.code-block-header')) return;
      
      // Get language from data-lang attribute
      const lang = pre.getAttribute('data-lang') || 'text';
      
      // Create header container
      const header = document.createElement('div');
      header.className = `code-block-header`;
      
      // Create language tag
      const langTag = document.createElement('span');
      langTag.className = 'code-lang-tag';
      langTag.textContent = lang;
      
      // Create copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-button';
      copyBtn.textContent = ' 复制';
      
      copyBtn.onclick = async () => {
        const code = pre.querySelector('code')?.textContent || '';
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(code);
          } else {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = code;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = ' 复制';
            copyBtn.classList.remove('copied');
          }, 2000);
        } catch (error) {
          console.error('Failed to copy code:', error);
          copyBtn.textContent = '复制失败';
          copyBtn.classList.add('failed');
          setTimeout(() => {
            copyBtn.textContent = '📋 复制';
            copyBtn.classList.remove('failed');
          }, 2000);
        }
      };
      
      header.appendChild(langTag);
      header.appendChild(copyBtn);
      pre.appendChild(header);
    });
  };

  const setupCodeBlocks = () => {
    if (!containerRef) return;

    // First add headers to all code blocks
    addCodeBlockHeaders(containerRef);

    const preElements = containerRef.querySelectorAll('pre.shiki-code-block');
    
    preElements.forEach((pre) => {
      const lang = pre.getAttribute('data-lang') || 'text';
      
      if (!isDiagramLanguage(lang)) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const encodedCode = btoa(unescape(encodeURIComponent(pre.querySelector('code')?.textContent || '')));
      wrapper.setAttribute('data-diagram-code', encodedCode);
      wrapper.setAttribute('data-diagram-type', lang);

      const header = pre.querySelector('.code-block-header');
      if (!header) return;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'diagram-toggle-btn';
      toggleBtn.type = 'button';
      toggleBtn.setAttribute('aria-label', '切换渲染图');
      toggleBtn.title = '查看渲染图';
      toggleBtn.innerHTML = `
        <svg class="icon-source" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
        </svg>
        <svg class="icon-render" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      `;

      const zoomBtn = document.createElement('button');
      zoomBtn.className = 'diagram-zoom-btn';
      zoomBtn.type = 'button';
      zoomBtn.setAttribute('aria-label', '放大查看');
      zoomBtn.title = '放大查看';
      zoomBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      `;

      header.insertBefore(zoomBtn, header.firstChild);
      header.insertBefore(toggleBtn, header.firstChild);

      let isSourceMode = true;
      let renderedSvg = '';

      const renderDiagramContent = async () => {
        try {
          const diagramCode = decodeDiagramCode(wrapper.getAttribute('data-diagram-code') || '');
          const svg = await renderDiagram(lang as DiagramType, diagramCode, props.theme || 'light');
          renderedSvg = svg;
          const diagramDiv = document.createElement('div');
          diagramDiv.className = 'diagram-rendered';
          diagramDiv.innerHTML = svg;
          wrapper.replaceChild(diagramDiv, pre);
          wrapper.classList.add('diagram-mode');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '渲染失败';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'diagram-error';
          errorDiv.textContent = errorMessage;
          wrapper.replaceChild(errorDiv, pre);
        }
      };

      toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        isSourceMode = !isSourceMode;
        const iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
        const iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;

        if (isSourceMode) {
          iconSource.style.display = '';
          iconRender.style.display = 'none';
          toggleBtn.title = '查看渲染图';
          zoomBtn.style.display = '';
          wrapper.classList.remove('diagram-mode');
          wrapper.appendChild(pre);
        } else {
          iconSource.style.display = 'none';
          iconRender.style.display = '';
          toggleBtn.title = '查看源码';
          zoomBtn.style.display = 'none';
          if (!renderedSvg) {
            await renderDiagramContent();
          } else {
            const diagramDiv = document.createElement('div');
            diagramDiv.className = 'diagram-rendered';
            diagramDiv.innerHTML = renderedSvg;
            wrapper.replaceChild(diagramDiv, pre);
            wrapper.classList.add('diagram-mode');
          }
        }
      });

      zoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const diagramCode = decodeDiagramCode(wrapper.getAttribute('data-diagram-code') || '');
        setZoomSource({ type: lang as DiagramType, code: diagramCode, theme: props.theme || 'light' });
        setZoomModalOpen(true);
      });
    });
  };

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


  const openDiagramZoom = (placeholder: HTMLElement) => {
    const type = placeholder.getAttribute('data-type') as DiagramType;
    const encodedCode = placeholder.getAttribute('data-code') || '';
    const theme = (placeholder.getAttribute('data-theme') as 'light' | 'dark') || 'light';
    try {
      const code = decodeDiagramCode(encodedCode);
      setZoomSource({ type, code, theme });
      setZoomModalOpen(true);
    } catch (err) {
      console.error('Failed to decode diagram code for zoom:', err);
    }
  };

  const setupInternalLinkHandlers = (container: HTMLElement) => {
    const internalLinks = container.querySelectorAll('a.internal-link[data-relative-path]');
    internalLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetPath = (e.currentTarget as HTMLElement).getAttribute('data-relative-path');
        if (targetPath && props.onFileOpen) {
          props.onFileOpen(targetPath);
        }
      });
    });
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
          link({ href, title, text }) {
            const linkHref = href || '';
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const linkText = text || '';

            // External links, anchors, mailto, tel, etc. - open in new tab
            if (
              linkHref.startsWith('http') ||
              linkHref.startsWith('//') ||
              linkHref.startsWith('mailto:') ||
              linkHref.startsWith('tel:') ||
              linkHref.startsWith('#') ||
              linkHref.startsWith('data:')
            ) {
              const targetAttr = linkHref.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"';
              return `<a href="${escapeHtml(linkHref)}"${targetAttr}${titleAttr}>${linkText}</a>`;
            }

            // Relative path link - resolve and mark for internal navigation
            if (props.currentFilePath) {
              const resolvedPath = resolveImagePath(props.currentFilePath, linkHref);
              return `<a href="#" data-relative-path="${escapeHtml(resolvedPath)}" class="internal-link" style="cursor:pointer"${titleAttr}>${linkText}</a>`;
            }

            return `<a href="${escapeHtml(linkHref)}"${titleAttr}>${linkText}</a>`;
          },
        },
      });

      let html = await marked.parse(content) as string;

      html = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'loading', 'decoding', 'data-type', 'data-code', 'data-theme', 'data-relative-path'],
        ADD_TAGS: ['mark', 'svg', 'path', 'g', 'rect', 'text', 'circle', 'line', 'polygon', 'polyline'],
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

      renderTimer = setTimeout(() => {
        if (containerRef) {
          // Setup code blocks (headers + diagram toggle)
          setupCodeBlocks();

          // Setup internal link click handlers
          setupInternalLinkHandlers(containerRef);
          
          // Extract headings (existing logic)
          if (props.onHeadingsExtracted) {
            const headings = extractHeadingsFromHtml();
            props.onHeadingsExtracted?.(headings);
          }
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

  onCleanup(() => {
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
  });

  return (
    <div
      ref={containerRef}
      class={`markdown-view ${props.class || ''} ${isRendering() ? 'rendering' : ''} ${props.theme === 'dark' ? 'dark' : ''}`}
      data-theme={props.theme}
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
      <DiagramZoomModal
        isOpen={zoomModalOpen()}
        onClose={() => setZoomModalOpen(false)}
        source={zoomSource()}
        title="图表预览"
      />
    </div>
  );
};

export default MarkdownView;
