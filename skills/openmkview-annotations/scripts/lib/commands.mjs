/* Command implementations and dispatch for the omk CLI. Each command takes
 * the parsed options and a context (URL + token); output is JSON on stdout.
 */

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
  relativePathFor,
  resolveProject,
  writeIdentity,
} from './client.mjs';
import { buildAnchorFromMarkdown } from './markdown.mjs';

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
  if (options.orphans) rows = rows.filter((row) => row.missingFile);
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
    Missing File rows); --orphans keeps only those. show finds the row
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

export { main };
