import type { Annotation, AnnotationAnchor, BlockAnchorSegment } from '../types';
import { decodeDiagramCode } from './markdown';
import {
  normalizeBlockText,
  hashBlockContent,
  type BlockModel,
} from './blockModel';
import { getBlockContentElement, clearRangeHighlights, highlightTextRange } from './rangeHighlight';
import { resolveAnchor } from './anchorResolver';
import { highlightSearchMatches } from './searchHighlight';

/**
 * A top-level rendered block and its DOM edge. The annotation identity
 * (`model`) is serializable; DOM references live only here, at the edge.
 */
export interface RenderedBlock {
  element: HTMLElement;
  model: BlockModel;
}

const ANNOTATABLE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'blockquote', 'pre', 'table',
]);

/** Exposes the content root used for selection/highlight offsets. */
export { getBlockContentElement };

function blockTypeOf(element: HTMLElement): string {
  if (element.tagName === 'DIV' && element.classList.contains('table-wrapper')) {
    return 'table';
  }
  if (element.tagName === 'DIV' && element.classList.contains('code-block-wrapper')) {
    return 'code';
  }
  if (element.tagName === 'PRE') {
    return 'code';
  }
  return element.tagName.toLowerCase();
}

function isAnnotatableBlock(element: HTMLElement): boolean {
  const type = blockTypeOf(element);
  if (type === 'table' || type === 'code') return true;
  return ANNOTATABLE_TAGS.has(type);
}

function headingLevel(type: string): number {
  if (type.length === 2 && type.startsWith('h')) {
    const level = Number.parseInt(type.slice(1), 10);
    return Number.isNaN(level) ? 0 : level;
  }
  return 0;
}

/**
 * Anchors must reference document content only. Rendered code/diagram blocks
 * carry injected UI chrome (language label, Copy button, diagram toggles), so
 * take the code source instead of the block's full textContent.
 */
function blockContentText(element: HTMLElement, type: string): string {
  if (type === 'code') {
    if (element.classList.contains('code-block-wrapper')) {
      const encoded = element.getAttribute('data-diagram-code');
      if (encoded) {
        try {
          return normalizeBlockText(decodeDiagramCode(encoded));
        } catch {
          // Fall through to the source <pre> below.
        }
      }
      return normalizeBlockText(element.querySelector('pre code')?.textContent || '');
    }
    return normalizeBlockText(element.querySelector('code')?.textContent || '');
  }

  if (type === 'table') {
    const table = element.querySelector('table');
    if (table) return normalizeBlockText(table.textContent || '');
  }

  return normalizeBlockText(element.textContent || '');
}

/**
 * Post-render pass: assigns a stable content-hash identifier to every
 * top-level block and records the heading path in effect at that point.
 */
export function assignBlockAnchors(root: HTMLElement): RenderedBlock[] {
  const blocks: RenderedBlock[] = [];
  const headingStack: { level: number; text: string }[] = [];
  const occurrences = new Map<string, number>();

  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement) || !isAnnotatableBlock(child)) continue;

    const type = blockTypeOf(child);
    const text = blockContentText(child, type);
    const level = headingLevel(type);

    // A heading's own text is the block; its path is the ancestors above it.
    if (level > 0) {
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
    }

    const headingPath = headingStack.map((heading) => heading.text);
    const occurrenceKey = `${type}\u0001${text}`;
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);

    const blockId = `blk-${hashBlockContent(`${occurrenceKey}\u0001${occurrence}`)}`;
    child.setAttribute('data-block-id', blockId);
    child.classList.add('annotation-block');

    blocks.push({
      element: child,
      model: { id: blockId, type, text, headingPath },
    });

    if (level > 0) {
      headingStack.push({ level, text });
    }
  }

  return blocks;
}

/** Adds the hover marker button to each block (idempotent per render). */
export function ensureBlockMarkers(blocks: RenderedBlock[]): void {
  for (const block of blocks) {
    if (block.element.querySelector('.annotation-marker')) continue;

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'annotation-marker';
    const label = block.model.text
      ? `Annotate this block: ${block.model.text.slice(0, 60)}`
      : 'Annotate this block';
    marker.setAttribute('aria-label', label);
    marker.title = label;
    // Keep the online affordance so Offline Mode can toggle the title and
    // restore it when the connection returns.
    marker.dataset.defaultTitle = label;
    marker.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    block.element.appendChild(marker);
  }
}

