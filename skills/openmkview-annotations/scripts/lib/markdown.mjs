/* Pure Markdown block model and Anchor construction for the omk CLI.
 *
 * Mirrors the frontend rules in
 * frontend/src/utils/{blockModel,annotationBlocks,selectionAnchor,
 * sourceMarkdownBlocks}.ts — FNV-1a block hashes, whitespace-normalized block
 * text, heading paths, and 48-character quote context — so an Anchor built
 * here resolves as Active in the Preview resolver. No Node APIs, no state:
 * the frontend vitest suite imports these exports directly to keep the two
 * implementations honest.
 */

export const CONTEXT_LENGTH = 48;

/* ------------------------------------------------------------------------- *
 * Pure block model (mirrors frontend/src/utils/blockModel.ts)
 * ------------------------------------------------------------------------- */

export function normalizeBlockText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

/** FNV-1a over UTF-16 code units; 8 lowercase hex characters. */
export function hashBlockContent(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function blockHashFor(type, text, occurrence) {
  return `blk-${hashBlockContent(`${type}\u0001${text}\u0001${occurrence}`)}`;
}

/* ------------------------------------------------------------------------- *
 * Raw-Markdown projection (mirrors frontend/src/utils/sourceMarkdownBlocks.ts)
 *
 * The app's resolver runs against rendered HTML; this parser is the same
 * approximation the Source view already uses. Its known limitations can only
 * degrade an Anchor to Outdated — never make it match the wrong text.
 * ------------------------------------------------------------------------- */

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!>~|]/;

const NAMED_ENTITIES = {
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

function decodeEntities(text) {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g,
    (entity, body) => {
      if (body.startsWith('#')) {
        const hexadecimal = body[1] === 'x' || body[1] === 'X';
        const value = Number.parseInt(
          body.slice(hexadecimal ? 2 : 1),
          hexadecimal ? 16 : 10
        );
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
    }
  );
}

function isWhitespace(character) {
  return /\s/.test(character);
}

function stripInlineMarkers(line) {
  let result = '';
  let inInlineCode = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (
      character === '\\' &&
      index + 1 < line.length &&
      ESCAPABLE.test(line[index + 1])
    ) {
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

function projectMarkdownLine(line) {
  const trimmed = line.trim();

  if (/^=+$/.test(trimmed)) return '';
  if (/^([*_-])(\s*\1){2,}$/.test(trimmed)) return '';
  if (/^-+$/.test(trimmed)) return '';
  if (trimmed.includes('-') && /^\|?[\s:|-]+\|?$/.test(trimmed)) return '';

  let text = line;
  text = text.replace(/^\s{0,3}#{1,6}\s+/, '');
  text = text.replace(/^(\s{0,3}>\s?)+/, '');
  text = text.replace(/^\s{0,3}([-+*]|\d{1,9}[.)])\s+/, '');
  text = text.replace(/^\[[ xX]\]\s+/, '');

  // Images render as <img> with an empty textContent: their alt text must not
  // leak into the anchor. Links contribute their visible label.
  text = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/!\[([^\]]*)\]\[[^\]]*\]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/<((?:https?|mailto):[^>]+)>/g, '$1')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(stripInlineMarkers(text));
}

function createBuilder() {
  return { text: [], pendingSpace: false };
}

function pushCharacter(builder, character) {
  if (isWhitespace(character)) {
    if (builder.text.length > 0 && builder.text[builder.text.length - 1] !== ' ') {
      builder.pendingSpace = true;
    }
    return;
  }
  if (builder.pendingSpace) {
    builder.text.push(' ');
    builder.pendingSpace = false;
  }
  builder.text.push(character);
}

function pushLine(builder, projected) {
  for (const character of projected) pushCharacter(builder, character);
  pushCharacter(builder, '\n');
}

/**
 * Appends prose content with no inter-line separator.
 *
 * The renderer is marked with `breaks: true`: every soft line break becomes a
 * `<br>`, which contributes no text node, so `brown` + `fox` renders as
 * `brownfox`. Leading whitespace on the next raw line does survive as text
 * (collapsed to one space here), matching the renderer's `<br>  fox` output.
 */
function pushText(builder, projected) {
  // CommonMark consumes trailing whitespace at a prose line end (two spaces
  // are a hard break). The renderer's <br> carries none of it forward.
  const content = projected.replace(/\s+$/, '');
  for (const character of content) pushCharacter(builder, character);
}

function pushSeparator(builder) {
  pushCharacter(builder, ' ');
}

/** Removes up to `width` leading spaces (a list container indent). */
function stripIndent(line, width) {
  let index = 0;
  while (index < line.length && index < width && line[index] === ' ') {
    index += 1;
  }
  return line.slice(index);
}

function finishBlock(builder, type, headingPath) {
  return { text: builder.text.join(''), type, headingPath };
}

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const ATX_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
const SETEXT_RE = /^\s{0,3}(=+|-+)\s*$/;
const HR_RE = /^\s{0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LIST_RE = /^(\s{0,3})([-+*]|\d{1,9}[.)])(\s+)(.*)$/;
const BLOCKQUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const INDENTED_CODE_RE = /^(\t| {4})/;
const TABLE_DELIMITER_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function isSetextUnderline(line) {
  return SETEXT_RE.test(line);
}

