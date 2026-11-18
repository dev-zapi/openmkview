import { createSignal } from 'solid-js';
import type { Annotation, AnnotationAnchor, AnnotationNote, ManagedAnnotation } from '../types';
import { api } from '../services/api';
import { offlineStore } from './offlineStore';
import { loadAnnotationsVisible, saveAnnotationsVisible } from '../utils/settings';

const [annotations, setAnnotations] = createSignal<Annotation[]>([]);
const [loading, setLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);
/** Project-wide rows for the annotation management panel. */
const [managed, setManaged] = createSignal<ManagedAnnotation[]>([]);
const [managedLoading, setManagedLoading] = createSignal<boolean>(false);
const [managedError, setManagedError] = createSignal<string | null>(null);
/** Includes a monotonic nonce so repeated jumps to the same entry register. */
const [jumpRequest, setJumpRequest] = createSignal<{ annotationId: number; nonce: number } | null>(
  null,
);
const [visible, setVisible] = createSignal<boolean>(loadAnnotationsVisible());

let loadedKey: string | null = null;
let currentProjectId: number | null = null;
let currentRelativePath: string | null = null;
let jumpNonce = 0;
/** A jump waiting for another file's annotations to load. */
let pendingJump: { projectId: number; relativePath: string; annotationId: number } | null = null;

function requestJumpNow(annotationId: number): void {
  jumpNonce += 1;
  setJumpRequest({ annotationId, nonce: jumpNonce });
}

function consumePendingJump(
  projectId: number,
  relativePath: string,
  loaded: Annotation[]
): void {
  if (
    !pendingJump ||
    pendingJump.projectId !== projectId ||
    pendingJump.relativePath !== relativePath
  ) {
    return;
  }
  const annotationId = pendingJump.annotationId;
  pendingJump = null;
  if (loaded.some((annotation) => annotation.id === annotationId)) {
    requestJumpNow(annotationId);
  }
}

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
  managed,
  managedLoading,
  managedError,
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
      if (loadedKey === key) {
        setAnnotations(loaded);
        consumePendingJump(projectId, relativePath, loaded);
      }
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
    pendingJump = null;
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

  /** Loads every annotation in the project for the management panel. */
  async loadForProject(projectId: number): Promise<void> {
    setManagedLoading(true);
    setManagedError(null);
    try {
      const loaded = await api.listProjectAnnotations(projectId);
      setManaged(loaded);
    } catch (err) {
      setManaged([]);
      setManagedError(err instanceof Error ? err.message : 'Failed to load annotations');
    } finally {
      setManagedLoading(false);
    }
  },

  /** Multi-select delete in one project. Updates both list surfaces in place. */
  async batchDelete(projectId: number, ids: number[]): Promise<void> {
    await api.batchDeleteAnnotations(projectId, ids);
    const removed = new Set(ids);
    setManaged((current) => current.filter((annotation) => !removed.has(annotation.id)));
    setAnnotations((current) => current.filter((annotation) => !removed.has(annotation.id)));
  },

  /** Multi-select Resolved toggle in one project. */
  async batchResolve(projectId: number, ids: number[], resolved: boolean): Promise<void> {
    await api.batchResolveAnnotations(projectId, ids, resolved);
    const updated = new Set(ids);
    const apply = <T extends Annotation>(list: T[]): T[] =>
      list.map((annotation) =>
        updated.has(annotation.id) ? { ...annotation, resolved } : annotation
      );
    setManaged(apply);
    setAnnotations(apply);
  },

  /** Deletes every annotation in the project after explicit confirmation. */
  async clearProject(projectId: number): Promise<void> {
    await api.clearProjectAnnotations(projectId);
    setManaged([]);
    setAnnotations([]);
  },

  /**
   * Asks the rendered document to scroll to and focus an annotation's anchor.
   * Multiple annotations may share a block, so lookup is list-based.
   */
  requestJump(annotationId: number): void {
    requestJumpNow(annotationId);
  },

  /**
   * Jump to an annotation in another file: open that file, then reveal the
   * annotation once its annotations finish loading. When the file is already
   * loaded the jump fires immediately.
   */
  requestJumpInFile(projectId: number, relativePath: string, annotationId: number): void {
    if (loadedKey === fileKey(projectId, relativePath)) {
      pendingJump = null;
      requestJumpNow(annotationId);
      return;
    }
    pendingJump = { projectId, relativePath, annotationId };
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
