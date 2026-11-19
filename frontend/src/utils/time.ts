/**
 * Parse a stored timestamp. SQLite's `datetime('now')` emits
 * `YYYY-MM-DD HH:MM:SS` in UTC without a zone designator; parsing that with
 * `new Date()` would treat it as local time, so normalize it to ISO UTC.
 */
export function parseTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  const normalized = sqliteUtc.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The one localized rendering for every timestamp in the app. */
export function formatTimestamp(value: string): string {
  const date = parseTimestamp(value);
  return date ? date.toLocaleString() : value;
}
