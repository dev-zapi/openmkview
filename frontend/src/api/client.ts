/**
 * 项目打开相关的 API 客户端
 * 处理路径解析、验证和项目打开
 */

import type {
  ResolvePathRequest,
  ResolvePathResult,
  ValidatePathRequest,
  ValidatePathResult,
  OpenProjectRequest,
  OpenProjectResult,
  RecentProjectsResult,
} from '../types/openProject';
import { authStore } from '../stores/authStore';

const API_BASE = '/api/projects';

async function apiRequest(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = init === undefined ? await fetch(input) : await fetch(input, init);
  if (res.status === 401) {
    authStore.setAuthenticated(false);
  }
  return res;
}

/**
 * 解析用户输入的路径
 * @param input 用户输入的路径字符串
 * @returns 解析结果，包含候选路径列表
 */
export async function resolvePath(input: string): Promise<ResolvePathResult> {
  const request: ResolvePathRequest = { path: input };
  const res = await apiRequest(`${API_BASE}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to resolve path: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

/**
 * 验证路径是否有效
 * @param path 要验证的路径
 * @returns 验证结果
 */
export async function validateProjectPath(path: string): Promise<ValidatePathResult> {
  const request: ValidatePathRequest = { path };
  const res = await apiRequest(`${API_BASE}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    throw new Error(`Failed to validate path: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

/**
 * 打开指定路径的项目
 * @param path 项目路径
 * @returns 打开结果
 */
export async function openProject(path: string): Promise<OpenProjectResult> {
  const request: OpenProjectRequest = { path };
  const res = await apiRequest(`${API_BASE}/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage: string;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || `Failed to open project: ${res.status} ${res.statusText}`;
    } catch {
      errorMessage = errorText || `Failed to open project: ${res.status} ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}

/**
 * 获取最近打开的项目列表
 * @returns 最近项目列表
 */
export async function getRecentProjects(): Promise<RecentProjectsResult> {
  const res = await apiRequest(`${API_BASE}/recent`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!res.ok) {
    throw new Error(`Failed to get recent projects: ${res.status} ${res.statusText}`);
  }
  
  return res.json();
}

/**
 * 项目 API 客户端对象（与现有 services/api.ts 风格保持一致）
 */
export const projectClient = {
  resolvePath,
  validateProjectPath,
  openProject,
  getRecentProjects,
};
