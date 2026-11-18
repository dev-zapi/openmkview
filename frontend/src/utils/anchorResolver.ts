import type {
  AnnotationAnchor,
  AnchorSegment,
  BlockAnchorSegment,
  TextAnchorSegment,
} from '../types';
import { normalizeBlockText, type BlockModel } from './blockModel';

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
export interface OutdatedAnchor {
  status: 'outdated';
  /** Text as it was anchored, for the Outdated snapshot. */
  snapshot: string;
}

export type AnchorResolution = ResolvedAnchor | OutdatedAnchor;

const CONTEXT_WEIGHT = 12;
const SAME_HASH_WEIGHT = 1000;
const SAME_BLOCK_TEXT_WEIGHT = 400;
const SAME_TYPE_WEIGHT = 30;
const HEADING_PREFIX_WEIGHT = 20;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBlockSegment(segment: unknown): segment is BlockAnchorSegment {
  return (
    isObject(segment) &&
    segment.kind === 'block' &&
    typeof segment.blockHash === 'string' &&
    typeof segment.blockText === 'string' &&
    typeof segment.blockType === 'string' &&
    isStringArray(segment.headingPath)
  );
}

function isTextSegment(segment: unknown): segment is TextAnchorSegment {
  return (
    isObject(segment) &&
    segment.kind === 'text' &&
    typeof segment.blockHash === 'string' &&
    typeof segment.blockText === 'string' &&
    typeof segment.blockType === 'string' &&
    isStringArray(segment.headingPath) &&
    typeof segment.quote === 'string' &&
    typeof segment.prefix === 'string' &&
    typeof segment.suffix === 'string'
  );
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function commonSuffixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (
    index < limit &&
    a[a.length - 1 - index] === b[b.length - 1 - index]
  ) {
    index += 1;
  }
  return index;
}

function headingPrefixLength(a: string[], b: string[]): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function contextScore(
  text: string,
  quoteStart: number,
  quoteEnd: number,
  prefix: string,
  suffix: string
): number {
  const actualPrefix = text.slice(0, quoteStart);
  const actualSuffix = text.slice(quoteEnd);
  const prefixMatch = commonSuffixLength(actualPrefix, prefix);
  const suffixMatch = commonPrefixLength(actualSuffix, suffix);
  return (prefixMatch + suffixMatch) * CONTEXT_WEIGHT;
}

function blockScore(
  candidate: BlockModel,
  segment: BlockAnchorSegment | TextAnchorSegment
): number {
  let score = 0;
  if (candidate.id === segment.blockHash) score += SAME_HASH_WEIGHT;
  if (candidate.text === normalizeBlockText(segment.blockText)) {
    score += SAME_BLOCK_TEXT_WEIGHT;
  }
  if (candidate.type === segment.blockType) score += SAME_TYPE_WEIGHT;
  score +=
    headingPrefixLength(candidate.headingPath, segment.headingPath) *
    HEADING_PREFIX_WEIGHT;
  return score;
}

interface QuoteOccurrence {
  block: BlockModel;
  start: number;
  end: number;
  score: number;
}

function quoteOccurrences(candidate: BlockModel, quote: string): number[] {
  if (!quote) return [];
  const starts: number[] = [];
  let index = candidate.text.indexOf(quote);
  while (index !== -1) {
    starts.push(index);
    index = candidate.text.indexOf(quote, index + 1);
  }

  if (starts.length > 0) return starts;

  // A case-only edit is still the same quoted passage.
  const lowerText = candidate.text.toLocaleLowerCase();
  const lowerQuote = quote.toLocaleLowerCase();
  index = lowerText.indexOf(lowerQuote);
  while (index !== -1) {
    starts.push(index);
    index = lowerText.indexOf(lowerQuote, index + 1);
  }
  return starts;
}

function bestOccurrence(
  blocks: BlockModel[],
  segment: TextAnchorSegment
): QuoteOccurrence | null {
  const quote = normalizeBlockText(segment.quote);
  if (!quote) return null;

  let best: QuoteOccurrence | null = null;

  for (const candidate of blocks) {
    const baseScore = blockScore(candidate, segment);
    for (const start of quoteOccurrences(candidate, quote)) {
      const end = start + quote.length;
      const score =
        baseScore +
        contextScore(candidate.text, start, end, segment.prefix, segment.suffix);
      if (
        !best ||
        score > best.score ||
        (score === best.score && start < best.start)
      ) {
        best = { block: candidate, start, end, score };
      }
    }
  }

  return best;
}

function resolveBlockSegment(
  blocks: BlockModel[],
  segment: BlockAnchorSegment
): ResolvedBlockSegment | null {
  const normalizedText = normalizeBlockText(segment.blockText);
  let best: { block: BlockModel; score: number } | null = null;

  for (const candidate of blocks) {
    if (candidate.id !== segment.blockHash && candidate.text !== normalizedText) {
      continue;
    }
    const score = blockScore(candidate, segment);
    if (!best || score > best.score) {
      best = { block: candidate, score };
    }
  }

  return best ? { kind: 'block', blockId: best.block.id } : null;
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

function snapshotFromAnchor(anchor: AnnotationAnchor): string {
  return (anchor.segments ?? [])
    .map((segment) => {
      if (!isObject(segment)) return '';
      if (typeof segment.quote === 'string') return segment.quote;
      if (typeof segment.blockText === 'string') return segment.blockText;
      return '';
    })
    .filter((text) => text.length > 0)
    .join('\n\n');
}

function outdated(anchor: AnnotationAnchor | null | undefined): OutdatedAnchor {
  return {
    status: 'outdated',
    snapshot: anchor && Array.isArray(anchor.segments) ? snapshotFromAnchor(anchor) : '',
  };
}

/**
 * Pure Anchor resolution: content references in, resolved block-relative
 * character ranges or Outdated out. No DOM, no storage, no scoring exposed.
 */
export function resolveAnchor(
  blocks: BlockModel[],
  anchor: AnnotationAnchor | null | undefined
): AnchorResolution {
  if (!anchor || !Array.isArray(anchor.segments) || anchor.segments.length === 0) {
    return outdated(anchor);
  }

  const resolved: ResolvedSegment[] = [];

  for (const segment of anchor.segments as AnchorSegment[]) {
    if (isBlockSegment(segment)) {
      const result = resolveBlockSegment(blocks, segment);
      if (!result) return outdated(anchor);
      resolved.push(result);
      continue;
    }

    if (isTextSegment(segment)) {
      const result = resolveTextSegment(blocks, segment);
      if (!result) return outdated(anchor);
      resolved.push(result);
      continue;
    }

    return outdated(anchor);
  }

  return { status: 'resolved', segments: resolved };
}
