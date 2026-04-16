import { describe, it, expect } from 'vitest';
import { generateHeadingId, resolveImagePath } from '../../utils/markdown';

describe('markdown utils', () => {
  it('generates heading ids from text', () => {
    expect(generateHeadingId('Hello World')).toBe('hello-world');
    expect(generateHeadingId('Section 1: Intro')).toBe('section-1-intro');
  });

  it('resolves relative image paths', () => {
    expect(resolveImagePath('docs/readme.md', 'image.png')).toBe('docs/image.png');
    expect(resolveImagePath('docs/sub/readme.md', '../image.png')).toBe('docs/image.png');
  });
});
