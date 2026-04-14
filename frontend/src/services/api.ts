import type { FileNode, FileContent, Project, TrashItem, TrashStats, FileSaveResponse } from '../types';

async function checkResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }
}

export const api = {
  async getFileTree(projectId: number): Promise<FileNode[]> {
    const res = await fetch(`/api/files/tree?project_id=${projectId}`);
    return res.json();
  },

  async getFileContent(path: string, projectId: number): Promise<FileContent> {
    const res = await fetch(
      `/api/files/content?path=${encodeURIComponent(path)}&project_id=${projectId}`
    );
    return res.json();
  },

  async saveFileContent(path: string, content: string, projectId: number): Promise<FileSaveResponse> {
    const res = await fetch('/api/files/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        path,
        content,
      }),
    });
    return res.json();
  },

  async searchFavicons(projectId: number): Promise<string[]> {
    const res = await fetch(`/api/files/favicons?project_id=${projectId}`);
    return res.json();
  },

  async getProjects(): Promise<Project[]> {
    const res = await fetch('/api/projects');
    return res.json();
  },

  async createProject(path: string): Promise<Project> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return res.json();
  },

  async closeProject(id: number): Promise<void> {
    await fetch(`/api/projects/${id}/close`, {
      method: 'POST',
    });
  },

  async updateProjectColor(id: number, color: string): Promise<void> {
    await fetch(`/api/projects/${id}/color`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
  },

  async updateProject(id: number, data: { name?: string; color?: string; icon?: string }): Promise<Project> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async moveToTrash(path: string, projectId: number, isFolder: boolean): Promise<TrashItem> {
    const res = await fetch('/api/trash/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path, isFolder }),
    });
    await checkResponse(res);
    return res.json();
  },

  async restoreFromTrash(trashItemId: string, projectId: number): Promise<void> {
    const res = await fetch('/api/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, trashItemId }),
    });
    await checkResponse(res);
  },

  async deleteFromTrash(trashItemId: string, projectId: number): Promise<void> {
    const res = await fetch('/api/trash/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, trashItemId }),
    });
    await checkResponse(res);
  },

  async clearTrash(projectId: number): Promise<void> {
    const res = await fetch('/api/trash/clear', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    await checkResponse(res);
  },

  async listTrash(projectId: number): Promise<TrashItem[]> {
    const res = await fetch(`/api/trash/list?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  async getTrashStats(projectId: number): Promise<TrashStats> {
    const res = await fetch(`/api/trash/stats?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  getFileRawUrl(path: string, projectId: number): string {
    return `/api/files/raw?path=${encodeURIComponent(path)}&project_id=${projectId}`;
  },
};
