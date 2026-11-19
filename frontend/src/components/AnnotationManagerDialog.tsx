import { Component, For, Show, createEffect, createSignal } from 'solid-js';
import type { ManagedAnnotation } from '../types';
import { annotationStore } from '../stores/annotationStore';
import {
  annotationExcerpt,
  annotationNotePreview,
  annotationState,
  annotationTime,
} from '../utils/annotationDisplay';
import { Dialog, DialogContent } from './ui';

interface AnnotationManagerDialogProps {
  isOpen: boolean;
  projectId?: number;
  currentFilePath: string | null;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
}

/**
 * The rendered file publishes canonical status; every other row is resolved
 * lazily by the store against its own file's content.
 */
function isRowOutdated(row: ManagedAnnotation): boolean {
  if (annotationStore.isOutdated(row.id)) return true;
  if (
    annotationStore.isLoadedFile(row.projectId, row.relativePath) &&
    annotationStore.previewOutdatedResolved()
  ) {
    return false;
  }
  return annotationStore.isManagedOutdated(row.id);
}

function outdatedSnapshot(row: ManagedAnnotation): string | null {
  return (
    annotationStore.outdatedSnapshot(row.id) ??
    annotationStore.managedOutdatedSnapshot(row.id)
  );
}

/**
 * Project-wide management fallback for annotations (#22). Lists every row in
 * the Active Project — including Outdated and Missing File ones — and offers
 * batch Resolved changes, batch delete, and a confirmed clear-all.
 */
