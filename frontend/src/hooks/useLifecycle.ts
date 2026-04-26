import { onMount, onCleanup } from 'solid-js';
import { api } from '../services/api';
import { projectStore } from '../stores/projectStore';
import { fileStore } from '../stores/fileStore';
import { editorStore } from '../stores/editorStore';
import { appStore } from '../stores/appStore';
import { settingsStore, initSettingsEffects } from '../stores/settingsStore';
import { diffStore } from '../stores/diffStore';
import { onPopState, getCurrentRoute, navigateToProject, navigateToFile } from '../utils/router';
import { loadSidebarWidth } from '../utils/settings';
import { useLayout } from './useLayout';
import { useProject } from './useProject';
import { useFile } from './useFile';
import { initWorker } from '../services/shikiWorkerClient';
import { updateBrowserThemeColor } from '../utils/theme';

export const useLifecycle = () => {
  const projectHook = useProject();
  const fileHook = useFile();
  const layoutHook = useLayout();

  onMount(async () => {
    initWorker().catch(err => console.warn('Failed to init Shiki worker:', err));
    
    initSettingsEffects();

    await settingsStore.fetchSettings().catch(err => {
      console.warn('Failed to load server settings:', err);
    });

    const projectList = await api.getProjects({ openOnly: true });
    projectStore.setProjects(projectList);

    appStore.setSidebarWidth(loadSidebarWidth());
    appStore.checkMobile();

    const cleanupResize = layoutHook.setupResizeHandlers();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      settingsStore.updateSystemTheme(e.matches ? 'dark' : 'light');
      updateBrowserThemeColor();
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    updateBrowserThemeColor();

    const cleanupPopState = onPopState(async (route) => {
      if (route.projectId) {
        const project = projectStore.state.projects.find(p => p.id === route.projectId);
        if (project) {
          await projectHook.switchProject(project, false);
          if (route.filePath) {
            await fileHook.openFile(route.filePath, false);
          }
        }
      } else {
        projectStore.setActiveProject(null);
        fileStore.setFileTree([]);
        fileStore.closeFile();
      }
    });

    const route = getCurrentRoute();
    if (route.projectId) {
      const project = projectList.find(p => p.id === route.projectId);
      if (project) {
        await projectHook.switchProject(project, false);
        if (route.filePath) {
          await fileHook.openFile(route.filePath, false);
        }
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editorStore.isDirty() && appStore.activeTab() === 'edit') {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    onCleanup(() => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      cleanupResize();
      cleanupPopState();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    });
  });
};

export default useLifecycle;
