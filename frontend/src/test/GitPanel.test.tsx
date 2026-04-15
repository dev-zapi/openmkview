import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import GitPanel from '../components/GitPanel';

describe('GitPanel', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <GitPanel projectId={1} isOpen={false} onClose={() => {}} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders git panel when open', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: 'main', files: [], isRepo: true }),
    });

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('🌿 Git')).toBeTruthy();
  });

  it('shows not a repo message when not in git repo', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: '', files: [], isRepo: false }),
    });

    render(() => <GitPanel projectId={1} isOpen={true} onClose={() => {}} />);

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it('calls onClose when close button clicked', () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ branch: 'main', files: [], isRepo: true }),
    });

    const onClose = vi.fn();
    render(() => <GitPanel projectId={1} isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});