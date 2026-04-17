import type { Connect } from 'vite';

type NextFunction = () => void;

let sessionTimeoutMinutes = 60;

function sendJson(res: any, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseBody<T>(req: Connect.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export async function handleAuthApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/auth/status') {
    sendJson(res, { authRequired: false, authenticated: true, sessionTimeoutMinutes });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    sendJson(res, { authRequired: true, authenticated: true, sessionTimeoutMinutes });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/api/auth/session-timeout') {
    const body = await parseBody<{ sessionTimeoutMinutes?: number }>(req);
    if (typeof body.sessionTimeoutMinutes === 'number' && body.sessionTimeoutMinutes > 0) {
      sessionTimeoutMinutes = body.sessionTimeoutMinutes;
    }
    sendJson(res, { authRequired: true, authenticated: true, sessionTimeoutMinutes });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    sendJson(res, { success: true });
    return true;
  }

  return false;
}
