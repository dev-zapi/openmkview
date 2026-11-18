import type { Annotation } from '../types';
import { anchorExcerpt } from './anchorScoring';
import { locateAnchorInSource } from './sourceAnchorLocator';

/**
 * Edit Mode's read-only Annotation echo.
 *
 * Anchors are resolved against the raw Markdown by the shared Source locator,
 * then mapped from 1-based source line ranges to zero-based character offsets
 * in the same text. CodeMirror positions in a freshly loaded document are
 * exactly those offsets, so this mapping is pure and testable without a view.
 *
 * Best-effort, like the Preview and Source echoes: an unlocatable Anchor is
 * Outdated and contributes no decoration. Canonical Outdated status (owned by
 * the rendered Preview) wins, so Edit never decorates an Outdated Anchor the
 * coarser raw projection happened to find.
 */

export interface EditorAnnotationLine {
  /** Zero-based offset of the line's first character in the raw Markdown. */
  from: number;
  /** Zero-based offset just past the line's last character (excludes `\n`). */
  to: number;
  /** True when every Annotation on this line is Resolved. */
  resolved: boolean;
  /** Anchored excerpts, joined for the read-only accessible label. */
  excerpt: string;
}

interface LineBounds {
  from: number;
  to: number;
}

/** Zero-based offsets of every source line, excluding the line separator. */
function lineBounds(markdown: string): LineBounds[] {
  const bounds: LineBounds[] = [];
  let from = 0;

  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === '\n') {
      const to = index > from && markdown[index - 1] === '\r' ? index - 1 : index;
      bounds.push({ from, to });
      from = index + 1;
    }
  }

  bounds.push({ from, to: markdown.length });
  return bounds;
}

/**
 * Translate inclusive 1-based source line ranges into the character offsets
 * CodeMirror uses, one entry per covered source line.
 */
function offsetsForRanges(
  markdown: string,
  ranges: { start: number; end: number }[]
): LineBounds[] {
  const bounds = lineBounds(markdown);
  const offsets: LineBounds[] = [];

  for (const range of ranges) {
    for (let line = range.start; line <= range.end; line += 1) {
      const lineBoundsAt = bounds[line - 1];
      if (lineBoundsAt) offsets.push(lineBoundsAt);
    }
  }

  return offsets;
}

interface LineAccumulator {
  from: number;
  to: number;
  resolved: boolean;
  excerpts: string[];
}

/**
 * Resolve every Annotation whose Anchor still exists to the source lines an
 * Edit Mode echo must decorate. Outdated annotations (`outdatedIds`) and
 * unlocatable Anchors contribute nothing.
 */
export function resolveEditorAnnotationLines(
  markdown: string,
  annotations: Annotation[],
  outdatedIds: ReadonlySet<number>
): EditorAnnotationLine[] {
  const byLine = new Map<number, LineAccumulator>();

  for (const annotation of annotations) {
    if (outdatedIds.has(annotation.id)) continue;

    const location = locateAnchorInSource(markdown, annotation.anchor);
    if (location.status !== 'located') continue;

    const excerpt = anchorExcerpt(annotation.anchor);
    for (const offset of offsetsForRanges(markdown, location.ranges)) {
      const existing = byLine.get(offset.from);
      if (existing) {
        existing.resolved = existing.resolved && annotation.resolved;
        if (excerpt) existing.excerpts.push(excerpt);
        existing.to = Math.max(existing.to, offset.to);
        continue;
      }
      byLine.set(offset.from, {
        from: offset.from,
        to: offset.to,
        resolved: annotation.resolved,
        excerpts: excerpt ? [excerpt] : [],
      });
    }
  }

  return [...byLine.values()]
    .sort((left, right) => left.from - right.from)
    .map((line) => ({
      from: line.from,
      to: line.to,
      resolved: line.resolved,
      excerpt: line.excerpts.join(' … '),
    }));
}
