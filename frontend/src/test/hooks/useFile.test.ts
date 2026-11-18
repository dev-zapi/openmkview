import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFile } from '../../hooks/useFile';
import { fileStore } from '../../stores/fileStore';
import { appStore } from '../../stores/appStore';
import { diffStore } from '../../stores/diffStore';
import { mobileLayoutStore } from '../../stores/mobileLayoutStore';
import { editorStore } from '../../stores/editorStore';
import { projectStore } from '../../stores/projectStore';
import { api } from '../../services/api';
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
    editorStore.setDirty(true);

    expect(confirmDiscardIfDirty()).toBe(true);
    expect(editorStore.originalContent()).toBe('old');
    expect(editorStore.isDirty()).toBe(false);
  });

  it('keeps changes when confirm rejects', () => {
    const { confirmDiscardIfDirty } = useFile();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    editorStore.initialize('old');
    editorStore.setDirty(true);

    expect(confirmDiscardIfDirty()).toBe(false);
    expect(editorStore.originalContent()).toBe('old');
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

  it('renames the file through the API and refreshes the tree', async () => {
    const { renameFile } = useFile();
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    vi.spyOn(window, 'prompt').mockReturnValue('GUIDE.md');
    const rename = vi.spyOn(api, 'renameFile').mockResolvedValue(undefined);
    vi.spyOn(api, 'getFileTree').mockResolvedValue([]);

    await renameFile(node);

    expect(rename).toHaveBeenCalledWith('docs/README.md', 'GUIDE.md', 1);
    expect(api.getFileTree).toHaveBeenCalledWith(1);
    expect(fileStore.fileTree()).toEqual([]);
  });

  it('reopens the current file under its renamed path', async () => {
    const { renameFile } = useFile();
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    fileStore.openDocumentFile(
      { content: '# Readme', fileName: 'README.md', path: 'docs/README.md' },
      'markdown'
    );
    vi.spyOn(window, 'prompt').mockReturnValue('GUIDE.md');
    vi.spyOn(api, 'renameFile').mockResolvedValue(undefined);
    vi.spyOn(api, 'getFileTree').mockResolvedValue([{
      id: 'docs/GUIDE.md',
      name: 'GUIDE.md',
      path: 'docs/GUIDE.md',
      isFolder: false,
      fileType: 'markdown',
    }]);
    vi.spyOn(api, 'getFileContent').mockResolvedValue({
      content: '# Readme',
      fileName: 'GUIDE.md',
      path: 'docs/GUIDE.md',
    });

    await renameFile(node);

    expect(api.getFileContent).toHaveBeenCalledWith('docs/GUIDE.md', 1);
    expect(fileStore.currentFile()?.path).toBe('docs/GUIDE.md');
  });

  it('reopens a file nested inside a renamed directory', async () => {
    const { renameFile } = useFile();
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    fileStore.openDocumentFile(
      { content: '# Readme', fileName: 'README.md', path: 'docs/README.md' },
      'markdown'
    );
    vi.spyOn(window, 'prompt').mockReturnValue('guides');
    vi.spyOn(api, 'renameFile').mockResolvedValue(undefined);
    vi.spyOn(api, 'getFileTree').mockResolvedValue([{
      id: 'guides/README.md',
      name: 'README.md',
      path: 'guides/README.md',
      isFolder: false,
      fileType: 'markdown',
    }]);
    vi.spyOn(api, 'getFileContent').mockResolvedValue({
      content: '# Readme',
      fileName: 'README.md',
      path: 'guides/README.md',
    });

    await renameFile({ id: 'docs', name: 'docs', path: 'docs', isFolder: true });

    expect(api.getFileContent).toHaveBeenCalledWith('guides/README.md', 1);
    expect(fileStore.currentFile()?.path).toBe('guides/README.md');
  });

  it('alerts when the rename request fails', async () => {
    const { renameFile } = useFile();
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    vi.spyOn(window, 'prompt').mockReturnValue('GUIDE.md');
    vi.spyOn(api, 'renameFile').mockRejectedValue(new Error('Target file already exists'));
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    await renameFile(node);

    expect(alertMock).toHaveBeenCalledWith('Failed to rename: Target file already exists');
  });

  it('closes the left drawer before opening a file on mobile', async () => {
    const { mobileFileClick } = useFile();
    const closeLeftDrawerSpy = vi.spyOn(mobileLayoutStore, 'closeLeftDrawer');

    await mobileFileClick('docs/README.md', false);

    expect(closeLeftDrawerSpy).toHaveBeenCalled();
  });

  it('opens other text files on the source tab', async () => {
    const openFile = useFile().openFile;
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    fileStore.setFileTree([{
      id: 'script.ts',
      name: 'script.ts',
      path: 'script.ts',
      isFolder: false,
      fileType: 'other',
    }]);
    vi.spyOn(api, 'getFileContent').mockResolvedValue({
      content: 'const x = 1;',
      fileName: 'script.ts',
      path: 'script.ts',
      truncated: true,
      lossy: true,
    });

    await openFile('script.ts', false);

    expect(fileStore.currentFileType()).toBe('other');
    expect(appStore.activeTab()).toBe('source');
    expect(fileStore.currentFile()?.truncated).toBe(true);
  });

  it('opens binary files on the placeholder preview state', async () => {
    const openFile = useFile().openFile;
    projectStore.setActiveProject({ id: 1, name: 'alpha', path: '/workspace/alpha' });
    fileStore.setFileTree([{
      id: 'archive.zip',
      name: 'archive.zip',
      path: 'archive.zip',
      isFolder: false,
      fileType: 'other',
    }]);
    vi.spyOn(api, 'getFileContent').mockResolvedValue({
      content: '',
      fileName: 'archive.zip',
      path: 'archive.zip',
      binary: true,
      size: 2048,
    });

    await openFile('archive.zip', false);

    expect(fileStore.currentFileType()).toBe('other');
    expect(appStore.activeTab()).toBe('preview');
    expect(fileStore.currentFile()?.binary).toBe(true);
  });
});
