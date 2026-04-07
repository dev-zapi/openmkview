/**
 * Mock API handlers - Project related
 */

import type { Connect } from 'vite';
import { mockProjects, mockRecentProjects } from '../data';
import type {
  ResolvePathRequest,
  ValidatePathRequest,
  OpenProjectRequest,
} from '../../types/openProject';

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
 * Handle project-related API
 */
export async function handleProjectsApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;

  // GET /api/projects - Get project list
  if (req.method === 'GET' && pathname === '/api/projects') {
    sendJson(res, mockProjects);
    return true;
  }

  // POST /api/projects - Create project
  if (req.method === 'POST' && pathname === '/api/projects') {
    const body = await parseBody<{ path: string }>(req);
    const newProject = {
      id: mockProjects.length + 1,
      name: body.path.split('/').pop() || 'new-project',
      path: body.path,
    };
    sendJson(res, newProject, 201);
    return true;
  }

  // DELETE /api/projects/:id - Delete project
  if (req.method === 'DELETE' && pathname.match(/^\/api\/projects\/\d+$/)) {
    sendJson(res, { success: true });
    return true;
  }

  // POST /api/projects/resolve - Resolve path
  if (req.method === 'POST' && pathname === '/api/projects/resolve') {
    const body = await parseBody<ResolvePathRequest>(req);
    const input = body.path.toLowerCase();

    // Simulate path resolution
    const candidates = mockRecentProjects
      .filter((p) => p.name.toLowerCase().includes(input) || p.path.toLowerCase().includes(input))
      .map((p) => ({
        name: p.name,
        path: p.path,
        depth: p.path.split('/').length,
        relative_path: p.path.split('/').pop() || '',
      }));

    sendJson(res, {
      success: true,
      candidates,
      path_type: input.startsWith('/')
        ? 'absolute'
        : input.startsWith('./') || input.startsWith('../')
          ? 'relative'
          : 'fuzzy',
    });
    return true;
  }

  // POST /api/projects/validate - Validate path
  if (req.method === 'POST' && pathname === '/api/projects/validate') {
    const body = await parseBody<ValidatePathRequest>(req);
    const path = body.path;

    // Simulate validation
    const valid = path.startsWith('/') || path.startsWith('./') || path.startsWith('../');
    sendJson(res, {
      valid,
      path_type: path.startsWith('/') ? 'absolute' : 'relative',
      normalized_path: valid ? path.replace(/\/+/g, '/') : undefined,
      error: valid ? undefined : 'Invalid path format',
    });
    return true;
  }

  // POST /api/projects/open - Open project
  if (req.method === 'POST' && pathname === '/api/projects/open') {
    const body = await parseBody<OpenProjectRequest>(req);
    const path = body.path;

    // Simulate opening project
    const projectName = path.split('/').pop() || 'project';
    sendJson(res, {
      success: true,
      project: {
        id: `mock-${Date.now()}`,
        name: projectName,
        path,
        last_opened_at: new Date().toISOString(),
        type: 'unknown',
      },
    });
    return true;
  }

  // GET /api/projects/recent - Get recent projects
  if (req.method === 'GET' && pathname === '/api/projects/recent') {
    sendJson(res, {
      projects: mockRecentProjects,
      total: mockRecentProjects.length,
    });
    return true;
  }

  return false;
}