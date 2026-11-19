#!/usr/bin/env node
/**
 * eval anchor comparison (structural, NOT the Active/Outdated oracle).
 *
 * Reads one annotation back from a running instance and checks whether its
 * stored Anchor is byte-equal (order-insensitive) to the one the CLI would
 * build from the same file content and quote. This catches persistence and
 * projection drift, but it does NOT decide Active vs Outdated: the resolver
 * ignores blockHash, scores blockText as only one signal, and can still resolve
 * a differing anchor. The real oracle is `resolver-status.mjs`, which runs the
 * frontend `resolveAnchor` over rendered blocks.
 *
 * Usage:
 *   verify-anchor.mjs --url URL --project-id N --relative-path PATH \
 *     --annotation-id N [--quote TEXT] [--token TOKEN]
 *
 * Output: one JSON object on stdout. Exit 0 when the anchor matches the CLI
 * builder, 3 when it differs, 2 on usage/config errors.
 */

import process from 'node:process';
import {
  buildAnchorFromMarkdown,
  parseMarkdownBlocks,
} from '../../scripts/omk.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Option --${name} requires a value`);
    options[name] = value;
    index += 1;
  }
  return options;
}

/** Deep JSON equality that ignores object key order (serde_json sorts keys). */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const required = ['url', 'project-id', 'relative-path', 'annotation-id'];
  for (const name of required) {
    if (!options[name]) throw new Error(`--${name} is required`);
  }

  const base = options.url.replace(/\/+$/, '');
  const headers = { Accept: 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const projectId = String(options['project-id']);
  const relativePath = options['relative-path'];
  const annotationId = Number(options['annotation-id']);
  if (!Number.isInteger(annotationId)) throw new Error('--annotation-id must be an integer');

  const contentResponse = await fetch(
    `${base}/api/files/content?project_id=${encodeURIComponent(projectId)}&relativePath=${encodeURIComponent(relativePath)}`,
    { headers }
  );
  if (!contentResponse.ok) {
    throw new Error(`file content request failed: HTTP ${contentResponse.status}`);
  }
  const file = await contentResponse.json();
  if (typeof file.content !== 'string') throw new Error('file content response has no string content');

  const manageResponse = await fetch(
    `${base}/api/annotations/manage?project_id=${encodeURIComponent(projectId)}`,
    { headers }
  );
  if (!manageResponse.ok) {
    throw new Error(`annotation list request failed: HTTP ${manageResponse.status}`);
  }
  const rows = await manageResponse.json();
  const annotation = rows.find((row) => row.id === annotationId);
  if (!annotation) throw new Error(`annotation ${annotationId} not found`);

  const quote = options.quote;
  const expected = buildAnchorFromMarkdown(file.content, quote);
  const projectionTexts = new Set(
    parseMarkdownBlocks(file.content).map((block) => block.text)
  );

  const storedSegments = Array.isArray(annotation.anchor?.segments)
    ? annotation.anchor.segments
    : [];
  const storedTextSegments = storedSegments.filter((segment) => segment.kind === 'text');
  const storedBlockTexts = storedSegments.map((segment) => segment.blockText);
  const blockTextInProjection = storedBlockTexts.every((text) => projectionTexts.has(text));

  const matchesBuilder = sameJson(annotation.anchor, expected);
  const expectedText = expected.segments.find((segment) => segment.kind === 'text');

  const result = {
    annotationId,
    relativePath,
    quote: quote ?? null,
    expectedKind: expectedText ? 'text' : 'block',
    expectedBlockText: expectedText?.blockText ?? expected.segments[0]?.blockText,
    storedBlockTexts,
    storedTextSegmentCount: storedTextSegments.length,
    blockTextInProjection,
    storedMatchesCliBuilder: matchesBuilder,
    builderComparison: matchesBuilder ? 'matches' : 'differs',
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = matchesBuilder ? 0 : 3;
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 2;
});
