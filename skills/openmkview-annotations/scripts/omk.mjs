#!/usr/bin/env node
/**
 * omk — the OpenMKView agent annotation CLI.
 *
 * A single-file, zero-dependency Node (>= 18) client for the Annotation API.
 * It exists so an agent can read human feedback and write annotations without
 * the web UI: list/show annotations, create one from a file path plus quoted
 * text, reply, resolve, and delete.
 *
 * `create` fetches the target file through the files API and builds a legal
 * Anchor client-side by mirroring the frontend rules in
 * frontend/src/utils/{blockModel,annotationBlocks,selectionAnchor,
 * sourceMarkdownBlocks}.ts — FNV-1a block hashes, whitespace-normalized block
 * text, heading paths, and 48-character quote context. The resulting Anchor
 * resolves as Active in the Preview resolver.
 *
 * The pure parser/anchor functions below are exported so the frontend vitest
 * suite can validate CLI-computed anchors through its own resolver seam.
 * Configuration (URL + token only, mode 0600):
 *   ~/.config/openmkview/agent.json
 * `OPENMKVIEW_URL` overrides the configured URL.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';

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
    throw new Error(`Quote not found in file: "${needle}"`);
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

/**
 * Write identity defaults: agent voice unless `--human`. `--author` names the
 * voice; blank/absent falls back to "agent" / "human".
 */
export function writeIdentity({ author, human = false } = {}) {
  const trimmed = typeof author === 'string' ? author.trim() : '';
  return {
    author: trimmed || (human ? 'human' : 'agent'),
    isAgent: !human,
  };
}

/* ------------------------------------------------------------------------- *
 * CLI plumbing
 * ------------------------------------------------------------------------- */

const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  '.config',
  'openmkview',
  'agent.json'
);
const CONFIG_PATH = process.env.OPENMKVIEW_AGENT_CONFIG || DEFAULT_CONFIG_PATH;
const CONFIG_DIR = path.dirname(CONFIG_PATH);
const DEFAULT_URL = 'http://127.0.0.1:4567';
const REVOKED_MESSAGE = 'Tool Session revoked — run omk.mjs init';

const BOOLEAN_FLAGS = new Set([
  'human',
  'undo',
  'resolved',
  'unresolved',
  'orphans',
  'help',
]);

