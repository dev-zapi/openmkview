/**
 * Shared text-range highlighting for Preview annotations. It maps character
 * offsets in a block's whitespace-normalized text back to DOM text nodes,
 * generalizing the TreeWalker approach used by search highlighting.
 */

export const ANNOTATION_HIGHLIGHT_ATTR = 'data-annotation-highlight';
const ANNOTATION_MARK_SELECTOR = `mark[${ANNOTATION_HIGHLIGHT_ATTR}]`;

export interface TextPosition {
  node: Text;
  /** Offset from the start of the block content root. */
  start: number;
  end: number;
  /** Offset inside the text node, used when wrapping DOM ranges. */
  localStart: number;
  localEnd: number;
}

export interface BlockTextIndex {
  /** Whitespace-collapsed, trimmed text of the block. */
  text: string;
  /** One entry per normalized character, in reading order. */
  positions: TextPosition[];
}

export interface RangeHighlightOptions {
  annotationId: number | string;
  resolved?: boolean;
  className?: string;
}

const CHROME_SELECTOR = [
  '.annotation-marker',
  '.code-block-header',
  '.copy-button',
  '.diagram-toggle-btn',
  '.diagram-zoom-btn',
].join(',');

function isChromeText(node: Text): boolean {
  return Boolean(node.parentElement?.closest(CHROME_SELECTOR));
}

/** Text nodes belonging to rendered content, excluding injected UI chrome. */
export function collectTextNodes(
  root: HTMLElement,
  shouldSkip: (node: Text) => boolean = isChromeText
): Text[] {
  const walker = (root.ownerDocument || document).createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );
  const nodes: Text[] = [];
  let node = walker.nextNode() as Text | null;

  while (node) {
    if (!shouldSkip(node) && node.nodeValue) nodes.push(node);
    node = walker.nextNode() as Text | null;
  }

  return nodes;
}

/** Resolves a code block / table wrapper to the element holding its text. */
export function getBlockContentElement(
  element: HTMLElement,
  type: string
): HTMLElement {
  if (type === 'code') {
    return element.querySelector<HTMLElement>('pre code') ?? element;
  }
  if (type === 'table') {
    return element.querySelector<HTMLElement>('table') ?? element;
  }
  return element;
}

/**
 * Builds offsets in normalized text while retaining each normalized
 * character's raw position, so highlights can be split back into DOM text
 * nodes without guessing.
 */
export function buildBlockTextIndex(root: HTMLElement): BlockTextIndex {
  const ownerDocument = root.ownerDocument || document;
  const walker = ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let text = '';
  const positions: TextPosition[] = [];
  let rawOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const value = node.nodeValue || '';
    if (!isChromeText(node)) {
      for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (/\s/.test(character)) {
          if (text.length > 0 && !text.endsWith(' ')) {
            positions.push({
              node,
              start: rawOffset,
              end: rawOffset + 1,
              localStart: index,
              localEnd: index + 1,
            });
            text += ' ';
          }
        } else {
          positions.push({
            node,
            start: rawOffset,
            end: rawOffset + 1,
            localStart: index,
            localEnd: index + 1,
          });
          text += character;
        }
        rawOffset += 1;
      }
    } else {
      rawOffset += value.length;
    }

    node = walker.nextNode() as Text | null;
  }

  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    positions.pop();
  }

  return { text, positions };
}

function absoluteOffsetForBoundary(
  root: HTMLElement,
  container: Node,
  offset: number
): number {
  const ownerDocument = root.ownerDocument || document;
  try {
    const range = ownerDocument.createRange();
    range.setStart(root, 0);
    range.setEnd(container, offset);
    return range.toString().length;
  } catch {
    return 0;
  }
}

/** Maps a DOM selection boundary to an offset in the normalized block text. */
export function normalizedOffsetForBoundary(
  index: BlockTextIndex,
  root: HTMLElement,
  container: Node,
  offset: number
): number {
  const absolute = absoluteOffsetForBoundary(root, container, offset);

  let low = 0;
  let high = index.positions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (index.positions[middle].start < absolute) low = middle + 1;
    else high = middle;
  }

  return low;
}

function createAnnotationMark(options: RangeHighlightOptions): HTMLElement {
  const ownerDocument = document;
  const mark = ownerDocument.createElement('mark');
  mark.setAttribute(ANNOTATION_HIGHLIGHT_ATTR, 'true');
  mark.setAttribute('data-annotation-id', String(options.annotationId));
  mark.className = ['annotation-text-highlight', options.className ?? '']
    .filter(Boolean)
    .join(' ');
  if (options.resolved) mark.classList.add('annotation-resolved');
  return mark;
}

function wrapInterval(
  node: Text,
  start: number,
  end: number,
  options: RangeHighlightOptions
): HTMLElement | null {
  const value = node.nodeValue || '';
  if (start >= end || start >= value.length) return null;

  let target = node;
  if (end < target.nodeValue!.length) {
    target.splitText(end);
  }
  if (start > 0) {
    target = target.splitText(start);
  }
  if (!target.nodeValue) return null;

  const mark = createAnnotationMark(options);
  target.parentNode?.insertBefore(mark, target);
  mark.appendChild(target);
  return mark;
}

/**
 * Wraps the normalized-character range in annotation marks. A range spanning
 * inline nodes yields one mark per text node, all carrying the same
 * Annotation identity.
 */
export function highlightTextRange(
  root: HTMLElement,
  start: number,
  end: number,
  options: RangeHighlightOptions
): HTMLElement[] {
  const index = buildBlockTextIndex(root);
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(end, index.text.length);
  if (clampedStart >= clampedEnd) return [];

  const intervals = new Map<Text, { start: number; end: number }>();
  for (let position = clampedStart; position < clampedEnd; position += 1) {
    const entry = index.positions[position];
    if (!entry) continue;
    const current = intervals.get(entry.node);
    if (current) current.end = entry.localEnd;
    else intervals.set(entry.node, { start: entry.localStart, end: entry.localEnd });
  }

  const marks: HTMLElement[] = [];
  intervals.forEach((interval, node) => {
    const mark = wrapInterval(node, interval.start, interval.end, options);
    if (mark) marks.push(mark);
  });

  return marks;
}

/** Removes annotation marks without disturbing search highlights. */
export function clearRangeHighlights(root: HTMLElement): void {
  const marks = Array.from(
    root.querySelectorAll<HTMLElement>(ANNOTATION_MARK_SELECTOR)
  );

  for (const mark of marks) {
    if (mark.parentElement?.closest(ANNOTATION_MARK_SELECTOR)) continue;
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(
      (root.ownerDocument || document).createTextNode(mark.textContent || ''),
      mark
    );
    parent.normalize();
  }
}
