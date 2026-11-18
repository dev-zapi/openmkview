import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@solidjs/testing-library';
import SourceView from '../../components/SourceView';
import type { Annotation } from '../../types';

vi.mock('../../services/shikiService', () => ({
  highlightCode: vi.fn(async ({ code }: { code: string }) => ({
    html: `<pre><code>${code
      .split('\n')
      .map((line) => {
        const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `<span class="line">${escaped || ' '}</span>`;
      })
      .join('')}</code></pre>`,
  })),
}));

global.fetch = vi.fn();

const CONTENT = ['# Source Jump', '', 'The quick brown fox jumps.', ''].join('\n');

function textAnnotation(id: number, quote: string, blockText: string): Annotation {
  return {
    id,
    projectId: 1,
    relativePath: 'doc.md',
    anchor: {
      version: 1,
      segments: [
        {
          kind: 'text',
          blockHash: 'blk-stale',
          blockText,
          blockType: 'p',
          headingPath: [],
          quote,
          prefix: '',
          suffix: '',
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

describe('SourceView column jump', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
    const { annotationStore } = await import('../../stores/annotationStore');
    annotationStore.reset();
  });

  it('scrolls to the anchored source line and consumes the request', async () => {
    (global.fetch as any).mockResolvedValue(
      jsonResponse([textAnnotation(7, 'quick brown fox', 'The quick brown fox jumps.')])
    );
    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'doc.md');
    annotationStore.requestJump(7);

    const { unmount } = render(() => (
      <SourceView
        content={CONTENT}
        fileName="doc.md"
        projectId={1}
        currentFilePath="doc.md"
      />
    ));

    await waitFor(() => expect(annotationStore.jumpRequest()).toBeNull());
    const line = document.querySelectorAll<HTMLElement>('pre code > .line')[2];
    expect(line.classList.contains('annotation-jump-target')).toBe(true);
    expect(document.activeElement).toBe(line);

    // A later Preview mount must not replay the consumed jump.
    expect(annotationStore.jumpRequest()).toBeNull();
    unmount();
  });

  it('clears an unlocatable jump instead of replaying it later', async () => {
    (global.fetch as any).mockResolvedValue(
      jsonResponse([textAnnotation(8, 'vanished words', 'The quick brown fox jumps.')])
    );
    const { annotationStore } = await import('../../stores/annotationStore');
    await annotationStore.load(1, 'doc.md');
    annotationStore.requestJump(8);

    const { unmount } = render(() => (
      <SourceView
        content={CONTENT}
        fileName="doc.md"
        projectId={1}
        currentFilePath="doc.md"
      />
    ));

    await waitFor(() => expect(annotationStore.jumpRequest()).toBeNull());
    expect(document.querySelector('.annotation-jump-target')).toBeNull();
    unmount();
  });
});