function parseArgs(argv) {
  const options = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '-h') {
      options.help = true;
      continue;
    }

    if (!token.startsWith('--')) {
      options._.push(token);
      continue;
    }

    const equals = token.indexOf('=');
    const name = equals === -1 ? token.slice(2) : token.slice(2, equals);
    let value;
    if (equals !== -1) {
      value = token.slice(equals + 1);
    }

    if (BOOLEAN_FLAGS.has(name)) {
      options[name] = value === undefined ? true : value !== 'false';
      continue;
    }

    if (value === undefined) {
      value = argv[index + 1];
      index += 1;
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Option --${name} requires a value`);
    }
    options[name] = value;
  }

  return options;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    // The token is a bearer credential: never leave it group/world readable.
    try {
      const mode = fs.statSync(CONFIG_PATH).mode & 0o777;
      if (mode & 0o077) {
        fs.chmodSync(CONFIG_PATH, 0o600);
        process.stderr.write(
          `Warning: ${CONFIG_PATH} was mode ${mode.toString(8)}; tightened to 600\n`
        );
      }
    } catch {
      // A stat/chmod failure must not make the config unreadable.
    }
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Cannot read ${CONFIG_PATH}: ${error.message}`);
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const temporary = `${CONFIG_PATH}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, CONFIG_PATH);
  fs.chmodSync(CONFIG_PATH, 0o600);
}

function makeContext(options) {
  const config = loadConfig();
  const url = (options.url || process.env.OPENMKVIEW_URL || config?.url || '')
    .trim()
    .replace(/\/+$/, '');

  if (!url) {
    throw new Error('OpenMKView URL is not configured — run omk.mjs init');
  }

  return { config, url, token: config?.token ?? null };
}

async function apiRequest(context, method, endpoint, body, options = {}) {
  const { auth = true, revokeMessage = true } = options;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && context.token) headers.Authorization = `Bearer ${context.token}`;

  let response;
  try {
    response = await fetch(`${context.url}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(30000) : undefined,
    });
  } catch (error) {
    throw new Error(`Cannot reach ${context.url}: ${error.message}`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (response.status === 401) {
    if (revokeMessage) throw new Error(REVOKED_MESSAGE);
    throw new Error(
      (data && typeof data === 'object' && data.error) || 'Unauthorized'
    );
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && data.error) ||
      `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
}

const apiGet = (context, endpoint, options) =>
  apiRequest(context, 'GET', endpoint, undefined, options);
const apiPost = (context, endpoint, body, options) =>
  apiRequest(context, 'POST', endpoint, body, options);
const apiPut = (context, endpoint, body, options) =>
  apiRequest(context, 'PUT', endpoint, body, options);
const apiDelete = (context, endpoint, options) =>
  apiRequest(context, 'DELETE', endpoint, undefined, options);

async function listProjects(context) {
  return apiGet(context, '/api/projects');
}

async function resolveProject(context, options) {
  const projects = await listProjects(context);

  if (options.project !== undefined) {
    const needle = String(options.project);
    const found =
      projects.find((project) => String(project.id) === needle) ||
      projects.find((project) => project.name === needle) ||
      projects.find((project) => project.path === needle);

    if (!found) throw new Error(`Project not found: ${needle}`);
    return found;
  }

  if (options.file && path.isAbsolute(options.file)) {
    const absolute = path.resolve(options.file);
    const under = projects
      .filter(
        (project) =>
          absolute === path.resolve(project.path) ||
          absolute.startsWith(`${path.resolve(project.path)}${path.sep}`)
      )
      .sort((left, right) => right.path.length - left.path.length)[0];

    if (under) return under;
  }

  if (projects.length === 1) return projects[0];
  if (projects.length === 0) {
    throw new Error('No projects registered — add one in the OpenMKView UI');
  }

  throw new Error('Multiple projects found — pass --project <id|name|path>');
}

function relativePathFor(project, file) {
  if (!file) throw new Error('--file is required');

  if (path.isAbsolute(file)) {
    const absolute = path.resolve(file);
    const root = path.resolve(project.path);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error(`File is outside project "${project.name}": ${file}`);
    }
    return path.relative(root, absolute).split(path.sep).join('/');
  }

  return file.split(path.sep).join('/');
}

async function fetchFileContent(context, projectId, relativePath) {
  const data = await apiGet(
    context,
    `/api/files/content?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`
  );

  if (data?.binary) throw new Error(`File is binary: ${relativePath}`);
  if (data?.truncated) {
    throw new Error(`File is truncated and cannot be anchored: ${relativePath}`);
  }
  if (typeof data?.content !== 'string') {
    throw new Error(`Unexpected file content response for ${relativePath}`);
  }

  return data.content;
}

/* ------------------------------------------------------------------------- *
 * Interactive prompts (no dependencies)
 * ------------------------------------------------------------------------- */

let pipeLines = null;

async function readPipeLine() {
  if (!pipeLines) {
    pipeLines = (async function* readLines() {
      let buffer = '';
      for await (const chunk of process.stdin) {
        buffer += chunk.toString();
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
          yield buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
        }
      }
      if (buffer.length > 0) yield buffer.replace(/\r$/, '');
    })();
  }

  const next = await pipeLines.next();
  return next.done ? '' : next.value;
}

function promptLine(message, { hidden = false } = {}) {
  process.stderr.write(message);

  if (!process.stdin.isTTY) {
    return readPipeLine().then((line) => {
      process.stderr.write('\n');
      return line;
    });
  }

  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let value = '';

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('data', onData);
    };

    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u0003') {
          cleanup();
          process.stderr.write('\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
        if (!hidden) process.stderr.write(character);
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function promptValue(message, { fallback = '', hidden = false } = {}) {
  const answer = (await promptLine(message, { hidden })).trim();
  return answer || fallback;
}

/* ------------------------------------------------------------------------- *
 * Commands
 * ------------------------------------------------------------------------- */

async function commandInit(options) {
  const config = loadConfig();
  const url = (
    options.url ||
    process.env.OPENMKVIEW_URL ||
    (await promptValue(`OpenMKView URL [${config?.url || DEFAULT_URL}]: `, {
      fallback: config?.url || DEFAULT_URL,
    }))
  )
    .trim()
    .replace(/\/+$/, '');

  const context = { url, token: null, config: null };
  const status = await apiGet(context, '/api/auth/status', {
    auth: false,
    revokeMessage: false,
  });

  if (!status.authRequired) {
    saveConfig({ url, token: null });
    output({ url, authRequired: false, tokenSaved: false });
    return;
  }

  const username =
    options.username ||
    process.env.OPENMKVIEW_USERNAME ||
    (await promptValue('Username: '));
  const password =
    process.env.OPENMKVIEW_PASSWORD ||
    (await promptValue('Password: ', { hidden: true }));

  const exchanged = await apiPost(
    context,
    '/api/auth/tool-sessions/exchange',
    { username, password, label: options.label || `omk on ${os.hostname()}` },
    { auth: false, revokeMessage: false }
  );

  saveConfig({ url, token: exchanged.token });
  output({
    url,
    authRequired: true,
    tokenSaved: true,
    toolSessionId: exchanged.id,
    label: exchanged.label,
  });
}

async function commandLogin(options) {
  const config = loadConfig();
  if (!config) {
    throw new Error('Not configured — run omk.mjs init');
  }

  const url = (options.url || process.env.OPENMKVIEW_URL || config.url)
    .trim()
    .replace(/\/+$/, '');
  const context = { url, token: null, config: null };
  const status = await apiGet(context, '/api/auth/status', {
    auth: false,
    revokeMessage: false,
  });

  if (!status.authRequired) {
    saveConfig({ url, token: null });
    output({ url, authRequired: false, tokenSaved: false });
    return;
  }

  const username =
    options.username ||
    process.env.OPENMKVIEW_USERNAME ||
    (await promptValue('Username: '));
  const password =
    process.env.OPENMKVIEW_PASSWORD ||
    (await promptValue('Password: ', { hidden: true }));

  const exchanged = await apiPost(
    context,
    '/api/auth/tool-sessions/exchange',
    { username, password, label: options.label || `omk on ${os.hostname()}` },
    { auth: false, revokeMessage: false }
  );

  saveConfig({ url, token: exchanged.token });
  output({
    url,
    authRequired: true,
    tokenSaved: true,
    toolSessionId: exchanged.id,
    label: exchanged.label,
  });
}

function assertResolvedFilter(options) {
  if (options.resolved && options.unresolved) {
    throw new Error('Use either --resolved or --unresolved, not both');
  }
}

function applyResolvedFilter(rows, options) {
  if (options.resolved) return rows.filter((row) => row.resolved);
  if (options.unresolved) return rows.filter((row) => !row.resolved);
  return rows;
}

async function commandList(context, options) {
  assertResolvedFilter(options);

  if (options.file) {
    const project = await resolveProject(context, options);
    const relativePath = relativePathFor(project, options.file);
    const query = new URLSearchParams({
      project_id: String(project.id),
      relativePath,
    });
    if (options.author) query.set('author', options.author);

    const rows = await apiGet(context, `/api/annotations?${query}`);
    output(applyResolvedFilter(rows, options));
    return;
  }

  const project = await resolveProject(context, options);
  const query = new URLSearchParams({ project_id: String(project.id) });
  if (options.author) query.set('author', options.author);

  let rows = await apiGet(context, `/api/annotations/manage?${query}`);
  if (options.orphans) rows = rows.filter((row) => row.orphaned);
  output(applyResolvedFilter(rows, options));
}

function parsePositiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer, got: ${value}`);
  }
  return parsed;
}

