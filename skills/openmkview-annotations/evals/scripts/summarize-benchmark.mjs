#!/usr/bin/env node
/**
 * Aggregate the per-run grading.json files into the benchmark.json /
 * benchmark.md shape the skill-creator viewer expects.
 *
 * Usage: summarize-benchmark.mjs RESULTS_DIR
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const resultsDir = process.argv[2];
if (!resultsDir) {
  process.stderr.write('usage: summarize-benchmark.mjs RESULTS_DIR\n');
  process.exit(2);
}

const configurations = ['with_skill', 'without_skill'];
const runs = [];
const notes = [];

const evalDirs = fs
  .readdirSync(resultsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

for (const [evalIndex, evalName] of evalDirs.entries()) {
  for (const configuration of configurations) {
    const gradingPath = path.join(resultsDir, evalName, configuration, 'grading.json');
    if (!fs.existsSync(gradingPath)) continue;
    const grading = JSON.parse(fs.readFileSync(gradingPath, 'utf8'));
    runs.push({
      eval_id: evalIndex,
      eval_name: evalName,
      configuration,
      run_number: 1,
      result: {
        pass_rate: grading.summary.pass_rate,
        passed: grading.summary.passed,
        failed: grading.summary.failed,
        total: grading.summary.total,
        time_seconds: null,
        tokens: null,
        tool_calls: null,
        errors: 0,
      },
      expectations: grading.expectations,
      notes: [],
    });
    if (grading.summary.failed > 0) {
      notes.push(
        `${evalName}/${configuration}: ${grading.summary.failed} failed assertion(s) — ${grading.expectations
          .filter((entry) => !entry.passed)
          .map((entry) => entry.text)
          .join('; ')}`
      );
    }
  }
}

function stats(values) {
  if (values.length === 0) return { mean: 0, stddev: 0, min: 0, max: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    mean,
    stddev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

const summary = {};
for (const configuration of configurations) {
  const passRates = runs
    .filter((run) => run.configuration === configuration)
    .map((run) => run.result.pass_rate);
  summary[configuration] = {
    pass_rate: stats(passRates),
    time_seconds: stats([]),
    tokens: stats([]),
  };
}
summary.delta = {
  pass_rate: (summary.with_skill.pass_rate.mean - summary.without_skill.pass_rate.mean).toFixed(2),
  time_seconds: 'n/a',
  tokens: 'n/a',
};

const benchmark = {
  metadata: {
    skill_name: 'openmkview-annotations',
    skill_path: 'skills/openmkview-annotations',
    executor_model: 'not-applicable (deterministic CLI vs raw HTTP harness)',
    analyzer_model: 'self-review',
    timestamp: new Date().toISOString(),
    evals_run: evalDirs,
    runs_per_configuration: 1,
  },
  runs,
  run_summary: summary,
  notes,
};

fs.writeFileSync(path.join(resultsDir, 'benchmark.json'), `${JSON.stringify(benchmark, null, 2)}\n`);

const lines = [
  '# openmkview-annotations eval benchmark',
  '',
  `| Eval | Configuration | Passed | Total | Pass rate |`,
  `|---|---|---|---|---|`,
];
for (const run of runs) {
  lines.push(
    `| ${run.eval_name} | ${run.configuration} | ${run.result.passed} | ${run.result.total} | ${(run.result.pass_rate * 100).toFixed(0)}% |`
  );
}
lines.push('');
lines.push(
  `**With skill:** ${(summary.with_skill.pass_rate.mean * 100).toFixed(0)}% mean pass rate  `
);
lines.push(
  `**Baseline:** ${(summary.without_skill.pass_rate.mean * 100).toFixed(0)}% mean pass rate  `
);
lines.push('');
if (notes.length > 0) {
  lines.push('## Notes');
  for (const note of notes) lines.push(`- ${note}`);
  lines.push('');
}

fs.writeFileSync(path.join(resultsDir, 'benchmark.md'), `${lines.join('\n')}\n`);
process.stdout.write(`wrote ${path.join(resultsDir, 'benchmark.json')}\n`);
