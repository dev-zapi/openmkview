/**
 * Frontmatter parsing utility.
 * Extracts YAML frontmatter from markdown content and parses it into key-value pairs.
 */

export interface FrontmatterResult {
  /** Parsed frontmatter key-value pairs. Empty record if no frontmatter found. */
  data: Record<string, string>;
  /** Markdown content with frontmatter stripped. */
  content: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n?---\s*(?:\n|$)/;

/**
 * Parse YAML frontmatter from the beginning of a markdown string.
 *
 * Supports simple `key: value` pairs (single-line values only).
 * Quoted values (`"..."` or `'...'`) are unquoted automatically.
 * Lines that don't match `key: value` format are ignored.
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  const match = raw.match(FRONTMATTER_REGEX);

  if (!match) {
    return { data: {}, content: raw };
  }

  const yamlBlock = match[1];
  const content = raw.slice(match[0].length);
  const data: Record<string, string> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Strip surrounding quotes
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
       (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      data[key] = value;
    }
  }

  return { data, content };
}

/**
 * Returns true when the frontmatter data object is non-empty.
 */
export function hasFrontmatter(data: Record<string, string>): boolean {
  return Object.keys(data).length > 0;
}
