import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProject } from '../../hooks/useProject';
import { projectStore } from '../../stores/projectStore';
import { appStore } from '../../stores/appStore';
import { openProjectStore } from '../../stores/openProjectStore';
import { editorStore } from '../../stores/editorStore';
import type { Project } from '../../types';

vi.mock('../../services/api', () => ({
  api: {
    getFileTree: vi.fn().mockResolvedValue([]),
    closeProject: vi.fn().mockResolvedValue(undefined),
    updateProjectColor: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn(),
    searchFavicons: vi.fn(),
    getFileRawUrl: vi.fn((relativePath: string, projectId: number) =>
      `/api/files/raw?relativePath=${encodeURIComponent(relativePath)}&project_id=${projectId}`
    ),
  },
}));

describe('useProject', () => {
  const project: Project = {
    id: 1,
    name: 'alpha',
    path: '/workspace/alpha',
    color: '#123456',
  };

  beforeEach(() => {
    projectStore.setProjects([]);
    projectStore.setActiveProject(null);
    editorStore.reset();
    appStore.setActiveTab('preview');
    appStore.closeColorPicker();
    appStore.closeOpenProjectDialog();
    openProjectStore.resetAll();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 900,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the open-project dialog', () => {
    const { openProject } = useProject();

    openProject();

    expect(appStore.openProjectDialogOpen()).toBe(true);
  });

  it('closes the open-project dialog', () => {
    const { closeOpenProjectDialog } = useProject();
    appStore.openOpenProjectDialog();

    closeOpenProjectDialog();

    expect(appStore.openProjectDialogOpen()).toBe(false);
  });

  it('returns project color style when color exists', () => {
    const { getColorStyle } = useProject();

    expect(getColorStyle(project)).toEqual({ background: '#123456' });
  });

  it('returns empty color style when color is missing', () => {
    const { getColorStyle } = useProject();

    expect(getColorStyle({ ...project, color: undefined })).toEqual({});
  });

  it('uses icon as display name when present', () => {
    const { getProjectDisplayName } = useProject();

    expect(getProjectDisplayName({ ...project, icon: 'Z' })).toBe('Z');
  });

  it('falls back to uppercase first letter for display name', () => {
    const { getProjectDisplayName } = useProject();

    expect(getProjectDisplayName(project)).toBe('A');
  });

  it('detects favicon icons and extracts the path', () => {
    const { isFaviconIcon, getFaviconPath } = useProject();

    expect(isFaviconIcon('favicon:assets/icon.png')).toBe(true);
    expect(isFaviconIcon('plain-icon')).toBe(false);
    expect(getFaviconPath('favicon:assets/icon.png')).toBe('assets/icon.png');
  });

  it('renders favicon icon metadata', () => {
    const { renderProjectIconContent } = useProject();

    expect(renderProjectIconContent({ ...project, icon: 'favicon:assets/icon.png' })).toEqual({
      type: 'image',
      src: '/api/files/raw?relativePath=assets%2Ficon.png&project_id=1',
    });
  });

  it('renders text icon metadata', () => {
    const { renderProjectIconContent } = useProject();

    expect(renderProjectIconContent(project)).toEqual({
      type: 'text',
      text: 'A',
    });
  });

  it('opens color picker beside the clicked element', () => {
    const { openColorPicker } = useProject();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    const currentTarget = {
      getBoundingClientRect: () => ({ left: 100, right: 140, top: 50 }),
    } as HTMLElement;

    openColorPicker(
      {
        preventDefault,
        stopPropagation,
        currentTarget,
      } as unknown as MouseEvent,
      42
    );

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(appStore.colorPickerOpen()).toBe(true);
    expect(appStore.colorPickerProjectId()).toBe(42);
    expect(appStore.colorPickerPosition()).toEqual({ x: 148, y: 50 });
  });

  it('repositions color picker to stay within viewport', () => {
    const { openColorPicker } = useProject();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 360,
    });

    openColorPicker(
      {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        currentTarget: {
          getBoundingClientRect: () => ({ left: 220, right: 260, top: 240 }),
        } as HTMLElement,
      } as unknown as MouseEvent,
      7
    );

    expect(appStore.colorPickerPosition()).toEqual({ x: 8, y: 240 });
  });

  it('opens color picker from explicit coordinates', () => {
    const { openColorPickerAt } = useProject();

    openColorPickerAt(9, { left: 32, right: 72, top: 44 });

    expect(appStore.colorPickerOpen()).toBe(true);
    expect(appStore.colorPickerProjectId()).toBe(9);
    expect(appStore.colorPickerPosition()).toEqual({ x: 80, y: 44 });
  });

  it('clamps explicit color picker coordinates within the viewport', () => {
    const { openColorPickerAt } = useProject();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 320,
    });

    openColorPickerAt(9, { left: 220, right: 260, top: 260 });

    expect(appStore.colorPickerPosition()).toEqual({ x: 8, y: 260 });
  });

  it('returns false when switching projects is cancelled by dirty editor confirmation', async () => {
    const { switchProject } = useProject();
    const targetProject = { ...project, id: 2, name: 'beta' };
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    editorStore.initialize('old');
    editorStore.updateContent('new');

    appStore.setActiveTab('edit');
    projectStore.setActiveProject(project);

    await expect(switchProject(targetProject)).resolves.toBe(false);
    expect(projectStore.state.activeProject).toEqual(project);
    expect(editorStore.editContent()).toBe('new');
    expect(editorStore.isDirty()).toBe(true);
  });
});
