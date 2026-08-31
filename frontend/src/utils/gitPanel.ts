import { authStore } from '../stores/authStore';

export type RemoteGitAction = 'fetch' | 'pull';
export type GitAction = 'add' | 'commit' | 'pull' | 'push' | 'fetch';

export const runGitAction = async (projectId: number, action: GitAction, message?: string) => {
  const response = await fetch('/api/git', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      project_id: projectId,
      ...(message ? { message } : {}),
    }),
  });

  if (response.status === 401) {
    authStore.setAuthenticated(false);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;
    try {
      const parsed = JSON.parse(errorText) as { error?: string };
      errorMessage = parsed.error || errorText;
    } catch {
      // Plain-text API errors are already ready for display.
    }
    throw new Error(errorMessage || `Git ${action} failed`);
  }
};

export const getStatusColor = (index: string, workTree: string) => {
  if (workTree === 'M' || index === 'M') return 'status-modified';
  if (workTree === '?' || index === '?') return 'status-untracked';
  if (workTree === 'A' || index === 'A') return 'status-added';
  if (workTree === 'D' || index === 'D') return 'status-deleted';
  return '';
};

export const getStatusLabel = (index: string, workTree: string) => {
  if (workTree === 'M' || index === 'M') return 'M';
  if (workTree === '?' || index === '?') return 'U';
  if (workTree === 'A' || index === 'A') return 'A';
  if (workTree === 'D' || index === 'D') return 'D';
  return '';
};
