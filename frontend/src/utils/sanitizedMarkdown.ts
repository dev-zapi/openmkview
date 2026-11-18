import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { escapeHtml } from './html';
import { generateHeadingId, resolveImagePath } from './markdown';

/** Shared sanitizer allowlist for document and Annotation note Markdown. */
export const MARKDOWN_SANITIZE_OPTIONS = {
  ADD_ATTR: ['target', 'loading', 'decoding', 'data-type', 'data-code', 'data-theme', 'data-relative-path'],
  ADD_TAGS: ['mark', 'svg', 'path', 'g', 'rect', 'text', 'circle', 'line', 'polygon', 'polyline'],
};

export function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, MARKDOWN_SANITIZE_OPTIONS);
}

export interface MarkdownPipelineOptions {
  /** File being previewed; relative links/images resolve against it. */
  currentFilePath?: string;
  projectId?: number;
}

/**
 * The single marked configuration used for document content and Annotation
 * note bodies, so links, images, headings, and fenced code behave identically
 * (spec story 41). Document rendering additionally highlights code and builds
 * diagram widgets after this step.
 */
export function createMarkdownPipeline(options: MarkdownPipelineOptions = {}): Marked {
  const marked = new Marked({
    gfm: true,
    breaks: true,
  });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = generateHeadingId(text);
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = lang || 'text';
        return `<pre class="shiki-code-block" data-lang="${language}"><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
      },
      image({ href, title, text }) {
        let imageUrl = href || '';

        if (href && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('//')) {
          if (options.currentFilePath && options.projectId) {
            const absolutePath = resolveImagePath(options.currentFilePath, href);
            imageUrl = `/api/files/raw?path=${encodeURIComponent(absolutePath)}&project_id=${options.projectId}`;
          }
        }

        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const altText = text || '';
        return `<img src="${imageUrl}" alt="${escapeHtml(altText)}"${titleAttr} loading="lazy" decoding="async" />`;
      },
      link({ href, title, text }) {
        const linkHref = href || '';
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const linkText = text || '';

        // External links, anchors, mailto, tel, etc. - open in new tab
        if (
          linkHref.startsWith('http') ||
          linkHref.startsWith('//') ||
          linkHref.startsWith('mailto:') ||
          linkHref.startsWith('tel:') ||
          linkHref.startsWith('#') ||
          linkHref.startsWith('data:')
        ) {
          const targetAttr = linkHref.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"';
          return `<a href="${escapeHtml(linkHref)}"${targetAttr}${titleAttr}>${linkText}</a>`;
        }

        // Relative path link - resolve and mark for internal navigation
        if (options.currentFilePath) {
          const resolvedPath = resolveImagePath(options.currentFilePath, linkHref);
          return `<a href="#" data-relative-path="${escapeHtml(resolvedPath)}" class="internal-link" style="cursor:pointer"${titleAttr}>${linkText}</a>`;
        }

        return `<a href="${escapeHtml(linkHref)}"${titleAttr}>${linkText}</a>`;
      },
    },
  });

  return marked;
}

const notePipeline = createMarkdownPipeline();

/** Renders an Annotation note body through the document Markdown pipeline. */
export function renderNoteMarkdown(markdown: string): string {
  const html = notePipeline.parse(markdown) as string;
  return sanitizeMarkdownHtml(html);
}
