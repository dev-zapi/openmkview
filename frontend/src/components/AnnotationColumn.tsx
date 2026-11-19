import { Component, For, Show, createSignal } from 'solid-js';
import type { Annotation } from '../types';
import { annotationStore } from '../stores/annotationStore';
import { annotationExcerpt } from '../utils/annotationDisplay';
import { formatTimestamp } from '../utils/time';
import { DEFAULT_ANNOTATION_COLUMN_WIDTH } from '../types/app';
import AnnotationThread from './AnnotationThread';
import AnnotationManagerDialog from './AnnotationManagerDialog';

interface AnnotationColumnProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
  currentFilePath?: string | null;
  onOpenFile?: (path: string) => void;
  /** Open width. The mobile drawer passes 100% instead of the desktop 300px. */
  width?: number | string;
  /** Desktop resize behavior. The mobile drawer omits the drag handle. */
  transition?: string;
  onStartDragging?: (event: MouseEvent) => void;
  /** Called after a jump request, e.g. to close the mobile drawer. */
  onJump?: () => void;
}

/**
 * Independent per-file annotation overview. A sibling of the outline panel,
 * so both columns can stay open at once.
 */
const AnnotationColumn: Component<AnnotationColumnProps> = (props) => {
  const [showResolved, setShowResolved] = createSignal(true);
  const [managerOpen, setManagerOpen] = createSignal(false);

  const visibleAnnotations = () =>
    annotationStore.annotations().filter((annotation) => showResolved() || !annotation.resolved);

  const jumpTo = (annotation: Annotation) => {
    annotationStore.requestJump(annotation.id);
    props.onJump?.();
  };

  const openWidth = () => {
    if (props.width === undefined) return `${DEFAULT_ANNOTATION_COLUMN_WIDTH}px`;
    return typeof props.width === 'number' ? `${props.width}px` : props.width;
  };

  return (
    <div
      class={`annotation-column ${props.isOpen ? '' : 'annotation-column-hidden'}`}
      style={{
        width: props.isOpen ? openWidth() : '0px',
        transition: props.transition ?? 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      role="region"
      aria-label="Annotations"
    >
      <Show when={props.isOpen}>
        <div class="annotation-column-header topbar-glass">
        <h3>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Annotations
          <span class="annotation-column-count">{annotationStore.annotations().length}</span>
        </h3>
        <div class="annotation-column-header-actions">
          <button
            type="button"
            class="annotation-column-manage"
            aria-label="Manage annotations"
            onClick={() => setManagerOpen(true)}
            disabled={props.projectId === undefined}
          >
            Manage
          </button>
          <button
            type="button"
            class="outline-close-btn"
            onClick={props.onClose}
            aria-label="Close annotations"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <label class="annotation-column-filter">
        <input
          type="checkbox"
          checked={showResolved()}
          onChange={(event) => setShowResolved(event.currentTarget.checked)}
        />
        Show resolved
      </label>

      <div class="annotation-column-content">
        <Show when={annotationStore.loading()}>
          <p class="annotation-column-empty">Loading annotations…</p>
        </Show>
        <Show when={!annotationStore.loading() && visibleAnnotations().length === 0}>
          <div class="annotation-column-empty">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p>No annotations for this file</p>
          </div>
        </Show>
        <For each={visibleAnnotations()}>
          {(annotation) => {
            const outdated = () => annotationStore.isOutdated(annotation.id);
            const snapshot = () => annotationStore.outdatedSnapshot(annotation.id) ?? '';
            const excerpt = () =>
              annotationExcerpt(annotation, annotationStore.outdatedSnapshot(annotation.id));
            const openAnnotation = (event: MouseEvent) => {
              // An Outdated annotation has no highlight to click; its column
              // entry opens the viewer so the snapshot stays reachable.
              if (!outdated()) {
                jumpTo(annotation);
                return;
              }
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
              annotationStore.requestView(annotation.id, rect.left, rect.top);
            };
            return (
              <div
                class={`annotation-column-item ${annotation.resolved ? 'resolved' : ''} ${outdated() ? 'outdated' : ''}`}
                data-annotation-id={String(annotation.id)}
                data-outdated={outdated() ? 'true' : undefined}
              >
                <button
                  type="button"
                  class="annotation-column-entry"
                  onClick={openAnnotation}
                  aria-label={`${outdated() ? 'Open outdated annotation' : 'Jump to annotation'}: ${excerpt().slice(0, 80)}`}
                >
                  <span class="annotation-column-excerpt">{excerpt()}</span>
                  <span class="annotation-column-meta">
                    <span
                      class={`annotation-state ${outdated() ? 'outdated' : annotation.resolved ? 'resolved' : ''}`}
                    >
                      {outdated() ? 'Outdated' : annotation.resolved ? 'Resolved' : 'Active'}
                    </span>
                    <span class="annotation-column-time">{formatTimestamp(annotation.updatedAt || annotation.createdAt)}</span>
                  </span>
                </button>

                <Show when={outdated()}>
                  <div class="annotation-outdated" role="status">
                    <span class="annotation-outdated-badge">Outdated</span>
                    <p class="annotation-outdated-snapshot">
                      <span class="annotation-outdated-label">Originally anchored text</span>
                      <span class="annotation-outdated-text">{snapshot()}</span>
                    </p>
                    <button
                      type="button"
                      class="annotation-action-secondary"
                      disabled={!annotationStore.canMutate()}
                      title={
                        annotationStore.canMutate() ? undefined : 'Unavailable offline'
                      }
                      onClick={() => annotationStore.startReanchor(annotation.id)}
                    >
                      Re-anchor
                    </button>
                  </div>
                </Show>

                <div class="annotation-column-thread">
                  <AnnotationThread annotation={annotation} />
                </div>
              </div>
            );
          }}
        </For>
        </div>
      </Show>

      <AnnotationManagerDialog
        isOpen={managerOpen()}
        projectId={props.projectId}
        currentFilePath={props.currentFilePath ?? null}
        onClose={() => setManagerOpen(false)}
        onOpenFile={props.onOpenFile}
      />

      <Show when={props.onStartDragging}>
        <div class="annotation-column-resize-handle" onMouseDown={props.onStartDragging} />
      </Show>
    </div>
  );
};

export default AnnotationColumn;
