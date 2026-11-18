import type {
  AnnotationAnchor,
  AnchorSegment,
  BlockAnchorSegment,
  TextAnchorSegment,
} from '../types';
import { normalizeBlockText, type BlockModel } from './blockModel';
import {
  blockMatchScore,
  contextScore,
  exactMatchScore,
  findQuoteOccurrences,
  isBlockSegment,
  isTextSegment,
  outdatedFromAnchor,
  selectBestOccurrence,
  type OutdatedResult,
  type ScoredOccurrence,
} from './anchorScoring';

export interface ResolvedBlockSegment {
  kind: 'block';
  blockId: string;
}

export interface ResolvedTextSegment {
  kind: 'text';
  blockId: string;
  /** Inclusive character offset in the block's normalized text. */
  start: number;
  /** Exclusive character offset in the block's normalized text. */
  end: number;
  quote: string;
}

export type ResolvedSegment = ResolvedBlockSegment | ResolvedTextSegment;

export interface ResolvedAnchor {
  status: 'resolved';
  segments: ResolvedSegment[];
}

/**
 * The resolver can express Outdated even though surfacing it (badge,
 * snapshot, manual re-anchoring) belongs to ticket #19.
 */
export type OutdatedAnchor = OutdatedResult;

export type AnchorResolution = ResolvedAnchor | OutdatedAnchor;

interface QuoteOccurrence {
  block: BlockModel;
  start: number;
  end: number;
  score: number;
}

function bestOccurrence(
  blocks: BlockModel[],
  segment: TextAnchorSegment
): QuoteOccurrence | null {
  const quote = normalizeBlockText(segment.quote);
  if (!quote) return null;

  const occurrences: ScoredOccurrence<BlockModel>[] = [];

  for (const candidate of blocks) {
    const baseScore = blockMatchScore(candidate, segment);
    for (const start of findQuoteOccurrences(candidate.text, quote)) {
      const end = start + quote.length;
      occurrences.push({
        candidate,
        start,
        end,
        score:
          baseScore +
          contextScore(candidate.text, start, end, segment.prefix, segment.suffix) +
          exactMatchScore(candidate.text, start, end, quote),
      });
    }
  }

  // Equal best scores in different blocks cannot be told apart by content,
  // context, or heading path: never guess (ADR-0005 / story 18).
  const best = selectBestOccurrence(occurrences, (occurrence) => occurrence.candidate.id);
  if (!best) return null;

  return {
    block: best.candidate,
    start: best.start,
    end: best.end,
    score: best.score,
  };
}

function resolveBlockSegment(
  blocks: BlockModel[],
  segment: BlockAnchorSegment
): ResolvedBlockSegment | null {
  const normalizedText = normalizeBlockText(segment.blockText);
  let bestScore = Number.NEGATIVE_INFINITY;
  let top: BlockModel[] = [];

  for (const candidate of blocks) {
    // A whole-block anchor resolves by its text reference. The hash alone is
    // not sufficient: it may now identify an identical inserted block.
    if (candidate.text !== normalizedText) continue;
    const score = blockMatchScore(candidate, segment);
    if (score > bestScore) {
      bestScore = score;
      top = [candidate];
    } else if (score === bestScore) {
      top.push(candidate);
    }
  }

  if (top.length === 0 || top.length > 1) return null;
  return { kind: 'block', blockId: top[0].id };
}

function resolveTextSegment(
  blocks: BlockModel[],
  segment: TextAnchorSegment
): ResolvedTextSegment | null {
  const occurrence = bestOccurrence(blocks, segment);
  if (!occurrence) return null;

  return {
    kind: 'text',
    blockId: occurrence.block.id,
    start: occurrence.start,
    end: occurrence.end,
    quote: occurrence.block.text.slice(occurrence.start, occurrence.end),
  };
}

/**
 * Pure Anchor resolution: content references in, resolved block-relative
 * character ranges or Outdated out. No DOM, no storage, no scoring exposed.
 *
 * Matching scope is deliberately whitespace/case-normalized verbatim quote
 * matching (plus context/heading-path tie-breaking). Whole-block and
 * word-level rewrites of the anchored text itself do not fuzzy-match; they
 * become Outdated, which manual re-anchoring rescues. Scoring is shared with
 * the Source-view echo (`anchorScoring`).
 */
export function resolveAnchor(
  blocks: BlockModel[],
  anchor: AnnotationAnchor | null | undefined
): AnchorResolution {
  if (!anchor || !Array.isArray(anchor.segments) || anchor.segments.length === 0) {
    return outdatedFromAnchor(anchor);
  }

  const resolved: ResolvedSegment[] = [];

  for (const segment of anchor.segments as AnchorSegment[]) {
    if (isBlockSegment(segment)) {
      const result = resolveBlockSegment(blocks, segment);
      if (!result) return outdatedFromAnchor(anchor);
      resolved.push(result);
      continue;
    }

    if (isTextSegment(segment)) {
      const result = resolveTextSegment(blocks, segment);
      if (!result) return outdatedFromAnchor(anchor);
      resolved.push(result);
      continue;
    }

    return outdatedFromAnchor(anchor);
  }

  return { status: 'resolved', segments: resolved };
}
