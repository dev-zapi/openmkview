/**
 * openProject 类型和 API 客户端测试
 * 运行: npm test
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  PathType,
  PathCandidate,
  ResolvePathResult,
  ValidatePathResult,
  OpenProjectResult,
  RecentProject,
  RecentProjectsResult,
  OpenProjectState,
} from '../types/openProject';
import {
  resolvePath,
  validateProjectPath,
  openProject,
  getRecentProjects,
  projectClient,
} from './client';

describe('openProject types', () => {
  it('PathType should accept valid values', () => {
    const absolute: PathType = 'absolute';
    const relative: PathType = 'relative';
    const fuzzy: PathType = 'fuzzy';
    
    expect(absolute).toBe('absolute');
    expect(relative).toBe('relative');
    expect(fuzzy).toBe('fuzzy');
  });

  it('PathCandidate should have correct structure', () => {
    const candidate: PathCandidate = {
      name: 'my-project',
      path: '/home/user/projects/my-project',
      depth: 2,
      relative_path: 'projects/my-project',
    };
    
    expect(candidate.name).toBe('my-project');
    expect(candidate.path).toBe('/home/user/projects/my-project');
    expect(candidate.depth).toBe(2);
    expect(candidate.relative_path).toBe('projects/my-project');
  });

  it('ResolvePathResult should have correct structure', () => {
    const result: ResolvePathResult = {
      success: true,
      candidates: [
        {
          name: 'project1',
          path: '/home/user/project1',
          depth: 1,
          relative_path: 'project1',
        },
      ],
      path_type: 'absolute',
    };
    
    expect(result.success).toBe(true);
    expect(result.candidates).toHaveLength(1);
    expect(result.path_type).toBe('absolute');
  });

  it('ValidatePathResult should have correct structure', () => {
    const validResult: ValidatePathResult = {
      valid: true,
      path_type: 'absolute',
      normalized_path: '/home/user/project',
    };
    
    const invalidResult: ValidatePathResult = {
      valid: false,
      error: 'Path does not exist',
    };
    
    expect(validResult.valid).toBe(true);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.error).toBeDefined();
  });

  it('OpenProjectResult should have correct structure', () => {
    const project: RecentProject = {
      id: 'proj-123',
      name: 'My Project',
      path: '/home/user/my-project',
      last_opened_at: new Date().toISOString(),
      type: 'rust',
    };
    
    const result: OpenProjectResult = {
      success: true,
      project,
    };
    
    expect(result.success).toBe(true);
    expect(result.project?.name).toBe('My Project');
  });

  it('RecentProjectsResult should have correct structure', () => {
    const result: RecentProjectsResult = {
      projects: [
        {
          id: 'proj-1',
          name: 'Project 1',
          path: '/path/to/project1',
          last_opened_at: new Date().toISOString(),
        },
      ],
      total: 1,
    };
    
    expect(result.projects).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('OpenProjectState should have correct structure', () => {
    const state: OpenProjectState = {
      isOpen: true,
      input: '/home/user',
      candidates: [],
      selectedIndex: -1,
      isLoading: false,
      error: null,
    };
    
    expect(state.isOpen).toBe(true);
    expect(state.input).toBe('/home/user');
    expect(state.selectedIndex).toBe(-1);
  });
});

describe('projectClient API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolvePath should call correct endpoint', async () => {
    const mockResponse: ResolvePathResult = {
      success: true,
      candidates: [],
    };
    
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    
    const result = await resolvePath('my-input');
    
    expect(fetch).toHaveBeenCalledWith('/api/projects/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'my-input' }),
    });
    expect(result.success).toBe(true);
  });

  it('validateProjectPath should call correct endpoint', async () => {
    const mockResponse: ValidatePathResult = {
      valid: true,
      path_type: 'absolute',
    };
    
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    
    const result = await validateProjectPath('/some/path');
    
    expect(fetch).toHaveBeenCalledWith('/api/projects/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/some/path' }),
    });
    expect(result.valid).toBe(true);
  });

  it('openProject should call correct endpoint', async () => {
    const mockResponse: OpenProjectResult = {
      success: true,
      project: {
        id: 'proj-1',
        name: 'Test',
        path: '/test',
        last_opened_at: new Date().toISOString(),
      },
    };
    
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    
    const result = await openProject('/test/path');
    
    expect(fetch).toHaveBeenCalledWith('/api/projects/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/test/path' }),
    });
    expect(result.success).toBe(true);
  });

  it('getRecentProjects should call correct endpoint', async () => {
    const mockResponse: RecentProjectsResult = {
      projects: [],
      total: 0,
    };
    
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);
    
    const result = await getRecentProjects();
    
    expect(fetch).toHaveBeenCalledWith('/api/projects/recent', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(result.projects).toEqual([]);
  });

  it('projectClient should export all functions', () => {
    expect(projectClient.resolvePath).toBe(resolvePath);
    expect(projectClient.validateProjectPath).toBe(validateProjectPath);
    expect(projectClient.openProject).toBe(openProject);
    expect(projectClient.getRecentProjects).toBe(getRecentProjects);
  });

  it('should throw error on failed request', async () => {
    const errorResponse = { error: 'Internal Server Error' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => JSON.stringify(errorResponse),
    } as Response);
    
    await expect(resolvePath('test')).rejects.toThrow('Failed to resolve path');
    await expect(validateProjectPath('test')).rejects.toThrow('Failed to validate path');
    await expect(openProject('test')).rejects.toThrow('Internal Server Error');
    await expect(getRecentProjects()).rejects.toThrow('Failed to get recent projects');
  });

  it('openProject should extract error message from JSON response', async () => {
    const errorResponse = { error: '目录不存在' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify(errorResponse),
    } as Response);
    
    await expect(openProject('/invalid/path')).rejects.toThrow('目录不存在');
  });

  it('openProject should handle non-JSON error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => 'Bad Request',
    } as Response);
    
    await expect(openProject('/invalid/path')).rejects.toThrow('Bad Request');
  });
});
