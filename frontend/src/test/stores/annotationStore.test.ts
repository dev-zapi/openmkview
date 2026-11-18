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

/** URL-routed fetch mock: management loads now also fetch each row's file. */
function mockFetchRoutes(routes: Array<[string, unknown]>): void {
  (global.fetch as any).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([fragment]) => url.includes(fragment));
    if (!match) return Promise.reject(new Error(`unexpected request: ${url}`));
    return Promise.resolve(jsonResponse(match[1]));
  });
}

describe('annotationStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  it('stamps created annotations with the logged-in username', async () => {
    const { authStore } = await import('../../stores/authStore');
    const { annotationStore } = await import('../../stores/annotationStore');
    authStore.setUsername('Jonas');

    const created = annotationFor(1, 1, 'a.md', 'blk-a');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse(created));

    await annotationStore.create(1, 'a.md', created.anchor, 'note');

    const request = JSON.parse((global.fetch as any).mock.calls.at(-1)[1].body);
    expect(request).toEqual({
      projectId: 1,
      relativePath: 'a.md',
      anchor: created.anchor,
      body: 'note',
      author: 'Jonas',
      isAgent: false,
    });
  });

  it('stamps replies with the logged-in username and a human voice', async () => {
    const { authStore } = await import('../../stores/authStore');
    const { annotationStore } = await import('../../stores/annotationStore');
    authStore.setUsername('Jonas');

    const updated = annotationFor(1, 1, 'a.md', 'blk-a');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse(updated));

    await annotationStore.appendNote(1, 'reply');

    const request = JSON.parse((global.fetch as any).mock.calls.at(-1)[1].body);
    expect(request).toEqual({ body: 'reply', author: 'Jonas', isAgent: false });
  });

  it('stamps null authorship when no username is known', async () => {
    const { authStore } = await import('../../stores/authStore');
    const { annotationStore } = await import('../../stores/annotationStore');
    authStore.setUsername(null);

    const updated = annotationFor(1, 1, 'a.md', 'blk-a');
    (global.fetch as any).mockResolvedValueOnce(jsonResponse(updated));

    await annotationStore.appendNote(1, 'reply');

    const request = JSON.parse((global.fetch as any).mock.calls.at(-1)[1].body);
    expect(request.author).toBeNull();
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
    (global.fetch as any).mockReset();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  function managedFor(id: number, relativePath = 'a.md') {
    return { ...annotationFor(id, 1, relativePath, `blk-${id}`), missingFile: false };
  }

  it('loads the project-wide management list', async () => {
    const rows = [managedFor(1), managedFor(2, 'b.md')];
    mockFetchRoutes([
      ['/api/annotations/manage', rows],
      ['/api/files/content', { content: '# File\n' }],
    ]);

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);

    expect(annotationStore.managed().map((row) => row.id)).toEqual([1, 2]);
    expect(annotationStore.managedLoading()).toBe(false);
    expect(annotationStore.managedError()).toBeNull();
  });

  it('surfaces a management-list load failure', async () => {
    (global.fetch as any).mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/api/annotations/manage')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          json: async () => ({ error: 'boom' }),
        } as unknown as Response);
      }
      return Promise.reject(new Error(`unexpected request: ${input}`));
    });

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);

    expect(annotationStore.managed()).toEqual([]);
    expect(annotationStore.managedError()).toBe('boom');
  });

  it('resolves Outdated across files and skips Missing File rows', async () => {
    const healthy = managedFor(1, 'a.md');
    const outdated = managedFor(2, 'b.md');
    const missing = { ...managedFor(3, 'gone.md'), missingFile: true };
    (global.fetch as any).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/annotations/manage')) {
        return Promise.resolve(jsonResponse([healthy, outdated, missing]));
      }
      if (url.includes('relativePath=a.md')) {
        return Promise.resolve(jsonResponse({ content: '# A\n\ntext\n' }));
      }
      if (url.includes('relativePath=b.md')) {
        return Promise.resolve(jsonResponse({ content: '# B\n\nnothing here\n' }));
      }
      return Promise.reject(new Error(`unexpected request: ${url}`));
    });

    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.loadForProject(1);
    await vi.waitFor(() => expect(annotationStore.isManagedOutdated(2)).toBe(true));

    expect(annotationStore.isManagedOutdated(1)).toBe(false);
    expect(annotationStore.managedOutdatedSnapshot(2)).toBe('text');

    const contentFetches = () =>
      (global.fetch as any).mock.calls.filter(([input]: [string]) =>
        String(input).includes('/api/files/content')
      ).length;
    // Missing File rows are not fetched: a.md and b.md only.
    expect(contentFetches()).toBe(2);
  });

  it('toggles individual rows and the whole selection', async () => {
    mockFetchRoutes([
      ['/api/annotations/manage', [managedFor(1), managedFor(2)]],
      ['/api/files/content', { content: '# File\n' }],
    ]);

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
    mockFetchRoutes([
      ['/api/annotations/manage', [managedFor(1), managedFor(2)]],
      [
        '/api/annotations?',
        [annotationFor(1, 1, 'a.md', 'blk-1'), annotationFor(2, 1, 'a.md', 'blk-2')],
      ],
      ['/api/annotations/batch-delete', { deleted: 1 }],
      ['/api/files/content', { content: '# File\n' }],
    ]);

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
    mockFetchRoutes([
      ['/api/annotations/manage', [managedFor(1), managedFor(2)]],
      [
        '/api/annotations?',
        [annotationFor(1, 1, 'a.md', 'blk-1'), annotationFor(2, 1, 'a.md', 'blk-2')],
      ],
      ['/api/annotations/batch-resolve', { updated: 1 }],
      ['/api/files/content', { content: '# File\n' }],
    ]);

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
    mockFetchRoutes([
      ['/api/annotations/manage', [managedFor(1)]],
      ['/api/annotations?', [annotationFor(1, 1, 'a.md', 'blk-1')]],
      ['/api/annotations/project/', { deleted: 1 }],
      ['/api/files/content', { content: '# File\n' }],
    ]);

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
    (global.fetch as any).mockReset();
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
