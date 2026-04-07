/**
 * Mock API handlers - Git related
 */

import type { Connect } from 'vite';
import { mockCommits, mockBranches, mockTags, mockGitStatus, mockFileDiffs, createMockDiff } from '../data';

type NextFunction = () => void;

/**
 * Parse JSON request body
 */
async function parseBody<T>(req: Connect.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: any, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Handle Git-related API
 */
export async function handleGitApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // GET /api/git/commits - Get commit list
  if (req.method === 'GET' && pathname === '/api/git/commits') {
    const projectId = searchParams.get('project_id');
    // filePath parameter is available but not used in mock
    // const filePath = searchParams.get('path');

    if (projectId) {
      sendJson(res, { entries: mockCommits });
      return true;
    }
    sendJson(res, { error: 'Missing project_id' }, 400);
    return true;
  }

  // POST /api/git/diff - Get file diff
  if (req.method === 'POST' && pathname === '/api/git/diff') {
    const body = await parseBody<{
      project_id: number;
      path: string;
      old_ref: string;
      new_ref: string;
    }>(req);

    // Return predefined diff or generate new one
    const diff =
      mockFileDiffs[body.path] ||
      createMockDiff(
        `// Old content for ${body.path}\n// Line 1\n// Line 2\n`,
        `// New content for ${body.path}\n// Line 1 (modified)\n// Line 2\n// Line 3 (added)\n`,
        body.path,
        body.path
      );
    sendJson(res, diff);
    return true;
  }

  // GET /api/git/file - Get file content at specific commit
  if (req.method === 'GET' && pathname === '/api/git/file') {
    const projectId = searchParams.get('project_id');
    const filePath = searchParams.get('path');
    const ref = searchParams.get('ref');

    if (projectId && filePath && ref) {
      res.setHeader('Content-Type', 'text/plain');
      res.end(`// File content at ${ref}\n// Path: ${filePath}\n// Mock content\n`);
      return true;
    }
    sendJson(res, { error: 'Missing parameters' }, 400);
    return true;
  }

  // GET /api/git/branches - Get branch list
  if (req.method === 'GET' && pathname === '/api/git/branches') {
    sendJson(res, mockBranches);
    return true;
  }

  // GET /api/git/tags - Get tag list
  if (req.method === 'GET' && pathname === '/api/git/tags') {
    sendJson(res, mockTags);
    return true;
  }

  // POST /api/git - Git operations
  if (req.method === 'POST' && pathname === '/api/git') {
    const body = await parseBody<{ action: string; project_id: number }>(req);

    if (body.action === 'status') {
      sendJson(res, mockGitStatus);
      return true;
    }
    sendJson(res, { error: 'Unknown action' }, 400);
    return true;
  }

  return false;
}