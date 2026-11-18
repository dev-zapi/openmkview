import { describe, expect, it } from 'vitest';
import { locateAnchorInSource } from '../../utils/sourceAnchorLocator';
import type {
  AnnotationAnchor,
  BlockAnchorSegment,
  TextAnchorSegment,
} from '../../types';

function textSegment(
  quote: string,
  options: { prefix?: string; suffix?: string; headingPath?: string[]; blockText?: string } = {}
): TextAnchorSegment {
  return {
    kind: 'text',
    blockHash: 'blk-stale',
    blockText: options.blockText ?? quote,
    blockType: 'p',
    headingPath: options.headingPath ?? [],
    quote,
    prefix: options.prefix ?? '',
    suffix: options.suffix ?? '',
  };
}

function blockSegment(
  blockText: string,
  options: { headingPath?: string[] } = {}
): BlockAnchorSegment {
  return {
    kind: 'block',
    blockHash: 'blk-stale',
    blockText,
    blockType: 'p',
    headingPath: options.headingPath ?? [],
  };
}

function anchor(...segments: AnnotationAnchor['segments']): AnnotationAnchor {
  return { version: 1, segments };
}

describe('sourceAnchorLocator utils', () => {
  it('locates an exact quote on its source line', () => {
    const markdown = [
      '# Source Echo',
      '',
      'The quick brown fox jumps over the lazy dog.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(markdown, anchor(textSegment('quick brown fox')));

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('locates a whitespace-drifted quote spanning source lines', () => {
    const markdown = [
      '# Source Echo',
      '',
      'The   quick',
      'brown fox jumps over the lazy dog.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('quick    brown   fox'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 4 }],
    });
  });

  it('locates a case-drifted quote', () => {
    const markdown = ['# Source Echo', '', 'The Quick Brown Fox jumps.', ''].join('\n');

    const location = locateAnchorInSource(markdown, anchor(textSegment('quick brown fox')));

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('returns every source range for a multi-segment Anchor', () => {
    const markdown = [
      '# Source Echo',
      '',
      'The quick brown fox jumps.',
      '',
      'A second paragraph explains the next step.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(
        textSegment('quick brown fox'),
        textSegment('second paragraph explains')
      )
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [
        { start: 3, end: 3 },
        { start: 5, end: 5 },
      ],
    });
  });

  it('locates quotes spanning fenced code lines', () => {
    const markdown = [
      '# Code',
      '',
      '```js',
      'const value = 1;',
      'const other = 2;',
      '```',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('value = 1; const other = 2;'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 4, end: 5 }],
    });
  });

  it('locates a whole-block Anchor whose rendered text drops inline markup', () => {
    const markdown = [
      '# Source Echo',
      '',
      'The **quick** brown fox _jumps_ over the lazy dog.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(blockSegment('The quick brown fox jumps over the lazy dog.'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('becomes Outdated when any segment cannot be located', () => {
    const markdown = ['# Source Echo', '', 'The quick brown fox jumps.', ''].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('quick brown fox'), textSegment('a quote that is gone'))
    );

    expect(location).toEqual({
      status: 'outdated',
      snapshot: 'quick brown fox\n\na quote that is gone',
    });
  });

  it('uses stored context to choose between repeated quotes', () => {
    const markdown = [
      '# Source Echo',
      '',
      'Alpha context repeated target sentence.',
      '',
      'Beta context repeated target sentence.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(
        textSegment('repeated target sentence', {
          prefix: 'Beta context ',
          suffix: '.',
        })
      )
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 5, end: 5 }],
    });
  });

  it('uses the heading path to choose between identical paragraphs', () => {
    const markdown = [
      '# First Section',
      '',
      'Identical words in both sections.',
      '',
      '# Second Section',
      '',
      'Identical words in both sections.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('Identical words', { headingPath: ['Second Section'] }))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 7, end: 7 }],
    });
  });

  it('never guesses when a quote is equally plausible on different lines', () => {
    const markdown = [
      '# Source Echo',
      '',
      'A shared sentence appears here.',
      '',
      'A shared sentence appears here.',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('A shared sentence appears here.'))
    );

    expect(location).toEqual({
      status: 'outdated',
      snapshot: 'A shared sentence appears here.',
    });
  });

  it('accepts repeated occurrences that map to the same source line', () => {
    const markdown = ['# Echo', '', 'echo echo echo', ''].join('\n');

    const location = locateAnchorInSource(markdown, anchor(textSegment('echo')));

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('locates a heading block by its rendered text', () => {
    const markdown = ['# Echo Title', '', 'Body.', ''].join('\n');

    const location = locateAnchorInSource(markdown, anchor(blockSegment('Echo Title')));

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 1, end: 1 }],
    });
  });

  it('locates a fenced code block by its source text, not the fence lines', () => {
    const markdown = [
      '# Code',
      '',
      '```rust',
      'const value = 1;',
      'const other = 2;',
      '```',
      '',
    ].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(blockSegment('const value = 1; const other = 2;'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 4, end: 5 }],
    });
  });

  it('locates rendered inline-code text', () => {
    const markdown = ['# Commands', '', 'Run `npm test` before committing.', ''].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(blockSegment('Run npm test before committing.'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('merges segments that land on the same source line', () => {
    const markdown = ['# Source Echo', '', 'The quick brown fox jumps.', ''].join('\n');

    const location = locateAnchorInSource(
      markdown,
      anchor(textSegment('quick'), textSegment('brown fox'))
    );

    expect(location).toEqual({
      status: 'located',
      ranges: [{ start: 3, end: 3 }],
    });
  });

  it('is Outdated for missing, empty, or malformed Anchors', () => {
    const markdown = ['# Source Echo', '', 'The quick brown fox jumps.', ''].join('\n');

    expect(locateAnchorInSource(markdown, null)).toEqual({
      status: 'outdated',
      snapshot: '',
    });
    expect(locateAnchorInSource(markdown, { version: 1, segments: [] })).toEqual({
      status: 'outdated',
      snapshot: '',
    });
    expect(
      locateAnchorInSource(markdown, {
        version: 1,
        segments: [{ kind: 'text' } as unknown as TextAnchorSegment],
      })
    ).toEqual({ status: 'outdated', snapshot: '' });
  });
});
