import type { AnnotationAnchor, AnchorSegment } from '../types';
import { normalizeBlockText } from './blockModel';

/** Inclusive, 1-based line range in the raw Markdown source. */
export interface SourceLineRange {
  start: number;
  end: number;
}

export type SourceAnchorLocation =
  | { status: 'located'; ranges: SourceLineRange[] }
  | { status: 'outdated'; snapshot: string };

interface SourceProjection {
  /** Whitespace-normalized raw Markdown text. */
  text: string;
  /** 1-based source line for every character in `text`. */
  lineOf: number[];
  /** Heading text ancestors active at each 1-based source line. */
  headingPaths: string[][];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function segmentText(segment: AnchorSegment): string | null {
  if (!isObject(segment)) return null;
  if (typeof segment.quote === 'string') return segment.quote;
  if (typeof segment.blockText === 'string') return segment.blockText;
  return null;
}

function snapshotFromAnchor(anchor: AnnotationAnchor): string {
  return anchor.segments
    .map((segment) => segmentText(segment) ?? '')
    .filter((text) => text.length > 0)
    .join('\n\n');
}

function outdated(anchor: AnnotationAnchor | null | undefined): SourceAnchorLocation {
  return {
    status: 'outdated',
    snapshot: anchor && Array.isArray(anchor.segments) ? snapshotFromAnchor(anchor) : '',
  };
}

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>~|]/;

/**
 * Removes inline Markdown decoration so rendered quote text can be found in
 * the raw source. Inline-code spans keep their content verbatim; emphasis
 * markers are dropped; escaped characters are unescaped.
 */
function stripInlineMarkers(line: string): string {
  let result = '';
  let inInlineCode = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '\\' && index + 1 < line.length && ESCAPABLE.test(line[index + 1])) {
      result += line[index + 1];
      index += 1;
      continue;
    }

    if (character === '`') {
      inInlineCode = !inInlineCode;
      continue;
    }

    if (!inInlineCode && (character === '*' || character === '_')) {
      const previous = line[index - 1] ?? ' ';
      const next = line[index + 1] ?? ' ';
      // Intra-word markers are literal; paired emphasis markers are dropped.
      if (/[A-Za-z0-9]/.test(previous) && /[A-Za-z0-9]/.test(next)) {
        result += character;
      }
      continue;
    }

    if (!inInlineCode && character === '~' && line[index + 1] === '~') {
      index += 1;
      continue;
    }

    result += character;
  }

  return result;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity);
}

/** Strips block-level markers and inline decoration from one Markdown line. */
function projectMarkdownLine(line: string): string {
  const trimmed = line.trim();

  // Setext underlines and horizontal rules render no annotatable text.
  if (/^=+$/.test(trimmed)) return '';
  if (/^([*_-])(\s*\1){2,}$/.test(trimmed)) return '';
  if (/^-+$/.test(trimmed)) return '';
  // Table delimiter rows hold no rendered text.
  if (trimmed.includes('-') && /^\|?[\s:|-]+\|?$/.test(trimmed)) return '';

  let text = line;
  text = text.replace(/^\s{0,3}#{1,6}\s+/, '');
  text = text.replace(/^(\s{0,3}>\s?)+/, '');
  text = text.replace(/^\s{0,3}([-+*]|\d{1,9}[.)])\s+/, '');
  text = text.replace(/^\[[ xX]\]\s+/, '');

  // Links and images contribute their visible label only.
  text = text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<((?:https?|mailto):[^>]+)>/g, '$1')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(stripInlineMarkers(text)).replace(/\|/g, '');
}

function frontmatterEnd(lines: string[]): number {
  if (lines.length === 0 || lines[0].trim() !== '---') return 0;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---' || lines[index].trim() === '...') return index;
  }
  return 0;
}

