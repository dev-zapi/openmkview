import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import GitPanel from '../components/GitPanel';

describe('GitPanel', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  const mockStatus = (status: any) => {
    mockFetch.mockResolvedValueOnce({ json: async () => status });
  };

  const mockCommits = (commits: any[]) => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ entries: commits }) });
  };

  const mockActionSuccess = () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '' });
  };

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <GitPanel projectId={1} isOpen={false} onClose={() => {}} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders git panel when open', async () => {
    mockStatus({ branch: 'main', files: [], isRepo: true });
    mockCommits([]);

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('🌿 Git')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Branch: main')).toBeTruthy();
    });
  });

  it('shows not a repo message when not in git repo', async () => {
    mockStatus({ branch: '', files: [], isRepo: false });
    mockCommits([]);

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Not a Git repository')).toBeTruthy();
    });
  });

  it('calls onClose when close button clicked', async () => {
    mockStatus({ branch: 'main', files: [], isRepo: true });
    mockCommits([]);

    const onClose = vi.fn();
    render(() => <GitPanel projectId={1} isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Branch: main')).toBeTruthy();
    });

    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders changed files with status labels', async () => {
    mockStatus({
      branch: 'main',
      isRepo: true,
      files: [
        { path: 'README.md', index: 'M', workTree: ' ' },
        { path: 'src/new.ts', index: '?', workTree: '?' },
      ],
    });
    mockCommits([]);

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('README.md')).toBeTruthy();
      expect(screen.getByText('src/new.ts')).toBeTruthy();
      expect(screen.getByText('M')).toBeTruthy();
      expect(screen.getByText('U')).toBeTruthy();
    });
  });

  it('submits commit action and shows refreshed commits', async () => {
    mockStatus({ branch: 'main', files: [], isRepo: true });
    mockCommits([]);
    mockActionSuccess();
    mockStatus({ branch: 'main', files: [], isRepo: true });
    mockCommits([{ shortHash: 'abc123', message: 'msg', author: 'me', date: 'today' }]);

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Commit message...')).toBeTruthy();
    });

    fireEvent.input(screen.getByPlaceholderText('Commit message...'), {
      currentTarget: { value: 'test commit' },
      target: { value: 'test commit' },
    });
    fireEvent.click(screen.getByText('Commit'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/git', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'commit', project_id: 1, message: 'test commit' }),
      }));
    });

    fireEvent.click(screen.getByText('Commits'));

    await waitFor(() => {
      expect(screen.getByText('msg')).toBeTruthy();
      expect(screen.getByText('abc123')).toBeTruthy();
    });
  });

  it('keeps commit message when commit action fails', async () => {
    mockStatus({ branch: 'main', files: [], isRepo: true });
    mockCommits([]);
    mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'Commit failed' });

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Commit message...')).toBeTruthy();
    });

    fireEvent.input(screen.getByPlaceholderText('Commit message...'), {
      currentTarget: { value: 'test commit' },
      target: { value: 'test commit' },
    });
    fireEvent.click(screen.getByText('Commit'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('test commit')).toBeTruthy();
    });
  });
});