const AnnotationManagerDialog: Component<AnnotationManagerDialogProps> = (props) => {
  const [pending, setPending] = createSignal(false);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [confirmClear, setConfirmClear] = createSignal(false);
  const [authorFilter, setAuthorFilter] = createSignal('');

  const rows = () => annotationStore.managed();
  const selected = () => annotationStore.managedSelection();
  const canMutate = () => annotationStore.canMutate();

  // User-story #7: narrow the loaded rows client-side. A row matches when any
  // of its notes was written by an author containing the query.
  const visibleRows = () => {
    const query = authorFilter().trim().toLowerCase();
    if (!query) return rows();
    return rows().filter((row) =>
      row.notes.some((note) => (note.author ?? '').toLowerCase().includes(query)),
    );
  };

  const selectedRows = () => rows().filter((row) => selected().has(row.id));
  const allSelectedResolved = () => {
    const chosen = selectedRows();
    return chosen.length > 0 && chosen.every((row) => row.resolved);
  };

  createEffect(() => {
    if (props.isOpen && props.projectId !== undefined) {
      void annotationStore.loadForProject(props.projectId);
    }
  });

  const toggleRow = (id: number) => {
    annotationStore.toggleManagedSelection(id);
  };

  const allSelected = () => {
    const visible = visibleRows();
    return visible.length > 0 && visible.every((row) => selected().has(row.id));
  };

  const toggleAll = () => {
    annotationStore.toggleManagedSelectionAll(visibleRows().map((row) => row.id));
  };

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Annotation action failed');
    } finally {
      setPending(false);
    }
  };

  const toggleResolved = () => {
    const projectId = props.projectId;
    const ids = selectedRows().map((row) => row.id);
    if (projectId === undefined || ids.length === 0) return;
    const resolved = !allSelectedResolved();
    void run(async () => {
      await annotationStore.batchResolve(projectId, ids, resolved);
      annotationStore.clearManagedSelection();
    });
  };

  const deleteSelected = () => {
    const projectId = props.projectId;
    const ids = selectedRows().map((row) => row.id);
    if (projectId === undefined || ids.length === 0) return;
    void run(async () => {
      await annotationStore.batchDelete(projectId, ids);
      annotationStore.clearManagedSelection();
    });
  };

  const clearAll = () => {
    const projectId = props.projectId;
    if (projectId === undefined) return;
    void run(async () => {
      await annotationStore.clearProject(projectId);
      annotationStore.clearManagedSelection();
      setConfirmClear(false);
    });
  };

  const jump = (row: ManagedAnnotation) => {
    if (row.missingFile || isRowOutdated(row)) return;
    annotationStore.requestJumpInFile(row.projectId, row.relativePath, row.id);
    if (row.relativePath !== props.currentFilePath) {
      // A cancelled/failed open cancels this pending jump inside useFile.
      props.onOpenFile?.(row.relativePath);
    }
    props.onClose();
  };

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent
        aria-label="Manage annotations"
        class="annotation-manager-dialog"
        style={{ 'max-width': 'min(980px, calc(100vw - 32px))', 'max-height': '82vh' }}
      >
        <div class="annotation-manager-header">
          <div>
            <h2>Manage annotations</h2>
            <p class="annotation-manager-subtitle">
              {authorFilter().trim()
                ? `${visibleRows().length} of ${rows().length}`
                : rows().length}{' '}
              {rows().length === 1 ? 'annotation' : 'annotations'} in this project
            </p>
          </div>
          <button
            type="button"
            class="annotation-manager-close"
            aria-label="Close manage annotations"
            onClick={props.onClose}
          >
            ×
          </button>
        </div>

        <div class="annotation-manager-filter">
          <label for="annotation-manager-author-filter">Author</label>
          <input
            id="annotation-manager-author-filter"
            type="search"
            placeholder="Filter by author"
            value={authorFilter()}
            onInput={(event) => setAuthorFilter(event.currentTarget.value)}
          />
        </div>

        <Show when={annotationStore.managedLoading()}>
          <p class="annotation-manager-empty">Loading annotations…</p>
        </Show>

        <Show when={annotationStore.managedError()}>
          <p class="annotation-error" role="alert">
            {annotationStore.managedError()}
          </p>
        </Show>

        <Show
          when={!annotationStore.managedLoading() && rows().length > 0}
          fallback={
            <Show when={!annotationStore.managedLoading() && !annotationStore.managedError()}>
              <p class="annotation-manager-empty">No annotations in this project</p>
            </Show>
          }
        >
          <Show
            when={visibleRows().length > 0}
            fallback={
              <p class="annotation-manager-empty">No annotations match this author</p>
            }
          >
          <div class="annotation-manager-table-wrap">
            <table class="annotation-manager-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Select all annotations"
                      checked={allSelected()}
                      onChange={toggleAll}
                    />
                  </th>
                  <th scope="col">File</th>
                  <th scope="col">Anchored excerpt</th>
                  <th scope="col">Note</th>
                  <th scope="col">State</th>
                  <th scope="col">Time</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                <For each={visibleRows()}>
                  {(row) => {
                    // A function: project-wide Outdated resolution fills in
                    // progressively, so the state cell must stay reactive.
                    const state = () => annotationState(row, isRowOutdated(row));
                    return (
                      <tr
                        class={
                          row.missingFile ? 'annotation-manager-row-missing-file' : ''
                        }
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select annotation in ${row.relativePath}`}
                            checked={selected().has(row.id)}
                            onChange={() => toggleRow(row.id)}
                          />
                        </td>
                        <td class="annotation-manager-file">{row.relativePath}</td>
                        <td class="annotation-manager-excerpt">
                          {annotationExcerpt(row, outdatedSnapshot(row))}
                        </td>
                        <td class="annotation-manager-note">{annotationNotePreview(row)}</td>
                        <td>
                          <span
                            class={`annotation-state ${
                              state().outdated
                                ? 'outdated'
                                : row.resolved
                                  ? 'resolved'
                                  : ''
                            }`}
                          >
                            {state().label}
                          </span>
                          <Show when={state().outdated}>
                            <span class="annotation-manager-badge">Outdated</span>
                          </Show>
                        </td>
                        <td class="annotation-manager-time">{annotationTime(row)}</td>
                        <td>
                          <Show
                            when={!row.missingFile}
                            fallback={
                              <span class="annotation-manager-missing-file">
                                File missing — cannot jump
                              </span>
                            }
                          >
                            <Show
                              when={!state().outdated}
                              fallback={
                                <span class="annotation-manager-outdated">
                                  Outdated — cannot locate text
                                </span>
                              }
                            >
                              <button
                                type="button"
                                class="annotation-manager-link"
                                onClick={() => jump(row)}
                              >
                                Jump
                              </button>
                            </Show>
                          </Show>
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
          </Show>
        </Show>

        <Show when={!canMutate()}>
          <p class="annotation-offline-note">Read-only while offline</p>
        </Show>

        <Show when={actionError()}>
          <p class="annotation-error" role="alert">
            {actionError()}
          </p>
        </Show>

        <div class="annotation-manager-toolbar">
          <span class="annotation-manager-selection">{selected().size} selected</span>
          <button
            type="button"
            class="annotation-action-secondary"
            disabled={pending() || !canMutate() || selected().size === 0}
            onClick={toggleResolved}
          >
            {allSelectedResolved() ? 'Unresolve selected' : 'Resolve selected'}
          </button>
          <button
            type="button"
            class="annotation-action-danger"
            disabled={pending() || !canMutate() || selected().size === 0}
            onClick={deleteSelected}
          >
            Delete selected
          </button>
          <button
            type="button"
            class="annotation-action-danger"
            disabled={pending() || !canMutate() || rows().length === 0}
            onClick={() => setConfirmClear(true)}
          >
            Clear all annotations…
          </button>
        </div>

        <Show when={confirmClear()}>
          <div
            class="annotation-manager-confirm"
            role="group"
            aria-label="Confirm clear all annotations"
          >
            <p>
              Delete all {rows().length} annotations in this project? This cannot be undone.
            </p>
            <div class="annotation-popover-actions">
              <button
                type="button"
                class="annotation-action-secondary"
                disabled={pending()}
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="annotation-action-danger"
                disabled={pending() || !canMutate()}
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
          </div>
        </Show>
      </DialogContent>
    </Dialog>
  );
};

export default AnnotationManagerDialog;
