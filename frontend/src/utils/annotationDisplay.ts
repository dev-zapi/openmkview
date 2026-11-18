import type { Annotation, AnnotationNote } from '../types';
import { anchorExcerpt } from './anchorScoring';

/**
 * The text an annotation is anchored to, for compact list surfaces. When the
 * anchor is Outdated, its originally anchored snapshot is shown instead.
 */
export function annotationExcerpt(
  annotation: Annotation,
  outdatedSnapshot?: string | null
): string {
  const snapshot = outdatedSnapshot?.trim();
  if (snapshot) return snapshot;
  return anchorExcerpt(annotation.anchor) || annotation.snapshot?.trim() || 'Anchored content';
}

/** First note body, condensed for the management table. */
export function annotationNotePreview(annotation: Annotation): string {
  const body = annotation.notes[0]?.body?.trim();
  return body || 'No note text';
}

/** Short label for the thread state, including its Outdated flag. */
export function annotationState(
  annotation: Annotation,
  outdated: boolean
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

/** The one localized rendering for every Annotation timestamp. */
export function formatAnnotationTimestamp(value: string): string {
  const date = parseAnnotationTimestamp(value);
  return date ? date.toLocaleString() : value;
}

/** Display timestamp for the management table. */
export function annotationTime(annotation: Annotation): string {
  return formatAnnotationTimestamp(annotation.updatedAt || annotation.createdAt);
}

/** Display timestamp for one note in a thread. */
export function annotationNoteTime(note: AnnotationNote): string {
  return formatAnnotationTimestamp(note.createdAt);
}
