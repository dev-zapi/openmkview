import type { FileNode } from '../types';

/**
 * Notice shown when a Placeholder Directory is expanded. Rendered as a row
 * decoration rather than a synthetic child path, so tree search can never
 * surface it as if it were a real file.
 */
export const PLACEHOLDER_NOTICE_NAME = '(此目录不支持展开)';

/** Remove trailing slashes so paths can be compared reliably. */
export function normalizeTreePath(path: string): string {
  return path.replace(/\/+$/, '');
}

/**
 * Notice text for an expanded Placeholder Directory row, or null for every
 * other row.
 */
export function getPlaceholderNotice(
  placeholderPaths: ReadonlySet<string>,
  rowPath: string,
  isExpanded: boolean
): string | null {
  if (!isExpanded) return null;
  return placeholderPaths.has(normalizeTreePath(rowPath)) ? PLACEHOLDER_NOTICE_NAME : null;
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
 * tree search also respects the toggle. Placeholder Directories emit only their
 * own directory path and never descend into `children`; the "not expandable"
 * notice is a row decoration, not a synthetic path, so search cannot surface it
 * as a real file.
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