function positionalIds(options) {
  const ids = options._.slice(1);
  if (options.ids) ids.push(...String(options.ids).split(','));
  return ids
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parsePositiveInt(value, 'Annotation id'));
}

async function commandShow(context, options) {
  const [rawId] = positionalIds(options);
  if (rawId === undefined) throw new Error('Usage: omk.mjs show <id> [--project <id>]');
  const id = rawId;

  const projects = options.project
    ? [await resolveProject(context, options)]
    : await listProjects(context);

  for (const project of projects) {
    const rows = await apiGet(
      context,
      `/api/annotations/manage?project_id=${project.id}`
    );
    const found = rows.find((row) => row.id === id);
    if (found) {
      output(found);
      return;
    }
  }

  throw new Error(`Annotation ${id} not found`);
}

async function commandCreate(context, options) {
  if (!options.file) throw new Error('--file is required');
  if (options.body === undefined) throw new Error('--body is required');

  const project = await resolveProject(context, options);
  const relativePath = relativePathFor(project, options.file);
  const markdown = await fetchFileContent(context, project.id, relativePath);
  const anchor = buildAnchorFromMarkdown(markdown, options.quote);
  const identity = writeIdentity(options);

  const created = await apiPost(context, '/api/annotations', {
    projectId: project.id,
    relativePath,
    anchor,
    body: options.body,
    ...identity,
  });

  output(created);
}

