import type { Connect } from 'vite';
import { DEFAULT_SETTINGS } from '../../types/app';

type NextFunction = () => void;

let currentSettings = { ...DEFAULT_SETTINGS };

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

export async function handleSettingsApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/settings') {
    sendJson(res, currentSettings);
    return true;
  }

  if (req.method === 'PUT' && pathname === '/api/settings') {
    currentSettings = {
      ...currentSettings,
      ...(await parseBody<typeof DEFAULT_SETTINGS>(req)),
    };
    sendJson(res, currentSettings);
    return true;
  }

  return false;
}
