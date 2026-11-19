#!/usr/bin/env node
/**
 * Browser review of resolver status and authorship in the real web UI.
 *
 * Opens the fixture instance, navigates directly to the file, opens the
 * annotation column, and reads the user-visible state for two annotations:
 * a CLI-created agent annotation (must be Active, author claude, Agent badge)
 * and a naive baseline annotation (must be Outdated). Writes a screenshot and
 * a JSON report.
 *
 * Usage:
 *   browser-review.mjs --url URL --project-id N --relative-path PATH \
 *     --with-id N --baseline-id N --out-dir DIR
 *
 * Exit 0 when every expectation holds, 1 otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..', '..', '..');
const require = createRequire(path.join(REPO_ROOT, 'frontend', 'package.json'));
const { chromium } = require('playwright');

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

async function readItem(page, id) {
  const item = page.locator(`.annotation-column-item[data-annotation-id="${id}"]`);
  await item.waitFor({ state: 'visible', timeout: 20000 });
  const state = (await item.locator('.annotation-state').first().innerText()).trim();
  const author = (await item.locator('.annotation-note-author-name').first().innerText()).trim();
  const badges = await item.locator('.annotation-note-agent-badge').allInnerTexts();
  return {
    id: Number(id),
    state,
    author,
    badges: badges.map((text) => text.trim()),
    outdatedAttribute: await item.getAttribute('data-outdated'),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const required = ['url', 'project-id', 'relative-path', 'with-id', 'baseline-id', 'out-dir'];
  for (const name of required) {
    if (!options[name]) throw new Error(`--${name} is required`);
  }

  const base = options.url.replace(/\/+$/, '');
  const target = `${base}/project/${options['project-id']}/files/${encodeURIComponent(
    options['relative-path']
  )}`;
  fs.mkdirSync(options['out-dir'], { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const report = {
    url: base,
    target,
    withSkill: null,
    baseline: null,
    screenshot: 'annotation-column.png',
    assertions: [],
    consoleErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
  });

  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-container').waitFor({ state: 'visible', timeout: 20000 });
    await page.getByRole('heading', { name: 'OpenMKView Fixture', exact: true }).waitFor({
      state: 'visible',
      timeout: 20000,
    });

    await page.getByRole('button', { name: 'Annotation column', exact: true }).click();
    const column = page.getByRole('region', { name: 'Annotations' });
    await column.waitFor({ state: 'visible', timeout: 10000 });

    report.withSkill = await readItem(page, options['with-id']);
    report.baseline = await readItem(page, options['baseline-id']);
    await column.screenshot({ path: report.screenshot });

    const check = (text, passed, evidence) => {
      report.assertions.push({ text, passed, evidence });
    };
    check(
      'CLI-created annotation renders as Active',
      report.withSkill.state === 'Active',
      `state=${report.withSkill.state}`
    );
    check(
      'CLI-created annotation carries author claude',
      report.withSkill.author === 'claude',
      `author=${report.withSkill.author}`
    );
    check(
      'CLI-created annotation carries the Agent badge',
      report.withSkill.badges.includes('Agent'),
      `badges=${JSON.stringify(report.withSkill.badges)}`
    );
    check(
      'Baseline raw-line annotation renders as Outdated',
      report.baseline.state === 'Outdated' && report.baseline.outdatedAttribute === 'true',
      `state=${report.baseline.state} data-outdated=${report.baseline.outdatedAttribute}`
    );
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(options['out-dir'], 'browser-review.json'),
    `${JSON.stringify(report, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(report.assertions, null, 2)}\n`);
  process.exitCode = report.assertions.every((entry) => entry.passed) ? 0 : 1;
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
  process.exitCode = 2;
}
