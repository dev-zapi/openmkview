import type { Annotation } from '../types';

/** The text an annotation is anchored to, for compact list surfaces. */
export function annotationExcerpt(annotation: Annotation): string {
  const parts = (annotation.anchor?.segments ?? [])
    .map((segment) => (segment.kind === 'text' ? segment.quote : segment.blockText))
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.join(' … ') || annotation.snapshot?.trim() || 'Anchored content';
}

/** First note body, condensed for the management table. */
export function annotationNotePreview(annotation: Annotation): string {
  const body = annotation.notes[0]?.body?.trim();
  return body || 'No note text';
}

/** Short label for the thread state, including the optional Outdated flag. */
export function annotationState(
  annotation: Annotation,
  outdated = annotation.outdated === true
): {
  label: 'Active' | 'Resolved';
  outdated: boolean;
} {
  return {
    label: annotation.resolved ? 'Resolved' : 'Active',
    outdated,
  };
}

/**
 * Parse a stored annotation timestamp. SQLite's `datetime('now')` emits
 * `YYYY-MM-DD HH:MM:SS` in UTC without a zone designator; parsing that with
 * `new Date()` would treat it as local time, so normalize it to ISO UTC.
 */
export function parseAnnotationTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  const normalized = sqliteUtc.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Display timestamp for the management table. */
export function annotationTime(annotation: Annotation): string {
  const value = annotation.updatedAt || annotation.createdAt;
  const date = parseAnnotationTimestamp(value);
  return date ? date.toLocaleString() : value;
}
