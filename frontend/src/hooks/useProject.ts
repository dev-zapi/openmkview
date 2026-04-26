import { api } from '../services/api';
import { projectStore } from '../stores/projectStore';
import { fileStore } from '../stores/fileStore';
import { editorStore } from '../stores/editorStore';
import { appStore } from '../stores/appStore';
import { diffStore } from '../stores/diffStore';
import { openProjectStore } from '../stores/openProjectStore';
import { navigateToProject, navigateToHome } from '../utils/router';
import { settingsStore } from '../stores/settingsStore';
import type { Project } from '../types';
import type { RecentProject } from '../types/openProject';
import { getFaviconPath, getProjectDisplayName, getProjectIconContent, isFaviconIcon } from '../utils/projectIcon';

export const useProject = () => {
  const getColorPickerPosition = (rect: Pick<DOMRect, 'left' | 'right' | 'top'>) => {
    const x = rect.right + 8;
    const y = rect.top;

    const pickerWidth = 280;
    const pickerHeight = 300;
    const viewportPadding = 8;
    const maxX = Math.max(viewportPadding, window.innerWidth - pickerWidth - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - pickerHeight - viewportPadding);
    const nextX = x + pickerWidth > window.innerWidth - viewportPadding
      ? rect.left - pickerWidth - 8
      : x;
    const nextY = y + pickerHeight > window.innerHeight - viewportPadding
      ? window.innerHeight - pickerHeight - viewportPadding
      : y;

    return {
      x: Math.min(Math.max(nextX, viewportPadding), maxX),
      y: Math.min(Math.max(nextY, viewportPadding), maxY),
    };
  };

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

  const switchProject = async (project: Project, updateUrl: boolean = true): Promise<boolean> => {
    if (!confirmDiscardIfDirty()) return false;

    fileStore.startLoading();
    try {
      const tree = await api.getFileTree(project.id);
      projectStore.setActiveProject(project);
      fileStore.setFileTree(tree);
      diffStore.reset();
      fileStore.closeFile();
      editorStore.reset();
      if (updateUrl) {
        navigateToProject(project.id);
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
      return false;
    } finally {
      fileStore.finishLoading();
    }

    return true;
  };

  const closeProject = async (projectId: number) => {
    if (!confirmDiscardIfDirty()) return;

    try {
      await api.closeProject(projectId);
      projectStore.removeProject(projectId);
      
      const projects = projectStore.state.projects;
      if (projectStore.state.activeProject?.id === projectId) {
        projectStore.setActiveProject(null);
        fileStore.setFileTree([]);
        fileStore.closeFile();
        navigateToHome();
        if (projects.length > 0) {
          await switchProject(projects[0]);
        }
      }
    } catch (error) {
      console.error('Failed to close project:', error);
    }
  };

  const openProject = () => {
    appStore.openOpenProjectDialog();
  };

  const closeOpenProjectDialog = () => {
    appStore.closeOpenProjectDialog();
  };

  const handleProjectOpened = async (recentProject: RecentProject) => {
    fileStore.startLoading();
    appStore.closeOpenProjectDialog();
    
    try {
      const project: Project = {
        id: parseInt(recentProject.id, 10),
        name: recentProject.name,
        path: recentProject.path,
        color: recentProject.color,
      };
      
      const existingProject = projectStore.state.projects.find(p => p.id === project.id);
      if (!existingProject) {
        projectStore.addProject(project);
      }
      
      const switched = await switchProject(project);
      if (switched) {
        openProjectStore.addRecentProject(recentProject);
      }
    } catch (error) {
      console.error('Failed to open project:', error);
      alert('Failed to open project. Please check the path and try again.');
    } finally {
      fileStore.finishLoading();
    }
  };

  const refreshProject = async () => {
    const project = projectStore.state.activeProject;
    if (!project) return;

    fileStore.startLoading();
    try {
      const tree = await api.getFileTree(project.id);
      fileStore.setFileTree(tree);

      const file = fileStore.currentFile();
      if (file) {
        const content = await api.getFileContent(file.path, project.id);
        fileStore.setCurrentFile(content);
        editorStore.initialize(content.content);
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      fileStore.finishLoading();
    }
  };

  const updateProjectColor = async (color: string) => {
    const projectId = appStore.colorPickerProjectId();
    if (!projectId) return;

    try {
      await api.updateProjectColor(projectId, color);
      projectStore.updateProject(projectId, { color });
      
      if (projectStore.state.activeProject?.id === projectId) {
        projectStore.setActiveProject({
          ...projectStore.state.activeProject,
          color,
        });
      }
    } catch (error) {
      console.error('Failed to update project color:', error);
    }
    
    appStore.closeColorPicker();
  };

  const openColorPicker = (e: MouseEvent, projectId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const position = getColorPickerPosition((e.currentTarget as HTMLElement).getBoundingClientRect());
    appStore.openColorPicker(projectId, position.x, position.y);
  };

  const openColorPickerAt = (projectId: number, rect: Pick<DOMRect, 'left' | 'right' | 'top'>) => {
    const position = getColorPickerPosition(rect);
    appStore.openColorPicker(projectId, position.x, position.y);
  };

  const saveProjectEdit = async (project: Project) => {
    try {
      const updatedProject = await api.updateProject(project.id, {
        name: project.name,
        color: project.color,
        icon: project.icon,
      });
      
      projectStore.updateProject(project.id, updatedProject);
      
      if (projectStore.state.activeProject?.id === updatedProject.id) {
        projectStore.setActiveProject(updatedProject);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('Failed to update project');
    }
    
    appStore.closeProjectEditDialog();
  };

  const getColorStyle = (project: Project): Record<string, string> => {
    return project.color ? { background: project.color } : {};
  };

  const renderProjectIconContent = (project: Project) => {
    return getProjectIconContent(project);
  };

  return {
    confirmDiscardIfDirty,
    switchProject,
    closeProject,
    openProject,
    closeOpenProjectDialog,
    handleProjectOpened,
    refreshProject,
    updateProjectColor,
    openColorPicker,
    openColorPickerAt,
    saveProjectEdit,
    getColorStyle,
    getProjectDisplayName,
    isFaviconIcon,
    getFaviconPath,
    renderProjectIconContent,
  };
};

export default useProject;
