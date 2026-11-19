import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import AnnotationManagerDialog from '../components/AnnotationManagerDialog';
import { annotationStore } from '../stores/annotationStore';
import type { ManagedAnnotation } from '../types';

function managedAnnotation(
  id: number,
  relativePath: string,
  authors: Array<string | null>
): ManagedAnnotation & { orphaned: boolean } {
  return {
    id,
    projectId: 1,
    relativePath,
    anchor: {
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
    },
    snapshot: 'text',
    resolved: false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    notes: authors.map((author, index) => ({
      id: id * 10 + index,
      annotationId: id,
      body: 'note',
      author,
      isAgent: false,
      createdAt: '2026-01-01 00:00:00',
    })),
    // Missing File rows skip the lazy per-file Outdated resolution.
    missingFile: true,
    orphaned: true,
  };
}

const ROWS = [
  managedAnnotation(1, 'alice.md', ['alice']),
  managedAnnotation(2, 'bob.md', ['bob']),
  managedAnnotation(3, 'legacy.md', [null]),
];

describe('AnnotationManagerDialog author filter', () => {
  beforeEach(() => {
    annotationStore.reset();
    vi.spyOn(window, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/annotations/manage')) {
        return new Response(JSON.stringify(ROWS), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('narrows rows by a case-insensitive author substring', async () => {
    render(() => (
      <AnnotationManagerDialog
        isOpen={true}
        projectId={1}
        currentFilePath={null}
        onClose={() => {}}
      />
    ));

    await waitFor(() => expect(screen.getAllByText('alice.md').length).toBe(1));
    expect(screen.getByText('bob.md')).toBeTruthy();
    expect(screen.getByText('legacy.md')).toBeTruthy();

    const filter = screen.getByLabelText('Author') as HTMLInputElement;
    fireEvent.input(filter, { target: { value: 'ALI' } });

    await waitFor(() => expect(screen.queryByText('bob.md')).toBeNull());
    expect(screen.getByText('alice.md')).toBeTruthy();
    expect(screen.queryByText('legacy.md')).toBeNull();
  });

  it('shows an empty state when no author matches', async () => {
    render(() => (
      <AnnotationManagerDialog
        isOpen={true}
        projectId={1}
        currentFilePath={null}
        onClose={() => {}}
      />
    ));

    await waitFor(() => expect(screen.getAllByText('alice.md').length).toBe(1));

    fireEvent.input(screen.getByLabelText('Author'), { target: { value: 'nobody' } });

    await waitFor(() =>
      expect(screen.getByText('No annotations match this author')).toBeTruthy()
    );
  });
});
