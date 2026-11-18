import { createSignal } from 'solid-js';
import type { Annotation, AnnotationAnchor, ManagedAnnotation } from '../types';
import { authStore } from './authStore';
import { api } from '../services/api';
import { offlineStore } from './offlineStore';
import { hashBlockContent } from '../utils/blockModel';
import { locateAnchorInSource } from '../utils/sourceAnchorLocator';
import { loadAnnotationsVisible, saveAnnotationsVisible } from '../utils/settings';

const [annotations, setAnnotations] = createSignal<Annotation[]>([]);
const [loading, setLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);
/** Project-wide rows for the annotation management panel. */
const [managed, setManaged] = createSignal<ManagedAnnotation[]>([]);
const [managedSelection, setManagedSelection] = createSignal<Set<number>>(new Set());
const [managedLoading, setManagedLoading] = createSignal<boolean>(false);
const [managedError, setManagedError] = createSignal<string | null>(null);
/**
 * Project-wide Outdated snapshots for management rows, resolved lazily from
 * each row's file content. Keyed by annotation id; value is the snapshot.
 */
const [managedOutdated, setManagedOutdated] = createSignal<Map<number, string>>(new Map());
const [visible, setVisible] = createSignal<boolean>(loadAnnotationsVisible());
/**
 * Anchor resolution results published by the rendered document. Keyed by
 * annotation id, value is the text as originally anchored. An annotation is
 * Outdated exactly when it appears here.
 */
const [outdatedSnapshots, setOutdatedSnapshotsSignal] = createSignal<Map<number, string>>(
  new Map()
);
/**
 * True once the rendered Preview model has resolved status for the current
 * file. The Preview is the canonical decision surface; the Source echo must
 * never overwrite its map (see `publishSourceOutdatedSnapshots`).
 */
const [previewOutdatedResolved, setPreviewOutdatedResolved] = createSignal(false);
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
/** Guards the lazily filled management Outdated map against stale opens. */
let managedResolveToken = 0;
/**
 * Project-wide resolution cache keyed by (project, path, content), so
 * unchanged content is not re-resolved when the manager reopens.
 */
const managedOutdatedCache = new Map<string, Map<number, string>>();

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

function managedContentKey(
  projectId: number,
  relativePath: string,
  content: string
): string {
  return `${fileKey(projectId, relativePath)}\u0000${content.length}\u0000${hashBlockContent(content)}`;
}

/**
 * Fill Outdated state for every management row from its own file's content.
 * Lazy and progressive: each file resolves independently and the table fills
 * as responses arrive. Missing files are skipped because the row's Missing
 * File state already explains why its Anchor cannot be evaluated.
 */
