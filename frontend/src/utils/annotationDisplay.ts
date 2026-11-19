import type { Annotation } from '../types';
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
