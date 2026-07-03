import { api } from '../services/api';
import { editorStore } from '../stores/editorStore';
import { fileStore } from '../stores/fileStore';
import { projectStore } from '../stores/projectStore';
import { appStore } from '../stores/appStore';
import type { TabType } from '../components/markdown-header/ViewTabs';

let getEditorContent: (() => string) | null = null;

export const useEditor = () => {
  const registerContentGetter = (getter: () => string) => {
    getEditorContent = getter;
  };

  const handleDirtyChange = (isDirty: boolean) => {
    editorStore.setDirty(isDirty);
  };

  const confirmDiscardIfDirty = (): boolean => {
    if (editorStore.isDirty() && appStore.activeTab() === 'edit') {
      const confirmed = confirm('You have unsaved changes. Do you want to continue?');
      if (!confirmed) return false;
    }
    return true;
  };

  const saveFile = async () => {
    const project = projectStore.state.activeProject;
    const file = fileStore.currentFile();
    if (!project || !file || !editorStore.isDirty()) return;

    const content = getEditorContent?.() || '';

    editorStore.startSaving();
    try {
      const expectedModifiedAt = file.lastModified;
      const response = await api.saveFileContent(
        file.path,
        content,
        project.id,
        expectedModifiedAt
      );

      if (response.success) {
        editorStore.markSaved(content);
        const updatedFile = await api.getFileContent(file.path, project.id);
        fileStore.setCurrentFile(updatedFile);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save file';

      if (errorMessage.includes('Conflict') || errorMessage.includes('modified externally')) {
        alert('This file has been modified externally. Please reload the file to see the latest version, then make your changes again.');
      } else {
        alert(errorMessage);
      }
    } finally {
      editorStore.finishSaving();
    }
  };

  const changeTab = (tab: TabType) => {
    if (editorStore.isDirty() && appStore.activeTab() === 'edit' && tab !== 'edit') {
      const confirmed = confirm('You have unsaved changes. Do you want to continue?');
      if (!confirmed) return;
    }
    appStore.setActiveTab(tab);
  };

  const handleHeadingsExtracted = (headings: Parameters<typeof fileStore.setHeadings>[0]) => {
    fileStore.setHeadings(headings);
  };

  return {
    registerContentGetter,
    handleDirtyChange,
    confirmDiscardIfDirty,
    saveFile,
    changeTab,
    handleHeadingsExtracted,
  };
};

export default useEditor;