async function resolveManagedOutdated(
  projectId: number,
  rows: ManagedAnnotation[],
  token: number
): Promise<void> {
  const byPath = new Map<string, ManagedAnnotation[]>();
  for (const row of rows) {
    if (row.missingFile) continue;
    const entries = byPath.get(row.relativePath) ?? [];
    entries.push(row);
    byPath.set(row.relativePath, entries);
  }

  await Promise.all(
    [...byPath.entries()].map(async ([relativePath, fileRows]) => {
      try {
        const file = await api.getFileContent(relativePath, projectId);
        if (token !== managedResolveToken) return;

        const cacheKey = managedContentKey(projectId, relativePath, file.content);
        let snapshots = managedOutdatedCache.get(cacheKey);
        if (!snapshots) {
          snapshots = new Map<number, string>();
          for (const row of fileRows) {
            const location = locateAnchorInSource(file.content, row.anchor);
            if (location.status === 'outdated') {
              snapshots.set(row.id, row.snapshot?.trim() || location.snapshot);
            }
          }
          managedOutdatedCache.set(cacheKey, snapshots);
        }

        if (token !== managedResolveToken || snapshots.size === 0) return;
        setManagedOutdated((current) => {
          const next = new Map(current);
          for (const [id, snapshot] of snapshots!) next.set(id, snapshot);
          return next;
        });
      } catch {
        // A vanished/unreadable file stays unresolved here; its row already
        // carries the Missing File state from the management list.
      }
    })
  );
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

/**
 * The one local removal path for delete, batch delete, and clear-all: every
 * list surface and the Outdated map are pruned together. Passing null means
 * "everything".
 */
function removeLocally(ids: ReadonlySet<number> | null): void {
  if (ids === null) {
    setAnnotations([]);
    applyManaged([]);
    setOutdatedSnapshotsSignal(new Map());
    setManagedOutdated(new Map());
    return;
  }

  setAnnotations((current) => current.filter((annotation) => !ids.has(annotation.id)));
  applyManaged(managed().filter((annotation) => !ids.has(annotation.id)));
  setOutdatedSnapshotsSignal((current) => {
    if (![...ids].some((id) => current.has(id))) return current;
    const next = new Map(current);
    for (const id of ids) next.delete(id);
    return next;
  });
  setManagedOutdated((current) => {
    if (![...ids].some((id) => current.has(id))) return current;
    const next = new Map(current);
    for (const id of ids) next.delete(id);
    return next;
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
  managedOutdated,
  visible,
  outdatedSnapshots,
  previewOutdatedResolved,
  reanchorTarget,
  viewRequest,
  jumpRequest,

  /** Whether annotation writes may be attempted (connected only). */
  canMutate(): boolean {
    return offlineStore.online();
  },

  /** Publish the rendered Preview's canonical resolution results. */
  setOutdatedSnapshots(snapshots: Map<number, string>): void {
    setOutdatedSnapshotsSignal(snapshots);
    setPreviewOutdatedResolved(true);
  },

  /**
   * Publish Source-locator status only when no Preview model has decided the
   * current file. On a tab switch the Preview map stays canonical, so the
   * independent column can never flip state because the Source projection is
   * coarser than the rendered block model.
   */
  publishSourceOutdatedSnapshots(snapshots: Map<number, string>): void {
    if (previewOutdatedResolved()) return;
    setOutdatedSnapshotsSignal(snapshots);
  },

  /**
   * The file content changed (in-app save, reload, or external load): the
   * rendered Preview's status map describes the old content. Drop it so the
   * next view to resolve (Preview or Source) becomes authoritative instead of
   * carrying pre-edit Active/Outdated decisions into the new content.
   */
  invalidateOutdatedStatus(): void {
    setOutdatedSnapshotsSignal(new Map());
    setPreviewOutdatedResolved(false);
  },

  isOutdated(id: number): boolean {
    return outdatedSnapshots().has(id);
  },

  outdatedSnapshot(id: number): string | null {
    return outdatedSnapshots().get(id) ?? null;
  },

  /** Whether the management resolution found the row's Anchor Outdated. */
  isManagedOutdated(id: number): boolean {
    return managedOutdated().has(id);
  },

  managedOutdatedSnapshot(id: number): string | null {
    return managedOutdated().get(id) ?? null;
  },

  /** Whether the given file is the one whose annotations are loaded. */
  isLoadedFile(projectId: number, relativePath: string): boolean {
    return loadedKey === fileKey(projectId, relativePath);
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
    setOutdatedSnapshotsSignal(new Map());
    setPreviewOutdatedResolved(false);
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
    setPreviewOutdatedResolved(false);
    setReanchorTarget(null);
    setJumpRequest(null);
    setViewRequest(null);
    setLoading(false);
    setError(null);
    applyManaged([]);
    setManagedLoading(false);
    setManagedError(null);
    managedResolveToken += 1;
    setManagedOutdated(new Map());
    managedOutdatedCache.clear();
  },

  async create(
    projectId: number,
    relativePath: string,
    anchor: AnnotationAnchor,
    body: string
  ): Promise<Annotation> {
    const created = await api.createAnnotation({
      projectId,
      relativePath,
      anchor,
      body,
      author: authStore.username(),
      isAgent: false,
    });
    if (loadedKey === fileKey(projectId, relativePath)) {
      setAnnotations((current) => [...current, created]);
    }
    return created;
  },

  async remove(id: number): Promise<void> {
    await api.deleteAnnotation(id);
    removeLocally(new Set([id]));
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
    const updated = await api.addAnnotationNote(
      annotationId,
      body,
      authStore.username()
    );
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
    const token = ++managedResolveToken;
    setManagedLoading(true);
    setManagedError(null);
    setManagedOutdated(new Map());
    try {
      const loaded = await api.listProjectAnnotations(projectId);
      if (token !== managedResolveToken) return;
      applyManaged(loaded);
      // Progressive: rows render immediately, Outdated fills per file.
      void resolveManagedOutdated(projectId, loaded, token);
    } catch (err) {
      if (token !== managedResolveToken) return;
      applyManaged([]);
      setManagedError(err instanceof Error ? err.message : 'Failed to load annotations');
    } finally {
      if (token === managedResolveToken) setManagedLoading(false);
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
    removeLocally(new Set(ids));
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
    removeLocally(null);
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

  /** Clears a handled jump so a remount cannot replay it. */
  clearJump(): void {
    setJumpRequest(null);
  },
};

export default annotationStore;
