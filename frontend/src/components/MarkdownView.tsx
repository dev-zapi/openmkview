import { Component, createSignal, createEffect, createMemo, onCleanup, onMount, untrack, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { highlightCode, getHighlighter } from '../services/shikiService';
import { renderDiagram, type DiagramType } from '../services/diagramService';
import DiagramZoomModal from './DiagramZoomModal';
import type { ZoomDiagramSource } from '../services/diagramZoomService';
import type { Annotation, AnnotationAnchor, Heading } from '../types';
import { parseFrontmatter, hasFrontmatter } from '../utils/frontmatter';
import { escapeHtml, unescapeHtml } from '../utils/html';
import { generateHeadingId, isDiagramLanguage, encodeDiagramCode, decodeDiagramCode } from '../utils/markdown';
import { setActiveSearchMatch } from '../utils/searchHighlight';
import {
  assignBlockAnchors,
  ensureBlockMarkers,
  blockAnchorFrom,
  applySearchAndAnnotationHighlights,
  type RenderedBlock,
} from '../utils/annotationBlocks';
import { anchorFromSelection } from '../utils/selectionAnchor';
import { createMarkdownPipeline, renderNoteMarkdown, sanitizeMarkdownHtml } from '../utils/sanitizedMarkdown';
import { annotationStore } from '../stores/annotationStore';
import AnnotationThread from './AnnotationThread';
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

  interface ComposerPanel {
    mode: 'composer';
    anchor: AnnotationAnchor;
    excerpt: string;
    left: number;
    top: number;
  }

  interface ViewerPanel {
    mode: 'view';
    annotation: Annotation;
    left: number;
    top: number;
  }

  interface ChooserPanel {
    mode: 'chooser';
    annotations: Annotation[];
    left: number;
    top: number;
  }

  interface SelectionCapture {
    anchor: AnnotationAnchor;
    excerpt: string;
    left: number;
    top: number;
  }

  type AnnotationPanel = ComposerPanel | ViewerPanel | ChooserPanel;

  const [panel, setPanel] = createSignal<AnnotationPanel | null>(null);
  const [selectionCapture, setSelectionCapture] =
    createSignal<SelectionCapture | null>(null);
  const [composerBody, setComposerBody] = createSignal('');
  const [savingAnnotation, setSavingAnnotation] = createSignal(false);
  const [annotationError, setAnnotationError] = createSignal<string | null>(null);
  let panelRef: HTMLDivElement | undefined;
  let renderedBlocks = new Map<string, RenderedBlock>();
  let renderedBlockList: RenderedBlock[] = [];
  let blockAttachments = new Map<string, Annotation[]>();

  const panelPosition = (rect: DOMRect): { left: number; top: number } => {
    const width = 320;
    let left = rect.right + 8;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, rect.left - width - 8);
    }
    // The popover can scroll, but it must start high enough that its action
    // row stays reachable when the anchored block is deep in the viewport.
    const maxTop = Math.max(8, window.innerHeight - 480);
    const top = Math.max(8, Math.min(rect.top, maxTop));
    return { left, top };
  };

  const openComposer = (anchor: AnnotationAnchor, excerpt: string, rect: DOMRect) => {
    const position = panelPosition(rect);
    setSelectionCapture(null);
    setComposerBody('');
    setAnnotationError(null);
    setPanel({ mode: 'composer', anchor, excerpt, ...position });
  };

  const openViewer = (annotation: Annotation, rect: DOMRect) => {
    const position = panelPosition(rect);
    setAnnotationError(null);
    setPanel({ mode: 'view', annotation, ...position });
  };

  const openChooser = (annotations: Annotation[], rect: DOMRect) => {
    const position = panelPosition(rect);
    setAnnotationError(null);
    setPanel({ mode: 'chooser', annotations, ...position });
  };

  /** Opens the only annotation directly, or a chooser when several match. */
  const openAnnotations = (annotations: Annotation[], rect: DOMRect) => {
    if (annotations.length === 0) return false;
    if (annotations.length === 1) openViewer(annotations[0], rect);
    else openChooser(annotations, rect);
    return true;
  };

  const saveAnnotation = async () => {
    const current = panel();
    const projectId = props.projectId;
    const relativePath = props.currentFilePath;
    if (!current || current.mode !== 'composer' || !projectId || !relativePath) return;

    const body = composerBody().trim();
    if (!body) {
      setAnnotationError('Write a note before saving.');
      return;
    }

    setSavingAnnotation(true);
    setAnnotationError(null);
    try {
      await annotationStore.create(projectId, relativePath, current.anchor, body);
      setPanel(null);
      setComposerBody('');
    } catch (error) {
      setAnnotationError(error instanceof Error ? error.message : 'Failed to save annotation');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const removeAnnotation = async (annotation: Annotation) => {
    setSavingAnnotation(true);
    setAnnotationError(null);
    try {
      await annotationStore.remove(annotation.id);
      setPanel(null);
    } catch (error) {
      setAnnotationError(error instanceof Error ? error.message : 'Failed to delete annotation');
    } finally {
      setSavingAnnotation(false);
    }
  };

  /** Completes manual re-anchoring from a fresh Preview text selection. */
  const completeReanchor = async (annotationId: number, anchor: AnnotationAnchor) => {
    setSavingAnnotation(true);
    setSelectionCapture(null);
    try {
      await annotationStore.reanchor(annotationId, anchor);
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to re-anchor annotation');
    } finally {
      setSavingAnnotation(false);
    }
  };

  const isReanchoring = () => annotationStore.reanchorTarget() !== null;

  const openAnnotationById = (id: number, rect: DOMRect) => {
    const annotation = annotationStore
      .annotations()
      .find((candidate) => candidate.id === id);
    if (annotation) openViewer(annotation, rect);
  };

  const onContentClick = (event: MouseEvent) => {
    if (!contentRef) return;
    // Pure-reading mode: no markers or highlights exist, so annotation
    // interactions are off while ordinary links/copy/etc keep working.
    if (!annotationStore.visible()) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    const textHighlight = target.closest(
      'mark[data-annotation-id]'
    ) as HTMLElement | null;
    if (textHighlight) {
      event.preventDefault();
      event.stopPropagation();
      openAnnotationById(
        Number(textHighlight.getAttribute('data-annotation-id')),
        textHighlight.getBoundingClientRect()
      );
      return;
    }

    const marker = target.closest('.annotation-marker') as HTMLElement | null;
    if (marker) {
      event.preventDefault();
      event.stopPropagation();
      const blockElement = marker.closest('.annotation-block') as HTMLElement | null;
      const blockId = blockElement?.getAttribute('data-block-id');
      const block = blockId ? renderedBlocks.get(blockId) : undefined;
      if (!blockElement || !block) return;

      const annotations = blockAttachments.get(block.model.id) ?? [];
      if (annotations.length > 0) {
        openAnnotations(annotations, marker.getBoundingClientRect());
      } else {
        openComposer(
          blockAnchorFrom(block),
          block.model.text,
          marker.getBoundingClientRect()
        );
      }
      return;
    }

    // Preserve ordinary in-document interactions inside a highlighted block.
    if (target.closest('a, button, input, textarea, select, .code-block-header')) return;

    const blockElement = target.closest('.annotation-block') as HTMLElement | null;
    if (!blockElement || !blockElement.classList.contains('annotation-highlighted')) return;

    // Multiple annotations on one block are listed by the render pass; the
    // chooser consumes that list instead of silently opening an arbitrary one.
    const ids = (
      blockElement.getAttribute('data-annotation-ids') ??
      blockElement.getAttribute('data-annotation-id') ??
      ''
    )
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const annotations = ids
      .map((id) =>
        annotationStore.annotations().find((candidate) => candidate.id === id)
      )
      .filter((candidate): candidate is Annotation => Boolean(candidate));
    if (annotations.length === 0) return;

    event.preventDefault();
    openAnnotations(annotations, blockElement.getBoundingClientRect());
  };

  const updateSelectionCapture = () => {
    if (
      !contentRef ||
      !props.projectId ||
      !props.currentFilePath ||
      !annotationStore.visible() ||
      !annotationStore.canMutate()
    ) {
      setSelectionCapture(null);
      return;
    }

    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionCapture(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (
      !contentRef.contains(range.startContainer) ||
      !contentRef.contains(range.endContainer)
    ) {
      setSelectionCapture(null);
      return;
    }

    const anchor = anchorFromSelection(contentRef, selection, renderedBlockList);
    if (!anchor) {
      setSelectionCapture(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSelectionCapture(null);
      return;
    }

    const excerpt = anchor.segments
      .map((segment) => (segment.kind === 'text' ? segment.quote : segment.blockText))
      .join(' … ');
    const buttonWidth = 116;
    let left = rect.right + 8;
    if (left + buttonWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - buttonWidth - 8);
    }
    const top = Math.max(8, rect.top - 38);

    setSelectionCapture({ anchor, excerpt, left, top });
  };

  const applyOfflineState = () => {
    const offline = !annotationStore.canMutate();
    for (const marker of contentRef?.querySelectorAll<HTMLButtonElement>('.annotation-marker') ?? []) {
      // Annotated markers only open the read-only viewer, which stays
      // available offline. Only the creation path is disabled.
      const opensViewer = marker.classList.contains('has-annotation');
      marker.disabled = offline && !opensViewer;
      marker.title =
        marker.disabled
          ? 'Unavailable offline'
          : marker.dataset.defaultTitle || 'Annotate this block';
    }
  };

  const prepareAnnotationPass = () => {
    if (!contentRef) return;
    contentRef.classList.toggle('annotations-hidden', !annotationStore.visible());
    const blocks = assignBlockAnchors(contentRef);
    renderedBlocks = new Map(blocks.map((block) => [block.model.id, block]));
    renderedBlockList = blocks;
    ensureBlockMarkers(blocks);
    setSelectionCapture(null);
    applyDecorations();
  };

  /**
   * Keep the two highlight layers in one order: annotation marks are removed,
   * search scans the unwrapped text, then annotation segments are applied.
   * Search deliberately skips annotation marks, so applying annotations first
   * would hide their text from search.
   */
  const applyDecorations = () => {
    if (!contentRef) {
      annotationStore.setOutdatedSnapshots(new Map());
      props.onSearchResultsChange?.(0);
      return;
    }
    if (renderedBlockList.length === 0) {
      annotationStore.setOutdatedSnapshots(new Map());
      props.onSearchResultsChange?.(0);
      return;
    }
    contentRef.classList.toggle('annotations-hidden', !annotationStore.visible());

    const applied = applySearchAndAnnotationHighlights(
      contentRef,
      props.searchQuery || '',
      annotationStore.visible() ? annotationStore.annotations() : [],
      renderedBlockList
    );
    searchMatches = applied.searchMatches;
    blockAttachments = applied.attachments;
    annotationStore.setOutdatedSnapshots(applied.outdated);
    props.onSearchResultsChange?.(searchMatches.length);
    setActiveSearchMatch(
      searchMatches,
      untrack(() => props.currentSearchResult || 0)
    );
    applyOfflineState();
  };

  const onReanchorEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isReanchoring()) return;
    annotationStore.cancelReanchor();
    setSelectionCapture(null);
    window.getSelection()?.removeAllRanges();
  };

  onMount(() => {
    contentRef?.addEventListener('click', onContentClick);
    document.addEventListener('selectionchange', updateSelectionCapture);
    contentRef?.addEventListener('mouseup', updateSelectionCapture);
    document.addEventListener('keyup', updateSelectionCapture);
    document.addEventListener('keydown', onReanchorEscape);
  });

  createEffect(() => {
    const projectId = props.projectId;
    const relativePath = props.currentFilePath;
    if (projectId && relativePath) {
      void annotationStore.load(projectId, relativePath);
    } else {
      annotationStore.reset();
    }
  });

  createEffect(() => {
    renderedHtml();
    annotationStore.annotations();
    // Re-applying on visibility keeps highlights and markers in sync when the
    // reading-mode toggle flips without a re-render.
    annotationStore.visible();
    props.searchQuery;
    applyDecorations();
  });

  // Offline Mode disables creation/editing controls in place, including
  // markers that were rendered before the connection dropped.
  createEffect(() => {
    annotationStore.canMutate();
    applyOfflineState();
  });

  // The annotation column asks the rendered document to reveal an anchor.
  // Depend only on jumpRequest: replies/edits/resolves mutate annotations and
  // must not replay the last jump.
  let handledJumpNonce = 0;
  createEffect(() => {
    const jump = annotationStore.jumpRequest();
    if (!jump || jump.nonce === handledJumpNonce) return;
    handledJumpNonce = jump.nonce;

    const annotation = untrack(() => annotationStore.annotations()).find(
      (candidate) => candidate.id === jump.annotationId,
    );
    const segment = annotation?.anchor?.segments?.find(
      (part) => part.kind === 'block' || part.kind === 'text',
    );
    if (!segment) return;

    const escaped = segment.blockHash.replace(/["\\]/g, '\\$&');
    const timer = setTimeout(() => {
      const block = contentRef?.querySelector<HTMLElement>(
        `.annotation-block[data-block-id="${escaped}"]`,
      );
      if (!block) return;

      const scroller = block.closest('.content-main') as HTMLElement | null;
      if (scroller) {
        const rect = block.getBoundingClientRect();
        const containerRect = scroller.getBoundingClientRect();
        const offsetTop = rect.top - containerRect.top + scroller.scrollTop - 60;
        scroller.scrollTo({ top: offsetTop, behavior: 'smooth' });
      } else {
        block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      block.classList.add('annotation-jump-target');
      block.setAttribute('tabindex', '-1');
      block.focus({ preventScroll: true });
      setTimeout(() => block.classList.remove('annotation-jump-target'), 1600);
    }, 0);

    onCleanup(() => clearTimeout(timer));
  });

  createEffect(() => {
    if (!panel()) return;
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && panelRef?.contains(target)) return;
      setPanel(null);
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    document.addEventListener('mousedown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    onCleanup(() => {
      document.removeEventListener('mousedown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    });
  });


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
      copyBtn.textContent = 'Copy';
      
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
          copyBtn.textContent = 'Copied';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('copied');
          }, 2000);
        } catch (error) {
          console.error('Failed to copy code:', error);
          copyBtn.textContent = 'Copy failed';
          copyBtn.classList.add('failed');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
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

    const preElements = containerRef.querySelectorAll('pre[data-lang]');
    
    preElements.forEach((pre) => {
      const lang = pre.getAttribute('data-lang') || 'text';
      
      if (!isDiagramLanguage(lang)) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode?.insertBefore(wrapper, pre);

      const encodedCode = btoa(unescape(encodeURIComponent(pre.querySelector('code')?.textContent || '')));
      wrapper.setAttribute('data-diagram-code', encodedCode);
      wrapper.setAttribute('data-diagram-type', lang);

      // Move header out of pre and into wrapper
      const header = pre.querySelector('.code-block-header');
      if (!header) {
        wrapper.appendChild(pre);
        return;
      }
      header.remove();
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'diagram-toggle-btn';
      toggleBtn.type = 'button';
      toggleBtn.setAttribute('aria-label', 'Toggle rendered diagram');
      toggleBtn.title = 'View rendered diagram';
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
      zoomBtn.setAttribute('aria-label', 'Zoom in');
      zoomBtn.title = 'Zoom in';
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

      let isSourceMode = false;
      let renderedSvg = '';

      const renderDiagramContent = async () => {
        try {
          const diagramCode = decodeDiagramCode(wrapper.getAttribute('data-diagram-code') || '');
          const svg = await renderDiagram(lang as DiagramType, diagramCode, props.theme || 'light');
          renderedSvg = svg;
          const diagramDiv = document.createElement('div');
          diagramDiv.className = 'diagram-rendered';
          diagramDiv.innerHTML = svg;
          if (pre.parentNode === wrapper) {
            wrapper.replaceChild(diagramDiv, pre);
          }
          wrapper.classList.add('diagram-mode');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to render';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'diagram-error';
          errorDiv.textContent = errorMessage;
          if (pre.parentNode === wrapper) {
            wrapper.replaceChild(errorDiv, pre);
          }
        }
      };

      // Set initial icon state for render mode (show source icon to indicate "click to view source")
      const iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
      const iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;
      iconSource.style.display = '';
      iconRender.style.display = 'none';
      toggleBtn.title = 'View source';
      zoomBtn.style.display = '';

      // Auto-render diagram on load
      renderDiagramContent();

      toggleBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        isSourceMode = !isSourceMode;
        const iconSource = toggleBtn.querySelector('.icon-source') as SVGElement;
        const iconRender = toggleBtn.querySelector('.icon-render') as SVGElement;

        if (isSourceMode) {
          iconSource.style.display = 'none';
          iconRender.style.display = '';
          toggleBtn.title = 'View rendered diagram';
          zoomBtn.style.display = 'none';
          wrapper.classList.remove('diagram-mode');
          // Remove diagram div if present
          const diagramDiv = wrapper.querySelector('.diagram-rendered');
          if (diagramDiv) {
            diagramDiv.remove();
          }
          // Add pre back if not present
          if (!wrapper.contains(pre)) {
            wrapper.appendChild(pre);
          }
        } else {
          iconSource.style.display = '';
          iconRender.style.display = 'none';
          toggleBtn.title = 'View source';
          zoomBtn.style.display = '';
          if (!renderedSvg) {
            await renderDiagramContent();
          } else {
            // Remove pre if present
            if (wrapper.contains(pre)) {
              pre.remove();
            }
            const diagramDiv = document.createElement('div');
            diagramDiv.className = 'diagram-rendered';
            diagramDiv.innerHTML = renderedSvg;
            wrapper.appendChild(diagramDiv);
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

      const marked = createMarkdownPipeline({
        currentFilePath: props.currentFilePath,
        projectId: props.projectId,
      });

      let html = await marked.parse(content) as string;

      html = sanitizeMarkdownHtml(html);

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
      html = html.replace(/<pre class="shiki-code-block" data-lang="([^"]*)"><code[^>]*>[\s\S]*?<\/code><\/pre>/g, (_match, lang) => {
        const highlighted = highlightedBlocks[index++] || '';
        return highlighted.replace(/<pre([^>]*)>/, `<pre$1 data-lang="${lang}">`);
      });

      setRenderedHtml(html);

      if (renderTimer) clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        if (containerRef) {
          // Setup code blocks (headers + diagram toggle)
          setupCodeBlocks();

          // Setup internal link click handlers
          setupInternalLinkHandlers(containerRef);

          // Assign stable block identities and annotation markers.
          prepareAnnotationPass();

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
    props.currentSearchResult;
    setActiveSearchMatch(searchMatches, props.currentSearchResult || 0);
  });

  onCleanup(() => {
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    contentRef?.removeEventListener('click', onContentClick);
    contentRef?.removeEventListener('mouseup', updateSelectionCapture);
    document.removeEventListener('selectionchange', updateSelectionCapture);
    document.removeEventListener('keyup', updateSelectionCapture);
    document.removeEventListener('keydown', onReanchorEscape);
  });

  const renderComposer = (current: AnnotationPanel) => {
    if (current.mode !== 'composer') return null;
    const offline = !annotationStore.canMutate();
    return (
      <div class="annotation-composer">
        <label class="annotation-composer-label" for="annotation-note-body">Note</label>
        <p class="annotation-anchor-excerpt">{current.excerpt.slice(0, 160)}</p>
        <textarea
          id="annotation-note-body"
          class="annotation-composer-input"
          rows={4}
          placeholder="Write a note… Markdown is supported"
          value={composerBody()}
          disabled={offline}
          onInput={(event) => setComposerBody(event.currentTarget.value)}
          ref={(element) => setTimeout(() => element.focus(), 0)}
        />
        <Show when={offline}>
          <p class="annotation-offline-note">Read-only while offline</p>
        </Show>
        <Show when={annotationError()}>
          <p class="annotation-error" role="alert">{annotationError()}</p>
        </Show>
        <div class="annotation-popover-actions">
          <button type="button" class="annotation-action-secondary" onClick={() => setPanel(null)}>
            Cancel
          </button>
          <button
            type="button"
            class="annotation-action-primary"
            disabled={offline || savingAnnotation() || composerBody().trim().length === 0}
            onClick={() => void saveAnnotation()}
          >
            {savingAnnotation() ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  };

  const viewerAnnotation = (): Annotation | undefined => {
    const current = panel();
    if (!current || current.mode !== 'view') return undefined;
    return (
      annotationStore.annotations().find((candidate) => candidate.id === current.annotation.id) ??
      current.annotation
    );
  };

  const renderViewer = (current: AnnotationPanel) => {
    if (current.mode !== 'view') return null;
    const annotation = viewerAnnotation() ?? current.annotation;
    const offline = !annotationStore.canMutate();
    const outdated = () => annotationStore.isOutdated(annotation.id);
    const snapshot = () =>
      annotationStore.outdatedSnapshot(annotation.id) ?? annotation.snapshot ?? '';
    const excerpt =
      annotation.anchor?.segments?.find((segment) => segment.kind === 'block')?.blockText ||
      annotation.snapshot ||
      '';

    return (
      <div class="annotation-viewer">
        <p class="annotation-anchor-excerpt">{excerpt.slice(0, 160)}</p>
        <Show when={outdated()}>
          <div class="annotation-outdated" role="status">
            <span class="annotation-outdated-badge">Outdated</span>
            <p class="annotation-outdated-snapshot">
              <span class="annotation-outdated-label">Originally anchored text</span>
              <span class="annotation-outdated-text">{snapshot()}</span>
            </p>
            <button
              type="button"
              class="annotation-action-secondary"
              disabled={offline}
              title={offline ? 'Unavailable offline' : undefined}
              onClick={() => {
                annotationStore.startReanchor(annotation.id);
                setPanel(null);
              }}
            >
              Re-anchor
            </button>
          </div>
        </Show>
        <AnnotationThread annotation={annotation} onDelete={() => setPanel(null)} />
      </div>
    );
  };

  const annotationExcerpt = (annotation: Annotation): string =>
    annotation.anchor.segments
      .map((segment) => (segment.kind === 'text' ? segment.quote : segment.blockText))
      .join(' … ')
      .slice(0, 120);

  const renderChooser = (current: AnnotationPanel) => {
    if (current.mode !== 'chooser') return null;
    return (
      <div class="annotation-chooser">
        <p class="annotation-composer-label">Annotations here</p>
        <div class="annotation-chooser-list">
          <For each={current.annotations}>
            {(annotation) => (
              <button
                type="button"
                class="annotation-chooser-item"
                onClick={() =>
                  setPanel({
                    mode: 'view',
                    annotation,
                    left: current.left,
                    top: current.top,
                  })
                }
              >
                <span class="annotation-chooser-excerpt">{annotationExcerpt(annotation)}</span>
                <span class="annotation-chooser-note">
                  {annotation.notes[0]?.body ?? ''}
                </span>
              </button>
            )}
          </For>
        </div>
      </div>
    );
  };

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
      <Show when={selectionCapture()}>
        {(capture) => (
          <Portal>
            <button
              type="button"
              class="annotation-selection-button"
              aria-label={
                isReanchoring() ? 'Re-anchor annotation to selected text' : 'Annotate selected text'
              }
              style={{
                left: `${capture().left}px`,
                top: `${capture().top}px`,
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const target = annotationStore.reanchorTarget();
                if (target !== null) {
                  void completeReanchor(target, capture().anchor);
                  return;
                }
                openComposer(
                  capture().anchor,
                  capture().excerpt,
                  new DOMRect(capture().left, capture().top, 0, 0)
                );
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              {isReanchoring() ? 'Re-anchor' : 'Annotate'}
            </button>
          </Portal>
        )}
      </Show>
      <Show when={panel()}>
        {(current) => (
          <Portal>
            <div
              ref={panelRef}
              class="annotation-popover"
              role="dialog"
              aria-label={
                current().mode === 'composer'
                  ? 'New annotation'
                  : current().mode === 'chooser'
                    ? 'Annotations here'
                    : 'Annotation'
              }
              style={{ left: `${current().left}px`, top: `${current().top}px` }}
            >
              {renderComposer(current())}
              {renderViewer(current())}
              {renderChooser(current())}
            </div>
          </Portal>
        )}
      </Show>
      <DiagramZoomModal
        isOpen={zoomModalOpen()}
        onClose={() => setZoomModalOpen(false)}
        source={zoomSource()}
        title="Diagram preview"
      />
    </div>
  );
};

export default MarkdownView;
