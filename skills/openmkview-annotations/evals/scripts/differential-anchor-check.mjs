#!/usr/bin/env node
/**
 * Differential check: the Python Anchor helper documented in
 * references/api.md must produce exactly the CLI's Anchor across the fixture
 * and targeted edge cases.
 *
 * The helper is extracted from api.md at run time, so the docs are the source
 * under test. Each case runs both builders and compares the JSON with object
 * key order ignored.
 *
 * Usage: differential-anchor-check.mjs --out results.json
 * Exit 0 when every case matches, 1 on any mismatch.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildAnchorFromMarkdown } from '../../scripts/omk.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..', '..');
const API_MD = path.join(SKILL_DIR, 'references', 'api.md');
const FIXTURE = path.join(SKILL_DIR, 'evals', 'fixture');

const EDGE_MARKDOWN = `# Guide

The quick brown fox jumps over the lazy dog.

## Setup

\`\`\`bash
npm install openmkview
npm run dev
\`\`\`

# Wrapped prose

The quick brown
fox jumps over
the lazy dog.

## Quote

> quote first line
> quote second line

## Escaped table

| Left | Right |
|---|---|
| x \\| y | z |

## Table

| A | B |
|---|---|
| C | D |

## Lists

- item first line
  continuation line
- second item

## Deep list

- deep item first line
      deeper continuation line
- second item

Setext first line
continued
===

## Images

Text before ![alt text](pic.png) text after.
`;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`Option ${token} requires a value`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return options;
}

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

function extractHelper(markdown) {
  const blocks = [...markdown.matchAll(/```python\n([\s\S]*?)```/g)];
  if (blocks.length !== 1) {
    throw new Error(`expected exactly one python block in api.md, found ${blocks.length}`);
  }
  return blocks[0][1];
}

function pythonAnchor(helperPath, markdownPath, quote) {
  const args = [helperPath, markdownPath];
  if (quote !== undefined) args.push(quote);
  const output = execFileSync('python3', args, { encoding: 'utf8' });
  return JSON.parse(output);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.out) throw new Error('usage: differential-anchor-check.mjs --out results.json');

  const scratch = fs.mkdtempSync(path.join(os.homedir(), '.cache', 'omk-diff-'));
  const helperPath = path.join(scratch, 'anchor.py');
  fs.writeFileSync(helperPath, extractHelper(fs.readFileSync(API_MD, 'utf8')));
  const edgePath = path.join(scratch, 'edge.md');
  fs.writeFileSync(edgePath, EDGE_MARKDOWN);

  const files = [
    ['README.md', path.join(FIXTURE, 'README.md')],
    ['guide.md', path.join(FIXTURE, 'guide.md')],
    ['notes.md', path.join(FIXTURE, 'notes.md')],
    ['edge.md', edgePath],
  ];
  const cases = [
    ['README.md', 'fox jumps'],
    ['README.md', 'npm run dev'],
    ['README.md', 'omk list'],
    ['README.md', 'OpenMKView Fixture'],
    ['README.md', undefined],
    ['guide.md', 'never inside it'],
    ['guide.md', undefined],
    ['notes.md', 'First bullet'],
    ['notes.md', 'spanning two lines'],
    ['notes.md', undefined],
    ['edge.md', 'brownfox'],
    ['edge.md', 'linequote'],
    ['edge.md', 'linecontinuation'],
    ['edge.md', 'deeper continuation'],
    ['edge.md', 'first linecontinued'],
    ['edge.md', 'C D'],
    ['edge.md', 'before text after'],
    ['edge.md', 'x | y'],
    ['edge.md', 'y z'],
    ['edge.md', undefined],
  ];
  const byName = new Map(files);

  const results = [];
  const mismatches = [];
  for (const [file, quote] of cases) {
    const markdownPath = byName.get(file);
    const markdown = fs.readFileSync(markdownPath, 'utf8');
    const name = `${file} [${quote === undefined ? 'whole file' : quote}]`;
    let match = true;
    let detail = '';
    try {
      const cli = buildAnchorFromMarkdown(markdown, quote);
      const python = pythonAnchor(helperPath, markdownPath, quote);
      match = sameJson(cli, python);
      if (!match) detail = 'anchor JSON differs';
    } catch (error) {
      match = false;
      detail = error.message;
    }
    results.push({ name, match, detail });
    if (!match) mismatches.push({ name, detail });
  }

  fs.rmSync(scratch, { recursive: true, force: true });

  const report = {
    helper: 'references/api.md python block',
    total: results.length,
    passed: results.filter((entry) => entry.match).length,
    mismatches,
    cases: results,
  };
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${report.passed}/${report.total} differential cases match\n`);
  process.exitCode = mismatches.length === 0 ? 0 : 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 2;
}
