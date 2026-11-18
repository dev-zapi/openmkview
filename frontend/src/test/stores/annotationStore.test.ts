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
    expect(annotationStore.byBlockHash('blk-a')?.[0]?.id).toBe(1);

    const second = annotationStore.load(1, 'b.md');
    expect(annotationStore.annotations()).toEqual([]);
    expect(annotationStore.byBlockHash('blk-a')).toEqual([]);

    (globalThis as any).__resolveSecond(jsonResponse([annotationFor(2, 1, 'b.md', 'blk-b')]));
    await second;
    expect(annotationStore.annotations()).toHaveLength(1);
    expect(annotationStore.byBlockHash('blk-b')?.[0]?.id).toBe(2);
  });

  it('returns every annotation targeting the same block', async () => {
    const first = annotationFor(1, 1, 'a.md', 'blk-shared');
    const second = annotationFor(2, 1, 'a.md', 'blk-shared');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([first, second]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');

    expect(annotationStore.byBlockHash('blk-shared').map((annotation) => annotation.id)).toEqual([
      1, 2,
    ]);
  });

  it('does not resolve a block hash from a different file', async () => {
    const annotation = annotationFor(1, 2, 'other.md', 'blk-shared');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([annotation]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'current.md');
    // The annotation belongs to project 2 / other.md, so it is not current.
    expect(annotationStore.byBlockHash('blk-shared')).toEqual([]);
  });

  it('re-anchors an Outdated annotation and clears its status', async () => {
    const annotation = annotationFor(1, 1, 'a.md', 'blk-gone');
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([annotation]))
      .mockResolvedValueOnce(jsonResponse({ ...annotation, snapshot: 'fresh quote' }));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    annotationStore.setOutdatedSnapshots(new Map([[1, 'old quote']]));
    expect(annotationStore.isOutdated(1)).toBe(true);

    annotationStore.startReanchor(1);
    expect(annotationStore.reanchorTarget()).toBe(1);

    const freshAnchor = {
      version: 1,
      segments: [
        {
          kind: 'text' as const,
          blockHash: 'blk-new',
          blockText: 'fresh quote paragraph',
          blockType: 'p',
          headingPath: [],
          quote: 'fresh quote',
          prefix: '',
          suffix: ' paragraph',
        },
      ],
    };
    await annotationStore.reanchor(1, freshAnchor);

    expect(global.fetch).toHaveBeenLastCalledWith('/api/annotations/1/anchor', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchor: freshAnchor }),
    });
    expect(annotationStore.annotations()[0].snapshot).toBe('fresh quote');
    expect(annotationStore.isOutdated(1)).toBe(false);
    expect(annotationStore.reanchorTarget()).toBeNull();
  });

  it('clears an armed re-anchor and viewer request when another file loads', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([annotationFor(1, 1, 'a.md', 'blk-a')]))
      .mockResolvedValueOnce(jsonResponse([]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    annotationStore.startReanchor(1);
    annotationStore.requestView(1, 10, 20);

    await annotationStore.load(1, 'b.md');

    expect(annotationStore.reanchorTarget()).toBeNull();
    expect(annotationStore.viewRequest()).toBeNull();
  });

  it('refuses to re-anchor an annotation that is not in the current file', async () => {
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'b.md');
    const fetchesBefore = (global.fetch as any).mock.calls.length;

    annotationStore.startReanchor(1);
    await expect(
      annotationStore.reanchor(1, {
        version: 1,
        segments: [
          {
            kind: 'block',
            blockHash: 'blk-a',
            blockText: 'text',
            blockType: 'p',
            headingPath: [],
          },
        ],
      })
    ).rejects.toThrow('no longer available');

    expect((global.fetch as any).mock.calls.length).toBe(fetchesBefore);
    expect(annotationStore.reanchorTarget()).toBeNull();
  });

  it('keeps the Preview Outdated map canonical over the Source fallback', async () => {
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.setOutdatedSnapshots(new Map([[1, 'preview snapshot']]));

    annotationStore.publishSourceOutdatedSnapshots(new Map([[2, 'source snapshot']]));

    expect([...annotationStore.outdatedSnapshots().entries()]).toEqual([
      [1, 'preview snapshot'],
    ]);
    expect(annotationStore.previewOutdatedResolved()).toBe(true);
  });

  it('fills Outdated status from Source when no Preview model resolved', async () => {
    const { annotationStore } = await import('../../stores/annotationStore');

    annotationStore.publishSourceOutdatedSnapshots(new Map([[2, 'source snapshot']]));

    expect([...annotationStore.outdatedSnapshots().entries()]).toEqual([
      [2, 'source snapshot'],
    ]);
    expect(annotationStore.previewOutdatedResolved()).toBe(false);
  });

  it('restores Source authority when another file loads', async () => {
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([]));

    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.setOutdatedSnapshots(new Map([[1, 'preview snapshot']]));

    await annotationStore.load(1, 'c.md');

    expect(annotationStore.previewOutdatedResolved()).toBe(false);
    expect(annotationStore.outdatedSnapshots().size).toBe(0);

    annotationStore.publishSourceOutdatedSnapshots(new Map([[3, 'source snapshot']]));
    expect([...annotationStore.outdatedSnapshots().entries()]).toEqual([
      [3, 'source snapshot'],
    ]);
  });
});
