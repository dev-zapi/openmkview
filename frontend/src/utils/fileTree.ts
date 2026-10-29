import type { FileNode } from '../types';

/**
 * Synthetic row inserted under a Placeholder Directory so expanding it shows a
 * single notice instead of enumerating its contents.
 */
export const PLACEHOLDER_NOTICE_NAME = '(此目录不支持展开)';

/** Remove trailing slashes so paths can be compared reliably. */
export function normalizeTreePath(path: string): string {
  return path.replace(/\/+$/, '');
}

/** True when the path points at the synthetic placeholder notice row. */
export function isPlaceholderNoticePath(path: string): boolean {
  return (
    path === PLACEHOLDER_NOTICE_NAME ||
    path.endsWith(`/${PLACEHOLDER_NOTICE_NAME}`)
  );
}

/** Recursively drop Hidden Entries when the show-hidden preference is off. */
export function filterVisibleNodes(
  nodes: FileNode[],
  showHidden: boolean
): FileNode[] {
  const visible: FileNode[] = [];
  for (const node of nodes) {
    if (node.hidden && !showHidden) continue;
    if (node.children) {
      visible.push({
        ...node,
        children: filterVisibleNodes(node.children, showHidden),
      });
    } else {
      visible.push(node);
    }
  }
  return visible;
}

/**
 * Convert the tree into the flat path list consumed by @pierre/trees.
 *
 * Hidden Entries are filtered out before the model sees them, so the built-in
 * tree search also respects the toggle. Placeholder Directories emit their own
 * directory path plus a single synthetic notice child and never descend into
 * `children`.
 */
export function fileNodesToPaths(
  nodes: FileNode[],
  showHidden: boolean
): string[] {
  const paths: string[] = [];

  const traverse = (node: FileNode) => {
    if (node.hidden && !showHidden) return;

    const path = normalizeTreePath(node.path);
    if (!node.isFolder) {
      paths.push(path);
      return;
    }

    paths.push(`${path}/`);
    if (node.isPlaceholder) {
      paths.push(`${path}/${PLACEHOLDER_NOTICE_NAME}`);
      return;
    }

    for (const child of node.children ?? []) {
      traverse(child);
    }
  };

  for (const node of nodes) {
    traverse(node);
  }
  return paths;
}

/** Collect normalized paths of every Placeholder Directory in the tree. */
export function collectPlaceholderPaths(nodes: FileNode[]): Set<string> {
  const paths = new Set<string>();

  const traverse = (node: FileNode) => {
    if (node.isFolder && node.isPlaceholder) {
      paths.add(normalizeTreePath(node.path));
    }
    for (const child of node.children ?? []) {
      traverse(child);
    }
  };

  for (const node of nodes) {
    traverse(node);
  }
  return paths;
}
