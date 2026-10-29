import type { FileTreeIcons } from '@pierre/trees';

export type FileIconCategory = 'code' | 'config' | 'archive' | 'font' | 'default';

const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts',
  'py', 'pyi', 'rs', 'go', 'java', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp',
  'cs', 'php', 'rb', 'swift', 'kt', 'kts', 'scala', 'lua', 'r',
  'sh', 'bash', 'zsh', 'fish', 'ps1',
  'css', 'scss', 'sass', 'less', 'styl',
  'vue', 'svelte', 'sql', 'graphql', 'gql',
]);

const CONFIG_EXTENSIONS = new Set([
  'json', 'jsonc', 'json5', 'jsonl', 'yaml', 'yml', 'toml',
  'ini', 'cfg', 'conf', 'env', 'lock',
]);

const ARCHIVE_EXTENSIONS = new Set([
  'zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'jar', 'war',
]);

const FONT_EXTENSIONS = new Set([
  'ttf', 'otf', 'woff', 'woff2', 'eot',
]);

function getExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Classify a file by extension for tree icon selection. */
export function getFileIconCategory(fileName: string): FileIconCategory {
  const ext = getExtension(fileName);
  if (CONFIG_EXTENSIONS.has(ext)) return 'config';
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
  if (FONT_EXTENSIONS.has(ext)) return 'font';
  if (CODE_EXTENSIONS.has(ext)) return 'code';
  return 'default';
}

/**
 * Built-in icon set for the tree. The complete set already resolves code,
 * config, archive and font extensions to dedicated glyphs; the extra remaps
 * fill small gaps (toml/lock/env) so the categories above always get an icon.
 */
export const FILE_TREE_ICONS: FileTreeIcons = {
  set: 'complete',
  colored: true,
  byFileExtension: {
    toml: 'json',
    lock: 'json',
    env: 'text',
  },
};

export function getFileTreeIcons(): FileTreeIcons {
  return FILE_TREE_ICONS;
}