/** Builds a searchable projection of the raw Markdown above its line map. */
function buildSourceProjection(markdown: string): SourceProjection {
  const text: string[] = [];
  const lineOf: number[] = [];
  let pendingSpaceLine: number | null = null;

  const pushCharacter = (character: string, line: number): void => {
    if (/\s/.test(character)) {
      if (text.length > 0 && text[text.length - 1] !== ' ') pendingSpaceLine = line;
      return;
    }
    if (pendingSpaceLine !== null) {
      text.push(' ');
      lineOf.push(pendingSpaceLine);
      pendingSpaceLine = null;
    }
    text.push(character);
    lineOf.push(line);
  };

  const lines = markdown.split('\n');
  const frontmatterStop = frontmatterEnd(lines);
  const headingPaths: string[][] = [[]];
  const headingStack: { level: number; text: string }[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    headingPaths[lineNumber] = headingStack.map((heading) => heading.text);

    if (frontmatterStop > 0 && index <= frontmatterStop) {
      pushCharacter('\n', lineNumber);
      continue;
    }

    const fence = /^\s{0,3}(```+|~~~+)/.exec(line);
    if (fence) {
      inFence = !inFence;
      pushCharacter('\n', lineNumber);
      continue;
    }

    if (!inFence) {
      const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        while (
          headingStack.length > 0 &&
          headingStack[headingStack.length - 1].level >= level
        ) {
          headingStack.pop();
        }
        headingStack.push({
          level,
          text: normalizeBlockText(projectMarkdownLine(heading[2])),
        });
      }
    }

    const projected = inFence ? line : projectMarkdownLine(line);
    for (const character of projected) pushCharacter(character, lineNumber);
    pushCharacter('\n', lineNumber);
  }

  return { text: text.join(''), lineOf, headingPaths };
}

function findOccurrences(projection: SourceProjection, quote: string): number[] {
  const normalizedQuote = normalizeBlockText(quote);
  if (!normalizedQuote) return [];

  const exact = projection.text.indexOf(normalizedQuote);
  if (exact !== -1) {
    const starts: number[] = [];
    let index = exact;
    while (index !== -1) {
      starts.push(index);
      index = projection.text.indexOf(normalizedQuote, index + 1);
    }
    return starts;
  }

  const lowerText = projection.text.toLocaleLowerCase();
  const lowerQuote = normalizedQuote.toLocaleLowerCase();
  const starts: number[] = [];
  let index = lowerText.indexOf(lowerQuote);
  while (index !== -1) {
    starts.push(index);
    index = lowerText.indexOf(lowerQuote, index + 1);
  }
  return starts;
}

const CONTEXT_WEIGHT = 12;
const HEADING_PREFIX_WEIGHT = 60;

function commonPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  return index;
}

function commonSuffixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[left.length - 1 - index] === right[right.length - 1 - index]) {
    index += 1;
  }
  return index;
}

function segmentString(segment: unknown, field: string): string {
  if (!isObject(segment)) return '';
  const value = segment[field];
  return typeof value === 'string' ? value : '';
}

function segmentHeadingPath(segment: unknown): string[] {
  if (!isObject(segment)) return [];
  const value = segment.headingPath;
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function contextScore(
  projection: SourceProjection,
  start: number,
  end: number,
  prefix: string,
  suffix: string
): number {
  // Boundary whitespace is meaningful here, so collapse without trimming:
  // the excerpt touching the quote must align with the projection's spacing.
  const normalizedPrefix = collapseWhitespace(prefix);
  const normalizedSuffix = collapseWhitespace(suffix);
  if (!normalizedPrefix.trim() && !normalizedSuffix.trim()) return 0;

  const actualPrefix = projection.text.slice(0, start);
  const actualSuffix = projection.text.slice(end);
  return (
    (commonSuffixLength(actualPrefix, normalizedPrefix) +
      commonPrefixLength(actualSuffix, normalizedSuffix)) *
    CONTEXT_WEIGHT
  );
}

function headingScore(projection: SourceProjection, line: number, headingPath: string[]): number {
  if (headingPath.length === 0) return 0;
  return (
    commonPrefixLength(projection.headingPaths[line] ?? [], headingPath) *
    HEADING_PREFIX_WEIGHT
  );
}

interface QuoteCandidate {
  range: SourceLineRange;
  score: number;
}

function locateQuote(projection: SourceProjection, segment: unknown): SourceLineRange | null {
  const quote = segmentString(segment, 'quote');
  if (!quote && segmentString(segment, 'blockText')) {
    return locateBlockText(projection, segment);
  }

  const normalizedQuote = normalizeBlockText(quote);
  if (!normalizedQuote) return null;

  const prefix = segmentString(segment, 'prefix');
  const suffix = segmentString(segment, 'suffix');
  const headingPath = segmentHeadingPath(segment);

  let bestScore = Number.NEGATIVE_INFINITY;
  let top: QuoteCandidate[] = [];

  for (const start of findOccurrences(projection, normalizedQuote)) {
    const end = start + normalizedQuote.length - 1;
    const line = projection.lineOf[start];
    const candidate: QuoteCandidate = {
      range: { start: line, end: projection.lineOf[end] },
      score:
        contextScore(projection, start, end, prefix, suffix) +
        headingScore(projection, line, headingPath),
    };

    if (candidate.score > bestScore) {
      bestScore = candidate.score;
      top = [candidate];
    } else if (candidate.score === bestScore) {
      top.push(candidate);
    }
  }

  return decideCandidate(top);
}

function locateBlockText(projection: SourceProjection, segment: unknown): SourceLineRange | null {
  const blockText = normalizeBlockText(segmentString(segment, 'blockText'));
  if (!blockText) return null;

  const headingPath = segmentHeadingPath(segment);
  let bestScore = Number.NEGATIVE_INFINITY;
  let top: QuoteCandidate[] = [];

  for (const start of findOccurrences(projection, blockText)) {
    const end = start + blockText.length - 1;
    const line = projection.lineOf[start];
    const candidate: QuoteCandidate = {
      range: { start: line, end: projection.lineOf[end] },
      score: headingScore(projection, line, headingPath),
    };

    if (candidate.score > bestScore) {
      bestScore = candidate.score;
      top = [candidate];
    } else if (candidate.score === bestScore) {
      top.push(candidate);
    }
  }

  return decideCandidate(top);
}

/**
 * Equal best scores on different source lines cannot be told apart by
 * content, context, or heading path. Guessing would echo a wrong line, so the
 * Anchor degrades to Outdated instead (ADR-0005).
 */
function decideCandidate(candidates: QuoteCandidate[]): SourceLineRange | null {
  if (candidates.length === 0) return null;

  const distinct = new Set(candidates.map((candidate) => `${candidate.range.start}:${candidate.range.end}`));
  if (distinct.size > 1) return null;

  return { ...candidates[0].range };
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
    return outdated(anchor);
  }

  const projection = buildSourceProjection(rawMarkdown);
  const ranges: SourceLineRange[] = [];

  for (const segment of anchor.segments) {
    const quote = segmentText(segment);
    if (!quote) return outdated(anchor);
    const range = locateQuote(projection, segment);
    if (!range) return outdated(anchor);
    ranges.push(range);
  }

  return { status: 'located', ranges: mergeRanges(ranges) };
}
