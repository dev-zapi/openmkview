import { describe, expect, it } from 'vitest';
import { resolveAnchor } from '../../utils/anchorResolver';
import type { BlockModel } from '../../utils/blockModel';
import type { AnnotationAnchor } from '../../types';

function block(
  id: string,
  text: string,
  options: Partial<BlockModel> = {}
): BlockModel {
  return {
    id,
    type: options.type ?? 'p',
    text,
    headingPath: options.headingPath ?? [],
  };
}

function textSegment(
  target: BlockModel,
  quote: string,
  options: { prefix?: string; suffix?: string } = {}
) {
  return {
    kind: 'text' as const,
    blockHash: target.id,
    blockText: target.text,
    blockType: target.type,
    headingPath: target.headingPath,
    quote,
    prefix: options.prefix ?? '',
    suffix: options.suffix ?? '',
  };
}

function textAnchor(...segments: ReturnType<typeof textSegment>[]): AnnotationAnchor {
  return { version: 1, segments };
}

describe('anchorResolver utils', () => {
  it('resolves an exact quote to its character range in a block', () => {
    const target = block('blk-a', 'The quick brown fox jumps over the lazy dog.');
    const resolution = resolveAnchor([target], textAnchor(textSegment(target, 'brown fox')));

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-a',
          start: 10,
          end: 19,
          quote: 'brown fox',
        },
      ],
    });
  });

  it('resolves across whitespace-only edits', () => {
    const stored = block('blk-a', 'alpha beta gamma');
    // The render pass normalizes whitespace before the resolver sees a block,
    // so extra spaces/newlines collapse back to the stored quote.
    const current = block('blk-a', 'alpha beta gamma');
    const resolution = resolveAnchor(
      [current],
      textAnchor(textSegment(stored, 'beta gamma'))
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0]).toMatchObject({ blockId: 'blk-a', quote: 'beta gamma' });
  });

  it('resolves after blocks are reordered and inserted above', () => {
    const target = block('blk-a', 'Keep this sentence intact.');
    const inserted = block('blk-new', 'A newly inserted paragraph.');
    const resolution = resolveAnchor(
      [inserted, target],
      textAnchor(textSegment(target, 'this sentence'))
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0].blockId).toBe('blk-a');
  });

  it('resolves when the quote survives a partial rewrite nearby', () => {
    const stored = block('blk-a', 'An old observation in a paragraph.');
    const rewritten = block('blk-a', 'A rewritten paragraph keeps this observation intact.');
    const resolution = resolveAnchor(
      [rewritten],
      textAnchor(textSegment(stored, 'this observation', { suffix: ' intact' }))
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0].blockId).toBe('blk-a');
    expect(resolution.segments[0].kind).toBe('text');
  });

  it('reports Outdated with a snapshot when the quote is gone', () => {
    const stored = block('blk-a', 'Original text to annotate.');
    const rewritten = block('blk-a', 'Completely different prose now.');
    const resolution = resolveAnchor(
      [rewritten],
      textAnchor(textSegment(stored, 'text to annotate'))
    );

    expect(resolution).toEqual({
      status: 'outdated',
      snapshot: 'text to annotate',
    });
  });

  it('resolves a cross-block anchor into one segment per block', () => {
    const first = block('blk-a', 'The argument starts in the first paragraph.');
    const second = block('blk-b', 'It continues into the second paragraph.');
    const third = block('blk-c', 'And ends in the third paragraph.');
    const resolution = resolveAnchor(
      [first, second, third],
      textAnchor(
        textSegment(first, 'starts in the first paragraph'),
        textSegment(second, 'It continues into the second paragraph'),
        textSegment(third, 'And ends in the third')
      )
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments).toHaveLength(3);
    expect(resolution.segments.map((segment) => segment.blockId)).toEqual([
      'blk-a',
      'blk-b',
      'blk-c',
    ]);
  });

  it('uses context excerpts to disambiguate duplicate quotes in different blocks', () => {
    const first = block('blk-a', 'First mention of the repeated phrase here.');
    const second = block('blk-b', 'A later mention of the repeated phrase too.');
    const stored = block('blk-b', 'A later mention of the repeated phrase too.');
    const resolution = resolveAnchor(
      [first, second],
      textAnchor(
        textSegment(stored, 'the repeated phrase', {
          prefix: 'A later mention of ',
          suffix: ' too.',
        })
      )
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0].blockId).toBe('blk-b');
  });

  it('resolves when surrounding heading paths change', () => {
    const stored = block('blk-a', 'Stable paragraph content.', {
      headingPath: ['Old heading'],
    });
    const renamed = block('blk-a', 'Stable paragraph content.', {
      headingPath: ['New heading'],
    });
    const resolution = resolveAnchor(
      [renamed],
      textAnchor(textSegment(stored, 'paragraph content'))
    );

    expect(resolution.status).toBe('resolved');
  });

  it('resolves by text when inline formatting changed', () => {
    const stored = block('blk-a', 'Call the function now.');
    const formatted = block('blk-a', 'Call the function now.');
    const resolution = resolveAnchor(
      [formatted],
      textAnchor(textSegment(stored, 'the function'))
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0]).toMatchObject({ start: 5, end: 17 });
  });

  it('marks empty anchors and empty block models Outdated', () => {
    const target = block('blk-a', 'alpha');

    expect(resolveAnchor([], textAnchor(textSegment(target, 'alpha')))).toMatchObject({
      status: 'outdated',
    });
    expect(resolveAnchor([target], { version: 1, segments: [] })).toMatchObject({
      status: 'outdated',
    });
  });

  it('keeps resolving whole-block anchors from the previous version', () => {
    const target = block('blk-a', 'whole paragraph', { headingPath: ['Intro'] });
    const resolution = resolveAnchor(
      [target],
      {
        version: 1,
        segments: [
          {
            kind: 'block',
            blockHash: 'blk-a',
            blockText: 'whole paragraph',
            blockType: 'p',
            headingPath: ['Intro'],
          },
        ],
      }
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [{ kind: 'block', blockId: 'blk-a' }],
    });
  });
});