async function commandReply(context, options) {
  const [id] = positionalIds(options);
  if (id === undefined) throw new Error('Usage: omk.mjs reply <id> --body <text>');
  if (options.body === undefined) throw new Error('--body is required');

  const updated = await apiPost(context, `/api/annotations/${id}/notes`, {
    body: options.body,
    ...writeIdentity(options),
  });

  output(updated);
}

async function commandResolve(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs resolve <id...> [--undo]');

  const resolved = !options.undo;

  if (ids.length > 1 && options.project !== undefined) {
    const project = await resolveProject(context, options);
    const result = await apiPost(context, '/api/annotations/batch-resolve', {
      projectId: project.id,
      ids,
      resolved,
    });
    output(result);
    return;
  }

  const results = [];
  for (const id of ids) {
    results.push(
      await apiPut(context, `/api/annotations/${id}/resolved`, { resolved })
    );
  }
  output(ids.length === 1 ? results[0] : results);
}

async function commandDelete(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs delete <id...>');

  if (ids.length > 1 && options.project !== undefined) {
    const project = await resolveProject(context, options);
    const result = await apiPost(context, '/api/annotations/batch-delete', {
      projectId: project.id,
      ids,
    });
    output(result);
    return;
  }

  const deleted = [];
  for (const id of ids) {
    await apiDelete(context, `/api/annotations/${id}`);
    deleted.push(id);
  }
  output({ deleted });
}

async function commandBatchResolve(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs batch-resolve <id...> --project <id>');
  const project = await resolveProject(context, options);
  const result = await apiPost(context, '/api/annotations/batch-resolve', {
    projectId: project.id,
    ids,
    resolved: !options.undo,
  });
  output(result);
}

async function commandBatchDelete(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs batch-delete <id...> --project <id>');
  const project = await resolveProject(context, options);
  const result = await apiPost(context, '/api/annotations/batch-delete', {
    projectId: project.id,
    ids,
  });
  output(result);
}

