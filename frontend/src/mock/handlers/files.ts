/**
 * Mock API 处理函数 - 文件相关
 */

import type { Connect } from 'vite';
import { getMockFileContent, generateDefaultFileContent } from '../data';

type NextFunction = () => void;

/**
 * 发送 JSON 响应
 */
function sendJson(res: any, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * 处理文件相关 API
 */
export async function handleFilesApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // GET /api/files/tree - 获取文件树
  if (req.method === 'GET' && pathname === '/api/files/tree') {
    const projectId = searchParams.get('project_id');
    if (projectId) {
      const { mockFileTree } = await import('../data');
      sendJson(res, mockFileTree);
      return true;
    }
    sendJson(res, { error: 'Missing project_id' }, 400);
    return true;
  }

  // GET /api/files/content - 获取文件内容
  if (req.method === 'GET' && pathname === '/api/files/content') {
    const path = searchParams.get('path');
    const projectId = searchParams.get('project_id');

    if (path && projectId) {
      const content = getMockFileContent(path) || generateDefaultFileContent(path);
      sendJson(res, content);
      return true;
    }
    sendJson(res, { error: 'Missing path or project_id' }, 400);
    return true;
  }

  return false;
}