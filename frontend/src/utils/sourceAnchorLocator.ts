import type { AnnotationAnchor, AnchorSegment } from '../types';
import { normalizeBlockText } from './blockModel';
import {
  blockMatchScore,
  contextScore,
  findQuoteOccurrences,
  isObject,
  outdatedFromAnchor,
  segmentAnchorText,
  segmentStringField,
  selectBestOccurrence,
  type OutdatedResult,
  type ScoredOccurrence,
  type ScorableBlock,
} from './anchorScoring';

/**
 * Source-view echo of Anchors: raw Markdown in, source line ranges out.
 *
 * Best-effort by design (ADR-0005). The raw document is projected into a
 * block-aware searchable text:
 * - blocks mirror the rendered top-level block model as closely as a
 *   lightweight parser can (headings incl. setext, paragraphs, lists,
 *   blockquotes, fenced/indented code, tables);
 * - blocks are joined with a boundary sentinel, so a quote can never match
 *   across a block boundary;
 * - sentence markers/decoration are stripped while block structure is kept.
 *
 * Known approximations (safe: they can only degrade to Outdated/outdated,
 * never echo a wrong line): lazy blockquote/list continuation, deeply nested
 * lists, HTML blocks, emphasis runs that are ambiguous with literal markers,
 * and characters after the first adjacent inline-code span on a line.
 *
 * Scoring is shared with the Preview resolver via `anchorScoring` so both
 * views agree wherever both can decide; when they cannot, the anchor is
 * Outdated rather than guessed.
 */

/** Inclusive, 1-based line range in the raw Markdown source. */
export interface SourceLineRange {
  start: number;
  end: number;
}

export type SourceAnchorLocation =
  | { status: 'located'; ranges: SourceLineRange[] }
  | OutdatedResult;

interface SourceBlock extends ScorableBlock {
  /** Per-character source line for `text`. */
  lineOf: number[];
  startLine: number;
  endLine: number;
}

interface SourceProjection {
  /** Blocks joined by `BOUNDARY`; sentinel characters never match quotes. */
  text: string;
  /** Per-character source line for `text` (sentinel included). */
  lineOf: number[];
  /** Per-character owning block index, or -1 for a boundary. */
  blockOf: number[];
  blocks: SourceBlock[];
  /** Half-open offsets of each block into `text`. */
  blockOffsets: { start: number; end: number }[];
}

const BOUNDARY = '\u0001';
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>~|]/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  deg: '°',
  times: '×',
  divide: '÷',
  plusmn: '±',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  iexcl: '¡',
  iquest: '¿',
  shy: '­',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (entity, body: string) => {
    if (body.startsWith('#')) {
      const hexadecimal = body[1] === 'x' || body[1] === 'X';
      const value = Number.parseInt(body.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (Number.isFinite(value) && value > 0 && value <= 0x10ffff) {
        try {
          return String.fromCodePoint(value);
        } catch {
          return entity;
        }
      }
      return entity;
    }
    return NAMED_ENTITIES[body] ?? entity;
  });
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

