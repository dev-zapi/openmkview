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

const emptySelection = () => new Set<number>();

/**
 * Project-wide management fallback for annotations (#22). Lists every row in
 * the Active Project — including Outdated and path-orphaned ones — and offers
 * batch Resolved changes, batch delete, and a confirmed clear-all.
 */
const AnnotationManagerDialog: Component<AnnotationManagerDialogProps> = (props) => {
  const [selected, setSelected] = createSignal<Set<number>>(emptySelection());
  const [pending, setPending] = createSignal(false);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [confirmClear, setConfirmClear] = createSignal(false);

  const rows = () => annotationStore.managed();
  const canMutate = () => annotationStore.canMutate();

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

  // Drop selections that no longer exist after a refresh or mutation.
  createEffect(() => {
    const live = new Set(rows().map((row) => row.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => live.has(id)));
      return next.size === current.size ? current : next;
    });
  });

  const toggleRow = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = () => rows().length > 0 && selected().size === rows().length;

  const toggleAll = () => {
    setSelected(allSelected() ? emptySelection() : new Set(rows().map((row) => row.id)));
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
      setSelected(emptySelection());
    });
  };

  const deleteSelected = () => {
    const projectId = props.projectId;
    const ids = selectedRows().map((row) => row.id);
    if (projectId === undefined || ids.length === 0) return;
    void run(async () => {
      await annotationStore.batchDelete(projectId, ids);
      setSelected(emptySelection());
    });
  };

  const clearAll = () => {
    const projectId = props.projectId;
    if (projectId === undefined) return;
    void run(async () => {
      await annotationStore.clearProject(projectId);
      setSelected(emptySelection());
      setConfirmClear(false);
    });
  };

  const jump = (row: ManagedAnnotation) => {
    if (row.orphaned) return;
    annotationStore.requestJumpInFile(row.projectId, row.relativePath, row.id);
    if (row.relativePath !== props.currentFilePath) {
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
              {rows().length} {rows().length === 1 ? 'annotation' : 'annotations'} in this project
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
                <For each={rows()}>
                  {(row) => {
                    const state = annotationState(row);
                    return (
                      <tr class={row.orphaned ? 'annotation-manager-row-orphaned' : ''}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select annotation in ${row.relativePath}`}
                            checked={selected().has(row.id)}
                            onChange={() => toggleRow(row.id)}
                          />
                        </td>
                        <td class="annotation-manager-file">{row.relativePath}</td>
                        <td class="annotation-manager-excerpt">{annotationExcerpt(row)}</td>
                        <td class="annotation-manager-note">{annotationNotePreview(row)}</td>
                        <td>
                          <span
                            class={`annotation-state ${row.resolved ? 'resolved' : ''}`}
                          >
                            {state.label}
                          </span>
                          <Show when={state.outdated}>
                            <span class="annotation-manager-badge">Outdated</span>
                          </Show>
                        </td>
                        <td class="annotation-manager-time">{annotationTime(row)}</td>
                        <td>
                          <Show
                            when={!row.orphaned}
                            fallback={
                              <span class="annotation-manager-orphan">
                                File missing — cannot jump
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
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
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
