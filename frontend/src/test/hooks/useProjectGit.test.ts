import { createRoot } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectGit } from '../../hooks/useProjectGit';
import { editorStore } from '../../stores/editorStore';
import { projectStore } from '../../stores/projectStore';
import { runGitAction } from '../../utils/gitPanel';
import type { Project } from '../../types';

vi.mock('../../utils/gitPanel', () => ({
  runGitAction: vi.fn(),
}));

const alpha: Project = { id: 1, name: 'alpha', path: '/alpha' };
const beta: Project = { id: 2, name: 'beta', path: '/beta' };

describe('useProjectGit', () => {
  let dispose: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    editorStore.reset();
    projectStore.setActiveProject(null);
  });

  afterEach(() => {
    dispose?.();
    vi.useRealTimers();
  });

  const createGit = (refreshProject = vi.fn().mockResolvedValue({ status: 'refreshed' })) => {
    let git!: ReturnType<typeof useProjectGit>;
    createRoot((rootDispose) => {
      dispose = rootDispose;
      git = useProjectGit(refreshProject);
    });
    return { git, refreshProject };
  };

  it('serializes operations for one project while allowing different projects', async () => {
    const resolvers = new Map<number, () => void>();
    vi.mocked(runGitAction).mockImplementation(
      (projectId) => new Promise<void>((resolve) => resolvers.set(projectId, resolve))
    );
    const { git } = createGit();

    const alphaFetch = git.runRemoteAction(alpha, 'fetch');
    expect(git.operationForProject(alpha.id)).toBe('fetch');
    await expect(git.runRemoteAction(alpha, 'pull')).resolves.toBe(false);

    const betaPull = git.runRemoteAction(beta, 'pull');
    expect(git.operationForProject(beta.id)).toBe('pull');
    expect(runGitAction).toHaveBeenCalledTimes(2);

    resolvers.get(alpha.id)?.();
    resolvers.get(beta.id)?.();
    await Promise.all([alphaFetch, betaPull]);

    expect(git.operationForProject(alpha.id)).toBeUndefined();
    expect(git.operationForProject(beta.id)).toBeUndefined();
  });

  it('warns when pull preserves a file that became dirty', async () => {
    projectStore.setActiveProject(alpha);
    const refreshProject = vi.fn().mockResolvedValue({
      status: 'current-file-preserved',
    });
    vi.mocked(runGitAction).mockResolvedValue();
    const { git } = createGit(refreshProject);

    await expect(git.runRemoteAction(alpha, 'pull')).resolves.toBe(true);

    expect(refreshProject).toHaveBeenCalledWith({
      expectedProjectId: alpha.id,
      preserveDirtyFile: true,
    });
    expect(git.toast()).toEqual({
      type: 'warning',
      message: 'Pull completed for alpha, but the current file was not refreshed because it has unsaved changes',
    });
  });

  it('includes the project name and Git error in failure toast', async () => {
    vi.mocked(runGitAction).mockRejectedValue(new Error('authentication required'));
    const { git } = createGit();

    await expect(git.runRemoteAction(beta, 'fetch')).resolves.toBe(false);

    expect(git.toast()).toEqual({
      type: 'error',
      message: 'Fetch failed for beta: authentication required',
    });
  });
});
