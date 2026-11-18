import { createSignal } from 'solid-js';
import type { Annotation, AnnotationAnchor } from '../types';
import { api } from '../services/api';
import { offlineStore } from './offlineStore';
import { loadAnnotationsVisible, saveAnnotationsVisible } from '../utils/settings';

const [annotations, setAnnotations] = createSignal<Annotation[]>([]);
const [loading, setLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);
const [visible, setVisible] = createSignal<boolean>(loadAnnotationsVisible());

let loadedKey: string | null = null;
let currentProjectId: number | null = null;
let currentRelativePath: string | null = null;

function applyVisibility(nextVisible: boolean): void {
  setVisible(nextVisible);
  saveAnnotationsVisible(nextVisible);
}

/**
 * Offline Mode is read-only (ADR-0002): never attempt an annotation write
 * while offline. UI surfaces disable their controls via canMutate(); this
 * guard keeps any unguarded caller from firing a doomed request.
 */
function requireOnline(): void {
  if (!offlineStore.online()) {
    throw new Error('Annotations are read-only while offline');
  }
}

function fileKey(projectId: number, relativePath: string): string {
  return `${projectId}\u0000${relativePath}`;
}

export const annotationStore = {
  annotations,
  loading,
  error,
  visible,

  /** Whether annotation writes may be attempted (Online Mode only). */
  canMutate(): boolean {
    return offlineStore.online();
  },

  setVisible(nextVisible: boolean): void {
    applyVisibility(nextVisible);
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
    setLoading(false);
    setError(null);
  },

  async create(
    projectId: number,
    relativePath: string,
    anchor: AnnotationAnchor,
    body: string
  ): Promise<Annotation> {
    requireOnline();
    const created = await api.createAnnotation({ projectId, relativePath, anchor, body });
    if (loadedKey === fileKey(projectId, relativePath)) {
      setAnnotations((current) => [...current, created]);
    }
    return created;
  },

  async remove(id: number): Promise<void> {
    requireOnline();
    await api.deleteAnnotation(id);
    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
  },

  /** Whole-block lookup: #16 anchors carry exactly one block segment. */
  byBlockHash(blockHash: string): Annotation | undefined {
    return annotations().find(
      (annotation) =>
        annotation.projectId === currentProjectId &&
        annotation.relativePath === currentRelativePath &&
        annotation.anchor?.segments?.some(
          (segment) => segment.kind === 'block' && segment.blockHash === blockHash
        )
    );
  },
};

export default annotationStore;