/**
 * Removes inline Markdown decoration so rendered quote text can be found in
 * the raw source. Inline-code spans keep their content verbatim; escaped
 * characters are unescaped. A marker run is stripped only when it reads as an
 * emphasis opener/closer, so literals such as `2 * 3` survive.
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

    if (!inInlineCode && (character === '*' || character === '_' || character === '~')) {
      let runEnd = index;
      while (line[runEnd + 1] === character) runEnd += 1;
      const runLength = runEnd - index + 1;

      if (character !== '~' || runLength >= 2) {
        const previous = line[index - 1] ?? ' ';
        const next = line[runEnd + 1] ?? ' ';
        const hangingLeft = index === 0 || isWhitespace(previous);
        const hangingRight = runEnd === line.length - 1 || isWhitespace(next);
        const opener = hangingLeft && !hangingRight;
        const closer = !hangingLeft && (hangingRight || /[.,;:!?)\]}]/.test(next));

        if (opener || closer) {
          index = runEnd;
          continue;
        }
      }

      result += line.slice(index, runEnd + 1);
      index = runEnd;
      continue;
    }

    result += character;
  }

  return result;
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

  return decodeEntities(stripInlineMarkers(text));
}

interface BlockBuilder {
  text: string[];
  lineOf: number[];
  pendingSpaceLine: number | null;
}

function createBuilder(): BlockBuilder {
  return { text: [], lineOf: [], pendingSpaceLine: null };
}

function pushCharacter(builder: BlockBuilder, character: string, line: number): void {
  if (isWhitespace(character)) {
    if (builder.text.length > 0 && builder.text[builder.text.length - 1] !== ' ') {
      builder.pendingSpaceLine = line;
    }
    return;
  }
  if (builder.pendingSpaceLine !== null) {
    builder.text.push(' ');
    builder.lineOf.push(builder.pendingSpaceLine);
    builder.pendingSpaceLine = null;
  }
  builder.text.push(character);
  builder.lineOf.push(line);
}

/** Appends a projected line, collapsing whitespace within the block. */
function pushLine(builder: BlockBuilder, projected: string, line: number): void {
  for (const character of projected) pushCharacter(builder, character, line);
  pushCharacter(builder, '\n', line);
}

function finishBlock(
  builder: BlockBuilder,
  type: string,
  startLine: number,
  endLine: number,
  headingPath: string[]
): SourceBlock {
  return {
    text: builder.text.join(''),
    lineOf: builder.lineOf,
    type,
    headingPath,
    startLine,
    endLine,
  };
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const ATX_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const SETEXT_RE = /^\s{0,3}(=+|-+)\s*$/;
const HR_RE = /^\s{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LIST_RE = /^(\s{0,3})([-+*]|\d{1,9}[.)])(\s+)(.*)$/;
const BLOCKQUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const INDENTED_CODE_RE = /^(\t| {4})/;
const TABLE_DELIMITER_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function isSetextUnderline(line: string): boolean {
  return SETEXT_RE.test(line);
}

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index];
  const next = lines[index + 1];
  return Boolean(line && next && line.includes('|') && TABLE_DELIMITER_RE.test(next));
}

function startsNewBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  if (!line || !line.trim()) return true;
  if (FENCE_RE.test(line)) return true;
  if (ATX_RE.test(line)) return true;
  if (LIST_RE.test(line)) return true;
  if (BLOCKQUOTE_RE.test(line)) return true;
  if (HR_RE.test(line)) return true;
  if (isTableStart(lines, index)) return true;
  return false;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/);
}

