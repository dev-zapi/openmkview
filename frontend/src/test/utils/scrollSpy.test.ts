import { describe, it, expect } from 'vitest';
import { computeActiveHeading } from '../../utils/scrollSpy';
import type { Heading } from '../../types';

describe('computeActiveHeading', () => {
  const headings: Heading[] = [
    { depth: 1, text: 'Introduction', id: 'introduction' },
    { depth: 2, text: 'Getting Started', id: 'getting-started' },
    { depth: 2, text: 'Installation', id: 'installation' },
    { depth: 3, text: 'Prerequisites', id: 'prerequisites' },
    { depth: 2, text: 'Configuration', id: 'configuration' },
    { depth: 1, text: 'API Reference', id: 'api-reference' },
  ];

  it('returns null when no headings are visible (above first heading)', () => {
    const visibleIds = new Set<string>();
    expect(computeActiveHeading(visibleIds, headings)).toBeNull();
  });

  it('returns the visible heading when only one is visible', () => {
    const visibleIds = new Set(['installation']);
    expect(computeActiveHeading(visibleIds, headings)).toBe('installation');
  });

  it('returns the topmost visible heading when multiple are visible', () => {
    const visibleIds = new Set(['getting-started', 'installation', 'prerequisites']);
    expect(computeActiveHeading(visibleIds, headings)).toBe('getting-started');
  });

  it('returns the last heading when it is the only one visible', () => {
    const visibleIds = new Set(['api-reference']);
    expect(computeActiveHeading(visibleIds, headings)).toBe('api-reference');
  });

  it('returns the first visible heading in document order when multiple are visible', () => {
    const visibleIds = new Set(['introduction', 'configuration', 'api-reference']);
    expect(computeActiveHeading(visibleIds, headings)).toBe('introduction');
  });

  it('ignores visible IDs that do not match any heading', () => {
    const visibleIds = new Set(['nonexistent', 'installation']);
    expect(computeActiveHeading(visibleIds, headings)).toBe('installation');
  });

  it('returns null when all visible IDs are unknown', () => {
    const visibleIds = new Set(['foo', 'bar']);
    expect(computeActiveHeading(visibleIds, headings)).toBeNull();
  });

  it('returns null when headings list is empty', () => {
    const visibleIds = new Set(['introduction']);
    expect(computeActiveHeading(visibleIds, [])).toBeNull();
  });

  it('handles single heading document', () => {
    const singleHeading: Heading[] = [
      { depth: 1, text: 'Only Heading', id: 'only-heading' },
    ];
    const visibleIds = new Set(['only-heading']);
    expect(computeActiveHeading(visibleIds, singleHeading)).toBe('only-heading');
  });

  it('returns null for single heading document when not visible', () => {
    const singleHeading: Heading[] = [
      { depth: 1, text: 'Only Heading', id: 'only-heading' },
    ];
    const visibleIds = new Set<string>();
    expect(computeActiveHeading(visibleIds, singleHeading)).toBeNull();
  });
});
