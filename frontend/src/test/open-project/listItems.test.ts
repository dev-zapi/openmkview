import { describe, it, expect } from 'vitest';
import { buildListItems } from '../../components/open-project/utils/listItems';

describe('buildListItems', () => {
  const recentProjects = [
    { id: '1', name: 'Alpha', path: '/alpha', last_opened_at: '2026-01-01' },
    { id: '2', name: 'Beta', path: '/beta', last_opened_at: '2026-01-02' },
    { id: '3', name: 'Gamma', path: '/gamma', last_opened_at: '2026-01-03' },
    { id: '4', name: 'Delta', path: '/delta', last_opened_at: '2026-01-04' },
  ];

  const searchResults = [
    { name: 'docs', path: '/workspace/docs', depth: 1, relative_path: 'docs' },
    { name: 'notes', path: '/workspace/notes', depth: 1, relative_path: 'notes' },
  ];

  it('returns top three recent projects when query is empty', () => {
    expect(buildListItems('', recentProjects, searchResults)).toEqual([
      { path: '/alpha', name: 'Alpha', icon: '📁', type: 'recent' },
      { path: '/beta', name: 'Beta', icon: '📁', type: 'recent' },
      { path: '/gamma', name: 'Gamma', icon: '📁', type: 'recent' },
    ]);
  });

  it('filters recent projects and appends search results when query exists', () => {
    expect(buildListItems('a', recentProjects, searchResults)).toEqual([
      { path: '/alpha', name: 'Alpha', icon: '📁', type: 'recent' },
      { path: '/beta', name: 'Beta', icon: '📁', type: 'recent' },
      { path: '/gamma', name: 'Gamma', icon: '📁', type: 'recent' },
      { path: '/workspace/docs', name: 'docs', icon: '📁', relativePath: 'docs', type: 'searchResult' },
      { path: '/workspace/notes', name: 'notes', icon: '📁', relativePath: 'notes', type: 'searchResult' },
    ]);
  });

  it('returns only search results when no recent projects match', () => {
    expect(buildListItems('zzz', recentProjects, searchResults)).toEqual([
      { path: '/workspace/docs', name: 'docs', icon: '📁', relativePath: 'docs', type: 'searchResult' },
      { path: '/workspace/notes', name: 'notes', icon: '📁', relativePath: 'notes', type: 'searchResult' },
    ]);
  });
});
