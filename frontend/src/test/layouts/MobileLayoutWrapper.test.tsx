import { afterEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { MobileLayoutWrapper } from '../../layouts/MobileLayoutWrapper';
import { mobileLayoutStore } from '../../components/mobile';
import type { Project } from '../../types';
import type { Settings } from '../../types/app';
import { createSignal, type ComponentProps } from 'solid-js';

const settings: Settings = {
  markdownWidth: { mode: 'full', fixedWidth: '900px' },
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

const alternateProject: Project = {
  id: 2,
  name: 'Workspace',
  path: '/workspace',
  color: '#ff6b6b',
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
  onOpenProject: () => {},
  onOpenTrash: () => {},
  onOpenSettings: () => {},
  onToggleTheme: () => {},
  onEditProject: () => {},
  onProjectClick: () => {},
  onFileClick: () => {},
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
    mobileLayoutStore.openLeftDrawer();

    expect(screen.getByLabelText('Toggle navigation menu')).toBeTruthy();
    expect(screen.getByTestId('mobile-topbar-title').textContent).toBe('OpenMKView');
    expect(screen.getByTestId('mobile-sidebar-title').textContent).toBe('Explorer');
    expect(container.querySelectorAll('.documentTitleBar').length).toBe(0);
  });

  it('syncs app height to the visible viewport and cleans up on unmount', () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 812,
    });

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');
    const removePropertySpy = vi.spyOn(document.documentElement.style, 'removeProperty');

    const { unmount } = renderWrapper();

    expect(setPropertySpy).toHaveBeenCalledWith('--app-height', '812px');

    unmount();

    expect(removePropertySpy).toHaveBeenCalledWith('--app-height');
  });

  it('updates app height when visual viewport changes', () => {
    let visualViewportHeight = 724;
    const listeners = new Map<string, EventListener>();

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get height() {
          return visualViewportHeight;
        },
        addEventListener: vi.fn((event: string, listener: EventListener) => {
          listeners.set(event, listener);
        }),
        removeEventListener: vi.fn((event: string) => {
          listeners.delete(event);
        }),
      },
    });

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');

    const { unmount } = renderWrapper();
    const initialCallCount = setPropertySpy.mock.calls.length;

    expect(setPropertySpy).toHaveBeenLastCalledWith('--app-height', '724px');

    visualViewportHeight = 680;
    listeners.get('resize')?.(new Event('resize'));

    expect(setPropertySpy).toHaveBeenLastCalledWith('--app-height', '680px');
    expect(setPropertySpy.mock.calls.length).toBe(initialCallCount + 1);

    listeners.get('scroll')?.(new Event('scroll'));

    expect(setPropertySpy.mock.calls.length).toBe(initialCallCount + 1);

    unmount();
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

  it('updates selected project button and top bar title when active project changes', async () => {
    const coloredProject = { ...project, color: '#c2185b' };
    const [activeProject, setActiveProject] = createSignal<Project | null>(coloredProject);

    render(() => (
      <MobileLayoutWrapper
        {...createProps({
          projects: [coloredProject, alternateProject],
          activeProject: activeProject(),
          renderProjectIcon: (item) => <span>{item.name[0]}</span>,
          getProjectStyle: (item) => item.color ? { background: item.color } : {},
        })}
      />
    ));

    mobileLayoutStore.openLeftDrawer();
    const demoButton = await screen.findByLabelText('Demo');
    const workspaceButton = await screen.findByLabelText('Workspace');

    expect(screen.getByTestId('mobile-topbar-title').textContent).toBe('Demo');
    expect(screen.getByTestId('mobile-sidebar-title').textContent).toBe('Demo');
    expect(demoButton.className).toContain('activityBarButtonActive');
    expect(demoButton.getAttribute('style')).toContain('background: rgb(194, 24, 91)');
    // After refactor, non-active buttons have no special classes (simplified border styling)
    // Workspace button has color, so it still has style attribute (applied regardless of active state)
    expect(workspaceButton.className).toContain('activityBarButton');
    expect(workspaceButton.className).not.toContain('activityBarButtonActive');
    expect(workspaceButton.getAttribute('style')).toContain('background: rgb(255, 107, 107)');

    setActiveProject(alternateProject);

    expect(screen.getByTestId('mobile-topbar-title').textContent).toBe('Workspace');
    expect(screen.getByTestId('mobile-sidebar-title').textContent).toBe('Workspace');
    const demoButtonAfterSwitch = screen.getByLabelText('Demo');
    const workspaceButtonAfterSwitch = screen.getByLabelText('Workspace');

    // After refactor, non-active buttons have no special classes
    // Demo button still has color, so style attribute remains
    expect(demoButtonAfterSwitch.className).toContain('activityBarButton');
    expect(demoButtonAfterSwitch.className).not.toContain('activityBarButtonActive');
    expect(demoButtonAfterSwitch.getAttribute('style')).toContain('background: rgb(194, 24, 91)');
    expect(workspaceButtonAfterSwitch.className).toContain('activityBarButtonActive');
    expect(workspaceButtonAfterSwitch.getAttribute('style')).toContain('background: rgb(255, 107, 107)');
  });
});
