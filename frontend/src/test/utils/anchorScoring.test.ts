import { describe, expect, it } from 'vitest';
import {
  anchorExcerpt,
  blockMatchScore,
  findQuoteMatches,
  occurrenceScore,
  selectWholeBlock,
  type ScorableBlock,
} from '../../utils/anchorScoring';
import type { AnnotationAnchor, BlockAnchorSegment, TextAnchorSegment } from '../../types';

function textSegment(
  quote: string,
  options: { prefix?: string; suffix?: string } = {}
): TextAnchorSegment {
  return {
    kind: 'text',
    blockHash: 'blk-stale',
    blockText: 'current text',
    blockType: 'p',
    headingPath: [],
    quote,
    prefix: options.prefix ?? '',
    suffix: options.suffix ?? '',
  };
}

function blockSegment(blockText: string, headingPath: string[] = []): BlockAnchorSegment {
  return {
    kind: 'block',
    blockHash: 'blk-stale',
    blockText,
    blockType: 'p',
    headingPath,
  };
}

describe('anchorScoring shared seam', () => {
  it('finds exact and case-drifted quote matches with one normalization', () => {
    const matches = findQuoteMatches('The QUICK brown fox.', 'quick   brown   fox');

    // Whitespace is normalized inside the seam; the case-drifted occurrence
    // must carry the normalized needle width.
    expect(matches).toEqual([{ start: 4, end: 19 }]);
  });

  it('scores occurrences from the shared block/context/exact formula', () => {
    const segment = textSegment('quick', { prefix: 'The ' });
    const base = blockMatchScore({ text: 'The quick fox.', type: 'p', headingPath: [] }, segment);
    const better = occurrenceScore(
      base,
      'The quick fox.',
      { start: 4, end: 9 },
      segment,
      'quick'
    );
    const worse = occurrenceScore(
      base,
      'The quick fox.',
      { start: 10, end: 13 },
      segment,
      'fox'
    );

    expect(better).toBeGreaterThan(worse);
  });

  it('selects a unique whole-block match by the caller identity key', () => {
    const candidates: ScorableBlock[] = [
      { text: 'Other paragraph.', type: 'p', headingPath: [] },
      { text: 'Stable paragraph.', type: 'p', headingPath: ['Intro'] },
    ];

    const selected = selectWholeBlock(
      candidates,
      (candidate) => candidate,
      blockSegment('Stable paragraph.', ['Intro']),
      (candidate) => candidate.text
    );

    expect(selected).toBe(candidates[1]);
  });

  it('refuses an ambiguous whole-block match across different tie keys', () => {
    const candidates: ScorableBlock[] = [
      { text: 'Identical paragraph.', type: 'p', headingPath: ['A'] },
      { text: 'Identical paragraph.', type: 'p', headingPath: ['B'] },
    ];

    expect(
      selectWholeBlock(
        candidates,
        (candidate) => candidate,
        blockSegment('Identical paragraph.'),
        (candidate) => candidate.headingPath.join('/')
      )
    ).toBeNull();
  });

  it('uses document order for equal whole-block scores within one tie key', () => {
    const candidates: ScorableBlock[] = [
      { text: 'Identical paragraph.', type: 'p', headingPath: ['A'] },
      { text: 'Identical paragraph.', type: 'p', headingPath: ['A'] },
    ];

    expect(
      selectWholeBlock(
        candidates,
        (candidate) => candidate,
        blockSegment('Identical paragraph.'),
        (candidate) => candidate.headingPath.join('/')
      )
    ).toBe(candidates[0]);
  });

  it('builds one excerpt shape for every annotation surface', () => {
    const anchor: AnnotationAnchor = {
      version: 1,
      segments: [
        textSegment('  selected words  '),
        blockSegment(' whole block text '),
        blockSegment('   '),
      ],
    };

    expect(anchorExcerpt(anchor)).toBe('selected words … whole block text');
    expect(anchorExcerpt(anchor, '\n\n')).toBe('selected words\n\nwhole block text');
    expect(anchorExcerpt(null)).toBe('');
  });
});
