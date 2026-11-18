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
const [managedSelection, setManagedSelection] = createSignal<Set<number>>(new Set());
const [managedLoading, setManagedLoading] = createSignal<boolean>(false);
const [managedError, setManagedError] = createSignal<string | null>(null);
const [visible, setVisible] = createSignal<boolean>(loadAnnotationsVisible());
/**
 * Anchor resolution results published by the rendered document. Keyed by
 * annotation id, value is the text as originally anchored. An annotation is
 * Outdated exactly when it appears here.
 */
const [outdatedSnapshots, setOutdatedSnapshotsSignal] = createSignal<Map<number, string>>(
  new Map()
);
/** Annotation awaiting a fresh text selection for manual re-anchoring. */
const [reanchorTarget, setReanchorTarget] = createSignal<number | null>(null);
/**
 * A column request to open an annotation in the document's viewer. Outdated
 * annotations have no highlight to click, so this is their popover entry.
 */
const [viewRequest, setViewRequest] = createSignal<{
  annotationId: number;
  nonce: number;
  left: number;
  top: number;
} | null>(null);
/** Includes a monotonic nonce so repeated jumps to the same entry register. */
const [jumpRequest, setJumpRequest] = createSignal<{ annotationId: number; nonce: number } | null>(
  null,
);

let loadedKey: string | null = null;
let currentProjectId: number | null = null;
let currentRelativePath: string | null = null;
let jumpNonce = 0;
let viewNonce = 0;
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

/** Replace the management rows and drop selections for rows that vanished. */
function applyManaged(next: ManagedAnnotation[]): void {
  setManaged(next);
  const live = new Set(next.map((annotation) => annotation.id));
  setManagedSelection((current) => {
    const pruned = new Set([...current].filter((id) => live.has(id)));
    return pruned.size === current.size ? current : pruned;
  });
}