const HELP = `omk — OpenMKView agent annotation CLI (zero dependencies, Node >= 18)

Usage:
  omk.mjs init [--url URL] [--username U] [--label L]
  omk.mjs login [--url URL] [--username U] [--label L]
  omk.mjs list [--file PATH] [--project ID|NAME|PATH] [--author A]
               [--resolved | --unresolved] [--orphans]
  omk.mjs show <id> [--project ID|NAME|PATH]
  omk.mjs create --file PATH --body TEXT [--quote TEXT]
                 [--author NAME] [--human] [--project ID|NAME|PATH]
  omk.mjs reply <id> --body TEXT [--author NAME] [--human]
  omk.mjs resolve <id...> [--undo] [--project ID|NAME|PATH]
  omk.mjs delete <id...> [--project ID|NAME|PATH]
  omk.mjs batch-resolve <id...> --project ID|NAME|PATH [--undo]
  omk.mjs batch-delete <id...> --project ID|NAME|PATH

Behavior:
  - JSON is written to stdout on success; errors are {"error": "..."} on stderr
    with a non-zero exit code.
  - Config: ~/.config/openmkview/agent.json (mode 0600), URL + token only.
    OPENMKVIEW_URL overrides the configured URL; OPENMKVIEW_AGENT_CONFIG
    overrides the config file path (useful for isolated test instances).
  - init exchanges username/password once for a non-expiring Tool Session and
    never stores the password. Credentials are prompted interactively or read
    from OPENMKVIEW_USERNAME / OPENMKVIEW_PASSWORD; the password is never
    accepted as a command-line flag. 401 means the session was revoked:
    "Tool Session revoked — run omk.mjs init". --label names the Tool Session
    shown in the settings UI (init and login).
  - create fetches the file through the files API and builds the Anchor
    client-side from rendered text. --quote is matched after whitespace
    normalization against a single block. Without --quote the annotation
    anchors the whole file (one block segment per block).
  - Writes default to author "agent" with isAgent: true. --author sets the
    name; --human sets isAgent: false and defaults the author to "human".
  - Project resolution: --project accepts an id, name, or path. Without it,
    an absolute --file under a project selects that project, a single
    registered project is used automatically, otherwise an error lists the
    choices.
  - list without --file uses the project management endpoint (includes
    orphaned rows); --orphans keeps only Missing File rows. show finds the row
    in a list because the API has no single-annotation GET.
`;

const COMMANDS = new Set([
  'init',
  'login',
  'list',
  'show',
  'create',
  'reply',
  'resolve',
  'delete',
  'batch-resolve',
  'batch-delete',
]);

async function main(argv) {
  if (argv.some((arg) => arg === '--password' || arg.startsWith('--password='))) {
    throw new Error(
      '--password is not accepted on the command line; set OPENMKVIEW_PASSWORD or use the interactive prompt'
    );
  }

  const options = parseArgs(argv);
  if (options.help || options._.length === 0) {
    process.stdout.write(HELP);
    if (options._.length === 0 && !options.help) process.exitCode = 1;
    return;
  }

  const command = options._[0];
  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }

  if (command === 'init') {
    await commandInit(options);
    return;
  }
  if (command === 'login') {
    await commandLogin(options);
    return;
  }

  const context = makeContext(options);

  switch (command) {
    case 'list':
      await commandList(context, options);
      break;
    case 'show':
      await commandShow(context, options);
      break;
    case 'create':
      await commandCreate(context, options);
      break;
    case 'reply':
      await commandReply(context, options);
      break;
    case 'resolve':
      await commandResolve(context, options);
      break;
    case 'delete':
      await commandDelete(context, options);
      break;
    case 'batch-resolve':
      await commandBatchResolve(context, options);
      break;
    case 'batch-delete':
      await commandBatchDelete(context, options);
      break;
  }
}

/**
 * True when this module is the process entry point. Symlinked invocations are
 * compared by real path: `import.meta.url` is the resolved file while
 * `process.argv[1]` keeps the symlink path, which must still run the CLI.
 */
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return (
      fs.realpathSync(process.argv[1]) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  });
}
