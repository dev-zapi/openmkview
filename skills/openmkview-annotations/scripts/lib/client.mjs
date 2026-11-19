/* CLI plumbing for the omk CLI: config (URL + token, mode 0600), argument
 * parsing, JSON output, HTTP against the Annotation API, interactive
 * prompts, and the Tool Session exchange. Zero dependencies, Node >= 18.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { StringDecoder } from 'node:string_decoder';

import {
  isPathUnder,
  parseTimestamp,
  projectChoices,
  projectMatchesFor,
} from './domain.mjs';

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
  'open',
  'new',
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

function normalizeUrl(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '');
}

function makeContext(options) {
  const config = loadConfig();
  const url = normalizeUrl(
    options.url || process.env.OPENMKVIEW_URL || config?.url || ''
  );

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

  // An absolute --file is authoritative: pick the project containing it, and
  // when none does, do not rescue the read with the working directory — the
  // caller's relativePathFor will report the file as outside the project.
  if (options.file && path.isAbsolute(options.file)) {
    const under = projectMatchesFor(options.file, projects)[0];
    if (under) return under.project;
  } else {
    // The agent usually runs from inside the project it is working on, so the
    // working directory selects the project the same way an absolute --file
    // does — before the single-project fallback, never over it.
    const byCwd = projectMatchesFor(process.cwd(), projects)[0];
    if (byCwd) return byCwd.project;
  }

  if (projects.length === 1) return projects[0];
  if (projects.length === 0) {
    throw new Error(
      'No projects registered — run `omk.mjs projects open <dir>` to register one'
    );
  }

  throw new Error(
    `Multiple projects found — pass --project <id|name|path>: ${projectChoices(projects)}`
  );
}

function relativePathFor(project, file) {
  if (!file) throw new Error('--file is required');

  if (path.isAbsolute(file)) {
    const absolute = path.resolve(file);
    const root = path.resolve(project.path);
    if (!isPathUnder(root, absolute)) {
      throw new Error(`File is outside project "${project.name}": ${file}`);
    }
    return path.relative(root, absolute).split(path.sep).join('/');
  }

  return file.split(path.sep).join('/');
}

/* ------------------------------------------------------------------------- *
 * Seen cursor (--new)
 * ------------------------------------------------------------------------- */

/* The cursor lives beside the agent config (so OPENMKVIEW_AGENT_CONFIG
 * isolates it too) and is keyed by instance URL + project id: what has been
 * seen on one instance says nothing about another. */
function cursorPath() {
  return path.join(path.dirname(CONFIG_PATH), 'agent-cursor.json');
}

function cursorKey(context, projectId) {
  return `${context.url}|${projectId}`;
}

function loadCursors() {
  try {
    const raw = fs.readFileSync(cursorPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Cannot read ${cursorPath()}: ${error.message}`);
  }
}

function readCursor(context, projectId) {
  const value = loadCursors()[cursorKey(context, projectId)];
  return typeof value === 'string' ? parseTimestamp(value) : 0;
}

function writeCursor(context, projectId, epochMs) {
  const cursors = loadCursors();
  cursors[cursorKey(context, projectId)] = new Date(epochMs).toISOString();
  fs.mkdirSync(path.dirname(cursorPath()), { recursive: true, mode: 0o700 });
  const temporary = `${cursorPath()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(cursors, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporary, cursorPath());
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
 * Tool Session exchange (init / login)
 * ------------------------------------------------------------------------- */

async function establishToolSession(url, options) {
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

export {
  DEFAULT_URL,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  establishToolSession,
  fetchFileContent,
  listProjects,
  loadConfig,
  makeContext,
  normalizeUrl,
  output,
  parseArgs,
  promptValue,
  readCursor,
  relativePathFor,
  resolveProject,
  writeCursor,
};
