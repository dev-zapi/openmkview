import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import DiffSelector from '../components/DiffSelector';
import { diffStore } from '../stores/diffStore';

vi.mock('../services/git', () => ({
  gitApi: {
    getBranches: vi.fn().mockResolvedValue(['main', 'develop', 'feature']),
    getTags: vi.fn().mockResolvedValue(['v1.0', 'v2.0']),
    getCommits: vi.fn().mockResolvedValue([
      { hash: 'abc123', message: 'Initial commit', date: '2024-01-01' },
      { hash: 'def456', message: 'Add feature', date: '2024-01-02' },
    ]),
    getFileDiff: vi.fn().mockResolvedValue({
      oldContent: 'old content',
      newContent: 'new content',
      oldFileName: 'test.md',
      newFileName: 'test.md',
      hunks: [],
    }),
  },
}));

describe('DiffSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diffStore.reset();
  });

  it('renders diff selector component', () => {
    const { container } = render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    expect(container.querySelector('.diff-selector')).toBeTruthy();
  });

  it('renders ref type selector', async () => {
    render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      expect(screen.getByText('Base')).toBeTruthy();
      expect(screen.getByText('Target')).toBeTruthy();
    });
  });

  it('renders compare arrow', async () => {
    const { container } = render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      const arrow = container.querySelector('.compare-arrow');
      expect(arrow).toBeTruthy();
      expect(arrow?.textContent).toBe('→');
    });
  });

  it('renders compare button', async () => {
    render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      expect(screen.getByText('Compare')).toBeTruthy();
    });
  });

  it('loads branches on mount', async () => {
    const { gitApi } = await import('../services/git');
    
    render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      expect(gitApi.getBranches).toHaveBeenCalledWith(1);
    });
  });

  it('loads tags on mount', async () => {
    const { gitApi } = await import('../services/git');
    
    render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      expect(gitApi.getTags).toHaveBeenCalledWith(1);
    });
  });

  it('loads commits on mount', async () => {
    const { gitApi } = await import('../services/git');
    
    render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      expect(gitApi.getCommits).toHaveBeenCalledWith(1);
    });
  });

  it('populates branch options after loading', async () => {
    const { container } = render(() => (
      <DiffSelector projectId={1} filePath="test.md" />
    ));
    
    await waitFor(() => {
      const branchOptions = container.querySelectorAll('option[value="main"]');
      expect(branchOptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders without crashing when projectId is 0', () => {
    const { container } = render(() => (
      <DiffSelector projectId={0} filePath="test.md" />
    ));
    expect(container.querySelector('.diff-selector')).toBeTruthy();
  });
});