import type {
  AnnotationAnchor,
  AnchorSegment,
  BlockAnchorSegment,
  TextAnchorSegment,
} from '../types';
import { normalizeBlockText } from './blockModel';

/**
 * Shared Anchor matching vocabulary for the two resolution edges:
 * - the rendered Preview model (`anchorResolver`)
 * - the raw-Markdown Source echo (`sourceAnchorLocator`)
 *
 * ADR-0005 scoring lives here so both views agree wherever both can decide.
 * Constants, field parsing, quote occurrence search, context/block scoring,
 * and the best-occurrence tie-break are all pure.
 */

export const CONTEXT_WEIGHT = 12;
export const SAME_BLOCK_TEXT_WEIGHT = 400;
export const SAME_TYPE_WEIGHT = 30;
export const HEADING_PREFIX_WEIGHT = 60;
/**
 * Tiny tiebreaker: when the quote and a case-insensitive occurrence score
 * identically (same block, same context), an exact-case occurrence wins.
 * One point cannot outrank any real context/heading signal.
 */
export const EXACT_MATCH_BONUS = 1;

export interface OutdatedResult {
  status: 'outdated';
  /** Text as it was anchored, for the Outdated snapshot. */
  snapshot: string;
}

/** The structural fields both a rendered block and a source block expose. */
export interface ScorableBlock {
  text: string;
  type: string;
  headingPath: string[];
}

export interface ScoredOccurrence<T> {
  candidate: T;
  start: number;
  /** Exclusive end offset. */
  end: number;
  score: number;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isBlockSegment(segment: unknown): segment is BlockAnchorSegment {
  return (
    isObject(segment) &&
    segment.kind === 'block' &&
    typeof segment.blockHash === 'string' &&
    typeof segment.blockText === 'string' &&
    typeof segment.blockType === 'string' &&
    isStringArray(segment.headingPath)
  );
}

export function isTextSegment(segment: unknown): segment is TextAnchorSegment {
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

export function segmentStringField(segment: unknown, field: string): string {
  if (!isObject(segment)) return '';
  const value = segment[field];
  return typeof value === 'string' ? value : '';
}

export function segmentHeadingPath(segment: unknown): string[] {
  if (!isObject(segment)) return [];
  const value = segment.headingPath;
  return isStringArray(value) ? value : [];
}

/** The text an Anchor segment references: quote first, then block text. */
export function segmentAnchorText(segment: unknown): string | null {
  if (!isObject(segment)) return null;
  if (typeof segment.quote === 'string') return segment.quote;
  if (typeof segment.blockText === 'string') return segment.blockText;
  return null;
}

export function snapshotFromAnchor(anchor: AnnotationAnchor): string {
  return (anchor.segments ?? [])
    .map((segment) => segmentAnchorText(segment) ?? '')
    .filter((text) => text.length > 0)
    .join('\n\n');
}

export function outdatedFromAnchor(
  anchor: AnnotationAnchor | null | undefined
): OutdatedResult {
  return {
    status: 'outdated',
    snapshot: anchor && Array.isArray(anchor.segments) ? snapshotFromAnchor(anchor) : '',
  };
}

export function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

export function commonSuffixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[left.length - 1 - index] === right[right.length - 1 - index]) {
    index += 1;
  }
  return index;
}

export function headingPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/**
 * Boundary whitespace is meaningful here, so excerpts collapse without
 * trimming: the excerpt touching the quote must align with the text's spacing.
 */
export function contextScore(
  text: string,
  quoteStart: number,
  quoteEnd: number,
  prefix: string,
  suffix: string
): number {
  const normalizedPrefix = collapseWhitespace(prefix);
  const normalizedSuffix = collapseWhitespace(suffix);
  if (!normalizedPrefix.trim() && !normalizedSuffix.trim()) return 0;

  const actualPrefix = text.slice(0, quoteStart);
  const actualSuffix = text.slice(quoteEnd);
  return (
    (commonSuffixLength(actualPrefix, normalizedPrefix) +
      commonPrefixLength(actualSuffix, normalizedSuffix)) *
    CONTEXT_WEIGHT
  );
}

/**
 * Content signals only. The stored block hash is deliberately not scored:
 * after an identical block is inserted above, the old hash belongs to the new
 * block, so letting it dominate would silently resolve to the wrong content.
 * Context and heading path outrank it; when they cannot separate two
 * candidates the anchor is ambiguous and becomes Outdated.
 */
export function blockMatchScore(
  candidate: ScorableBlock,
  segment: AnchorSegment
): number {
  let score = 0;
  if (candidate.text === normalizeBlockText(segmentStringField(segment, 'blockText'))) {
    score += SAME_BLOCK_TEXT_WEIGHT;
  }
  if (candidate.type === segmentStringField(segment, 'blockType')) {
    score += SAME_TYPE_WEIGHT;
  }
  score += headingPrefixLength(candidate.headingPath, segmentHeadingPath(segment)) *
    HEADING_PREFIX_WEIGHT;
  return score;
}

/** +1 only when the occurrence's text matches the quote's case exactly. */
export function exactMatchScore(
  text: string,
  quoteStart: number,
  quoteEnd: number,
  quote: string
): number {
  return text.slice(quoteStart, quoteEnd) === quote ? EXACT_MATCH_BONUS : 0;
}

/**
 * Exact and case-drifted occurrences are scored together. Returning exact
 * matches alone would discard a case-only edit elsewhere that the stored
 * context clearly identifies (and vice versa). Equal indices are deduped.
 */
export function findQuoteOccurrences(text: string, quote: string): number[] {
  const needle = normalizeBlockText(quote);
  if (!needle) return [];

  const starts = new Set<number>();
  const collect = (haystack: string, target: string): void => {
    let index = haystack.indexOf(target);
    while (index !== -1) {
      starts.add(index);
      index = haystack.indexOf(target, index + 1);
    }
  };

  collect(text, needle);

  const lowerText = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  // Lowercasing must preserve lengths for indices to map back to `text`.
  if (lowerText.length === text.length && lowerNeedle.length === needle.length) {
    collect(lowerText, lowerNeedle);
  }

  return [...starts].sort((left, right) => left - right);
}

/**
 * Highest score wins. Equal best scores across different tie keys cannot be
 * told apart by content, context, or heading path: never guess (ADR-0005).
 * Within one tie key, document order decides.
 */
export function selectBestOccurrence<T>(
  occurrences: ScoredOccurrence<T>[],
  tieKey: (occurrence: ScoredOccurrence<T>) => string
): ScoredOccurrence<T> | null {
  if (occurrences.length === 0) return null;

  let bestScore = Number.NEGATIVE_INFINITY;
  let top: ScoredOccurrence<T>[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.score > bestScore) {
      bestScore = occurrence.score;
      top = [occurrence];
    } else if (occurrence.score === bestScore) {
      top.push(occurrence);
    }
  }

  const keys = new Set(top.map(tieKey));
  if (keys.size > 1) return null;

  top.sort((left, right) => left.start - right.start);
  return top[0];
}
