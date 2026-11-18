import { createSignal } from 'solid-js';
import type { Annotation, AnnotationAnchor, AnnotationNote } from '../types';
import { api } from '../services/api';
import { offlineStore } from './offlineStore';
import { loadAnnotationsVisible, saveAnnotationsVisible } from '../utils/settings';

const [annotations, setAnnotations] = createSignal<Annotation[]>([]);
const [loading, setLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);
/** Includes a monotonic nonce so repeated jumps to the same entry register. */
const [jumpRequest, setJumpRequest] = createSignal<{ annotationId: number; nonce: number } | null>(
  null,
);
const [visible, setVisible] = createSignal<boolean>(loadAnnotationsVisible());

let loadedKey: string | null = null;
let currentProjectId: number | null = null;
let currentRelativePath: string | null = null;
let jumpNonce = 0;

function applyVisibility(nextVisible: boolean): void {
  setVisible(nextVisible);
  saveAnnotationsVisible(nextVisible);
}

function fileKey(projectId: number, relativePath: string): string {
  return `${projectId}\u0000${relativePath}`;
}

function replaceAnnotation(updated: Annotation): void {
  setAnnotations((current) =>
    current.map((annotation) => (annotation.id === updated.id ? updated : annotation)),
  );
}

export const annotationStore = {
  annotations,
  loading,
  error,
  jumpRequest,
  visible,

  /** Whether annotation writes may be attempted (connected only). */
  canMutate(): boolean {
    return offlineStore.online();
  },

  toggleVisible(): void {
    applyVisibility(!visible());
  },

  /** Load annotations for the given file, deduplicating repeat calls. */
  async load(projectId: number, relativePath: string): Promise<void> {
    const key = fileKey(projectId, relativePath);
    if (key === loadedKey) return;

    loadedKey = key;
    currentProjectId = projectId;
    currentRelativePath = relativePath;
    // Never let the previous file's annotations survive into the new file,
    // even for the few milliseconds before the fetch resolves.
    setAnnotations([]);
    setJumpRequest(null);
    setLoading(true);
    setError(null);

    try {
      const loaded = await api.listAnnotations(projectId, relativePath);
      // A slower response for a previous file must not overwrite the current one.
      if (loadedKey === key) setAnnotations(loaded);
    } catch (err) {
      if (loadedKey === key) {
        setAnnotations([]);
        setError(err instanceof Error ? err.message : 'Failed to load annotations');
      }
    } finally {
      if (loadedKey === key) setLoading(false);
    }
  },

  reset(): void {
    loadedKey = null;
    currentProjectId = null;
    currentRelativePath = null;
    setAnnotations([]);
    setJumpRequest(null);
    setLoading(false);
    setError(null);
  },

  async create(
    projectId: number,
    relativePath: string,
    anchor: AnnotationAnchor,
    body: string
  ): Promise<Annotation> {
    const created = await api.createAnnotation({ projectId, relativePath, anchor, body });
    if (loadedKey === fileKey(projectId, relativePath)) {
      setAnnotations((current) => [...current, created]);
    }
    return created;
  },

  async remove(id: number): Promise<void> {
    await api.deleteAnnotation(id);
    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
  },

  /** All annotations whose Anchor references the given block, in list order. */
  byBlockHash(blockHash: string): Annotation[] {
    return annotations().filter(
      (annotation) =>
        annotation.projectId === currentProjectId &&
        annotation.relativePath === currentRelativePath &&
        annotation.anchor?.segments?.some(
          (segment) =>
            (segment.kind === 'block' || segment.kind === 'text') &&
            segment.blockHash === blockHash
        )
    );
  },

  /** Appends a Reply to the thread and keeps the list in sync. */
  async appendNote(annotationId: number, body: string): Promise<Annotation> {
    const updated = await api.addAnnotationNote(annotationId, body);
    replaceAnnotation(updated);
    return updated;
  },

  /** Rewrites one note body in the thread. */
  async updateNote(annotationId: number, noteId: number, body: string): Promise<Annotation> {
    const updated = await api.updateAnnotationNote(annotationId, noteId, body);
    replaceAnnotation(updated);
    return updated;
  },

  /** Sets the thread-level Resolved flag. */
  async setResolved(annotationId: number, resolved: boolean): Promise<Annotation> {
    const updated = await api.setAnnotationResolved(annotationId, resolved);
    replaceAnnotation(updated);
    return updated;
  },

  /**
   * Asks the rendered document to scroll to and focus an annotation's anchor.
   * Multiple annotations may share a block, so lookup is list-based.
   */
  requestJump(annotationId: number): void {
    jumpNonce += 1;
    setJumpRequest({ annotationId, nonce: jumpNonce });
  },

  /** Clears a handled jump so a remount cannot replay it. */
  clearJump(): void {
    setJumpRequest(null);
  },

  annotationsForBlock(blockHash: string): Annotation[] {
    return annotationStore.byBlockHash(blockHash);
  },

  /** All note bodies for a thread, in time order (the API already orders them). */
  notesFor(annotationId: number): AnnotationNote[] {
    return annotations().find((annotation) => annotation.id === annotationId)?.notes ?? [];
  },
};

export default annotationStore;
