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

    const second = annotationStore.load(1, 'b.md');
    expect(annotationStore.annotations()).toEqual([]);

    (globalThis as any).__resolveSecond(jsonResponse([annotationFor(2, 1, 'b.md', 'blk-b')]));
    await second;
    expect(annotationStore.annotations().map((annotation) => annotation.id)).toEqual([2]);
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

  it('lets Source re-resolve after a save invalidates the Preview map', async () => {
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.setOutdatedSnapshots(new Map([[1, 'pre-edit snapshot']]));
    expect(annotationStore.previewOutdatedResolved()).toBe(true);

    // Preview → Edit/save → Source: the saved content invalidates the
    // pre-edit decisions, so the next resolver (Source) is authoritative.
    annotationStore.invalidateOutdatedStatus();

    expect(annotationStore.previewOutdatedResolved()).toBe(false);
    expect(annotationStore.outdatedSnapshots().size).toBe(0);

    annotationStore.publishSourceOutdatedSnapshots(
      new Map([[2, 'post-edit source snapshot']])
    );
    expect([...annotationStore.outdatedSnapshots().entries()]).toEqual([
      [2, 'post-edit source snapshot'],
    ]);
  });
});

describe('annotationStore management panel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  function managedFor(id: number, relativePath = 'a.md') {
    return { ...annotationFor(id, 1, relativePath, `blk-${id}`), orphaned: false };
  }

  it('loads the project-wide management list', async () => {
    const rows = [managedFor(1), managedFor(2, 'b.md')];
    (global.fetch as any).mockResolvedValueOnce(jsonResponse(rows));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);

    expect(annotationStore.managed().map((row) => row.id)).toEqual([1, 2]);
    expect(annotationStore.managedLoading()).toBe(false);
    expect(annotationStore.managedError()).toBeNull();
  });

  it('surfaces a management-list load failure', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ error: 'boom' }),
    } as unknown as Response);

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);

    expect(annotationStore.managed()).toEqual([]);
    expect(annotationStore.managedError()).toBe('boom');
  });

  it('toggles individual rows and the whole selection', async () => {
    (global.fetch as any).mockResolvedValueOnce(jsonResponse([managedFor(1), managedFor(2)]));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);

    annotationStore.toggleManagedSelection(1);
    expect([...annotationStore.managedSelection()]).toEqual([1]);

    annotationStore.toggleManagedSelection(1);
    expect([...annotationStore.managedSelection()]).toEqual([]);

    annotationStore.toggleManagedSelectionAll();
    expect([...annotationStore.managedSelection()].sort()).toEqual([1, 2]);

    annotationStore.toggleManagedSelectionAll();
    expect([...annotationStore.managedSelection()]).toEqual([]);
  });

  it('batch delete updates both surfaces and prunes the selection', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([annotationFor(1, 1, 'a.md', 'blk-1'), annotationFor(2, 1, 'a.md', 'blk-2')]))
      .mockResolvedValueOnce(jsonResponse([managedFor(1), managedFor(2)]))
      .mockResolvedValueOnce(jsonResponse({ deleted: 1 }));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    await annotationStore.loadForProject(1);
    annotationStore.toggleManagedSelection(1);
    annotationStore.toggleManagedSelection(2);

    await annotationStore.batchDelete(1, [1]);

    expect(annotationStore.managed().map((row) => row.id)).toEqual([2]);
    expect(annotationStore.annotations().map((row) => row.id)).toEqual([2]);
    expect([...annotationStore.managedSelection()]).toEqual([2]);
  });

  it('batch resolve flips the resolved flag on both surfaces', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([annotationFor(1, 1, 'a.md', 'blk-1'), annotationFor(2, 1, 'a.md', 'blk-2')]))
      .mockResolvedValueOnce(jsonResponse([managedFor(1), managedFor(2)]))
      .mockResolvedValueOnce(jsonResponse({ updated: 1 }));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    await annotationStore.loadForProject(1);

    await annotationStore.batchResolve(1, [1], true);

    expect(annotationStore.managed().find((row) => row.id === 1)?.resolved).toBe(true);
    expect(annotationStore.managed().find((row) => row.id === 2)?.resolved).toBe(false);
    expect(annotationStore.annotations().find((row) => row.id === 1)?.resolved).toBe(true);
    expect(annotationStore.annotations().find((row) => row.id === 2)?.resolved).toBe(false);
  });

  it('clear project empties both surfaces and the selection', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([annotationFor(1, 1, 'a.md', 'blk-1')]))
      .mockResolvedValueOnce(jsonResponse([managedFor(1)]))
      .mockResolvedValueOnce(jsonResponse({ deleted: 1 }));

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'a.md');
    await annotationStore.loadForProject(1);
    annotationStore.toggleManagedSelection(1);

    await annotationStore.clearProject(1);

    expect(annotationStore.managed()).toEqual([]);
    expect(annotationStore.annotations()).toEqual([]);
    expect([...annotationStore.managedSelection()]).toEqual([]);
  });
});

describe('annotationStore cross-file jump', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  it('reveals the annotation once its target file finishes loading', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      jsonResponse([annotationFor(7, 1, 'b.md', 'blk-b')])
    );

    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.requestJumpInFile(1, 'b.md', 7);
    expect(annotationStore.jumpRequest()).toBeNull();

    await annotationStore.load(1, 'b.md');

    expect(annotationStore.jumpRequest()?.annotationId).toBe(7);
  });

  it('drops the pending jump when its open is cancelled', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      jsonResponse([annotationFor(7, 1, 'b.md', 'blk-b')])
    );

    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.requestJumpInFile(1, 'b.md', 7);
    annotationStore.cancelPendingJump('b.md');

    await annotationStore.load(1, 'b.md');

    expect(annotationStore.jumpRequest()).toBeNull();
  });

  it('drops the pending jump when another file loads first', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([annotationFor(7, 1, 'b.md', 'blk-b')]));

    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.requestJumpInFile(1, 'b.md', 7);

    await annotationStore.load(1, 'c.md');
    await annotationStore.load(1, 'b.md');

    expect(annotationStore.jumpRequest()).toBeNull();
  });

  it('drops the pending jump when the target load fails', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([annotationFor(7, 1, 'b.md', 'blk-b')]));

    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.requestJumpInFile(1, 'b.md', 7);

    await annotationStore.load(1, 'b.md');
    expect(annotationStore.jumpRequest()).toBeNull();

    // A later, unrelated open of the same path must not replay the jump.
    await annotationStore.load(1, 'c.md');
    await annotationStore.load(1, 'b.md');
    expect(annotationStore.jumpRequest()).toBeNull();
  });
});
