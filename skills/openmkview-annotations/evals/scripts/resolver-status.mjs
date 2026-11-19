#!/usr/bin/env node
/**
 * Genuine Active/Outdated oracle for eval anchors.
 *
 * Runs the frontend's real `resolveAnchor` over blocks produced by the real
 * render pipeline (`createMarkdownPipeline` -> `sanitizeMarkdownHtml` ->
 * `assignBlockAnchors`), exactly as the Preview does. This is the authority:
 * it ignores blockHash, weights blockText, and can resolve anchors that merely
 * match a quote plus context.
 *
 * Vitest is required because the render pass needs a DOM. The script generates
 * a throwaway spec inside the frontend test tree, runs it, and deletes it.
 * Input/output are JSON files so the caller can assert the actual statuses.
 *
 * Usage:
 *   resolver-status.mjs --cases cases.json --out results.json
 *
 * cases.json: [{ "name": "with_skill", "markdown": "...", "anchor": {...} }]
 * results.json: [{ "name": "with_skill", "status": "resolved"|"outdated" }]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, '..', '..');
const REPO_ROOT = path.resolve(SKILL_DIR, '..', '..');
const FRONTEND = path.join(REPO_ROOT, 'frontend');
const GENERATED_DIR = path.join(FRONTEND, 'src', 'test', 'skills');
const GENERATED = path.join(GENERATED_DIR, 'evalResolveStatus.generated.test.ts');

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

const SPEC = `import fs from 'node:fs';
import { resolveAnchor } from '../../utils/anchorResolver';
import { assignBlockAnchors } from '../../utils/annotationBlocks';
import {
  createMarkdownPipeline,
  sanitizeMarkdownHtml,
} from '../../utils/sanitizedMarkdown';
import type { AnnotationAnchor } from '../../types';

interface AnchorCase {
  name: string;
  markdown: string;
  anchor: AnnotationAnchor;
}

const cases: AnchorCase[] = JSON.parse(
  fs.readFileSync(process.env.EVAL_ANCHOR_CASES as string, 'utf8')
);

it('resolves eval anchors against the rendered Preview block model', () => {
  const results = cases.map((entry) => {
    const html = sanitizeMarkdownHtml(
      createMarkdownPipeline().parse(entry.markdown) as string
    );
    // The HTML comes from the product's own sanitizer, exactly as the existing
    // frontend seam test (omkCli.test.ts) does.
    const root = document.createElement('div');
    root.innerHTML = html;
    const blocks = assignBlockAnchors(root).map((block) => block.model);
    const resolution = resolveAnchor(blocks, entry.anchor);
    return { name: entry.name, status: resolution.status };
  });

  fs.writeFileSync(
    process.env.EVAL_ANCHOR_RESULTS as string,
    JSON.stringify(results, null, 2) + '\\n'
  );
  expect(results).toHaveLength(cases.length);
});
`;

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.cases || !options.out) {
    throw new Error('usage: resolver-status.mjs --cases cases.json --out results.json');
  }

  const cases = JSON.parse(fs.readFileSync(options.cases, 'utf8'));
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error('cases file must be a non-empty JSON array');
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(GENERATED, SPEC);

  let status = 0;
  try {
    execFileSync(
      'npx',
      ['vitest', 'run', 'src/test/skills/evalResolveStatus.generated.test.ts'],
      {
        cwd: FRONTEND,
        env: {
          ...process.env,
          EVAL_ANCHOR_CASES: path.resolve(options.cases),
          EVAL_ANCHOR_RESULTS: path.resolve(options.out),
        },
        stdio: 'pipe',
      }
    );
  } catch (error) {
    status = error.status ?? 1;
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    process.stderr.write(output.split(REPO_ROOT).join('<repo>'));
    process.stderr.write('\n');
  } finally {
    fs.rmSync(GENERATED, { force: true });
  }

  if (!fs.existsSync(options.out)) {
    throw new Error('resolver produced no results file');
  }
  process.stdout.write(fs.readFileSync(options.out, 'utf8'));
  process.exitCode = status;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 2;
}
