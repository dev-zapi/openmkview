import type { GitCommit, GitDiff } from '../types';

export interface FileDiffRequest {
  projectId: number;
  filePath: string;
  oldRef: string;
  newRef: string;
}

export const gitApi = {
  async getCommits(projectId: number, filePath?: string): Promise<GitCommit[]> {
    const params = new URLSearchParams({ project_id: String(projectId) });
    if (filePath) params.append('path', filePath);
    const res = await fetch(`/api/git/commits?${params}`);
    const data = await res.json();
    return data.entries || [];
  },

  async getFileDiff(request: FileDiffRequest): Promise<GitDiff> {
    const res = await fetch('/api/git/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: request.projectId,
        path: request.filePath,
        old_ref: request.oldRef,
        new_ref: request.newRef,
      }),
    });
    return res.json();
  },

  async getFileAtCommit(projectId: number, filePath: string, ref: string): Promise<string> {
    const res = await fetch(
      `/api/git/file?project_id=${projectId}&path=${encodeURIComponent(filePath)}&ref=${ref}`
    );
    return res.text();
  },

  async getBranches(projectId: number): Promise<string[]> {
    const res = await fetch(`/api/git/branches?project_id=${projectId}`);
    return res.json();
  },

  async getTags(projectId: number): Promise<string[]> {
    const res = await fetch(`/api/git/tags?project_id=${projectId}`);
    return res.json();
  },

  async getStatus(projectId: number): Promise<any> {
    const res = await fetch('/api/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', project_id: projectId }),
    });
    return res.json();
  },
};
