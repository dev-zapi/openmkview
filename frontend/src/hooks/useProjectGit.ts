import { createSignal, onCleanup } from 'solid-js';
import type { Project } from '../types';
import { editorStore } from '../stores/editorStore';
import { offlineStore } from '../stores/offlineStore';
import { projectStore } from '../stores/projectStore';
import { runGitAction, type RemoteGitAction } from '../utils/gitPanel';
import type { ProjectRefreshResult } from './useProject';

export type ToastType = 'success' | 'warning' | 'error';

export interface AppToastMessage {
  message: string;
  type: ToastType;
}

type RefreshProject = (options: {
  expectedProjectId: number;
  preserveDirtyFile: boolean;
}) => Promise<ProjectRefreshResult>;

export const useProjectGit = (refreshProject: RefreshProject) => {
  const [operations, setOperations] = createSignal<Record<number, RemoteGitAction>>({});
  const [toast, setToast] = createSignal<AppToastMessage | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const showToast = (message: string, type: ToastType) => {
    if (toastTimer) clearTimeout(toastTimer);
    setToast({ message, type });
    toastTimer = setTimeout(() => setToast(null), type === 'success' ? 2000 : 5000);
  };

  const finishOperation = (projectId: number) => {
    setOperations((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  };

  const runRemoteAction = async (
    project: Project,
    action: RemoteGitAction
  ): Promise<boolean> => {
    if (operations()[project.id] || !offlineStore.online()) return false;
    if (
      action === 'pull' &&
      projectStore.state.activeProject?.id === project.id &&
      editorStore.isDirty()
    ) {
      return false;
    }

    setOperations((current) => ({ ...current, [project.id]: action }));
    let pullCompleted = false;

    try {
      await runGitAction(project.id, action);
      pullCompleted = action === 'pull';

      if (action === 'pull' && projectStore.state.activeProject?.id === project.id) {
        const refresh = await refreshProject({
          expectedProjectId: project.id,
          preserveDirtyFile: true,
        });

        if (refresh.status === 'failed') {
          showToast(
            `Pull completed for ${project.name}, but refresh failed: ${refresh.error}`,
            'error'
          );
          return false;
        }

        if (refresh.status === 'current-file-preserved') {
          showToast(
            `Pull completed for ${project.name}, but the current file was not refreshed because it has unsaved changes`,
            'warning'
          );
          return true;
        }
      }

      const actionName = action === 'fetch' ? 'Fetch' : 'Pull';
      showToast(`${actionName} completed for ${project.name}`, 'success');
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Git error';
      if (pullCompleted) {
        showToast(`Pull completed for ${project.name}, but refresh failed: ${detail}`, 'error');
      } else {
        const actionName = action === 'fetch' ? 'Fetch' : 'Pull';
        showToast(`${actionName} failed for ${project.name}: ${detail}`, 'error');
      }
      return false;
    } finally {
      finishOperation(project.id);
    }
  };

  onCleanup(() => {
    if (toastTimer) clearTimeout(toastTimer);
  });

  return {
    operationForProject: (projectId: number) => operations()[projectId],
    runRemoteAction,
    toast,
  };
};
