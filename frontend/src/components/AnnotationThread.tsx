import { Component, For, Show, createSignal } from 'solid-js';
import type { Annotation, AnnotationNote } from '../types';
import { annotationStore } from '../stores/annotationStore';
import { annotationNoteTime } from '../utils/annotationDisplay';
import { renderNoteMarkdown } from '../utils/sanitizedMarkdown';

interface AnnotationThreadProps {
  annotation: Annotation;
  onDelete?: () => void;
}

/**
 * The full single-user thread UI shared by the popover and the annotation
 * column: time-ordered notes, editable Markdown bodies, Reply, Resolve, Delete.
 */
const AnnotationThread: Component<AnnotationThreadProps> = (props) => {
  const [replyBody, setReplyBody] = createSignal('');
  const [editingNoteId, setEditingNoteId] = createSignal<number | null>(null);
  const [noteDraft, setNoteDraft] = createSignal('');
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const canMutate = () => annotationStore.canMutate();
  const offlineTitle = () => (canMutate() ? undefined : 'Unavailable offline');

  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annotation action failed');
    } finally {
      setPending(false);
    }
  };

  const submitReply = () => {
    const body = replyBody().trim();
    if (!body) return;
    void run(async () => {
      await annotationStore.appendNote(props.annotation.id, body);
      setReplyBody('');
    });
  };

  const startEdit = (note: AnnotationNote) => {
    setEditingNoteId(note.id);
    setNoteDraft(note.body);
    setError(null);
  };

  const saveEdit = (note: AnnotationNote) => {
    const body = noteDraft().trim();
    if (!body) {
      setError('Write a note before saving.');
      return;
    }
    void run(async () => {
      await annotationStore.updateNote(props.annotation.id, note.id, body);
      setEditingNoteId(null);
      setNoteDraft('');
    });
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setNoteDraft('');
  };

  const toggleResolved = () => {
    void run(async () => {
      await annotationStore.setResolved(props.annotation.id, !props.annotation.resolved);
    });
  };

  const remove = () => {
    void run(async () => {
      await annotationStore.remove(props.annotation.id);
      props.onDelete?.();
    });
  };

  return (
    <div class="annotation-thread" data-resolved={props.annotation.resolved ? 'true' : 'false'}>
      <Show when={!canMutate()}>
        <p class="annotation-offline-note">Read-only while offline</p>
      </Show>
      <For each={props.annotation.notes}>
        {(note) => (
          <div class="annotation-note" data-note-id={String(note.id)}>
            <div class="annotation-note-meta">
              <span class="annotation-note-meta-left">
                <span class="annotation-note-time">{annotationNoteTime(note)}</span>
                <span class="annotation-note-author">
                  <span class="annotation-note-author-name">{note.author ?? '—'}</span>
                  <Show when={note.isAgent}>
                    <span class="annotation-note-agent-badge">Agent</span>
                  </Show>
                </span>
              </span>
              <button
                type="button"
                class="annotation-note-edit"
                disabled={pending() || !canMutate()}
                title={offlineTitle()}
                onClick={() => startEdit(note)}
              >
                Edit
              </button>
            </div>
            <Show
              when={editingNoteId() === note.id}
              fallback={<div class="annotation-note-body" innerHTML={renderNoteMarkdown(note.body)} />}
            >
              <textarea
                class="annotation-composer-input"
                aria-label="Note body"
                rows={3}
                disabled={!canMutate()}
                value={noteDraft()}
                onInput={(event) => setNoteDraft(event.currentTarget.value)}
              />
              <div class="annotation-popover-actions">
                <button
                  type="button"
                  class="annotation-action-secondary"
                  disabled={pending()}
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="annotation-action-primary"
                  disabled={pending() || !canMutate() || noteDraft().trim().length === 0}
                  title={offlineTitle()}
                  onClick={() => saveEdit(note)}
                >
                  Save
                </button>
              </div>
            </Show>
          </div>
        )}
      </For>

      <div class="annotation-reply">
        <textarea
          class="annotation-composer-input"
          aria-label="Reply body"
          rows={2}
          placeholder={
            canMutate() ? 'Write a reply… Markdown is supported' : 'Unavailable offline'
          }
          disabled={!canMutate()}
          value={replyBody()}
          onInput={(event) => setReplyBody(event.currentTarget.value)}
        />
        <div class="annotation-popover-actions">
          <button
            type="button"
            class="annotation-action-primary"
            disabled={pending() || !canMutate() || replyBody().trim().length === 0}
            title={offlineTitle()}
            onClick={submitReply}
          >
            Reply
          </button>
        </div>
      </div>

      <Show when={error()}>
        <p class="annotation-error" role="alert">
          {error()}
        </p>
      </Show>

      <div class="annotation-popover-actions">
        <button
          type="button"
          class="annotation-action-secondary"
          disabled={pending() || !canMutate()}
          title={offlineTitle()}
          onClick={toggleResolved}
        >
          {props.annotation.resolved ? 'Unresolve' : 'Resolve'}
        </button>
        <button
          type="button"
          class="annotation-action-danger"
          disabled={pending() || !canMutate()}
          title={offlineTitle()}
          onClick={remove}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default AnnotationThread;
