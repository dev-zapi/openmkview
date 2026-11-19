#!/usr/bin/env node
/**
 * Render a JSON annotation list (from /api/annotations or
 * /api/annotations/manage) as a short human-readable summary.
 *
 * This is the deterministic stand-in for an agent's answer in the eval: it
 * shows what the human asked for without the eval harness pretending to
 * reason. Usage: summarize-list.mjs LIST_JSON OUT_MD [TITLE]
 */

import fs from 'node:fs';
import process from 'node:process';

const [listPath, outPath, title = 'Annotations'] = process.argv.slice(2);
if (!listPath || !outPath) {
  process.stderr.write('usage: summarize-list.mjs LIST_JSON OUT_MD [TITLE]\n');
  process.exit(2);
}

const rows = JSON.parse(fs.readFileSync(listPath, 'utf8'));
if (!Array.isArray(rows)) throw new Error('list response is not an array');

const lines = [`# ${title}`, ''];
if (rows.length === 0) {
  lines.push('No annotations.');
} else {
  for (const annotation of rows) {
    const state = annotation.resolved ? 'Resolved' : 'Unresolved';
    const missing = annotation.missingFile ? ', Missing File' : '';
    lines.push(
      `## Annotation ${annotation.id} — ${annotation.relativePath} (${state}${missing})`
    );
    if (annotation.snapshot) lines.push(`Anchored text: "${annotation.snapshot}"`);
    for (const note of annotation.notes ?? []) {
      const author = note.author ?? '—';
      const voice = note.isAgent ? 'agent' : 'human';
      lines.push(`- ${author} (${voice}): ${note.body}`);
    }
    lines.push('');
  }
}

fs.writeFileSync(outPath, `${lines.join('\n')}\n`);
process.stdout.write(`wrote ${outPath} (${rows.length} annotations)\n`);
