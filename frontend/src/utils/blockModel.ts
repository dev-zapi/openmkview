/**
 * The serializable block model shared by the render pass and the pure Anchor
 * resolver. It deliberately contains no DOM references: DOM walking happens
 * at the edges (annotationBlocks / rangeHighlight), so anchor resolution can
 * be unit-tested from plain data.
 */
export interface BlockModel {
  /** Stable content-hash identifier assigned by the render pass. */
  id: string;
  /** Rendered block type, e.g. `p`, `h2`, `code`, `table`. */
  type: string;
  /** Whitespace-normalized text content. */
  text: string;
  /** Heading text ancestors in effect at the block's position. */
  headingPath: string[];
}

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
