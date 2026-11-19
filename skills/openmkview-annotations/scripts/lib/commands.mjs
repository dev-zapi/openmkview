/* Command implementations and dispatch for the omk CLI. Each command takes
 * the parsed options and a context (URL + token); output is JSON on stdout.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
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
  writeIdentity,
} from './client.mjs';
import {
  isThreadNewSince,
  latestThreadActivity,
  normalizeProject,
  parseTimestamp,
  projectMatchesFor,
} from './domain.mjs';
import { buildAnchorFromMarkdown, parseMarkdownBlocks } from './markdown.mjs';

/* Project validation reasons arrive in Chinese from the API; the CLI speaks
 * English, so the known cases are translated and anything else passes through
 * unchanged (never hide an unexpected reason). */
const VALIDATION_REASON_MESSAGES = {
  '目录不存在': 'directory does not exist',
  '路径不是目录': 'path is not a directory',
  '目录中没有找到 Markdown 或 HTML 文件（.md、.mdx、.html 或 .htm）':
    'no Markdown or HTML files found in the directory (.md, .mdx, .html, or .htm)',
};

function englishValidationReason(reason) {
  return VALIDATION_REASON_MESSAGES[reason] ?? reason;
}

async function commandInit(options) {
  const config = loadConfig();
  const url = normalizeUrl(
    options.url ||
      process.env.OPENMKVIEW_URL ||
      (await promptValue(`OpenMKView URL [${config?.url || DEFAULT_URL}]: `, {
        fallback: config?.url || DEFAULT_URL,
      }))
  );

  await establishToolSession(url, options);
}

async function commandLogin(options) {
  const config = loadConfig();
  if (!config) {
    throw new Error('Not configured — run omk.mjs init');
  }

  const url = normalizeUrl(
    options.url || process.env.OPENMKVIEW_URL || config.url
  );

  await establishToolSession(url, options);
}

/* ------------------------------------------------------------------------- *
 * projects — list endpoints and directory registration
 * ------------------------------------------------------------------------- */

async function commandProjects(context, options) {
  const subcommand = options._[1];

  if (!subcommand) {
    throw new Error(`Usage:\n${PROJECTS_USAGE}`);
  }

  if (subcommand === 'list') {
    const projects = await listProjects(context);
    const rows = options.open
      ? projects.filter((project) => project.is_open)
      : projects;
    output(rows.map(normalizeProject));
    return;
  }

  if (subcommand === 'open') {
    const target = options._[2];
    if (target === undefined) {
      throw new Error('Usage:\n  omk.mjs projects open <dir>');
    }

    const directory = path.resolve(String(target));
    const validation = await apiPost(context, '/api/projects/validate', {
      path: directory,
    });
    if (!validation?.valid) {
      throw new Error(
        `Cannot register ${directory}: ${englishValidationReason(
          validation?.reason ?? 'unknown reason'
        )}`
      );
    }

    // create-or-open is idempotent: an already registered directory is only
    // re-opened, so running this twice is safe.
    await apiPost(context, '/api/projects/open', { path: directory });

    const projects = await listProjects(context);
    const match = projectMatchesFor(directory, projects)[0];
    if (!match) {
      throw new Error(`Cannot find the project registered at ${directory}`);
    }
    output(normalizeProject(match.project));
    return;
  }

  if (subcommand === 'detect') {
    const directory = path.resolve(String(options._[2] ?? process.cwd()));
    const projects = await listProjects(context);
    // projectMatchesFor already orders deepest first, so matches[0] is the
    // Containing Project (or the root itself).
    const matches = projectMatchesFor(directory, projects).map(
      ({ project, relation }) => ({
        relation,
        project: normalizeProject(project),
      })
    );
    const [first] = matches;

    output({
      path: directory,
      registered: matches.length > 0,
      project: first ? first.project : null,
      relation: first ? first.relation : null,
      matches,
    });
    return;
  }

  throw new Error(
    `Unknown projects subcommand: ${subcommand}\n\nUsage:\n${PROJECTS_USAGE}`
  );
}

/* ------------------------------------------------------------------------- *
 * list
 * ------------------------------------------------------------------------- */

function assertListFilters(options) {
  if (options.resolved && options.unresolved) {
    throw new Error('Use either --resolved or --unresolved, not both');
  }
  if (options.new && options.since !== undefined) {
    throw new Error('Use either --new or --since, not both');
  }
}

function applyResolvedFilter(rows, options) {
  if (options.resolved) return rows.filter((row) => row.resolved);
  if (options.unresolved) return rows.filter((row) => !row.resolved);
  return rows;
}

/* --text searches the anchored snapshot and every note body in one haystack;
 * it is a case-insensitive substring match, not a query language. */
