#!/usr/bin/env node
/**
 * Append one graded assertion to a skill-creator grading.json file.
 *
 * Usage:
 *   assert.mjs GRADING_JSON true|false "assertion text" "evidence"
 *
 * Writes { expectations: [{text, passed, evidence}], summary: {...} }, the
 * field names the eval viewer expects.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [gradingPath, passedRaw, text, evidence = ''] = process.argv.slice(2);
if (!gradingPath || !text) {
  process.stderr.write('usage: assert.mjs GRADING_JSON true|false TEXT [EVIDENCE]\n');
  process.exit(2);
}

let grading = { expectations: [] };
if (fs.existsSync(gradingPath)) {
  grading = JSON.parse(fs.readFileSync(gradingPath, 'utf8'));
  if (!Array.isArray(grading.expectations)) grading.expectations = [];
}

grading.expectations.push({
  text,
  passed: passedRaw === 'true',
  evidence,
});

const passed = grading.expectations.filter((entry) => entry.passed).length;
const total = grading.expectations.length;
grading.summary = { passed, failed: total - passed, total, pass_rate: total ? passed / total : 0 };

fs.mkdirSync(path.dirname(gradingPath), { recursive: true });
fs.writeFileSync(gradingPath, `${JSON.stringify(grading, null, 2)}\n`);
