import type { Connect } from 'vite';
import type { PasskeyCredentialSummary } from '../../types/app';

type NextFunction = () => void;

let sessionTimeoutMinutes = 60;
let passkeyConfigured = true;
let passkeyAvailable = true;
let passkeyOrigin = 'http://localhost:4567';
let passkeys: PasskeyCredentialSummary[] = [
  {
    id: 'demo-passkey',
    name: 'Demo Device',
    createdAt: new Date('2026-04-18T12:00:00Z').toISOString(),
    lastUsedAt: new Date('2026-04-18T12:30:00Z').toISOString(),
  },
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

export async function handleAuthApi(
  req: Connect.IncomingMessage,
  res: any,
  _next: NextFunction
): Promise<boolean> {
  const url = new URL(req.url || '', 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/auth/status') {
    sendJson(res, {
      authRequired: false,
      authenticated: true,
      sessionTimeoutMinutes,
      passkeyConfigured,
      passkeyAvailable,
      passkeyOrigin,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    sendJson(res, {
      authRequired: true,
      authenticated: true,
      sessionTimeoutMinutes,
      passkeyConfigured,
      passkeyAvailable,
      passkeyOrigin,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/passkey/login/start') {
    sendJson(res, {
      requestId: 'mock-login-request',
      options: {
        publicKey: {
          challenge: 'ZmFrZS1jaGFsbGVuZ2U',
          timeout: 300000,
          rpId: 'localhost',
          allowCredentials: [
            { id: 'ZmFrZS1jcmVkLWlk', type: 'public-key' },
          ],
          userVerification: 'required',
        },
      },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/passkey/login/finish') {
    sendJson(res, {
      authRequired: true,
      authenticated: true,
      sessionTimeoutMinutes,
      passkeyConfigured,
      passkeyAvailable,
      passkeyOrigin,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/passkey/register/start') {
    sendJson(res, {
      requestId: 'mock-register-request',
      options: {
        publicKey: {
          challenge: 'ZmFrZS1yZWdpc3Rlci1jaGFsbGVuZ2U',
          rp: { id: 'localhost', name: 'OpenMKView' },
          user: {
            id: 'ZmFrZS11c2VyLWlk',
            name: 'admin',
            displayName: 'admin',
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 300000,
          authenticatorSelection: { userVerification: 'required' },
        },
      },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/passkey/register/finish') {
    const body = await parseBody<{ name?: string }>(req);
    passkeys = [
      {
        id: `passkey-${Date.now()}`,
        name: body.name || `Device ${passkeys.length + 1}`,
        createdAt: new Date().toISOString(),
      },
      ...passkeys,
    ];
    passkeyAvailable = passkeys.length > 0;
    sendJson(res, { credentials: passkeys });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/auth/passkey/list') {
    sendJson(res, { credentials: passkeys });
    return true;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/auth/passkey/')) {
    const id = decodeURIComponent(pathname.slice('/api/auth/passkey/'.length));
    passkeys = passkeys.filter((item) => item.id !== id);
    passkeyAvailable = passkeys.length > 0;
    sendJson(res, { credentials: passkeys });
    return true;
  }

  if (req.method === 'PUT' && pathname === '/api/auth/session-timeout') {
    const body = await parseBody<{ sessionTimeoutMinutes?: number }>(req);
    if (typeof body.sessionTimeoutMinutes === 'number' && body.sessionTimeoutMinutes > 0) {
      sessionTimeoutMinutes = body.sessionTimeoutMinutes;
    }
    sendJson(res, {
      authRequired: true,
      authenticated: true,
      sessionTimeoutMinutes,
      passkeyConfigured,
      passkeyAvailable,
      passkeyOrigin,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    sendJson(res, { success: true });
    return true;
  }

  return false;
}
