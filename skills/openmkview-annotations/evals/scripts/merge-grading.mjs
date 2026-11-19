#!/usr/bin/env node
/**
 * Append assertions produced by a helper report (e.g. browser-review.json)
 * into a skill-creator grading.json.
 *
 * Usage: merge-grading.mjs GRADING_JSON SOURCE_JSON
 * SOURCE_JSON: { assertions: [{text, passed, evidence}] } or such an array.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [gradingPath, sourcePath] = process.argv.slice(2);
if (!gradingPath || !sourcePath) {
  process.stderr.write('usage: merge-grading.mjs GRADING_JSON SOURCE_JSON\n');
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const incoming = Array.isArray(source) ? source : source.assertions;
if (!Array.isArray(incoming)) throw new Error('source has no assertions array');

let grading = { expectations: [] };
if (fs.existsSync(gradingPath)) {
  grading = JSON.parse(fs.readFileSync(gradingPath, 'utf8'));
  if (!Array.isArray(grading.expectations)) grading.expectations = [];
}
for (const entry of incoming) {
  grading.expectations.push({
    text: entry.text,
    passed: Boolean(entry.passed),
    evidence: entry.evidence ?? '',
  });
}
const passed = grading.expectations.filter((entry) => entry.passed).length;
const total = grading.expectations.length;
grading.summary = { passed, failed: total - passed, total, pass_rate: total ? passed / total : 0 };

fs.mkdirSync(path.dirname(gradingPath), { recursive: true });
fs.writeFileSync(gradingPath, `${JSON.stringify(grading, null, 2)}\n`);
process.stdout.write(`${passed}/${total} assertions passed\n`);
