import { describe, expect, it } from 'vitest';
import { resolveAnchor } from '../../utils/anchorResolver';
import type { BlockModel } from '../../utils/blockModel';
import type { AnnotationAnchor, BlockAnchorSegment, TextAnchorSegment } from '../../types';

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

/** A stored segment whose hash no longer identifies the current block. */
function textSegment(
  stored: BlockModel,
  quote: string,
  options: { prefix?: string; suffix?: string } = {}
): TextAnchorSegment {
  return {
    kind: 'text',
    blockHash: stored.id,
    blockText: stored.text,
    blockType: stored.type,
    headingPath: stored.headingPath,
    quote,
    prefix: options.prefix ?? '',
    suffix: options.suffix ?? '',
  };
}

function blockSegment(
  stored: BlockModel,
  blockText = stored.text
): BlockAnchorSegment {
  return {
    kind: 'block',
    blockHash: stored.id,
    blockText,
    blockType: stored.type,
    headingPath: stored.headingPath,
  };
}

function textAnchor(...segments: AnnotationAnchor['segments']): AnnotationAnchor {
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

  it('resolves normalized whitespace edits from a stale hash', () => {
    const stored = block('blk-stale', 'alpha   beta\n\tgamma');
    const current = block('blk-current', 'alpha beta gamma');
    const resolution = resolveAnchor(
      [current],
      textAnchor(textSegment(stored, 'beta   gamma'))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current',
          start: 6,
          end: 16,
          quote: 'beta gamma',
        },
      ],
    });
  });

  it('resolves after blocks are reordered and a new block is inserted above', () => {
    const stored = block('blk-stale', 'Keep this sentence intact.');
    const inserted = block('blk-new', 'A newly inserted paragraph.');
    const target = block('blk-current', 'Keep this sentence intact.');
    const resolution = resolveAnchor(
      [inserted, target],
      textAnchor(textSegment(stored, 'this sentence'))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current',
          start: 5,
          end: 18,
          quote: 'this sentence',
        },
      ],
    });
  });

  it('resolves when the quote survives a partial rewrite nearby', () => {
    const stored = block('blk-stale', 'An old observation in a paragraph.');
    const rewritten = block(
      'blk-current',
      'A rewritten paragraph keeps this observation intact.'
    );
    const resolution = resolveAnchor(
      [rewritten],
      textAnchor(textSegment(stored, 'this observation', { suffix: ' intact' }))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current',
          start: 28,
          end: 44,
          quote: 'this observation',
        },
      ],
    });
  });

  it('reports Outdated with a snapshot when the quote is gone', () => {
    const stored = block('blk-stale', 'Original text to annotate.');
    const rewritten = block('blk-current', 'Completely different prose now.');
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
    const storedFirst = block('blk-stale-a', 'The argument starts in the first paragraph.');
    const storedSecond = block('blk-stale-b', 'It continues into the second paragraph.');
    const storedThird = block('blk-stale-c', 'And ends in the third paragraph.');
    const currentFirst = block('blk-current-a', 'The argument starts in the first paragraph.');
    const currentSecond = block('blk-current-b', 'It continues into the second paragraph.');
    const currentThird = block('blk-current-c', 'And ends in the third paragraph.');

    const resolution = resolveAnchor(
      [currentFirst, currentSecond, currentThird],
      textAnchor(
        textSegment(storedFirst, 'starts in the first paragraph'),
        textSegment(storedSecond, 'It continues into the second paragraph'),
        textSegment(storedThird, 'And ends in the third')
      )
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current-a',
          start: 13,
          end: 42,
          quote: 'starts in the first paragraph',
        },
        {
          kind: 'text',
          blockId: 'blk-current-b',
          start: 0,
          end: 38,
          quote: 'It continues into the second paragraph',
        },
        {
          kind: 'text',
          blockId: 'blk-current-c',
          start: 0,
          end: 21,
          quote: 'And ends in the third',
        },
      ],
    });
  });

  it('reports the whole anchor Outdated when one segment no longer matches', () => {
    const storedFirst = block('blk-stale-a', 'The kept first part.');
    const storedSecond = block('blk-stale-b', 'The removed second part.');
    const currentFirst = block('blk-current-a', 'The kept first part.');
    const currentSecond = block('blk-current-b', 'Entirely new wording here.');

    const resolution = resolveAnchor(
      [currentFirst, currentSecond],
      textAnchor(
        textSegment(storedFirst, 'kept first part'),
        textSegment(storedSecond, 'removed second part')
      )
    );

    expect(resolution).toEqual({
      status: 'outdated',
      snapshot: 'kept first part\n\nremoved second part',
    });
  });

  it('prefers matching context over a stale block hash', () => {
    // The stored hash still points at the first block, but the annotation was
    // taken from the second one; context must win.
    const stored = block('blk-stale', 'Mention of the repeated phrase.');
    const first = block('blk-first', 'First mention of the repeated phrase here.');
    const second = block('blk-second', 'A later mention of the repeated phrase too.');
    const resolution = resolveAnchor(
      [first, second],
      textAnchor(
        textSegment(stored, 'the repeated phrase', {
          prefix: 'A later mention of ',
          suffix: ' too.',
        })
      )
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-second',
          start: 19,
          end: 38,
          quote: 'the repeated phrase',
        },
      ],
    });
  });

  it('reports Outdated for equal-score duplicate quotes with no context', () => {
    const stored = block('blk-stale', 'mention of the repeated phrase');
    const first = block('blk-first', 'First mention of the repeated phrase here.');
    const second = block('blk-second', 'A later mention of the repeated phrase too.');

    const resolution = resolveAnchor(
      [first, second],
      textAnchor(textSegment(stored, 'the repeated phrase'))
    );

    expect(resolution).toEqual({
      status: 'outdated',
      snapshot: 'the repeated phrase',
    });
  });

  it('uses document order for equal occurrences inside one block', () => {
    const target = block('blk-current', 'alpha beta alpha beta');
    const stored = block('blk-stale', 'alpha beta alpha beta');

    const resolution = resolveAnchor(
      [target],
      textAnchor(textSegment(stored, 'beta'))
    );

    expect(resolution.status).toBe('resolved');
    if (resolution.status !== 'resolved') return;
    expect(resolution.segments[0]).toMatchObject({ start: 6, end: 10 });
  });

  it('resolves a whole-block anchor after a heading-path change from a stale hash', () => {
    const stored = block('blk-stale', 'Stable paragraph content.', {
      headingPath: ['Old heading'],
    });
    const renamed = block('blk-current', 'Stable paragraph content.', {
      headingPath: ['New heading'],
    });
    const resolution = resolveAnchor(
      [renamed],
      textAnchor(blockSegment(stored))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [{ kind: 'block', blockId: 'blk-current' }],
    });
  });

  it('reports an ambiguous whole-block anchor Outdated instead of guessing', () => {
    const stored = block('blk-stale', 'Identical paragraph.');
    const first = block('blk-first', 'Identical paragraph.');
    const second = block('blk-second', 'Identical paragraph.');

    const resolution = resolveAnchor(
      [first, second],
      textAnchor(blockSegment(stored))
    );

    expect(resolution.status).toBe('outdated');
  });

  it('does not let a stale hash pick the inserted duplicate above', () => {
    const stored = block('blk-now-inserted', 'Identical paragraph.', {
      headingPath: ['Original Section'],
    });
    const inserted = block('blk-now-inserted', 'Identical paragraph.', {
      headingPath: ['Other Section'],
    });
    const original = block('blk-current', 'Identical paragraph.', {
      headingPath: ['Original Section'],
    });

    const resolution = resolveAnchor(
      [inserted, original],
      textAnchor(textSegment(stored, 'Identical paragraph'))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current',
          start: 0,
          end: 19,
          quote: 'Identical paragraph',
        },
      ],
    });
  });

  it('resolves by text when inline formatting changed', () => {
    const stored = block('blk-stale', 'Call the **function** now.');
    const formatted = block('blk-current', 'Call the function now.');
    const resolution = resolveAnchor(
      [formatted],
      textAnchor(textSegment(stored, 'the function'))
    );

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-current',
          start: 5,
          end: 17,
          quote: 'the function',
        },
      ],
    });
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
    const target = block('blk-current', 'whole paragraph', { headingPath: ['Intro'] });
    const stored = block('blk-stale', 'whole paragraph', { headingPath: ['Intro'] });
    const resolution = resolveAnchor([target], textAnchor(blockSegment(stored)));

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [{ kind: 'block', blockId: 'blk-current' }],
    });
  });

  it('prefers the exact-case occurrence when case-insensitive scores tie', () => {
    const target = block('blk-a', 'HELLO hello');
    const resolution = resolveAnchor([target], textAnchor(textSegment(target, 'hello')));

    expect(resolution).toEqual({
      status: 'resolved',
      segments: [
        {
          kind: 'text',
          blockId: 'blk-a',
          start: 6,
          end: 11,
          quote: 'hello',
        },
      ],
    });
  });
});
