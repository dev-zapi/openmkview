import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import OpenProjectDialog from '../../components/open-project/OpenProjectDialog';

const openProjectByPath = vi.fn();
const setSearchQuery = vi.fn();
const clearError = vi.fn();

vi.mock('../../components/open-project/hooks/useOpenProject', () => ({
  useOpenProject: () => ({
    state: { isLoading: false, error: null },
    searchQuery: () => '',
    debouncedQuery: () => '',
    searchResults: () => [],
    isSearching: () => false,
    recentProjects: () => [
      { id: '1', name: 'Alpha', path: '/alpha', last_opened_at: '2026-01-01' },
    ],
    isLoadingRecent: () => false,
    setSearchQuery,
    openProjectByPath,
    clearError,
  }),
}));

describe('OpenProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recent project items when open', () => {
    render(() => <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />);

    expect(screen.getByText('Open project')).toBeTruthy();
    expect(screen.getByText('Recent projects')).toBeTruthy();
    expect(screen.getByText('/alpha')).toBeTruthy();
  });

  it('opens selected path when list item is clicked', () => {
    render(() => <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />);

    fireEvent.click(screen.getByText('/alpha'));

    expect(openProjectByPath).toHaveBeenCalledWith('/alpha');
  });
});
