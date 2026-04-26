import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFile } from '../../hooks/useFile';
import { fileStore } from '../../stores/fileStore';
import { appStore } from '../../stores/appStore';
import { diffStore } from '../../stores/diffStore';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import { editorStore } from '../../stores/editorStore';
import { projectStore } from '../../stores/projectStore';
import type { FileNode } from '../../types';

describe('useFile', () => {
  const node: FileNode = {
    id: '1',
    name: 'README.md',
    path: 'docs/README.md',
    isFolder: false,
    fileType: 'markdown',
  };

  beforeEach(() => {
    fileStore.reset();
    editorStore.reset();
    projectStore.setActiveProject(null);
    appStore.setActiveTab('edit');
    diffStore.setDiffMode(true);
    mobileLayoutStore.closeAllDrawers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discards changes when confirm accepts', () => {
    const { confirmDiscardIfDirty } = useFile();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    editorStore.initialize('old');
    editorStore.updateContent('new');

    expect(confirmDiscardIfDirty()).toBe(true);
    expect(editorStore.editContent()).toBe('old');
    expect(editorStore.isDirty()).toBe(false);
  });

  it('keeps changes when confirm rejects', () => {
    const { confirmDiscardIfDirty } = useFile();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    editorStore.initialize('old');
    editorStore.updateContent('new');

    expect(confirmDiscardIfDirty()).toBe(false);
    expect(editorStore.editContent()).toBe('new');
    expect(editorStore.isDirty()).toBe(true);
  });

  it('resets diff mode and returns to preview tab when closing diff', () => {
    const { closeDiff } = useFile();

    closeDiff();

    expect(diffStore.state.isDiffMode).toBe(false);
    expect(appStore.activeTab()).toBe('preview');
  });

  it('copies project-relative full path with clipboard API', async () => {
    const { copyPath } = useFile();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });

    await copyPath(node);

    expect(writeText).toHaveBeenCalledWith('/workspace/alpha/docs/README.md');
  });

  it('uses fallback copy path when clipboard API fails', async () => {
    const { copyPath } = useFile();
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });

    await copyPath(node);

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('does nothing when renaming to the same name', () => {
    const { renameFile } = useFile();
    vi.spyOn(window, 'prompt').mockReturnValue('README.md');
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    renameFile(node);

    expect(alertMock).not.toHaveBeenCalled();
  });

  it('shows placeholder alert when renaming to a new name', () => {
    const { renameFile } = useFile();
    vi.spyOn(window, 'prompt').mockReturnValue('GUIDE.md');
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    renameFile(node);

    expect(alertMock).toHaveBeenCalledWith('Rename functionality will be implemented in future version');
  });

  it('closes the left drawer before opening a file on mobile', async () => {
    const { mobileFileClick } = useFile();
    const closeLeftDrawerSpy = vi.spyOn(mobileLayoutStore, 'closeLeftDrawer');

    await mobileFileClick('docs/README.md', false);

    expect(closeLeftDrawerSpy).toHaveBeenCalled();
  });
});
