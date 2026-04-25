import type { FileNode, FileContent, Project, TrashItem, TrashStats, FileSaveResponse } from '../types';
import { authStore } from '../stores/authStore';

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = init === undefined ? await fetch(input) : await fetch(input, init);
  if (res.status === 401) {
    authStore.setAuthenticated(false);
  }
  return res;
}

async function checkResponse(res: Response): Promise<void> {
  if (res.ok === false) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }
}

export const api = {
  async getFileTree(projectId: number): Promise<FileNode[]> {
    const res = await request(`/api/files/tree?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  async getFileContent(relativePath: string, projectId: number): Promise<FileContent> {
    const res = await request(
      `/api/files/content?relativePath=${encodeURIComponent(relativePath)}&project_id=${projectId}`
    );
    await checkResponse(res);
    return res.json();
  },

  async saveFileContent(relativePath: string, content: string, projectId: number, expectedModifiedAt?: string): Promise<FileSaveResponse> {
    const res = await request('/api/files/content', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        relativePath,
        content,
        expectedModifiedAt,
      }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errorData.error || `Save failed with status ${res.status}`);
    }
    return res.json();
  },

  async searchFavicons(projectId: number): Promise<string[]> {
    const res = await request(`/api/files/favicons?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  async getProjects(options?: { openOnly?: boolean }): Promise<Project[]> {
    const query = options?.openOnly ? '?open=true' : '';
    const res = await request(`/api/projects${query}`);
    await checkResponse(res);
    return res.json();
  },

  async createProject(path: string): Promise<Project> {
    const res = await request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    await checkResponse(res);
    return res.json();
  },

  async closeProject(id: number): Promise<void> {
    const res = await request(`/api/projects/${id}/close`, {
      method: 'POST',
    });
    await checkResponse(res);
  },

  async updateProjectColor(id: number, color: string): Promise<void> {
    const res = await request(`/api/projects/${id}/color`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
    await checkResponse(res);
  },

  async updateProject(id: number, data: { name?: string; color?: string; icon?: string }): Promise<Project> {
    const res = await request(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await checkResponse(res);
    return res.json();
  },

  async moveToTrash(path: string, projectId: number, isFolder: boolean): Promise<TrashItem> {
    const res = await request('/api/trash/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, path, isFolder }),
    });
    await checkResponse(res);
    return res.json();
  },

  async restoreFromTrash(trashItemId: string, projectId: number): Promise<void> {
    const res = await request('/api/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, trashItemId }),
    });
    await checkResponse(res);
  },

  async deleteFromTrash(trashItemId: string, projectId: number): Promise<void> {
    const res = await request('/api/trash/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, trashItemId }),
    });
    await checkResponse(res);
  },

  async clearTrash(projectId: number): Promise<void> {
    const res = await request('/api/trash/clear', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    await checkResponse(res);
  },

  async listTrash(projectId: number): Promise<TrashItem[]> {
    const res = await request(`/api/trash/list?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  async getTrashStats(projectId: number): Promise<TrashStats> {
    const res = await request(`/api/trash/stats?project_id=${projectId}`);
    await checkResponse(res);
    return res.json();
  },

  getFileRawUrl(relativePath: string, projectId: number): string {
    return `/api/files/raw?relativePath=${encodeURIComponent(relativePath)}&project_id=${projectId}`;
  },
};