export const annotationStore = {
  annotations,
  loading,
  error,
  managed,
  managedSelection,
  managedLoading,
  managedError,
  visible,
  outdatedSnapshots,
  reanchorTarget,
  viewRequest,
  jumpRequest,

  /** Whether annotation writes may be attempted (connected only). */
  canMutate(): boolean {
    return offlineStore.online();
  },

  /** Publish the render pass's resolution results (called after every render). */
  setOutdatedSnapshots(snapshots: Map<number, string>): void {
    setOutdatedSnapshotsSignal(snapshots);
  },

  isOutdated(id: number): boolean {
    return outdatedSnapshots().has(id);
  },

  outdatedSnapshot(id: number): string | null {
    return outdatedSnapshots().get(id) ?? null;
  },

  /** Arm manual re-anchoring for an Outdated annotation. */
  startReanchor(id: number): void {
    setReanchorTarget(id);
  },

  cancelReanchor(): void {
    setReanchorTarget(null);
  },

  /** Ask the document viewer to open an annotation (Outdated column entry). */
  requestView(annotationId: number, left: number, top: number): void {
    viewNonce += 1;
    setViewRequest({ annotationId, nonce: viewNonce, left, top });
  },

  clearView(): void {
    setViewRequest(null);
  },

  toggleVisible(): void {
    applyVisibility(!visible());
  },

  /** Load annotations for the given file, deduplicating repeat calls. */
  async load(projectId: number, relativePath: string): Promise<void> {
    const key = fileKey(projectId, relativePath);
    if (key === loadedKey) return;

    // A pending cross-file jump only survives if this load is its target.
    if (
      pendingJump &&
      (pendingJump.projectId !== projectId || pendingJump.relativePath !== relativePath)
    ) {
      pendingJump = null;
    }

    loadedKey = key;
    currentProjectId = projectId;
    currentRelativePath = relativePath;
    // Never let the previous file's annotations, an armed re-anchor, or a
    // pending viewer request survive into the new file: re-anchoring must
    // only ever write the annotation it was armed for in the same file.
    setAnnotations([]);
    setJumpRequest(null);
    setReanchorTarget(null);
    setViewRequest(null);
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
        // A failed target load must not leave a jump armed for some later,
        // unrelated open of the same path.
        pendingJump = null;
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
    setOutdatedSnapshotsSignal(new Map());
    setReanchorTarget(null);
    setJumpRequest(null);
    setViewRequest(null);
    setLoading(false);
    setError(null);
    applyManaged([]);
    setManagedLoading(false);
    setManagedError(null);
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
    setOutdatedSnapshotsSignal((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  },

  /**
   * Manual re-anchoring: attach an Outdated annotation to a freshly selected
   * range. The server returns the updated annotation; its previous Outdated
   * status is cleared locally so the badge disappears immediately.
   */
  async reanchor(id: number, anchor: AnnotationAnchor): Promise<Annotation> {
    // Belt and braces: never write an anchor onto an annotation that is no
    // longer part of the currently loaded file (for example after a fast
    // file switch that left a stale re-anchor armed).
    const current = annotations().find((annotation) => annotation.id === id);
    if (
      !current ||
      current.projectId !== currentProjectId ||
      current.relativePath !== currentRelativePath
    ) {
      setReanchorTarget(null);
      throw new Error('Annotation is no longer available in this file');
    }

    const updated = await api.reanchorAnnotation(id, anchor);
    setAnnotations((current) =>
      current.map((annotation) => (annotation.id === id ? updated : annotation))
    );
    setOutdatedSnapshotsSignal((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    setReanchorTarget(null);
    return updated;
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
      applyManaged(loaded);
    } catch (err) {
      applyManaged([]);
      setManagedError(err instanceof Error ? err.message : 'Failed to load annotations');
    } finally {
      setManagedLoading(false);
    }
  },

  /** Adds or removes one management row from the current selection. */
  toggleManagedSelection(id: number): void {
    setManagedSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  },

  /** Selects every management row, or clears the selection when all are selected. */
  toggleManagedSelectionAll(): void {
    setManagedSelection((current) =>
      current.size === managed().length
        ? new Set<number>()
        : new Set(managed().map((annotation) => annotation.id)),
    );
  },

  clearManagedSelection(): void {
    setManagedSelection(new Set<number>());
  },

  /** Multi-select delete in one project. Updates both list surfaces in place. */
  async batchDelete(projectId: number, ids: number[]): Promise<void> {
    await api.batchDeleteAnnotations(projectId, ids);
    const removed = new Set(ids);
    applyManaged(managed().filter((annotation) => !removed.has(annotation.id)));
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
    applyManaged(apply(managed()));
    setAnnotations(apply);
  },

  /** Deletes every annotation in the project after explicit confirmation. */
  async clearProject(projectId: number): Promise<void> {
    await api.clearProjectAnnotations(projectId);
    applyManaged([]);
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

  /**
   * Drops an armed cross-file jump when the requested open never happened
   * (dirty-document cancel or load failure). Passing a path only cancels the
   * pending jump aimed at that path.
   */
  cancelPendingJump(relativePath?: string): void {
    if (!pendingJump) return;
    if (relativePath !== undefined && pendingJump.relativePath !== relativePath) return;
    pendingJump = null;
  },

  /** All annotations whose Anchor references the given block, in list order. */
  annotationsForBlock(blockHash: string): Annotation[] {
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

  /** Alias for annotationsForBlock: both return every matching annotation. */
  byBlockHash(blockHash: string): Annotation[] {
    return annotationStore.annotationsForBlock(blockHash);
  },

  /** Clears a handled jump so a remount cannot replay it. */
  clearJump(): void {
    setJumpRequest(null);
  },

  /** All note bodies for a thread, in time order (the API already orders them). */
  notesFor(annotationId: number): AnnotationNote[] {
    return annotations().find((annotation) => annotation.id === annotationId)?.notes ?? [];
  },
};

export default annotationStore;
