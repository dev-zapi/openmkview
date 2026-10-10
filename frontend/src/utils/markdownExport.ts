import type { DocumentFileType } from '../types';

export type ExportFormat = 'pdf' | 'html' | 'md';

export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const isSafeUrl = (url: string): boolean => {
  const trimmedUrl = url.trim().toLowerCase();
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];

  for (const protocol of dangerousProtocols) {
    if (trimmedUrl.startsWith(protocol)) {
      return false;
    }
  }

  return true;
};

export const markdownToSafeHtml = (markdown: string): string => {
  let escaped = escapeHtml(markdown);

  escaped = escaped.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
  escaped = escaped.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
  escaped = escaped.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
  escaped = escaped.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_(.*?)_/g, '<em>$1</em>');
  escaped = escaped.replace(/~~(.*?)~~/g, '<del>$1</del>');
  escaped = escaped.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    if (isSafeUrl(url)) {
      return `<img alt="${escapeHtml(alt)}" src="${escapeHtml(url)}" />`;
    }
    return '[Image blocked: unsafe URL]';
  });
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    if (isSafeUrl(url)) {
      return `<a href="${escapeHtml(url)}">${text}</a>`;
    }
    return text;
  });
  escaped = escaped.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  escaped = escaped.replace(/\n/g, '<br />');

  return escaped;
};

const stripExtension = (fileName: string): string => fileName.replace(/\.[^/.]+$/, '');
const dateStamp = (date: Date): string => date.toISOString().slice(0, 10);

export const buildMarkdownDownloadName = (fileName: string, date: Date = new Date()): string => {
  return `${stripExtension(fileName)}_${dateStamp(date)}.md`;
};

export const buildHtmlDownloadName = (fileName: string, date: Date = new Date()): string => {
  return `${stripExtension(fileName)}_${dateStamp(date)}.html`;
};

export const buildPrintableMarkdownDocument = (fileName: string, content: string): string => {
  const safeHtmlBody = markdownToSafeHtml(content);
  const safeFileName = escapeHtml(fileName);

  return `<!DOCTYPE html>
<html>
<head>
  <title>${safeFileName}</title>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  ${safeHtmlBody}
</body>
</html>`;
};

/** Trigger a browser download of a text payload. */
export const downloadTextFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** Open a print window with the given full HTML document and invoke print(). */
export const printHtmlDocument = (html: string): boolean => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  // Load via a blob URL instead of document.write() to avoid XSS sinks
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  printWindow.addEventListener('load', () => {
    printWindow.print();
    URL.revokeObjectURL(url);
  });
  printWindow.location.href = url;
  return true;
};

/**
 * Export a document file in the requested format.
 * - markdown: pdf (print window), html (rendered standalone doc), md (source)
 * - html: pdf (print window of the raw html), html (source)
 */
export const exportDocument = (
  docType: DocumentFileType,
  fileName: string,
  content: string,
  format: ExportFormat,
): void => {
  switch (format) {
    case 'pdf': {
      const html = docType === 'html' ? content : buildPrintableMarkdownDocument(fileName, content);
      printHtmlDocument(html);
      break;
    }
    case 'html': {
      const html = docType === 'html' ? content : buildPrintableMarkdownDocument(fileName, content);
      downloadTextFile(html, buildHtmlDownloadName(fileName), 'text/html');
      break;
    }
    case 'md': {
      downloadTextFile(content, buildMarkdownDownloadName(fileName), 'text/markdown');
      break;
    }
  }
};
