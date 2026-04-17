import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import TrashDialog from '../components/TrashDialog';

vi.mock('../services/api', () => {
  const mockTrashItems = [
    {
      id: '1234567890_readme.md',
      originalName: 'readme.md',
      originalPath: 'docs/readme.md',
      deletedAt: '2024-01-15T10:30:00Z',
      isFolder: false,
      size: 1234,
    },
    {
      id: '1234567891_old-folder',
      originalName: 'old-folder',
      originalPath: 'docs/old-folder',
      deletedAt: '2024-01-01T10:00:00Z',
      isFolder: true,
      size: 5000,
    },
  ];

  const mockTrashStats = {
    totalItems: 2,
    totalSize: 6234,
    oldestItemAge: 15,
  };

  return {
    api: {
      listTrash: vi.fn().mockResolvedValue(mockTrashItems),
      getTrashStats: vi.fn().mockResolvedValue(mockTrashStats),
      restoreFromTrash: vi.fn().mockResolvedValue(undefined),
      deleteFromTrash: vi.fn().mockResolvedValue(undefined),
      clearTrash: vi.fn().mockResolvedValue(undefined),
    },
  };
});

describe('TrashDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders trash dialog when open', () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    expect(screen.getByText('Trash')).toBeTruthy();
  });

  it('does not render when closed', () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={false}
        projectId={1}
        onClose={onClose}
      />
    ));

    expect(screen.queryByText('Trash')).toBeNull();
  });

  it('displays trash stats', async () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('2 items')).toBeTruthy();
    });
  });

  it('displays trash items', async () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('readme.md')).toBeTruthy();
      expect(screen.getByText('old-folder')).toBeTruthy();
    });
  });

  it('displays restore and delete buttons for each item', async () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    await waitFor(() => {
      const restoreButtons = screen.getAllByText('Restore');
      const deleteButtons = screen.getAllByText('Delete Forever');
      expect(restoreButtons.length).toBe(2);
      expect(deleteButtons.length).toBe(2);
    });
  });

  it('displays clear all button', () => {
    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    expect(screen.getByText('Clear All')).toBeTruthy();
  });

  it('calls restoreFromTrash when restore clicked', async () => {
    const { api } = await import('../services/api');
    const onClose = vi.fn();
    const onRestore = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
        onRestore={onRestore}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('readme.md')).toBeTruthy();
    });

    const restoreButtons = screen.getAllByText('Restore');
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(api.restoreFromTrash).toHaveBeenCalledWith('1234567890_readme.md', 1);
    });
  });

  it('shows empty message when trash is empty', async () => {
    const { api } = await import('../services/api');
    vi.mocked(api.listTrash).mockResolvedValueOnce([]);
    vi.mocked(api.getTrashStats).mockResolvedValueOnce({
      totalItems: 0,
      totalSize: 0,
      oldestItemAge: 0,
    });

    const onClose = vi.fn();
    
    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={onClose}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('Trash is empty')).toBeTruthy();
    });
  });

  it('confirms permanent delete before deleting item', async () => {
    const { api } = await import('../services/api');

    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={() => {}}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('readme.md')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('Delete Forever')[0]);

    await waitFor(() => {
      expect(screen.getByText('Permanently delete "readme.md"?')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Delete Forever', { selector: '.confirm-btn' }));

    await waitFor(() => {
      expect(api.deleteFromTrash).toHaveBeenCalledWith('1234567890_readme.md', 1);
    });
  });

  it('confirms clear all before clearing trash', async () => {
    const { api } = await import('../services/api');

    render(() => (
      <TrashDialog
        isOpen={true}
        projectId={1}
        onClose={() => {}}
      />
    ));

    await waitFor(() => {
      expect(screen.getByText('readme.md')).toBeTruthy();
      expect((screen.getByText('Clear All') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getAllByText('Clear All')[0]);

    await waitFor(() => {
      expect(screen.getByText('Clear all trash items?')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Clear All', { selector: '.confirm-btn' }));

    await waitFor(() => {
      expect(api.clearTrash).toHaveBeenCalledWith(1);
    });
  });
});
