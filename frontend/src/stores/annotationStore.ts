import { createSignal } from 'solid-js';
import type { Annotation, AnnotationAnchor } from '../types';
import { api } from '../services/api';

const [annotations, setAnnotations] = createSignal<Annotation[]>([]);
const [loading, setLoading] = createSignal<boolean>(false);
const [error, setError] = createSignal<string | null>(null);

let loadedKey: string | null = null;

function fileKey(projectId: number, relativePath: string): string {
  return `${projectId}\u0000${relativePath}`;
}

export const annotationStore = {
  annotations,
  loading,
  error,

  /** Load annotations for the given file, deduplicating repeat calls. */
  async load(projectId: number, relativePath: string): Promise<void> {
    const key = fileKey(projectId, relativePath);
    if (key === loadedKey) return;

    loadedKey = key;
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

  /** Whole-block lookup: #16 anchors carry exactly one block segment. */
  byBlockHash(blockHash: string): Annotation | undefined {
    return annotations().find((annotation) =>
      annotation.anchor?.segments?.some(
        (segment) => segment.kind === 'block' && segment.blockHash === blockHash
      )
    );
  },
};

export default annotationStore;