function applyTextFilter(rows, query) {
  const needle = String(query).toLocaleLowerCase();
  return rows.filter((row) => {
    const haystack = [
      row.snapshot ?? '',
      ...(row.notes ?? []).map((note) => note.body ?? ''),
    ]
      .join('\n')
      .toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

async function commandList(context, options) {
  assertListFilters(options);

  const project = await resolveProject(context, options);

  let rows;
  if (options.file) {
    const relativePath = relativePathFor(project, options.file);
    const query = new URLSearchParams({
      project_id: String(project.id),
      relativePath,
    });
    if (options.author) query.set('author', options.author);
    rows = await apiGet(context, `/api/annotations?${query}`);
  } else {
    const query = new URLSearchParams({ project_id: String(project.id) });
    if (options.author) query.set('author', options.author);
    rows = await apiGet(context, `/api/annotations/manage?${query}`);
  }

  let filtered = applyResolvedFilter(rows, options);

  let cursor = null;
  if (options.new) {
    cursor = readCursor(context, project.id);
    filtered = filtered.filter((row) => isThreadNewSince(row, cursor));
  } else if (options.since !== undefined) {
    const cutoff = parseTimestamp(options.since);
    filtered = filtered.filter((row) => isThreadNewSince(row, cutoff));
  }

  if (!options.file && options.orphans) {
    filtered = filtered.filter((row) => row.missingFile);
  }

  if (options.text !== undefined) {
    filtered = applyTextFilter(filtered, options.text);
  }

  // Only a project-wide, unfiltered read may advance the cursor. --file and
  // --author narrow the read server-side; advancing from those rows would
  // permanently skip updates in files/authors that were never shown. The read
  // still filters and returns JSON as usual — it just leaves the cursor alone.
  if (cursor !== null) {
    if (options.file || options.author) {
      process.stderr.write(
        'Warning: cursor not advanced (--new with --file/--author narrows the read)\n'
      );
    } else if (rows.length > 0) {
      const latest = Math.max(...rows.map(latestThreadActivity));
      writeCursor(context, project.id, Math.max(cursor, latest));
    }
  }

  output(filtered);
}

function parseBoundedInt(value, label, minimum) {
  const text = String(value).trim();
  const parsed = text === '' ? Number.NaN : Number(text);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    const requirement =
      minimum === 0 ? 'a non-negative integer' : 'a positive integer';
    throw new Error(`${label} must be ${requirement}, got: ${value}`);
  }
  return parsed;
}

function parsePositiveInt(value, label) {
  return parseBoundedInt(value, label, 1);
}

function parseNonNegativeInt(value, label) {
  return parseBoundedInt(value, label, 0);
}

function positionalIds(options) {
  const ids = options._.slice(1);
  if (options.ids) ids.push(...String(options.ids).split(','));
  return ids
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parsePositiveInt(value, 'Annotation id'));
}

/* --context N: each anchored block plus N neighbors on each side, resolved
 * from the current file. Windows around separate hits union by block order,
 * never as one continuous min..max span (which a multi-segment anchor on
 * distant blocks would blow up). Radius 0 keeps only the anchored blocks.
 * Best effort by design — an unreadable or binary file simply yields null
 * instead of failing the show. */
function contextWindowFor(row, blocks, radius) {
  const anchored = new Set(
    (row.anchor?.segments ?? [])
      .map((segment) => segment.blockHash)
      .filter(Boolean)
  );
  if (anchored.size === 0) return null;

  const indexes = [];
  blocks.forEach((block, index) => {
    if (anchored.has(block.id)) indexes.push(index);
  });
  if (indexes.length === 0) return null;

  const included = new Set();
  for (const index of indexes) {
    for (let offset = -radius; offset <= radius; offset += 1) {
      const candidate = index + offset;
      if (candidate >= 0 && candidate < blocks.length) included.add(candidate);
    }
  }

  return blocks
    .map((block, index) => ({ block, index }))
    .filter(({ index }) => included.has(index))
    .map(({ block }) => ({
      blockHash: block.id,
      blockType: block.type,
      text: block.text,
      headingPath: block.headingPath,
      anchor: anchored.has(block.id),
    }));
}

async function commandShow(context, options) {
  const [rawId] = positionalIds(options);
  if (rawId === undefined) {
    throw new Error('Usage: omk.mjs show <id> [--project <id>] [--context N]');
  }
  const id = rawId;
  const radius =
    options.context === undefined
      ? null
      : parseNonNegativeInt(options.context, '--context');

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
      if (radius !== null) {
        try {
          const markdown = await fetchFileContent(
            context,
            found.projectId,
            found.relativePath
          );
          found.context = contextWindowFor(
            found,
            parseMarkdownBlocks(markdown),
            radius
          );
        } catch {
          found.context = null;
        }
      }
      output(found);
      return;
    }
  }

  throw new Error(`Annotation ${id} not found`);
}

/* --body wins over --body-file; "--body-file -" reads all of stdin, which
 * keeps large feedback bodies out of shell quoting. */