function isTableStart(lines, index) {
  const line = lines[index];
  const next = lines[index + 1];
  return Boolean(line && next && line.includes('|') && TABLE_DELIMITER_RE.test(next));
}

function startsNewBlock(lines, index) {
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

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/);
}

function parseSourceBlocks(lines) {
  const blocks = [];
  const headingStack = [];
  const currentPath = () => headingStack.map((heading) => heading.text);
  const popHeadings = (level) => {
    while (
      headingStack.length > 0 &&
      headingStack[headingStack.length - 1].level >= level
    ) {
      headingStack.pop();
    }
  };
  const updateHeading = (level, text) => {
    popHeadings(level);
    headingStack.push({ level, text });
  };

  let index = 0;

  // Frontmatter renders outside the annotatable Markdown block model, so the
  // CLI skips it entirely (the web renderer has no anchorable block for it).
  if (lines[0]?.trim() === '---') {
    const close = lines.findIndex(
      (line, at) => at > 0 && (line.trim() === '---' || line.trim() === '...')
    );
    if (close !== -1) index = close + 1;
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
      const closePattern = new RegExp(
        `^\\s{0,3}${marker === '`' ? '`' : '~'}{${minimumLength},}\\s*$`
      );
      const builder = createBuilder();
      let cursor = index + 1;

      while (cursor < lines.length && !closePattern.test(lines[cursor])) {
        pushLine(builder, lines[cursor]);
        cursor += 1;
      }

      blocks.push(finishBlock(builder, 'code', currentPath()));
      index = cursor < lines.length ? cursor + 1 : lines.length;
      continue;
    }

    const atx = ATX_RE.exec(line);
    if (atx) {
      const level = atx[1].length;
      // A heading's path excludes itself and any previous heading at the same
      // or deeper level (assignBlockAnchors pops before recording the path).
      popHeadings(level);
      const builder = createBuilder();
      pushText(builder, projectMarkdownLine(atx[2]));
      blocks.push(finishBlock(builder, `h${level}`, currentPath()));
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
        pushLine(builder, lines[cursor].replace(INDENTED_CODE_RE, ''));
        cursor += 1;
      }

      blocks.push(finishBlock(builder, 'code', currentPath()));
      index = cursor;
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const builder = createBuilder();
      let cursor = index;
      while (cursor < lines.length && BLOCKQUOTE_RE.test(lines[cursor])) {
        const content = BLOCKQUOTE_RE.exec(lines[cursor])[1];
        if (content.trim()) {
          pushText(builder, projectMarkdownLine(content));
        } else {
          // A blank quoted line separates paragraphs inside the blockquote;
          // the renderer leaves a text-node newline between them.
          pushSeparator(builder);
        }
        cursor += 1;
      }
      blocks.push(finishBlock(builder, 'blockquote', currentPath()));
      index = cursor;
      continue;
    }

    if (isTableStart(lines, index)) {
      const builder = createBuilder();
      let cursor = index;

      const addRow = (rowLine) => {
        for (const cell of splitTableRow(rowLine)) {
          // Rendered cells are separated by text-node newlines, which
          // normalize to a single space.
          pushSeparator(builder);
          pushText(builder, normalizeBlockText(projectMarkdownLine(cell)));
        }
      };

      addRow(lines[cursor]);
      cursor += 2; // header + delimiter
      while (
        cursor < lines.length &&
        lines[cursor].trim() &&
        lines[cursor].includes('|')
      ) {
        addRow(lines[cursor]);
        cursor += 1;
      }

      blocks.push(finishBlock(builder, 'table', currentPath()));
      index = cursor;
      continue;
    }

    const list = LIST_RE.exec(line);
    if (list) {
      const builder = createBuilder();
      const ordered = /^\d/.test(list[2]);
      const contentIndent = list[1].length + list[2].length + list[3].length;
      let itemCount = 0;
      let cursor = index;

      while (cursor < lines.length) {
        const itemLine = lines[cursor];
        if (!itemLine.trim()) break;

        const item = LIST_RE.exec(itemLine);
        if (item) {
          // The renderer puts a newline between </li> and <li>, so items are
          // separated by one space; continuation lines inside an item are not.
          if (itemCount > 0) pushSeparator(builder);
          pushText(builder, projectMarkdownLine(item[4]));
          itemCount += 1;
          cursor += 1;
          continue;
        }

        if (startsNewBlock(lines, cursor)) break;
        // Container indentation belongs to the list, not the item text.
        pushText(
          builder,
          projectMarkdownLine(stripIndent(itemLine, contentIndent))
        );
        cursor += 1;
      }

      blocks.push(finishBlock(builder, ordered ? 'ol' : 'ul', currentPath()));
      index = cursor;
      continue;
    }

    if (HR_RE.test(line) || isSetextUnderline(line)) {
      index += 1;
      continue;
    }

    const builder = createBuilder();
    let cursor = index;
    let setextLevel = null;

    while (cursor < lines.length) {
      const paragraphLine = lines[cursor];
      if (!paragraphLine.trim()) break;

      if (cursor > index && isSetextUnderline(paragraphLine)) {
        setextLevel = paragraphLine.trim().startsWith('=') ? 1 : 2;
        cursor += 1;
        break;
      }

      if (cursor > index && startsNewBlock(lines, cursor)) break;

      pushText(builder, projectMarkdownLine(paragraphLine));
      cursor += 1;
    }

    if (setextLevel !== null) {
      const text = normalizeBlockText(builder.text.join(''));
      popHeadings(setextLevel);
      blocks.push(finishBlock(builder, `h${setextLevel}`, currentPath()));
      updateHeading(setextLevel, text);
    } else {
      blocks.push(finishBlock(builder, 'p', currentPath()));
    }

    index = cursor;
  }

  return blocks;
}