export function blockAnchorFrom(block: RenderedBlock): AnnotationAnchor {
  const model = block.model;
  const segment: BlockAnchorSegment = {
    kind: 'block',
    blockHash: model.id,
    blockText: model.text,
    blockType: model.type,
    headingPath: model.headingPath,
  };
  return { version: 1, segments: [segment] };
}

export interface AnnotationHighlightResult {
  /** Block id -> annotations attached to it (resolved anchors only). */
  attachments: Map<string, Annotation[]>;
  /** Annotation id -> originally anchored text, for every Outdated anchor. */
  outdated: Map<number, string>;
}

/**
 * Re-attaches stored annotations to rendered blocks by running the pure
 * Anchor resolver over the block model. Idempotent: safe to call after every
 * render, annotation change, and search change.
 *
 * Outdated annotations are never highlighted; they are reported here so the
 * column can badge them and their popover can show the original text.
 */
export function applyAnnotationHighlights(
  root: HTMLElement,
  annotations: Annotation[],
  blocks: RenderedBlock[]
): AnnotationHighlightResult {
  for (const block of blocks) {
    block.element.classList.remove('annotation-highlighted', 'annotation-resolved');
    block.element.removeAttribute('data-annotation-id');
    block.element.removeAttribute('data-annotation-ids');
    const marker = block.element.querySelector<HTMLElement>('.annotation-marker');
    marker?.classList.remove('has-annotation', 'resolved');
  }
  clearRangeHighlights(root);

  const elementsById = new Map(blocks.map((block) => [block.model.id, block.element]));
  const models = blocks.map((block) => block.model);
  const attachments = new Map<string, Annotation[]>();
  const outdated = new Map<number, string>();
  const blockIds = new Map<string, number[]>();
  const blockResolved = new Map<string, boolean>();

  const attach = (blockId: string, annotation: Annotation) => {
    const current = attachments.get(blockId) ?? [];
    if (!current.some((candidate) => candidate.id === annotation.id)) {
      current.push(annotation);
      attachments.set(blockId, current);
    }
  };

  for (const annotation of annotations) {
    const resolution = resolveAnchor(models, annotation.anchor);
    if (resolution.status !== 'resolved') {
      const snapshot = annotation.snapshot?.trim() || resolution.snapshot;
      outdated.set(annotation.id, snapshot);
      continue;
    }

    for (const segment of resolution.segments) {
      const element = elementsById.get(segment.blockId);
      if (!element) continue;

      attach(segment.blockId, annotation);

      if (segment.kind === 'block') {
        element.classList.add('annotation-highlighted');
        const ids = blockIds.get(segment.blockId) ?? [];
        ids.push(annotation.id);
        blockIds.set(segment.blockId, ids);
        blockResolved.set(
          segment.blockId,
          (blockResolved.get(segment.blockId) ?? true) && annotation.resolved
        );
        continue;
      }

      const content = getBlockContentElement(element, modelType(models, segment.blockId));
      highlightTextRange(content, segment.start, segment.end, {
        annotationId: annotation.id,
        resolved: annotation.resolved,
      });
    }
  }

  for (const [blockId, element] of elementsById) {
    const ids = blockIds.get(blockId);
    if (ids && ids.length > 0) {
      element.setAttribute('data-annotation-id', String(ids[0]));
      element.setAttribute('data-annotation-ids', ids.join(','));
      if (blockResolved.get(blockId)) element.classList.add('annotation-resolved');
    }

    const annotation = attachments.get(blockId)?.[0];
    if (annotation) {
      const marker = element.querySelector<HTMLElement>('.annotation-marker');
      marker?.classList.add('has-annotation');
      if (annotation.resolved) marker?.classList.add('resolved');
    }
  }

  return { attachments, outdated };
}

function modelType(models: BlockModel[], blockId: string): string {
  return models.find((model) => model.id === blockId)?.type ?? 'p';
}

export interface AppliedHighlights {
  searchMatches: HTMLElement[];
  attachments: Map<string, Annotation[]>;
  outdated: Map<number, string>;
}

/**
 * The one ordering that keeps both highlight layers findable:
 * remove annotation marks, run search over the unwrapped text, then apply
 * annotation segments. Search skips annotation marks, so reversing this
 * order would make annotated passages invisible to search.
 */
export function applySearchAndAnnotationHighlights(
  root: HTMLElement,
  query: string,
  annotations: Annotation[],
  blocks: RenderedBlock[]
): AppliedHighlights {
  clearRangeHighlights(root);
  const searchMatches = highlightSearchMatches(root, query);
  const applied = applyAnnotationHighlights(root, annotations, blocks);
  return { searchMatches, ...applied };
}
