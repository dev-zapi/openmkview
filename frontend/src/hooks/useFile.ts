import { api } from '../services/api';
import { fileStore } from '../stores/fileStore';
import { editorStore } from '../stores/editorStore';
import { projectStore } from '../stores/projectStore';
import { appStore } from '../stores/appStore';
import { diffStore } from '../stores/diffStore';
import { navigateToFile } from '../utils/router';
import { settingsStore } from '../stores/settingsStore';
import { mobileLayoutStore } from '../stores/mobileLayoutStore';
import type { FileNode } from '../types';

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
      fileStore.openMarkdownFile(content);
      editorStore.initialize(content.content);
      diffStore.reset();
      appStore.setActiveTab('preview');
      if (updateUrl) {
        navigateToFile(project.id, path);
      }
    } catch (error) {
      console.error('Failed to load file:', error);
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

  const renameFile = (node: FileNode) => {
    const newName = prompt('Enter new name:', node.name);
    if (!newName || newName === node.name) return;
    
    alert('Rename functionality will be implemented in future version');
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