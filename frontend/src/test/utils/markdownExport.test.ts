import { describe, it, expect } from 'vitest';
import {
  buildMarkdownDownloadName,
  buildPrintableMarkdownDocument,
  escapeHtml,
  isSafeUrl,
  markdownToSafeHtml,
} from '../../utils/markdownExport';

describe('markdownExport utils', () => {
  it('escapes html entities', () => {
    expect(escapeHtml('<script>"x" & y</script>')).toBe('&lt;script&gt;&quot;x&quot; &amp; y&lt;/script&gt;');
  });

  it('rejects dangerous protocols', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl(' data:text/html,hi')).toBe(false);
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('converts markdown into escaped html', () => {
    const html = markdownToSafeHtml('# Title\n**Bold** and `code`');

    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('blocks unsafe links and images', () => {
    const html = markdownToSafeHtml('[x](javascript:alert(1)) ![img](file:///tmp/a.png)');

    expect(html).not.toContain('javascript:alert(1)');
    expect(html).not.toContain('file:///tmp/a.png');
    expect(html).toContain('[Image blocked: unsafe URL]');
    expect(html).not.toContain('!img');
  });

  it('renders safe images as img tags', () => {
    const html = markdownToSafeHtml('![img](https://example.com/a.png)');

    expect(html).toContain('<img alt="img" src="https://example.com/a.png" />');
  });

  it('builds markdown download names from file names and dates', () => {
    const fileName = buildMarkdownDownloadName('notes.md', new Date('2026-04-16T10:00:00.000Z'));

    expect(fileName).toBe('notes_2026-04-16.md');
  });

  it('builds printable html document with escaped title and body', () => {
    const documentHtml = buildPrintableMarkdownDocument('unsafe<script>.md', '# Hello\n<script>alert(1)</script>');

    expect(documentHtml).toContain('<title>unsafe&lt;script&gt;.md</title>');
    expect(documentHtml).toContain('<h1>Hello</h1>');
    expect(documentHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
