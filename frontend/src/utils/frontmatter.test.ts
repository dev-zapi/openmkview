import { describe, it, expect } from 'vitest';
import { parseFrontmatter, hasFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('should parse basic frontmatter', () => {
    const input = `---
title: Hello World
date: 2024-01-01
author: John
---
# Content here`;

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({
      title: 'Hello World',
      date: '2024-01-01',
      author: 'John',
    });
    expect(result.content).toBe('# Content here');
  });

  it('should handle quoted values', () => {
    const input = `---
title: "Hello: World"
description: 'Single quoted value'
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.data.title).toBe('Hello: World');
    expect(result.data.description).toBe('Single quoted value');
  });

  it('should return empty object when no frontmatter', () => {
    const input = `# Just markdown
No frontmatter here`;

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({});
    expect(result.content).toBe(input);
  });

  it('should handle empty frontmatter', () => {
    const input = `---
---
Content after`;

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({});
    expect(result.content).toBe('Content after');
  });

  it('should ignore comments in frontmatter', () => {
    const input = `---
title: Test
# This is a comment
author: Jane
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({
      title: 'Test',
      author: 'Jane',
    });
  });

  it('should ignore lines without colon', () => {
    const input = `---
title: Valid
Invalid line without colon
another: Valid too
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({
      title: 'Valid',
      another: 'Valid too',
    });
  });

  it('should handle frontmatter with Windows line endings', () => {
    const input = "---\r\ntitle: Test\r\nauthor: Jane\r\n---\r\nContent";

    const result = parseFrontmatter(input);
    
    expect(result.data).toEqual({
      title: 'Test',
      author: 'Jane',
    });
  });

  it('should preserve content exactly after frontmatter', () => {
    const input = `---
title: Test
---

# Heading

Some **markdown** content`;

    const result = parseFrontmatter(input);
    
    expect(result.content).toBe(`# Heading

Some **markdown** content`);
  });

  it('should handle multi-word values', () => {
    const input = `---
title: My Long Title Here
tags: tag1 tag2 tag3
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.data.title).toBe('My Long Title Here');
    expect(result.data.tags).toBe('tag1 tag2 tag3');
  });

  it('should handle values with special characters', () => {
    const input = `---
title: Test with special chars !@#$%^&*()
url: https://example.com/path?query=value
---
Content`;

    const result = parseFrontmatter(input);
    
    expect(result.data.title).toBe('Test with special chars !@#$%^&*()');
    expect(result.data.url).toBe('https://example.com/path?query=value');
  });
});

describe('hasFrontmatter', () => {
  it('should return true for non-empty object', () => {
    expect(hasFrontmatter({ title: 'Test' })).toBe(true);
  });

  it('should return false for empty object', () => {
    expect(hasFrontmatter({})).toBe(false);
  });
});