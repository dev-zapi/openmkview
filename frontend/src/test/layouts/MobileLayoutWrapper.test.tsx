import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { MobileLayoutWrapper } from '../../layouts/MobileLayoutWrapper';
import { mobileLayoutStore } from '../../components/mobile';
import type { Project } from '../../types';
import type { Settings } from '../../types/app';
import type { ComponentProps } from 'solid-js';

const settings: Settings = {
  markdownWidth: 'full',
  fixedWidth: '900px',
  themeMode: 'system',
  lightTheme: 'light-default',
  darkTheme: 'dark-default',
  uiFontFamily: 'MiSans, sans-serif',
  markdownFontFamily: 'Georgia, "Noto Serif", serif',
  uiFontSize: '14px',
  markdownFontSize: '16px',
  protectedPaths: ['.git'],
  trashExpireDays: 30,
};

const project: Project = {
  id: 1,
  name: 'Demo',
  path: '/demo',
};

type MobileLayoutWrapperProps = ComponentProps<typeof MobileLayoutWrapper>;

const createProps = (overrides: Partial<MobileLayoutWrapperProps> = {}): MobileLayoutWrapperProps => ({
  projects: [],
  activeProject: null,
  currentFile: null,
  currentFileType: 'markdown',
  imagePreviewUrl: null,
  imageFileName: '',
  activeTab: 'preview',
  headings: [],
  loading: false,
  editContent: '',
  isDirty: false,
  saving: false,
  settings,
  theme: 'light',
  themeMode: 'system',
  markdownStyle: {},
  isSearchOpen: false,
  searchQuery: '',
  searchResultCount: 0,
  currentSearchResult: 0,
  searchRequestKey: 0,
  fileTree: [],
  expandedFolders: new Set(),
  onOpenProject: () => {},
  onOpenTrash: () => {},
  onOpenSettings: () => {},
  onToggleTheme: () => {},
  onEditProject: () => {},
  onOpenProjectColorChangeAt: () => {},
  onProjectClick: () => {},
  onProjectActionSwitch: async () => true,
  onFileClick: () => {},
  onFolderToggle: () => {},
  onDelete: () => {},
  onCopyPath: () => {},
  onRename: () => {},
  onTabChange: () => {},
  onOutlineToggle: () => {},
  onSearchClick: () => {},
  onSearchClose: () => {},
  onSearchQueryChange: () => {},
  onSearchNext: () => {},
  onSearchPrev: () => {},
  onSearchResultsChange: () => {},
  onHeadingsExtracted: () => {},
  onContentChange: () => {},
  onSave: () => {},
  onCloseDiff: () => {},
  renderProjectIcon: () => <span>A</span>,
  getProjectStyle: () => ({}),
  ...overrides,
});

const renderWrapper = (overrides: Partial<MobileLayoutWrapperProps> = {}) => {
  const props = createProps(overrides);
  return render(() => <MobileLayoutWrapper {...props} />);
};

afterEach(() => {
  mobileLayoutStore.closeAllDrawers();
  vi.useRealTimers();
});

describe('MobileLayoutWrapper', () => {
  it('renders mobile layout shell', () => {
    const { container } = renderWrapper();

    expect(screen.getByLabelText('Toggle navigation menu')).toBeTruthy();
    expect(screen.getAllByText('OpenMKView').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.documentTitleBar').length).toBe(0);
  });

  it('switches project on click in mobile drawer', async () => {
    const onProjectClick = vi.fn();

    renderWrapper({
      projects: [project],
      activeProject: project,
      onProjectClick,
    });

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');
    await fireEvent.click(projectButton);

    expect(onProjectClick).toHaveBeenCalledWith(project);
  });

  it('opens project action sheet with keyboard and restores focus on escape', async () => {
    renderWrapper({
      projects: [project],
      activeProject: project,
    });

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');
    projectButton.focus();

    await fireEvent.keyDown(projectButton, { key: 'F10', shiftKey: true });

    const dialog = screen.getByRole('dialog', { name: 'Demo' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Project Actions')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit Project' }));

    await fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Demo' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(projectButton));
  });

  it('opens project actions on long press and suppresses touch click switch', async () => {
    vi.useFakeTimers();
    const onProjectClick = vi.fn();

    renderWrapper({
      projects: [project],
      activeProject: project,
      onProjectClick,
    });

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');

    await fireEvent.touchStart(projectButton, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    vi.advanceTimersByTime(500);

    expect(screen.getByRole('dialog', { name: 'Demo' })).toBeTruthy();

    await fireEvent.touchEnd(projectButton, {
      changedTouches: [{ clientX: 10, clientY: 10 }],
    });
    await fireEvent.click(projectButton);

    expect(onProjectClick).not.toHaveBeenCalled();
  });

  it('cancels long press when touch moves beyond threshold', async () => {
    vi.useFakeTimers();
    const onProjectClick = vi.fn();

    renderWrapper({
      projects: [project],
      activeProject: project,
      onProjectClick,
    });

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');

    await fireEvent.touchStart(projectButton, {
      touches: [{ clientX: 10, clientY: 10 }],
    });
    await fireEvent.touchMove(projectButton, {
      touches: [{ clientX: 26, clientY: 26 }],
    });
    vi.advanceTimersByTime(500);
    await fireEvent.touchEnd(projectButton, {
      changedTouches: [{ clientX: 26, clientY: 26 }],
    });

    expect(screen.queryByRole('dialog', { name: 'Demo' })).toBeNull();
    expect(onProjectClick).not.toHaveBeenCalled();
  });

  it('does not open edit dialog when project switch is cancelled', async () => {
    const onProjectActionSwitch = vi.fn().mockResolvedValue(false);
    const onEditProject = vi.fn();

    renderWrapper({
      projects: [project],
      activeProject: project,
      onProjectActionSwitch,
      onEditProject,
    });

    mobileLayoutStore.openLeftDrawer();
    const projectButton = await screen.findByLabelText('Demo');

    await fireEvent.keyDown(projectButton, { key: 'F10', shiftKey: true });
    await fireEvent.click(screen.getByRole('button', { name: 'Edit Project' }));

    expect(onProjectActionSwitch).toHaveBeenCalledWith(project);
    expect(screen.getByRole('dialog', { name: 'Demo' })).toBeTruthy();
    expect(onEditProject).not.toHaveBeenCalled();
  });
});
