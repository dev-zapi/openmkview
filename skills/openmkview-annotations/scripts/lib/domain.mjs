/* Pure domain helpers for the omk CLI: project rows, project containment,
 * and thread freshness. This module holds no config, HTTP, prompt, or cursor
 * state, so it can be imported by both the transport layer and the command
 * layer without dragging either one in.
 */

import path from 'node:path';

/**
 * GET /api/projects rows are the one snake_case surface the CLI touches
 * (`created_at`, `last_opened_at`, `is_open`); every other endpoint is
 * camelCase. Normalize once at the boundary so callers see one shape.
 */
function normalizeProject(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isOpen: Boolean(row.is_open),
    createdAt: row.created_at ?? null,
    lastOpenedAt: row.last_opened_at ?? null,
    color: row.color ?? null,
    icon: row.icon ?? null,
  };
}

/**
 * True when `absolute` is `root` itself or nested beneath it. Both paths must
 * already be absolute; comparing with the separator keeps `/a/bc` out of
 * `/a/b`.
 */
function isPathUnder(root, absolute) {
  return absolute === root || absolute.startsWith(`${root}${path.sep}`);
}

/**
 * Every registered project that contains `directory` — its root or an
 * ancestor — deepest first, each tagged with `relation`: "root" when the
 * directory is the project root, "inside" when it is nested under it. An
 * empty array means the directory is not registered on this instance.
 */
function projectMatchesFor(directory, projects) {
  const absolute = path.resolve(String(directory));
  const matches = [];
  for (const project of projects) {
    const root = path.resolve(project.path);
    if (!isPathUnder(root, absolute)) continue;
    matches.push({
      project,
      relation: absolute === root ? 'root' : 'inside',
      depth: root.length,
    });
  }
  matches.sort((left, right) => right.depth - left.depth);
  return matches.map(({ project, relation }) => ({ project, relation }));
}

function projectChoices(projects) {
  return projects
    .map((project) => `${project.id} ${project.name} (${project.path})`)
    .join('; ');
}

/**
 * Timestamps arrive either as ISO 8601 or as SQLite UTC strings with a space
 * separator ("2026-11-18 12:46:41"); both parse to epoch milliseconds, and an
 * unparseable value reads as 0 so a bad row never filters everything out.
 */
function parseTimestamp(value) {
  if (!value) return 0;
  const trimmed = String(value).trim();
  const normalized = trimmed.replace(' ', 'T');
  const hasZone = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const parsed = Date.parse(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Epoch of the newest note of activity in a thread: the thread's creation or
 * any note's creation, whichever is latest. This — not updatedAt — defines
 * "new" for --new/--since, so resolves and re-anchors do not resurface a
 * thread.
 */
function latestThreadActivity(row) {
  const times = [parseTimestamp(row?.createdAt)];
  for (const note of row?.notes ?? []) {
    times.push(parseTimestamp(note?.createdAt));
  }
  return Math.max(...times);
}

/**
 * A thread is unseen when it was created, or any note in it was appended,
 * after the cutoff: a human reply to an old thread counts as new feedback.
 */
function isThreadNewSince(row, cutoffMs) {
  if (parseTimestamp(row?.createdAt) > cutoffMs) return true;
  return (row?.notes ?? []).some(
    (note) => parseTimestamp(note?.createdAt) > cutoffMs
  );
}

export {
  isPathUnder,
  isThreadNewSince,
  latestThreadActivity,
  normalizeProject,
  parseTimestamp,
  projectChoices,
  projectMatchesFor,
};
