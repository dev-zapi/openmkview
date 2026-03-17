import { Component, createSignal, createEffect, For, Show } from 'solid-js';
import { gitApi } from '../services/git';
import type { GitCommit } from '../types';

interface GitPanelProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface GitFileStatus {
  path: string;
  index: string;
  workTree: string;
}

interface GitStatus {
  branch: string;
  files: GitFileStatus[];
  isRepo: boolean;
}

const GitPanel: Component<GitPanelProps> = (props) => {
  const [status, setStatus] = createSignal<GitStatus | null>(null);
  const [commits, setCommits] = createSignal<GitCommit[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [commitMessage, setCommitMessage] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'changes' | 'commits'>('changes');

  createEffect(() => {
    if (props.isOpen && props.projectId) {
      loadGitStatus();
      loadCommits();
    }
  });

  const loadGitStatus = async () => {
    setLoading(true);
    try {
      const data = await gitApi.getStatus(props.projectId);
      setStatus(data);
    } catch (error) {
      console.error('Failed to load git status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommits = async () => {
    try {
      const data = await gitApi.getCommits(props.projectId);
      setCommits(data);
    } catch (error) {
      console.error('Failed to load commits:', error);
    }
  };

  const handleStageAll = async () => {
    try {
      await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', project_id: props.projectId }),
      });
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to stage files:', error);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage().trim()) return;
    try {
      await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'commit',
          project_id: props.projectId,
          message: commitMessage(),
        }),
      });
      setCommitMessage('');
      await loadGitStatus();
      await loadCommits();
    } catch (error) {
      console.error('Failed to commit:', error);
    }
  };

  const handlePull = async () => {
    try {
      await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', project_id: props.projectId }),
      });
      await loadGitStatus();
      await loadCommits();
    } catch (error) {
      console.error('Failed to pull:', error);
    }
  };

  const handlePush = async () => {
    try {
      await fetch('/api/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'push', project_id: props.projectId }),
      });
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to push:', error);
    }
  };

  const getStatusColor = (index: string, workTree: string) => {
    if (workTree === 'M' || index === 'M') return 'status-modified';
    if (workTree === '?' || index === '?') return 'status-untracked';
    if (workTree === 'A' || index === 'A') return 'status-added';
    if (workTree === 'D' || index === 'D') return 'status-deleted';
    return '';
  };

  const getStatusLabel = (index: string, workTree: string) => {
    if (workTree === 'M' || index === 'M') return 'M';
    if (workTree === '?' || index === '?') return 'U';
    if (workTree === 'A' || index === 'A') return 'A';
    if (workTree === 'D' || index === 'D') return 'D';
    return '';
  };

  return (
    <Show when={props.isOpen}>
      <div class="git-panel">
        <div class="git-panel-header">
          <h3>🌿 Git</h3>
          <button class="close-btn" onClick={props.onClose}>✕</button>
        </div>

        <div class="git-panel-tabs">
          <button
            class={activeTab() === 'changes' ? 'active' : ''}
            onClick={() => setActiveTab('changes')}
          >
            Changes
          </button>
          <button
            class={activeTab() === 'commits' ? 'active' : ''}
            onClick={() => setActiveTab('commits')}
          >
            Commits
          </button>
        </div>

        <Show when={loading()}>
          <div class="loading">Loading...</div>
        </Show>

        <Show when={!loading() && status()}>
          <Show when={!status()?.isRepo}>
            <div class="git-not-repo">Not a Git repository</div>
          </Show>

          <Show when={status()?.isRepo}>
            <Show when={activeTab() === 'changes'}>
              <div class="git-branch">Branch: {status()?.branch}</div>

              <div class="git-actions">
                <button onClick={handleStageAll}>Stage All</button>
                <button onClick={handlePull}>Pull</button>
                <button onClick={handlePush}>Push</button>
              </div>

              <div class="git-commit-input">
                <input
                  type="text"
                  placeholder="Commit message..."
                  value={commitMessage()}
                  onInput={(e) => setCommitMessage(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
                />
                <button onClick={handleCommit} disabled={!commitMessage().trim()}>
                  Commit
                </button>
              </div>

              <div class="git-files">
                <For each={status()?.files}>
                  {(file) => (
                    <div class={`git-file-item ${getStatusColor(file.index, file.workTree)}`}>
                      <span class="git-file-status">
                        {getStatusLabel(file.index, file.workTree)}
                      </span>
                      <span class="git-file-path">{file.path}</span>
                    </div>
                  )}
                </For>
                <Show when={status()?.files.length === 0}>
                  <div class="git-empty">No changes</div>
                </Show>
              </div>
            </Show>

            <Show when={activeTab() === 'commits'}>
              <div class="git-commits">
                <For each={commits()}>
                  {(commit) => (
                    <div class="git-commit-item">
                      <div class="git-commit-hash">{commit.shortHash}</div>
                      <div class="git-commit-message">{commit.message}</div>
                      <div class="git-commit-meta">
                        {commit.author} • {commit.date}
                      </div>
                    </div>
                  )}
                </For>
                <Show when={commits().length === 0}>
                  <div class="git-empty">No commits</div>
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </div>
    </Show>
  );
};

export default GitPanel;