/**
 * Raw Markdown -> serializable block model with stable ids, matching the
 * render pass's occurrence-keyed FNV-1a identity.
 */
export function parseMarkdownBlocks(markdown) {
  const blocks = parseSourceBlocks(String(markdown).split('\n'));
  const occurrences = new Map();

  return blocks.map((block) => {
    const key = `${block.type}\u0001${block.text}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return {
      id: blockHashFor(block.type, block.text, occurrence),
      type: block.type,
      text: block.text,
      headingPath: block.headingPath,
    };
  });
}

function blockSegment(block) {
  return {
    kind: 'block',
    blockHash: block.id,
    blockText: block.text,
    blockType: block.type,
    headingPath: block.headingPath,
  };
}

/**
 * Diagnostic suffix for a failed quote match: up to three blocks sharing the
 * most whitespace-split words with the quote (case-insensitive), or the first
 * two blocks when nothing overlaps. Rendered text, capped at 80 characters,
 * so the agent can retry against the exact block instead of guessing.
 */
function closestBlockExcerpt(blocks, needle) {
  const words = new Set(
    needle.toLocaleLowerCase().split(/\s+/).filter(Boolean)
  );
  const scored = blocks
    .map((block) => ({
      block,
      hits: block.text
        .toLocaleLowerCase()
        .split(/\s+/)
        .reduce((count, word) => (words.has(word) ? count + 1 : count), 0),
    }))
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .slice(0, 3);

  const pool =
    scored.length > 0
      ? scored
      : blocks.slice(0, 2).map((block) => ({ block }));
  if (pool.length === 0) return '';

  const excerpts = pool.map(({ block }, index) => {
    const text =
      block.text.length > 80 ? `${block.text.slice(0, 77)}...` : block.text;
    return `[${index + 1}] "${text}"`;
  });
  return `; closest blocks: ${excerpts.join(' | ')}`;
}

/**
 * Builds an Anchor from raw Markdown and the text an agent wants to quote.
 *
 * - `quote` omitted -> a whole-file Anchor: one whole-block segment per block.
 * - `quote` equal to a block's full text -> a whole-block Anchor.
 * - otherwise -> a text segment with 48-char prefix/suffix context.
 *
 * The quote is matched against whitespace-normalized block text (what the
 * reader sees), not against raw Markdown syntax.
 */
export function buildAnchorFromMarkdown(markdown, quote) {
  const blocks = parseMarkdownBlocks(markdown);
  if (blocks.length === 0) {
    throw new Error('File has no annotatable content');
  }

  if (quote === undefined || quote === null) {
    return { version: 1, segments: blocks.map(blockSegment) };
  }

  const needle = normalizeBlockText(quote);
  if (!needle) throw new Error('Quote cannot be empty');

  const whole = blocks.find((block) => block.text === needle);
  if (whole) return { version: 1, segments: [blockSegment(whole)] };

  let block = blocks.find((candidate) => candidate.text.includes(needle));
  let start = block ? block.text.indexOf(needle) : -1;

  if (!block) {
    // Case-only drift is tolerated by the resolver; mirror that here.
    const lowerNeedle = needle.toLocaleLowerCase();
    block = blocks.find((candidate) => {
      const lowerText = candidate.text.toLocaleLowerCase();
      return (
        lowerText.length === candidate.text.length &&
        lowerText.includes(lowerNeedle)
      );
    });
    if (block) start = block.text.toLocaleLowerCase().indexOf(lowerNeedle);
  }

  if (!block || start < 0) {
    throw new Error(
      `Quote not found in file: "${needle}"${closestBlockExcerpt(blocks, needle)}`
    );
  }

  const end = start + needle.length;
  return {
    version: 1,
    segments: [
      {
        kind: 'text',
        blockHash: block.id,
        blockText: block.text,
        blockType: block.type,
        headingPath: block.headingPath,
        quote: block.text.slice(start, end),
        prefix: block.text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
        suffix: block.text.slice(end, Math.min(block.text.length, end + CONTEXT_LENGTH)),
      },
    ],
  };
}
