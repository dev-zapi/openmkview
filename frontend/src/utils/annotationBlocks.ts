import type { Annotation, AnnotationAnchor, BlockAnchorSegment } from '../types';

/** A top-level rendered block with the content identity used by Anchors. */
export interface RenderedBlock {
  element: HTMLElement;
  blockId: string;
  blockType: string;
  text: string;
  headingPath: string[];
}

const ANNOTATABLE_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'blockquote', 'pre', 'table',
]);

export function normalizeBlockText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** FNV-1a hash, kept synchronous so the render pass stays synchronous. */
export function hashBlockContent(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function blockTypeOf(element: HTMLElement): string {
  if (element.tagName === 'DIV' && element.classList.contains('table-wrapper')) {
    return 'table';
  }
  if (element.tagName === 'DIV' && element.classList.contains('code-block-wrapper')) {
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
    const text = normalizeBlockText(child.textContent || '');
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

    blocks.push({ element: child, blockId, blockType: type, text, headingPath });

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
    marker.setAttribute('aria-label', 'Annotate this block');
    marker.title = 'Annotate this block';
    marker.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    block.element.appendChild(marker);
  }
}

export function blockAnchorFrom(block: RenderedBlock): AnnotationAnchor {
  const segment: BlockAnchorSegment = {
    kind: 'block',
    blockHash: block.blockId,
    blockText: block.text,
    blockType: block.blockType,
    headingPath: block.headingPath,
  };
  return { version: 1, segments: [segment] };
}

function findBlock(root: HTMLElement, blockHash: string): HTMLElement | null {
  const escaped = blockHash.replace(/["\\]/g, '\\$&');
  return root.querySelector<HTMLElement>(`[data-block-id="${escaped}"]`);
}

/**
 * Re-attaches stored annotations to rendered blocks by content-hash match.
 * Idempotent: safe to call after every render and every annotation change.
 */
export function applyAnnotationHighlights(
  root: HTMLElement,
  annotations: Annotation[]
): void {
  for (const block of Array.from(root.querySelectorAll<HTMLElement>('.annotation-block'))) {
    block.classList.remove('annotation-highlighted', 'annotation-resolved');
    block.removeAttribute('data-annotation-id');
    const marker = block.querySelector<HTMLElement>('.annotation-marker');
    marker?.classList.remove('has-annotation', 'resolved');
  }

  for (const annotation of annotations) {
    const segment = annotation.anchor?.segments?.find((part) => part.kind === 'block');
    if (!segment) continue;

    const block = findBlock(root, segment.blockHash);
    if (!block) continue;

    block.classList.add('annotation-highlighted');
    block.setAttribute('data-annotation-id', String(annotation.id));
    if (annotation.resolved) block.classList.add('annotation-resolved');

    const marker = block.querySelector<HTMLElement>('.annotation-marker');
    if (marker) {
      marker.classList.add('has-annotation');
      if (annotation.resolved) marker.classList.add('resolved');
    }
  }
}
