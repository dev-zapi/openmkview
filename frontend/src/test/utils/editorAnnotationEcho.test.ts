import { describe, expect, it } from 'vitest';
import { resolveEditorAnnotationLines } from '../../utils/editorAnnotationEcho';
import type { Annotation, AnnotationAnchor } from '../../types';

const MARKDOWN = [
  '# Edit Echo E2E',
  '',
  'The quick brown fox jumps.',
  '',
  'A second paragraph carries a different thought.',
  '',
  'The final paragraph closes the argument.',
  '',
].join('\n');

function annotation(
  id: number,
  quote: string,
  blockText: string,
  options: { resolved?: boolean; kind?: 'text' | 'block' } = {}
): Annotation {
  const kind = options.kind ?? 'text';
  const segment =
    kind === 'block'
      ? {
          kind: 'block' as const,
          blockHash: 'blk-stale',
          blockText,
          blockType: 'p',
          headingPath: [],
        }
      : {
          kind: 'text' as const,
          blockHash: 'blk-stale',
          blockText,
          blockType: 'p',
          headingPath: [],
          quote,
          prefix: '',
          suffix: '',
        };
  const anchor: AnnotationAnchor = { version: 1, segments: [segment] };

  return {
    id,
    projectId: 1,
    relativePath: 'doc.md',
    anchor,
    snapshot: null,
    resolved: options.resolved ?? false,
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
    notes: [],
  };
}

function lineOffsets(text: string, line: string): { from: number; to: number } {
  const from = text.indexOf(line);
  if (from === -1) throw new Error(`missing line: ${line}`);
  return { from, to: from + line.length };
}

describe('editorAnnotationEcho utils', () => {
  it('maps a located text quote to its source line offsets', () => {
    const line = 'The quick brown fox jumps.';
    const offsets = lineOffsets(MARKDOWN, line);

    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [annotation(1, 'quick brown fox', line)],
      new Set()
    );

    expect(lines).toEqual([
      { ...offsets, resolved: false, excerpt: 'quick brown fox' },
    ]);
  });

  it('maps every source line of a quote spanning lines', () => {
    const markdown = ['# Echo', '', 'The quick', 'brown fox jumps.', ''].join('\n');
    const first = lineOffsets(markdown, 'The quick');
    const second = lineOffsets(markdown, 'brown fox jumps.');

    const lines = resolveEditorAnnotationLines(
      markdown,
      [annotation(1, 'quick brown fox', 'The quick\nbrown fox jumps.')],
      new Set()
    );

    expect(lines.map((line) => ({ from: line.from, to: line.to }))).toEqual([
      first,
      second,
    ]);
  });

  it('maps a whole-block anchor to its source line', () => {
    const line = 'The final paragraph closes the argument.';
    const offsets = lineOffsets(MARKDOWN, line);

    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [annotation(1, line, line, { kind: 'block' })],
      new Set()
    );

    expect(lines).toEqual([
      { ...offsets, resolved: false, excerpt: line },
    ]);
  });

  it('skips annotations the canonical status marks Outdated', () => {
    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [annotation(1, 'quick brown fox', 'The quick brown fox jumps.')],
      new Set([1])
    );

    expect(lines).toEqual([]);
  });

  it('skips anchors the raw Markdown cannot locate', () => {
    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [annotation(1, 'vanished words', 'The quick brown fox jumps.')],
      new Set()
    );

    expect(lines).toEqual([]);
  });

  it('merges annotations on the same line and keeps them unresolved if any is active', () => {
    const line = 'The quick brown fox jumps.';
    const offsets = lineOffsets(MARKDOWN, line);

    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [
        annotation(1, 'quick brown', line, { resolved: true }),
        annotation(2, 'fox jumps', line),
      ],
      new Set()
    );

    expect(lines).toEqual([
      {
        ...offsets,
        resolved: false,
        excerpt: 'quick brown … fox jumps',
      },
    ]);
  });

  it('marks a line resolved when every annotation on it is Resolved', () => {
    const line = 'The quick brown fox jumps.';
    const offsets = lineOffsets(MARKDOWN, line);

    const lines = resolveEditorAnnotationLines(
      MARKDOWN,
      [
        annotation(1, 'quick brown', line, { resolved: true }),
        annotation(2, 'fox jumps', line, { resolved: true }),
      ],
      new Set()
    );

    expect(lines).toEqual([
      { ...offsets, resolved: true, excerpt: 'quick brown … fox jumps' },
    ]);
  });
});
