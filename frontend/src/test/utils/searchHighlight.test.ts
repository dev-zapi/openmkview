import { describe, expect, it } from 'vitest';
import {
  clearSearchHighlights,
  highlightSearchMatches,
  setActiveSearchMatch,
} from '../../utils/searchHighlight';

describe('searchHighlight utils', () => {
  it('highlights all case-insensitive matches in text content', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>Hello world</p><p>HELLO again</p>';

    const matches = highlightSearchMatches(root, 'hello');

    expect(matches).toHaveLength(2);
    expect(root.querySelectorAll('mark[data-search-highlight="true"]')).toHaveLength(2);
  });

  it('marks the current active match', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>alpha beta alpha</p>';

    const matches = highlightSearchMatches(root, 'alpha');
    setActiveSearchMatch(matches, 2);

    expect(matches[0].classList.contains('search-match-current')).toBe(false);
    expect(matches[1].classList.contains('search-match-current')).toBe(true);
  });

  it('clears existing highlight marks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p>preview search preview</p>';

    highlightSearchMatches(root, 'preview');
    clearSearchHighlights(root);

    expect(root.querySelector('mark[data-search-highlight="true"]')).toBeNull();
    expect(root.textContent).toBe('preview search preview');
  });
});
