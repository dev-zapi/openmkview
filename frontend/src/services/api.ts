import type { FileNode, FileContent, Project } from '../types';

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
};
