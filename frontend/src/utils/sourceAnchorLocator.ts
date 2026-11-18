import type { AnnotationAnchor, AnchorSegment } from '../types';
import {
  blockMatchScore,
  findQuoteMatches,
  isObject,
  occurrenceScore,
  outdatedFromAnchor,
  segmentAnchorText,
  segmentQuote,
  selectBestOccurrence,
  selectWholeBlock,
  type OutdatedResult,
  type ScoredOccurrence,
} from './anchorScoring';
import { buildSourceProjection, type SourceProjection } from './sourceMarkdownBlocks';

/**
 * Source-view echo of Anchors: raw Markdown in, source line ranges out.
 *
 * Best-effort by design (ADR-0005). The raw document is projected into a
 * block-aware searchable model (`sourceMarkdownBlocks`), blocks are separated
 * by a sentinel so matches never cross a block boundary, and whole-block
 * Anchors must equal an entire block. Scoring is shared with the Preview
 * resolver (`anchorScoring`), so both views agree wherever both can decide;
 * when they cannot, the anchor is Outdated rather than guessed.
 */

/** Inclusive, 1-based line range in the raw Markdown source. */
export interface SourceLineRange {
  start: number;
  end: number;
}

export type SourceAnchorLocation =
  | { status: 'located'; ranges: SourceLineRange[] }
  | OutdatedResult;

function rangeForOccurrence(
  projection: SourceProjection,
  occurrence: ScoredOccurrence<number>
): SourceLineRange {
  return {
    start: projection.lineOf[occurrence.start],
    end: projection.lineOf[occurrence.end - 1],
  };
}

function locateTextSegment(
  projection: SourceProjection,
  segment: AnchorSegment
): SourceLineRange | null {
  const quote = segmentQuote(segment);
  if (!quote) return null;

  const occurrences: ScoredOccurrence<number>[] = [];

  for (const match of findQuoteMatches(projection.text, quote)) {
    const blockIndex = projection.blockOf[match.start];
    // A match must stay inside one block; sentinels already prevent `indexOf`
    // from crossing them, and this guards any future projection change.
    if (blockIndex < 0 || projection.blockOf[match.end - 1] !== blockIndex) continue;

    occurrences.push({
      candidate: blockIndex,
      start: match.start,
      end: match.end,
      score: occurrenceScore(
        blockMatchScore(projection.blocks[blockIndex], segment),
        projection.text,
        match,
        segment,
        quote
      ),
    });
  }

  const best = selectBestOccurrence(
    occurrences,
    (occurrence) => {
      const range = rangeForOccurrence(projection, occurrence);
      return `${range.start}:${range.end}`;
    }
  );

  return best ? rangeForOccurrence(projection, best) : null;
}

function locateBlockSegment(
  projection: SourceProjection,
  segment: AnchorSegment
): SourceLineRange | null {
  // A whole-block Anchor must equal an entire block, never a substring.
  const block = selectWholeBlock(
    projection.blocks,
    (candidate) => candidate,
    segment,
    (candidate) => `${candidate.startLine}:${candidate.endLine}`
  );

  return block ? { start: block.startLine, end: block.endLine } : null;
}

function mergeRanges(ranges: SourceLineRange[]): SourceLineRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  const merged: SourceLineRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/**
 * Pure Source-view echo: locates each Anchor segment's quote text in the raw
 * Markdown and returns the covered source lines. Best-effort by design; an
 * unlocatable segment makes the whole Anchor Outdated rather than guessing a
 * wrong line (ADR-0005).
 */
export function locateAnchorInSource(
  rawMarkdown: string,
  anchor: AnnotationAnchor | null | undefined
): SourceAnchorLocation {
  if (!anchor || !Array.isArray(anchor.segments) || anchor.segments.length === 0) {
    return outdatedFromAnchor(anchor);
  }

  const projection = buildSourceProjection(rawMarkdown);
  const ranges: SourceLineRange[] = [];

  for (const segment of anchor.segments) {
    if (!isObject(segment) || !segmentAnchorText(segment)) {
      return outdatedFromAnchor(anchor);
    }
    const range =
      segment.kind === 'block'
        ? locateBlockSegment(projection, segment)
        : segment.kind === 'text'
          ? locateTextSegment(projection, segment)
          : null;
    if (!range) return outdatedFromAnchor(anchor);
    ranges.push(range);
  }

  return { status: 'located', ranges: mergeRanges(ranges) };
}
