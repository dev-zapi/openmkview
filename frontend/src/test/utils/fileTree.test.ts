import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import {
  PLACEHOLDER_NOTICE_NAME,
  collectPlaceholderPaths,
  fileNodesToPaths,
  filterVisibleNodes,
  getPlaceholderNotice,
  normalizeTreePath,
} from '../../utils/fileTree';

const tree: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    path: 'src',
    isFolder: true,
    children: [
      { id: 'src/index.ts', name: 'index.ts', path: 'src/index.ts', isFolder: false },
      {
        id: 'src/.cache',
        name: '.cache',
        path: 'src/.cache',
        isFolder: true,
        hidden: true,
        children: [
          { id: 'src/.cache/a', name: 'a', path: 'src/.cache/a', isFolder: false, hidden: true },
        ],
      },
    ],
  },
  {
    id: 'node_modules',
    name: 'node_modules',
    path: 'node_modules',
    isFolder: true,
    isPlaceholder: true,
    children: undefined,
  },
];

describe('fileTree utils', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeTreePath('src/')).toBe('src');
    expect(normalizeTreePath('/src//')).toBe('/src');
  });

  it('shows the notice when a Placeholder Directory is expanded', () => {
    const placeholders = collectPlaceholderPaths(tree);
    expect(getPlaceholderNotice(placeholders, 'node_modules/', true)).toBe(
      PLACEHOLDER_NOTICE_NAME
    );
    expect(getPlaceholderNotice(placeholders, 'node_modules', true)).toBe(
      PLACEHOLDER_NOTICE_NAME
    );
    expect(getPlaceholderNotice(placeholders, 'node_modules', false)).toBeNull();
    expect(getPlaceholderNotice(placeholders, 'src', true)).toBeNull();
  });

  it('filters Hidden Entries when the toggle is off', () => {
    const visible = filterVisibleNodes(tree, false);
    expect(visible.map((node) => node.name)).toEqual(['src', 'node_modules']);
    expect(visible[0].children?.map((node) => node.name)).toEqual(['index.ts']);
  });

  it('keeps Hidden Entries when the toggle is on', () => {
    const visible = filterVisibleNodes(tree, true);
    expect(visible[0].children?.map((node) => node.name)).toEqual(['index.ts', '.cache']);
  });

  it('does not add a searchable notice path for placeholder directories', () => {
    const paths = fileNodesToPaths(tree, false);
    expect(paths).toContain('src/');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('node_modules/');
    expect(paths.some((path) => path.includes(PLACEHOLDER_NOTICE_NAME))).toBe(false);
    expect(paths.filter((path) => path.startsWith('node_modules/'))).toEqual([
      'node_modules/',
    ]);
  });

  it('drops hidden paths before the tree model sees them', () => {
    const paths = fileNodesToPaths(tree, false);
    expect(paths).not.toContain('src/.cache/');
    expect(paths).not.toContain('src/.cache/a');
  });

  it('collects placeholder directory paths', () => {
    expect([...collectPlaceholderPaths(tree)]).toEqual(['node_modules']);
  });
});
