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
export function annotationState(annotation: Annotation): {
  label: 'Active' | 'Resolved';
  outdated: boolean;
} {
  return {
    label: annotation.resolved ? 'Resolved' : 'Active',
    outdated: annotation.outdated === true,
  };
}

/** Display timestamp for the management table. */
export function annotationTime(annotation: Annotation): string {
  const value = annotation.updatedAt || annotation.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
