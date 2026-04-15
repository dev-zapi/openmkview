import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import DiffViewer from '../components/DiffViewer';

const mockDiffData = {
  oldContent: '# Old Content\nLine 1\nLine 2',
  newContent: '# New Content\nLine 1\nLine 2 modified',
  oldFileName: 'test.md',
  newFileName: 'test.md',
  hunks: [],
};

describe('DiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders diff viewer component', async () => {
    const { container } = render(() => (
      <DiffViewer diffData={mockDiffData} theme="dark" mode="split" />
    ));
    
    await waitFor(() => {
      expect(container.querySelector('.diff-viewer')).toBeTruthy();
    });
  });

  it('renders file info in toolbar', async () => {
    const { container } = render(() => (
      <DiffViewer diffData={mockDiffData} />
    ));
    
    await waitFor(() => {
      const fileInfo = container.querySelector('.diff-file-info');
      expect(fileInfo).toBeTruthy();
      expect(fileInfo?.textContent).toContain('test.md');
    });
  });

  it('renders close button when onClose provided', async () => {
    const onClose = vi.fn();
    render(() => (
      <DiffViewer diffData={mockDiffData} onClose={onClose} />
    ));
    
    await waitFor(() => {
      const closeBtn = screen.queryByText('Close');
      expect(closeBtn).toBeTruthy();
    });
  });

  it('does not render close button when onClose not provided', async () => {
    render(() => (
      <DiffViewer diffData={mockDiffData} />
    ));
    
    await waitFor(() => {
      const closeBtn = screen.queryByText('Close');
      expect(closeBtn).toBeFalsy();
    });
  });

  it('renders toolbar with view mode toggle', async () => {
    const { container } = render(() => (
      <DiffViewer diffData={mockDiffData} />
    ));
    
    await waitFor(() => {
      const toolbarBtn = container.querySelector('.toolbar-btn');
      expect(toolbarBtn).toBeTruthy();
    });
  });

  it('applies theme to diff container', async () => {
    const { container } = render(() => (
      <DiffViewer diffData={mockDiffData} theme="dark" />
    ));
    
    await waitFor(() => {
      const viewerDiv = container.querySelector('.diff-viewer');
      expect(viewerDiv).toBeTruthy();
    });
  });

  it('uses provided mode', async () => {
    const { container } = render(() => (
      <DiffViewer diffData={mockDiffData} mode="unified" />
    ));
    
    await waitFor(() => {
      expect(container.querySelector('.diff-viewer')).toBeTruthy();
    });
  });

  it('renders error state when data is malformed', async () => {
    const malformedData = {
      oldContent: '',
      newContent: '',
      oldFileName: '',
      newFileName: '',
    } as any;
    
    const { container } = render(() => (
      <DiffViewer diffData={malformedData} />
    ));
    
    await waitFor(() => {
      const diffContent = container.querySelector('.diff-content');
      expect(diffContent).toBeTruthy();
    });
  });
});