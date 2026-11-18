import type { AnnotationAnchor, TextAnchorSegment } from '../types';
import type { RenderedBlock } from './annotationBlocks';
import {
  buildBlockTextIndex,
  getBlockContentElement,
  normalizedOffsetForBoundary,
} from './rangeHighlight';

const CONTEXT_LENGTH = 48;

function blockIndexForNode(node: Node, blocks: RenderedBlock[]): number {
  return blocks.findIndex((block) => block.element.contains(node));
}

function trimmedRange(
  text: string,
  start: number,
  end: number
): { start: number; end: number } {
  let from = Math.max(0, Math.min(start, text.length));
  let to = Math.max(0, Math.min(end, text.length));
  while (from < to && text[from] === ' ') from += 1;
  while (to > from && text[to - 1] === ' ') to -= 1;
  return { start: from, end: to };
}

/**
 * Turns a live Preview selection into the versioned content-reference Anchor
 * payload. Cross-block selections become one text segment per covered block.
 */
export function anchorFromSelection(
  root: HTMLElement,
  selection: Selection | null,
  blocks: RenderedBlock[]
): AnnotationAnchor | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const firstBlock = blockIndexForNode(range.startContainer, blocks);
  const lastBlock = blockIndexForNode(range.endContainer, blocks);
  if (firstBlock === -1 || lastBlock === -1 || firstBlock > lastBlock) {
    return null;
  }

  const segments: TextAnchorSegment[] = [];

  for (let index = firstBlock; index <= lastBlock; index += 1) {
    const block = blocks[index];
    const content = getBlockContentElement(block.element, block.model.type);
    const textIndex = buildBlockTextIndex(content);
    if (textIndex.text.length === 0) continue;

    let start = 0;
    let end = textIndex.text.length;

    if (index === firstBlock) {
      start = normalizedOffsetForBoundary(
        textIndex,
        content,
        range.startContainer,
        range.startOffset
      );
    }
    if (index === lastBlock) {
      end = normalizedOffsetForBoundary(
        textIndex,
        content,
        range.endContainer,
        range.endOffset
      );
    }

    const trimmed = trimmedRange(textIndex.text, start, end);
    if (trimmed.start >= trimmed.end) continue;

    segments.push({
      kind: 'text',
      blockHash: block.model.id,
      blockText: block.model.text,
      blockType: block.model.type,
      headingPath: block.model.headingPath,
      quote: textIndex.text.slice(trimmed.start, trimmed.end),
      prefix: textIndex.text.slice(
        Math.max(0, trimmed.start - CONTEXT_LENGTH),
        trimmed.start
      ),
      suffix: textIndex.text.slice(
        trimmed.end,
        Math.min(textIndex.text.length, trimmed.end + CONTEXT_LENGTH)
      ),
    });
  }

  if (segments.length === 0) return null;
  return { version: 1, segments };
}
