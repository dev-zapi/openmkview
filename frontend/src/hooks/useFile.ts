import { api } from '../services/api';
import { fileStore } from '../stores/fileStore';
import { editorStore } from '../stores/editorStore';
import { projectStore } from '../stores/projectStore';
import { appStore } from '../stores/appStore';
import { diffStore } from '../stores/diffStore';
import { offlineStore } from '../stores/offlineStore';
import { navigateToFile } from '../utils/router';
import { settingsStore } from '../stores/settingsStore';
import { mobileLayoutStore } from '../stores/mobileLayoutStore';
import type { FileNode } from '../types';

/** Map the open file's path when its own path or an ancestor directory is renamed. */
function mapPathAfterRename(
  currentPath: string,
  renamedPath: string,
  newName: string
): string | null {
  const parent = renamedPath.includes('/')
    ? renamedPath.slice(0, renamedPath.lastIndexOf('/') + 1)
    : '';
  const replacement = `${parent}${newName}`;

  if (currentPath === renamedPath) return replacement;
  if (currentPath.startsWith(`${renamedPath}/`)) {
    return `${replacement}${currentPath.slice(renamedPath.length)}`;
  }
  return null;
}

export const useFile = () => {
  const confirmDiscardIfDirty = (): boolean => {
    if (editorStore.isDirty() && appStore.activeTab() === 'edit') {
      const confirmed = confirm('You have unsaved changes. Do you want to continue?');
      if (!confirmed) {
        return false;
      }
      editorStore.discardChanges();
    }
    return true;
  };

  const openFile = async (path: string, updateUrl: boolean = true) => {
    const project = projectStore.state.activeProject;
    if (!project) return;

    if (!confirmDiscardIfDirty()) return;

    const node = fileStore.findNodeByPath(path);
    const fileType = node?.fileType;

    if (fileType === 'image') {
      fileStore.openImageFile(api.getFileRawUrl(path, project.id), node?.name || '');
      editorStore.reset();
      diffStore.reset();
      appStore.setActiveTab('preview');
      if (updateUrl) {
        navigateToFile(project.id, path);
      }
      return;
    }

    fileStore.startLoading();
    try {
      const content = await api.getFileContent(path, project.id);

      if (fileType === 'other' || content.binary) {
        // Source Fallback for text files without a dedicated renderer; binaries
        // get a placeholder page.
        fileStore.openOtherFile(content);
        editorStore.reset();
        diffStore.reset();
        appStore.setActiveTab(content.binary ? 'preview' : 'source');
      } else {
        fileStore.openDocumentFile(content, fileType === 'html' ? 'html' : 'markdown');
        editorStore.initialize(content.content);
        diffStore.reset();
        appStore.setActiveTab('preview');
      }

      if (updateUrl) {
        navigateToFile(project.id, path);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      fileStore.setLoadError(
        offlineStore.online()
          ? 'Failed to load the file'
          : 'You are offline and this content is not cached',
      );
    } finally {
      fileStore.finishLoading();
    }
  };

  const deleteFile = async (node: FileNode) => {
    const project = projectStore.state.activeProject;
    if (!project) return;

    if (settingsStore.isProtectedPath(node.path)) {
      alert(`Cannot delete protected path: ${node.name}`);
      return;
    }

    const confirmed = confirm(`Move "${node.name}" to trash?`);
    if (!confirmed) return;

    try {
      await api.moveToTrash(node.path, project.id, node.isFolder);
      
      const tree = await api.getFileTree(project.id);
      fileStore.setFileTree(tree);
      
      if (fileStore.currentFile()?.path === node.path) {
        fileStore.closeFile();
      }
    } catch (error) {
      console.error('Failed to move to trash:', error);
      alert('Failed to move to trash');
    }
  };

  const copyPath = async (node: FileNode) => {
    const project = projectStore.state.activeProject;
    if (!project) return;
    
    const fullPath = `${project.path}/${node.path}`;
    
    try {
      await navigator.clipboard.writeText(fullPath);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullPath;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const renameFile = async (node: FileNode) => {
    const project = projectStore.state.activeProject;
    if (!project) return;

    const newName = prompt('Enter new name:', node.name);
    if (!newName || newName === node.name) return;

    try {
      await api.renameFile(node.path, newName, project.id);

      const tree = await api.getFileTree(project.id);
      fileStore.setFileTree(tree);

      // Annotations follow the file because the backend migrated their
      // stored relative paths; reopen the current file under its new path.
      const currentPath = fileStore.currentFile()?.path;
      const nextPath = currentPath
        ? mapPathAfterRename(currentPath, node.path, newName)
        : null;
      if (nextPath) {
        await openFile(nextPath, true);
      }
    } catch (error) {
      console.error('Failed to rename:', error);
      alert(`Failed to rename: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const mobileFileClick = async (path: string, updateUrl?: boolean) => {
    mobileLayoutStore.closeLeftDrawer();
    await openFile(path, updateUrl ?? true);
  };

  const handleTrashRestore = async () => {
    const project = projectStore.state.activeProject;
    if (!project) return;
    
    const tree = await api.getFileTree(project.id);
    fileStore.setFileTree(tree);
  };

  const closeDiff = () => {
    diffStore.reset();
    appStore.setActiveTab('preview');
  };

  return {
    confirmDiscardIfDirty,
    openFile,
    deleteFile,
    copyPath,
    renameFile,
    mobileFileClick,
    handleTrashRestore,
    closeDiff,
  };
};

export default useFile;
