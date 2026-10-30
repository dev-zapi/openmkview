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

/** Custom glyph for code languages the built-in 'complete' set has no icon for. */
export const GENERIC_CODE_ICON = 'openmkview-file-tree-code';

const GENERIC_CODE_ICON_SPRITE =
  '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden"><symbol id="' +
  GENERIC_CODE_ICON +
  '" viewBox="0 0 16 16">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
  'd="M6 4 2.5 8 6 12M10 4l3.5 4L10 12M9 3 7 13"/>' +
  '</symbol></svg>';

/**
 * Extensions in each category that @pierre/trees' built-in 'complete' set does
 * not resolve to a dedicated glyph. They are remapped to a category icon so the
 * classifier above actually governs the tree instead of leaving them generic.
 */
const CODE_EXTENSIONS_WITHOUT_BUILTIN_ICON = [
  'java', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'cs', 'php',
  'kt', 'kts', 'scala', 'lua', 'r', 'ps1',
];
const CONFIG_EXTENSIONS_WITHOUT_BUILTIN_ICON = ['toml', 'env', 'lock'];
const ARCHIVE_EXTENSIONS_WITHOUT_BUILTIN_ICON = ['zst'];

const CATEGORY_FALLBACK_ICON: Record<FileIconCategory, string> = {
  code: GENERIC_CODE_ICON,
  config: 'text',
  archive: 'zip',
  font: 'font',
  default: 'default',
};

/** Icon per extension for the gaps left by the built-in set. */
const EXTENSION_ICON_REMAPS: Record<string, string> = {};
for (const extension of [
  ...CODE_EXTENSIONS_WITHOUT_BUILTIN_ICON,
  ...CONFIG_EXTENSIONS_WITHOUT_BUILTIN_ICON,
  ...ARCHIVE_EXTENSIONS_WITHOUT_BUILTIN_ICON,
]) {
  EXTENSION_ICON_REMAPS[extension] =
    CATEGORY_FALLBACK_ICON[getFileIconCategory(`file.${extension}`)];
}
// Structured-data glyphs fit these config files better than the generic text icon.
EXTENSION_ICON_REMAPS.toml = 'json';
EXTENSION_ICON_REMAPS.lock = 'json';

/**
 * Built-in icon set for the tree. The complete set already resolves most
 * extensions to dedicated glyphs; the remaps fill the gaps so every extension
 * the classifier recognizes gets a category icon.
 */
export const FILE_TREE_ICONS: FileTreeIcons = {
  set: 'complete',
  colored: true,
  spriteSheet: GENERIC_CODE_ICON_SPRITE,
  byFileExtension: EXTENSION_ICON_REMAPS,
};

export function getFileTreeIcons(): FileTreeIcons {
  return FILE_TREE_ICONS;
}
