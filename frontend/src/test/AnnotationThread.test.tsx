import { describe, expect, it } from 'vitest';
import { render } from '@solidjs/testing-library';
import AnnotationThread from '../components/AnnotationThread';
import type { Annotation, AnnotationNote } from '../types';

function note(
  id: number,
  body: string,
  author: string | null,
  isAgent: boolean
): AnnotationNote {
  return {
    id,
    annotationId: 1,
    body,
    author,
    isAgent,
    createdAt: '2026-01-01 00:00:00',
  };
}

function annotationWithNotes(notes: AnnotationNote[]): Annotation {
  return {
    id: 1,
    projectId: 1,
    relativePath: 'doc.md',
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
    snapshot: null,
    resolved: false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    notes,
  };
}

describe('AnnotationThread authorship badges', () => {
  it('labels human notes with their author and marks agent notes', () => {
    const { container } = render(() => (
      <AnnotationThread
        annotation={annotationWithNotes([
          note(1, 'Human note', 'Jonas', false),
          note(2, 'Agent note', 'openmkview-agent', true),
          note(3, 'Legacy note', null, false),
        ])}
      />
    ));

    const badges = container.querySelectorAll('.annotation-note-author');
    expect(badges).toHaveLength(3);

    const human = badges[0];
    expect(human.querySelector('.annotation-note-author-name')?.textContent).toBe('Jonas');
    expect(human.querySelector('.annotation-note-agent-badge')).toBeNull();

    const agent = badges[1];
    expect(agent.querySelector('.annotation-note-author-name')?.textContent).toBe(
      'openmkview-agent'
    );
    expect(agent.querySelector('.annotation-note-agent-badge')?.textContent).toBe('Agent');

    const legacy = badges[2];
    expect(legacy.querySelector('.annotation-note-author-name')?.textContent).toBe('—');
    expect(legacy.querySelector('.annotation-note-agent-badge')).toBeNull();
  });
});
