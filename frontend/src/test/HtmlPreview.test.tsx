import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import HtmlPreview from '../components/HtmlPreview';

describe('HtmlPreview', () => {
  it('renders html content in inline div when projectId is not provided', () => {
    const { container } = render(() => (
      <HtmlPreview content="<h1>Hello</h1>" currentFilePath="index.html" />
    ));

    // When projectId is not provided, component renders inline div, not iframe
    const inlineDiv = container.querySelector('.html-preview-inline');
    expect(inlineDiv).toBeTruthy();
    expect(inlineDiv?.innerHTML).toContain('<h1>Hello</h1>');
  });

  it('renders iframe with src url when projectId is provided', () => {
    const { container } = render(() => (
      <HtmlPreview
        content={'<img src="./images/logo.png"><link rel="stylesheet" href="style.css">'}
        currentFilePath="docs/index.html"
        projectId={7}
      />
    ));

    // When projectId is provided, component renders iframe with src attribute
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe?.getAttribute('src')).toContain('/api/files/raw?relativePath=docs%2Findex.html&project_id=7');
  });
});
