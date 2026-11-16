import type { Connect } from 'vite';
import { DEFAULT_SETTINGS } from '../../types/app';
import type { Theme } from '../../types/app';

type NextFunction = () => void;

let currentSettings = { ...DEFAULT_SETTINGS };

// Mirrors get_builtin_themes() in src/models/theme.rs so the Settings pickers
// see the same list as a real backend.
const builtinThemes: Theme[] = [
  { id: 'light-default', name: 'Default', type: 'light', builtin: true },
  { id: 'light-warm', name: 'Warm', type: 'light', builtin: true },
  { id: 'light-cool', name: 'Cool', type: 'light', builtin: true },
  { id: 'dark-default', name: 'Default', type: 'dark', builtin: true },
  { id: 'dark-blue', name: 'Blue', type: 'dark', builtin: true },
  { id: 'dark-purple', name: 'Purple', type: 'dark', builtin: true },
];

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

  if (req.method === 'GET' && pathname === '/api/themes') {
    sendJson(res, { themes: builtinThemes });
    return true;
  }

  return false;
}
