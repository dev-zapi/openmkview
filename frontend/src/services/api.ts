import type {
  Annotation,
  AnnotationAnchor,
  CreateAnnotationRequest,
  FileNode,
  FileContent,
  ManagedAnnotation,
  Project,
  TrashItem,
  TrashStats,
  FileSaveResponse,
} from '../types';
import { authStore } from '../stores/authStore';
import { offlineStore } from '../stores/offlineStore';

const ANNOTATION_API_PREFIX = '/api/annotations';

/**
 * Offline Mode is read-only (ADR-0002): annotation GETs are served from the
 * runtime cache, but every annotation mutation must fail fast without a
 * network attempt. Centralizing the guard here means every current and
 * future annotation mutator inherits it automatically.
 */
function isAnnotationMutation(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') return false;
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return url.startsWith(ANNOTATION_API_PREFIX);
}

async function request(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isAnnotationMutation(input, init) && !offlineStore.online()) {
    throw new Error('Annotations are read-only while offline');
  }
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

  async moveFile(from: string, to: string, projectId: number): Promise<void> {
    const res = await request('/api/files/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, from, to }),
    });
    await checkResponse(res);
  },

  async renameFile(path: string, newName: string, projectId: number): Promise<void> {
    const res = await request('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'rename',
        project_id: projectId,
        path,
        new_name: newName,
      }),
    });
    await checkResponse(res);
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

  async listAnnotations(projectId: number, relativePath: string): Promise<Annotation[]> {
    const res = await request(
      `/api/annotations?project_id=${projectId}&relativePath=${encodeURIComponent(relativePath)}`
    );
    await checkResponse(res);
    return res.json();
  },

  async createAnnotation(body: CreateAnnotationRequest): Promise<Annotation> {
    const res = await request('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await checkResponse(res);
    return res.json();
  },

  async deleteAnnotation(id: number): Promise<void> {
    const res = await request(`/api/annotations/${id}`, { method: 'DELETE' });
    await checkResponse(res);
  },

  /** Manual re-anchoring: replace an Outdated annotation's Anchor payload. */
  async reanchorAnnotation(id: number, anchor: AnnotationAnchor): Promise<Annotation> {
    const res = await request(`/api/annotations/${id}/anchor`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchor }),
    });
    await checkResponse(res);
    return res.json();
  },

  async addAnnotationNote(
    annotationId: number,
    body: string,
    author: string | null
  ): Promise<Annotation> {
    const res = await request(`/api/annotations/${annotationId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, author, isAgent: false }),
    });
    await checkResponse(res);
    return res.json();
  },

  async updateAnnotationNote(
    annotationId: number,
    noteId: number,
    body: string
  ): Promise<Annotation> {
    const res = await request(`/api/annotations/${annotationId}/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    await checkResponse(res);
    return res.json();
  },

  async setAnnotationResolved(annotationId: number, resolved: boolean): Promise<Annotation> {
    const res = await request(`/api/annotations/${annotationId}/resolved`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved }),
    });
    await checkResponse(res);
    return res.json();
  },

  /** Project-wide management list, including Missing File and Outdated rows. */
  async listProjectAnnotations(projectId: number): Promise<ManagedAnnotation[]> {
    const res = await request(`/api/annotations/manage?project_id=${projectId}`);
    await checkResponse(res);
    // The backend reports the Missing File condition as `orphaned`; the UI and
    // domain vocabulary call it Missing File.
    const rows = (await res.json()) as Array<
      Omit<ManagedAnnotation, 'missingFile'> & {
        missingFile?: boolean;
        orphaned?: boolean;
      }
    >;
    return rows.map(({ orphaned, missingFile, ...row }) => ({
      ...row,
      missingFile: missingFile ?? orphaned ?? false,
    }));
  },

  async batchDeleteAnnotations(projectId: number, ids: number[]): Promise<void> {
    const res = await request('/api/annotations/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ids }),
    });
    await checkResponse(res);
  },

  async batchResolveAnnotations(
    projectId: number,
    ids: number[],
    resolved: boolean
  ): Promise<void> {
    const res = await request('/api/annotations/batch-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, ids, resolved }),
    });
    await checkResponse(res);
  },

  async clearProjectAnnotations(projectId: number): Promise<void> {
    const res = await request(`/api/annotations/project/${projectId}`, {
      method: 'DELETE',
    });
    await checkResponse(res);
  },
};