function resolveBody(options) {
  if (options.body !== undefined) return options.body;

  const bodyFile = options['body-file'];
  if (bodyFile === undefined) return undefined;

  const target = String(bodyFile);
  if (target === '-') {
    try {
      return fs.readFileSync(0, 'utf8');
    } catch (error) {
      throw new Error(`Cannot read stdin for --body-file -: ${error.message}`);
    }
  }

  try {
    return fs.readFileSync(target, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read --body-file ${target}: ${error.message}`);
  }
}

async function commandCreate(context, options) {
  if (!options.file) throw new Error('--file is required');
  const body = resolveBody(options);
  if (body === undefined) throw new Error('--body is required');

  const project = await resolveProject(context, options);
  const relativePath = relativePathFor(project, options.file);
  const markdown = await fetchFileContent(context, project.id, relativePath);
  const anchor = buildAnchorFromMarkdown(markdown, options.quote);
  const identity = writeIdentity(options);

  const created = await apiPost(context, '/api/annotations', {
    projectId: project.id,
    relativePath,
    anchor,
    body,
    ...identity,
  });

  output(created);
}

async function commandReply(context, options) {
  const [id] = positionalIds(options);
  if (id === undefined) {
    throw new Error('Usage: omk.mjs reply <id> --body <text> | --body-file <path>');
  }
  const body = resolveBody(options);
  if (body === undefined) throw new Error('--body is required');

  const updated = await apiPost(context, `/api/annotations/${id}/notes`, {
    body,
    ...writeIdentity(options),
  });

  output(updated);
}

/* Shared batch cores: the batch branch of resolve/delete and the dedicated
 * batch-* commands hit the same endpoints through one path. */
async function batchResolveIds(context, options, ids) {
  const project = await resolveProject(context, options);
  const result = await apiPost(context, '/api/annotations/batch-resolve', {
    projectId: project.id,
    ids,
    resolved: !options.undo,
  });
  output(result);
}

async function batchDeleteIds(context, options, ids) {
  const project = await resolveProject(context, options);
  const result = await apiPost(context, '/api/annotations/batch-delete', {
    projectId: project.id,
    ids,
  });
  output(result);
}

async function commandResolve(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs resolve <id...> [--undo]');

  const resolved = !options.undo;

  if (ids.length > 1 && options.project !== undefined) {
    await batchResolveIds(context, options, ids);
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
    await batchDeleteIds(context, options, ids);
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
  await batchResolveIds(context, options, ids);
}

async function commandBatchDelete(context, options) {
  const ids = positionalIds(options);
  if (ids.length === 0) throw new Error('Usage: omk.mjs batch-delete <id...> --project <id>');
  await batchDeleteIds(context, options, ids);
}

const PROJECTS_USAGE = `  omk.mjs projects list [--open]
  omk.mjs projects open <dir>
  omk.mjs projects detect [<dir>]`;

const HELP = `omk — OpenMKView agent annotation CLI (zero dependencies, Node >= 18)

Usage:
  omk.mjs init [--url URL] [--username U] [--label L]
  omk.mjs login [--url URL] [--username U] [--label L]
${PROJECTS_USAGE}
  omk.mjs list [--file PATH] [--project ID|NAME|PATH] [--author A]
               [--resolved | --unresolved] [--orphans]
               [--new | --since TIMESTAMP] [--text QUERY]
  omk.mjs show <id> [--project ID|NAME|PATH] [--context N]
  omk.mjs create --file PATH (--body TEXT | --body-file PATH) [--quote TEXT]
                 [--author NAME] [--human] [--project ID|NAME|PATH]
  omk.mjs reply <id> (--body TEXT | --body-file PATH) [--author NAME] [--human]
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
    --body-file PATH (or "-" for stdin) supplies the body when --body is absent.
  - Project resolution: --project accepts an id, name, or path. Without it an
    absolute --file selects the project containing it, and when none does the
    working directory is not consulted (the file is reported as outside). A
    relative or absent --file falls back to the working directory: the deepest
    registered project containing it (open or closed). A single registered
    project is used automatically, and otherwise the error lists every
    registered project. Projects list output is camelCase.
  - projects list prints registered projects (--open keeps open ones).
    projects open validates the directory, then registers or re-opens it
    (idempotent) and prints the project; validation reasons are translated to
    English (unknown reasons pass through unchanged). projects detect reports
    whether a directory (default: the working directory) is a registered
    project's root ("relation": "root") or nested inside one ("inside"),
    deepest first.
  - list --new keeps threads created, or with a note appended, after the last
    successful project-wide --new read (cursor stored beside the agent config,
    keyed per instance + project) and advances it. A --new read narrowed with
    --file or --author still filters normally but does not advance the cursor
    (it prints a warning to stderr): those flags narrow the server-side read,
    so advancing would hide other files' or authors' updates. list --since
    applies the same activity test to an ISO or "YYYY-MM-DD HH:MM:SS" timestamp
    without a cursor. They are mutually exclusive. list --text filters
    case-insensitively over the snapshot and note bodies.
  - list without --file uses the project management endpoint (includes
    Missing File rows); --orphans keeps only those. show finds the row
    in a list because the API has no single-annotation GET. show --context N
    (N >= 0) adds a "context" array with N blocks on each side of every
    anchored block (0 keeps only the anchored blocks; null when the file
    cannot be read).
`;

const COMMANDS = new Set([
  'init',
  'login',
  'projects',
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
    case 'projects':
      await commandProjects(context, options);
      break;
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

export { main };