/** Parses the raw Markdown into the top-level block model the echo needs. */
function parseSourceBlocks(lines: string[]): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const headingStack: { level: number; text: string }[] = [];
  const currentPath = (): string[] => headingStack.map((heading) => heading.text);
  const updateHeading = (level: number, text: string): void => {
    while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
      headingStack.pop();
    }
    headingStack.push({ level, text });
  };

  let index = 0;

  // Frontmatter renders outside the Markdown block model.
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex((line, at) => at > 0 && (line.trim() === '---' || line.trim() === '...'));
    if (close !== -1) {
      blocks.push(finishBlock(createBuilder(), 'frontmatter', 1, close + 1, []));
      index = close + 1;
    }
  }

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const minimumLength = fence[1].length;
      const closePattern = new RegExp(`^\\s{0,3}${marker === '`' ? '`' : '~'}{${minimumLength},}\\s*$`);
      const builder = createBuilder();
      let cursor = index + 1;

      while (cursor < lines.length && !closePattern.test(lines[cursor])) {
        pushLine(builder, lines[cursor], cursor + 1);
        cursor += 1;
      }

      const closeLine = cursor < lines.length ? cursor : lines.length - 1;
      const hasContent = cursor > index + 1;
      // Whole-block echo covers the code content, not the fence markers.
      const startLine = hasContent ? index + 2 : index + 1;
      const endLine = hasContent ? cursor : closeLine + 1;
      blocks.push(finishBlock(builder, 'code', startLine, endLine, currentPath()));
      index = cursor < lines.length ? cursor + 1 : lines.length;
      continue;
    }

    const atx = ATX_RE.exec(line);
    if (atx) {
      const level = atx[1].length;
      const builder = createBuilder();
      pushLine(builder, projectMarkdownLine(atx[2]), index + 1);
      blocks.push(finishBlock(builder, `h${level}`, index + 1, index + 1, currentPath()));
      updateHeading(level, normalizeBlockText(builder.text.join('')));
      index += 1;
      continue;
    }

    if (INDENTED_CODE_RE.test(line)) {
      const builder = createBuilder();
      let cursor = index;

      while (cursor < lines.length) {
        if (!lines[cursor].trim()) {
          const nextLine = lines[cursor + 1];
          if (nextLine !== undefined && INDENTED_CODE_RE.test(nextLine)) {
            cursor += 1;
            continue;
          }
          break;
        }
        if (!INDENTED_CODE_RE.test(lines[cursor])) break;
        pushLine(builder, lines[cursor].replace(INDENTED_CODE_RE, ''), cursor + 1);
        cursor += 1;
      }

      blocks.push(finishBlock(builder, 'code', index + 1, cursor, currentPath()));
      index = cursor;
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const builder = createBuilder();
      let cursor = index;
      while (cursor < lines.length && BLOCKQUOTE_RE.test(lines[cursor])) {
        pushLine(builder, projectMarkdownLine(BLOCKQUOTE_RE.exec(lines[cursor])![1]), cursor + 1);
        cursor += 1;
      }
      blocks.push(finishBlock(builder, 'blockquote', index + 1, cursor, currentPath()));
      index = cursor;
      continue;
    }

    if (isTableStart(lines, index)) {
      const builder = createBuilder();
      let cursor = index;

      const addRow = (rowLine: string, lineNumber: number): void => {
        for (const cell of splitTableRow(rowLine)) {
          const projected = normalizeBlockText(projectMarkdownLine(cell));
          for (const character of projected) {
            builder.text.push(character);
            builder.lineOf.push(lineNumber);
          }
        }
      };

      addRow(lines[cursor], cursor + 1);
      cursor += 2; // header + delimiter
      while (cursor < lines.length && lines[cursor].trim() && lines[cursor].includes('|')) {
        addRow(lines[cursor], cursor + 1);
        cursor += 1;
      }

      blocks.push(finishBlock(builder, 'table', index + 1, cursor, currentPath()));
      index = cursor;
      continue;
    }

    const list = LIST_RE.exec(line);
    if (list) {
      const builder = createBuilder();
      const ordered = /^\d/.test(list[2]);
      let cursor = index;

      while (cursor < lines.length) {
        const itemLine = lines[cursor];
        if (!itemLine.trim()) break;

        const item = LIST_RE.exec(itemLine);
        if (item) {
          pushLine(builder, projectMarkdownLine(item[4]), cursor + 1);
          cursor += 1;
          continue;
        }

        if (startsNewBlock(lines, cursor)) break;
        pushLine(builder, projectMarkdownLine(itemLine), cursor + 1);
        cursor += 1;
      }

      blocks.push(finishBlock(builder, ordered ? 'ol' : 'ul', index + 1, cursor, currentPath()));
      index = cursor;
      continue;
    }

    if (HR_RE.test(line) || isSetextUnderline(line)) {
      // Standalone rules and orphan underlines render no annotatable text.
      index += 1;
      continue;
    }

    // Paragraph, possibly a multi-line setext heading.
    const builder = createBuilder();
    const startLine = index + 1;
    let cursor = index;
    let setextLevel: number | null = null;

    while (cursor < lines.length) {
      const paragraphLine = lines[cursor];
      if (!paragraphLine.trim()) break;

      if (cursor > index && isSetextUnderline(paragraphLine)) {
        setextLevel = paragraphLine.trim().startsWith('=') ? 1 : 2;
        cursor += 1;
        break;
      }

      if (cursor > index && startsNewBlock(lines, cursor)) break;

      pushLine(builder, projectMarkdownLine(paragraphLine), cursor + 1);
      cursor += 1;
    }

    if (setextLevel !== null) {
      const text = normalizeBlockText(builder.text.join(''));
      blocks.push(
        finishBlock(builder, `h${setextLevel}`, startLine, cursor, currentPath())
      );
      updateHeading(setextLevel, text);
    } else {
      blocks.push(finishBlock(builder, 'p', startLine, cursor, currentPath()));
    }

    index = cursor;
  }

  return blocks;
}

