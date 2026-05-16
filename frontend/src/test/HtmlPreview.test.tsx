import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import HtmlPreview from '../components/HtmlPreview';

describe('HtmlPreview', () => {
  it('renders html content in sandboxed iframe', () => {
    const { container } = render(() => (
      <HtmlPreview content="<h1>Hello</h1>" currentFilePath="index.html" />
    ));

    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(iframe?.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
  });

  it('rewrites relative resource urls through raw file endpoint', () => {
    const { container } = render(() => (
      <HtmlPreview
        content={'<img src="./images/logo.png"><link rel="stylesheet" href="style.css">'}
        currentFilePath="docs/index.html"
        projectId={7}
      />
    ));

    const srcdoc = container.querySelector('iframe')?.getAttribute('srcdoc') || '';
    expect(srcdoc).toContain('/api/files/raw?relativePath=docs%2Fimages%2Flogo.png&amp;project_id=7');
    expect(srcdoc).toContain('/api/files/raw?relativePath=docs%2Fstyle.css&amp;project_id=7');
  });
});
