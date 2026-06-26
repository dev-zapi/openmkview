import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import OpenProjectDialog from '../../components/open-project/OpenProjectDialog';
import { useOpenProject } from '../../components/open-project/hooks/useOpenProject';

const openProjectByPath = vi.fn();
const setSearchQuery = vi.fn();
const clearError = vi.fn();

const createMockHook = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

vi.mock('../../components/open-project/hooks/useOpenProject', () => ({
  useOpenProject: vi.fn(() => createMockHook()),
}));

describe('OpenProjectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOpenProject).mockReturnValue(createMockHook());
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

  it('does not render folder-list-container when data is empty', () => {
    vi.mocked(useOpenProject).mockReturnValue(createMockHook({ recentProjects: () => [] }));

    const { container } = render(() => (
      <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />
    ));

    const folderListContainer = container.querySelector('.folder-list-container');
    expect(folderListContainer).toBeNull();
  });

  it('renders folder-list-container when data exists', () => {
    const { container } = render(() => (
      <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />
    ));

    const folderListContainer = container.querySelector('.folder-list-container');
    expect(folderListContainer).not.toBeNull();
  });

  it('shows loading state when loading recent projects', () => {
    vi.mocked(useOpenProject).mockReturnValue(
      createMockHook({ recentProjects: () => [], isLoadingRecent: () => true })
    );

    render(() => <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows error message when error exists', () => {
    vi.mocked(useOpenProject).mockReturnValue(
      createMockHook({ state: { isLoading: false, error: 'Test error message' } })
    );

    render(() => <OpenProjectDialog isOpen={true} onClose={() => {}} onProjectOpened={() => {}} />);

    expect(screen.getByText('Test error message')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(() => (
      <OpenProjectDialog isOpen={false} onClose={() => {}} onProjectOpened={() => {}} />
    ));

    expect(container.querySelector('.open-project-overlay')).toBeNull();
  });
});
