import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Annotation } from '../../types';

global.fetch = vi.fn();

function annotationFor(id: number, projectId: number, relativePath: string, blockHash: string): Annotation {
  return {
    id,
    projectId,
    relativePath,
    anchor: {
      version: 1,
      segments: [
        {
          kind: 'block',
          blockHash,
          blockText: 'text',
          blockType: 'p',
          headingPath: [],
        },
      ],
    },
    snapshot: null,
    resolved: false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    notes: [],
  };
}

function jsonResponse(value: unknown): Response {
  return { ok: true, json: async () => value } as unknown as Response;
}

describe('annotationStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  it('clears the previous file annotations as soon as another file loads', async () => {
    const first = annotationFor(1, 1, 'a.md', 'blk-a');
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([first]))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            (globalThis as any).__resolveSecond = resolve;
          })
      );

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    expect(annotationStore.annotations()).toEqual([first]);
    expect(annotationStore.byBlockHash('blk-a')?.id).toBe(1);

    const second = annotationStore.load(1, 'b.md');
    expect(annotationStore.annotations()).toEqual([]);
    expect(annotationStore.byBlockHash('blk-a')).toBeUndefined();

    (globalThis as any).__resolveSecond(jsonResponse([annotationFor(2, 1, 'b.md', 'blk-b')]));
    await second;
    expect(annotationStore.annotations()).toHaveLength(1);
    expect(annotationStore.byBlockHash('blk-b')?.id).toBe(2);
  });

  it('does not resolve a block hash from a different file', async () => {
    const annotation = annotationFor(1, 2, 'other.md', 'blk-shared');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([annotation]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'current.md');
    // The annotation belongs to project 2 / other.md, so it is not current.
    expect(annotationStore.byBlockHash('blk-shared')).toBeUndefined();
  });
});
