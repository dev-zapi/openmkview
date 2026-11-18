import { Marked } from 'marked';
import DOMPurify from 'dompurify';

/** Shared sanitizer allowlist for document and Annotation note Markdown. */
export const MARKDOWN_SANITIZE_OPTIONS = {
  ADD_ATTR: ['target', 'loading', 'decoding', 'data-type', 'data-code', 'data-theme', 'data-relative-path'],
  ADD_TAGS: ['mark', 'svg', 'path', 'g', 'rect', 'text', 'circle', 'line', 'polygon', 'polyline'],
};

export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, MARKDOWN_SANITIZE_OPTIONS);
}

const noteMarked = new Marked({ gfm: true, breaks: true });

/** Renders an Annotation note body through marked + DOMPurify. */
export function renderNoteMarkdown(markdown: string): string {
  const html = noteMarked.parse(markdown) as string;
  return sanitizeMarkdownHtml(html);
}
