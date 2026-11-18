import { Component, For, Show, createSignal } from 'solid-js';
import type { Annotation } from '../types';
import { annotationStore } from '../stores/annotationStore';
import AnnotationThread from './AnnotationThread';

interface AnnotationColumnProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLUMN_WIDTH = 300;

function excerptFor(annotation: Annotation): string {
  const parts = (annotation.anchor?.segments ?? [])
    .map((segment) => (segment.kind === 'text' ? segment.quote : segment.blockText))
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.join(' … ') || annotation.snapshot?.trim() || 'Anchored content';
}

function timeFor(annotation: Annotation): string {
  return annotation.updatedAt || annotation.createdAt;
}

/**
 * Independent per-file annotation overview. A sibling of the outline panel,
 * so both columns can stay open at once.
 */
const AnnotationColumn: Component<AnnotationColumnProps> = (props) => {
  const [showResolved, setShowResolved] = createSignal(true);

  const visibleAnnotations = () =>
    annotationStore.annotations().filter((annotation) => showResolved() || !annotation.resolved);

  const jumpTo = (annotation: Annotation) => {
    annotationStore.requestJump(annotation.id);
  };

  return (
    <div
      class={`annotation-column ${props.isOpen ? '' : 'annotation-column-hidden'}`}
      style={{ width: props.isOpen ? `${COLUMN_WIDTH}px` : '0px' }}
      role="region"
      aria-label="Annotations"
    >
      <Show when={props.isOpen}>
        <div class="annotation-column-header">
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
          {(annotation) => (
            <div
              class={`annotation-column-item ${annotation.resolved ? 'resolved' : ''}`}
              data-annotation-id={String(annotation.id)}
            >
              <button
                type="button"
                class="annotation-column-entry"
                onClick={() => jumpTo(annotation)}
                aria-label={`Jump to annotation: ${excerptFor(annotation).slice(0, 80)}`}
              >
                <span class="annotation-column-excerpt">{excerptFor(annotation)}</span>
                <span class="annotation-column-meta">
                  <span class={`annotation-state ${annotation.resolved ? 'resolved' : ''}`}>
                    {annotation.resolved ? 'Resolved' : 'Active'}
                  </span>
                  <span class="annotation-column-time">{timeFor(annotation)}</span>
                </span>
              </button>

              <div class="annotation-column-thread">
                <AnnotationThread annotation={annotation} />
              </div>
            </div>
          )}
        </For>
        </div>
      </Show>
    </div>
  );
};

export default AnnotationColumn;
