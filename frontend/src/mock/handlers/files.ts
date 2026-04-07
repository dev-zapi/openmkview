/**
 * Mock API handlers - File related
 */

import type { Connect } from 'vite';
import { getMockFileContent, generateDefaultFileContent } from '../data';

type NextFunction = () => void;

/**
 * Send JSON response
 */
function sendJson(res: any, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Handle file-related API
 */
export async function handleFilesApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // GET /api/files/tree - Get file tree
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

  // GET /api/files/content - Get file content
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