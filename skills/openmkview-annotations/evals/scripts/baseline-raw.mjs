#!/usr/bin/env node
/**
 * Baseline "no-skill" agent: raw HTTP only, hand-crafted Anchor JSON.
 *
 * This is what the eval is comparing against. It intentionally does NOT import
 * anything from scripts/omk.mjs. It reads Markdown as lines and emits a
 * WHOLE-BLOCK segment whose blockText is the raw source line containing the
 * quote. The resolver's selectWholeBlock requires exact equality with a
 * rendered block's text, and hard-wrapped prose renders with its soft breaks
 * concatenated (`fox jumps over` becomes part of `...brownfox jumps overthe...`).
 * The Anchor validates structurally but genuinely resolves Outdated — exactly
 * the failure mode the skill's client-side projection removes.
 *
 * Commands:
 *   create --url URL --project-id N --relative-path PATH --quote TEXT \
 *          --body TEXT [--author NAME] [--human]
 *   resolve --url URL --project-id N --author NAME
 *
 * Output: one JSON object on stdout.
 */

import process from 'node:process';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (name === 'human') {
      options.human = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Option --${name} requires a value`);
    options[name] = value;
    index += 1;
  }
  return options;
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function headingPathFor(lines, lineIndex) {
  const stack = [];
  for (let index = 0; index <= lineIndex; index += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[index]);
    if (!match) continue;
    const level = match[1].length;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, text: match[2] });
  }
  return stack.map((heading) => heading.text);
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? { Accept: 'application/json' } : {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data && data.error ? data.error : text}`);
  }
  return data;
}

async function create(options) {
  const base = options.url.replace(/\/+$/, '');
  const projectId = String(options['project-id']);
  const relativePath = options['relative-path'];
  const file = await request(
    'GET',
    `${base}/api/files/content?project_id=${encodeURIComponent(projectId)}&relativePath=${encodeURIComponent(relativePath)}`
  );

  const lines = String(file.content).split('\n');
  const needle = String(options.quote ?? '').replace(/\s+/g, ' ').trim();
  if (!needle) throw new Error('--quote is required');
  const lineIndex = lines.findIndex((line) => line.includes(needle));
  if (lineIndex === -1) throw new Error(`Quote not found in file: "${needle}"`);

  // The naive projection: use the raw source line as the block text.
  const blockText = lines[lineIndex].trim();
  const blockType = 'p';
  const blockHash = `blk-${fnv1a(`${blockType}\u0001${blockText}\u0001${0}`)}`;

  // Whole-block segment: selectWholeBlock requires block.text === blockText,
  // so the raw source line cannot match the rendered block.
  const anchor = {
    version: 1,
    segments: [
      {
        kind: 'block',
        blockHash,
        blockText,
        blockType,
        headingPath: headingPathFor(lines, lineIndex),
      },
    ],
  };

  const payload = {
    projectId: Number(projectId),
    relativePath,
    anchor,
    body: options.body,
    author: options.author ?? (options.human ? 'human' : 'agent'),
    isAgent: !options.human,
  };

  return request('POST', `${base}/api/annotations`, payload);
}

async function resolveUnresolved(options) {
  const base = options.url.replace(/\/+$/, '');
  const projectId = String(options['project-id']);
  const query = new URLSearchParams({ project_id: projectId });
  if (options.author) query.set('author', options.author);
  const rows = await request('GET', `${base}/api/annotations/manage?${query}`);

  const unresolved = rows.filter(
    (row) =>
      !row.resolved &&
      (!options.author || (row.notes ?? []).some((note) => note.author === options.author))
  );

  const ids = [];
  for (const row of unresolved) {
    await request('PUT', `${base}/api/annotations/${row.id}/resolved`, {
      resolved: true,
    });
    ids.push(row.id);
  }
  return { updated: ids.length, ids };
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const options = parseArgs(rest);

  if (command === 'create') {
    if (!options.url || !options['project-id'] || !options['relative-path']) {
      throw new Error('create requires --url --project-id --relative-path');
    }
    process.stdout.write(`${JSON.stringify(await create(options), null, 2)}\n`);
    return;
  }

  if (command === 'resolve') {
    if (!options.url || !options['project-id'] || !options.author) {
      throw new Error('resolve requires --url --project-id --author');
    }
    process.stdout.write(`${JSON.stringify(await resolveUnresolved(options), null, 2)}\n`);
    return;
  }

  throw new Error('usage: baseline-raw.mjs create|resolve ...');
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 2;
});
