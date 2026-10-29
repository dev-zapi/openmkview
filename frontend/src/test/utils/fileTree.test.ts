import { describe, expect, it } from 'vitest';
import type { FileNode } from '../../types';
import {
  PLACEHOLDER_NOTICE_NAME,
  collectPlaceholderPaths,
  fileNodesToPaths,
  filterVisibleNodes,
  isPlaceholderNoticePath,
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

  it('recognizes the placeholder notice row', () => {
    expect(isPlaceholderNoticePath(PLACEHOLDER_NOTICE_NAME)).toBe(true);
    expect(isPlaceholderNoticePath(`node_modules/${PLACEHOLDER_NOTICE_NAME}`)).toBe(true);
    expect(isPlaceholderNoticePath('node_modules/pkg')).toBe(false);
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

  it('emits a notice child for placeholder directories and does not descend', () => {
    const paths = fileNodesToPaths(tree, false);
    expect(paths).toContain('src/');
    expect(paths).toContain('src/index.ts');
    expect(paths).toContain('node_modules/');
    expect(paths).toContain(`node_modules/${PLACEHOLDER_NOTICE_NAME}`);
    expect(paths.filter((path) => path.startsWith('node_modules/')).sort()).toEqual([
      'node_modules/',
      `node_modules/${PLACEHOLDER_NOTICE_NAME}`,
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
