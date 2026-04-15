import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import SourceView from '../components/SourceView';

vi.mock('../services/shikiService', () => ({
  highlightCode: vi.fn().mockResolvedValue({
    html: '<pre class="shiki"><code>test</code></pre>',
  }),
}));

describe('SourceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(() => (
      <SourceView content="const x = 1;" fileName="test.js" />
    ));
    expect(screen.getByText('Highlighting...')).toBeTruthy();
  });

  it('renders highlighted content after loading', async () => {
    const { container } = render(() => (
      <SourceView content="const x = 1;" fileName="test.js" />
    ));
    
    await waitFor(() => {
      const highlighted = container.querySelector('.source-highlighted');
      expect(highlighted).toBeTruthy();
    });
  });

  it('shows nothing when content is empty', async () => {
    const { container } = render(() => (
      <SourceView content="" fileName="test.js" />
    ));
    
    await waitFor(() => {
      const highlighted = container.querySelector('.source-highlighted');
      expect(highlighted?.innerHTML).toBeFalsy();
    });
  });

  it('detects language from file extension', async () => {
    const { highlightCode } = await import('../services/shikiService');
    
    render(() => (
      <SourceView content="def hello(): pass" fileName="test.py" />
    ));
    
    await waitFor(() => {
      expect(highlightCode).toHaveBeenCalledWith({
        code: 'def hello(): pass',
        lang: 'python',
        theme: undefined,
      });
    });
  });

  it('uses text language for unknown extensions', async () => {
    const { highlightCode } = await import('../services/shikiService');
    
    render(() => (
      <SourceView content="some content" fileName="test.xyz" />
    ));
    
    await waitFor(() => {
      expect(highlightCode).toHaveBeenCalledWith({
        code: 'some content',
        lang: 'text',
        theme: undefined,
      });
    });
  });

  it('handles error gracefully', async () => {
    const { highlightCode } = await import('../services/shikiService');
    highlightCode.mockRejectedValueOnce(new Error('Highlight failed'));
    
    const { container } = render(() => (
      <SourceView content="test" fileName="test.js" />
    ));
    
    await waitFor(() => {
      const errorDiv = container.querySelector('.source-error');
      expect(errorDiv).toBeTruthy();
    });
  });
});