/** Builds the block-aware projection of the raw Markdown above a line map. */
function buildSourceProjection(markdown: string): SourceProjection {
  const blocks = parseSourceBlocks(markdown.split('\n'));
  const characters: string[] = [];
  const lineOf: number[] = [];
  const blockOf: number[] = [];
  const blockOffsets: { start: number; end: number }[] = [];

  blocks.forEach((block, blockIndex) => {
    if (characters.length > 0) {
      characters.push(BOUNDARY);
      lineOf.push(block.startLine);
      blockOf.push(-1);
    }

    const start = characters.length;
    for (let offset = 0; offset < block.text.length; offset += 1) {
      characters.push(block.text[offset]);
      lineOf.push(block.lineOf[offset]);
      blockOf.push(blockIndex);
    }
    blockOffsets.push({ start, end: characters.length });
  });

  return { text: characters.join(''), lineOf, blockOf, blocks, blockOffsets };
}

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
  const quote = normalizeBlockText(segmentStringField(segment, 'quote'));
  if (!quote) return null;

  const prefix = segmentStringField(segment, 'prefix');
  const suffix = segmentStringField(segment, 'suffix');
  const occurrences: ScoredOccurrence<number>[] = [];

  for (const start of findQuoteOccurrences(projection.text, quote)) {
    const end = start + quote.length; // exclusive
    const blockIndex = projection.blockOf[start];
    // A match must stay inside one block; sentinels already prevent `indexOf`
    // from crossing them, and this guards any future projection change.
    if (blockIndex < 0 || projection.blockOf[end - 1] !== blockIndex) continue;

    occurrences.push({
      candidate: blockIndex,
      start,
      end,
      score:
        blockMatchScore(projection.blocks[blockIndex], segment) +
        contextScore(projection.text, start, end, prefix, suffix),
    });
  }

  const best = selectBestOccurrence(
    occurrences,
    (occurrence) => `${rangeForOccurrence(projection, occurrence).start}:${rangeForOccurrence(projection, occurrence).end}`
  );

  return best ? rangeForOccurrence(projection, best) : null;
}

function locateBlockSegment(
  projection: SourceProjection,
  segment: AnchorSegment
): SourceLineRange | null {
  const blockText = normalizeBlockText(segmentStringField(segment, 'blockText'));
  if (!blockText) return null;

  // A whole-block Anchor must equal an entire block, never a substring.
  const occurrences: ScoredOccurrence<number>[] = [];
  projection.blocks.forEach((block, blockIndex) => {
    if (block.text !== blockText) return;
    occurrences.push({
      candidate: blockIndex,
      start: projection.blockOffsets[blockIndex].start,
      end: projection.blockOffsets[blockIndex].end,
      score: blockMatchScore(block, segment),
    });
  });

  const best = selectBestOccurrence(
    occurrences,
    (occurrence) => {
      const block = projection.blocks[occurrence.candidate];
      return `${block.startLine}:${block.endLine}`;
    }
  );
  if (!best) return null;

  const block = projection.blocks[best.candidate];
  return { start: block.startLine, end: block.endLine };
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
    if (!segmentAnchorText(segment) || !isObject(segment)) return outdatedFromAnchor(anchor);
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
