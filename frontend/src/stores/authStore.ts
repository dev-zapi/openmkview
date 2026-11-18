import { createSignal } from 'solid-js';
import type {
  AuthStatus,
  PasskeyCeremonyStart,
  PasskeyCredentialSummary,
  PasskeyListResponse,
  ToolSessionSummary,
} from '../types/app';
import { settingsStore } from './settingsStore';
import {
  ensureWebauthnFocus,
  ensureWebauthnSupport,
  normalizeWebauthnError,
  prepareCreationOptions,
  prepareRequestOptions,
  serializeAuthenticationCredential,
  serializeRegistrationCredential,
} from '../utils/webauthn';

function applyAuthStatus(data: AuthStatus) {
  setAuthRequired(data.authRequired);
  setAuthenticated(data.authenticated);
  setUsername(data.username ?? null);
  setPasskeyConfigured(Boolean(data.passkeyConfigured));
  setPasskeyAvailable(Boolean(data.passkeyAvailable));
  setPasskeyOrigin(data.passkeyOrigin || null);
  if (typeof data.sessionTimeoutMinutes === 'number' && data.sessionTimeoutMinutes > 0) {
    settingsStore.updateSettings({ sessionTimeoutMinutes: data.sessionTimeoutMinutes });
  }
}

const [authRequired, setAuthRequired] = createSignal(false);
const [authenticated, setAuthenticated] = createSignal(true);
const [username, setUsername] = createSignal<string | null>(null);
const [passkeyConfigured, setPasskeyConfigured] = createSignal(false);
const [passkeyAvailable, setPasskeyAvailable] = createSignal(false);
const [passkeyOrigin, setPasskeyOrigin] = createSignal<string | null>(null);
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal<string | null>(null);

async function readErrorMessage(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return data.error || `Request failed with status ${res.status}`;
}

export const authStore = {
  authRequired,
  authenticated,
  username,
  passkeyConfigured,
  passkeyAvailable,
  passkeyOrigin,
  loading,
  error,
  setAuthenticated,
  setAuthRequired,
  setUsername,
  setPasskeyConfigured,
  setPasskeyAvailable,
  setPasskeyOrigin,
  setLoading,
  setError,

  /**
   * The author stamped on web writes. With auth enabled this is the logged-in
   * username (null when unknown, e.g. before status loads). Auth-disabled
   * instances have no username, so writes use a local fallback instead of
   * making every note look like a legacy row.
   */
  noteAuthor(): string | null {
    return authRequired() ? username() : 'You';
  },

  async checkStatus(): Promise<AuthStatus | null> {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/status');
      if (res.status === 401) {
        setAuthenticated(false);
        return null;
      }
      const data = await res.json() as AuthStatus;
      applyAuthStatus(data);
      setError(null);
      return data;
    } catch {
      // 网络失败（如离线）不等于未认证：保持现有会话状态，由离线 UI 提示
      return null;
    } finally {
      setLoading(false);
    }
  },

  async login(username: string, password: string): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const message = await readErrorMessage(res);
        setError(message);
        throw new Error(message);
      }

      const data = await res.json() as AuthStatus;
      applyAuthStatus(data);
      setError(null);
    } finally {
      setLoading(false);
    }
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setUsername(null);
    setPasskeyConfigured(false);
    setPasskeyAvailable(false);
    setPasskeyOrigin(null);
  },

  async loginWithPasskey(): Promise<void> {
    setLoading(true);

    try {
      ensureWebauthnSupport();
      ensureWebauthnFocus();
      const startRes = await fetch('/api/auth/passkey/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!startRes.ok) {
        const message = await readErrorMessage(startRes);
        setError(message);
        throw new Error(message);
      }

      const startData = await startRes.json() as PasskeyCeremonyStart;
      const credential = await navigator.credentials.get(prepareRequestOptions(startData.options));

      const finishRes = await fetch('/api/auth/passkey/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: startData.requestId,
          credential: serializeAuthenticationCredential(credential),
        }),
      });

      if (!finishRes.ok) {
        const message = await readErrorMessage(finishRes);
        setError(message);
        throw new Error(message);
      }

      const data = await finishRes.json() as AuthStatus;
      applyAuthStatus(data);
      setError(null);
    } catch (error) {
      const normalizedError = normalizeWebauthnError(error, 'Passkey login failed');
      const message = normalizedError.message;
      setError(message);
      throw normalizedError;
    } finally {
      setLoading(false);
    }
  },

  async listPasskeys(): Promise<PasskeyCredentialSummary[]> {
    const res = await fetch('/api/auth/passkey/list');
    if (!res.ok) {
      const message = await readErrorMessage(res);
      setError(message);
      throw new Error(message);
    }

    const data = await res.json() as PasskeyListResponse;
    setPasskeyAvailable(data.credentials.length > 0);
    return data.credentials;
  },

  async registerPasskey(name?: string): Promise<PasskeyCredentialSummary[]> {
    setLoading(true);

    try {
      ensureWebauthnSupport();
      ensureWebauthnFocus();
      const startRes = await fetch('/api/auth/passkey/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!startRes.ok) {
        const message = await readErrorMessage(startRes);
        setError(message);
        throw new Error(message);
      }

      const startData = await startRes.json() as PasskeyCeremonyStart;
      const credential = await navigator.credentials.create({
        publicKey: prepareCreationOptions(startData.options),
      });

      const finishRes = await fetch('/api/auth/passkey/register/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: startData.requestId,
          name,
          credential: serializeRegistrationCredential(credential),
        }),
      });

      if (!finishRes.ok) {
        const message = await readErrorMessage(finishRes);
        setError(message);
        throw new Error(message);
      }

      const data = await finishRes.json() as PasskeyListResponse;
      setPasskeyAvailable(data.credentials.length > 0);
      setError(null);
      return data.credentials;
    } catch (error) {
      const normalizedError = normalizeWebauthnError(error, 'Passkey registration failed');
      const message = normalizedError.message;
      setError(message);
      throw normalizedError;
    } finally {
      setLoading(false);
    }
  },

  async deletePasskey(id: string): Promise<PasskeyCredentialSummary[]> {
    const res = await fetch(`/api/auth/passkey/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const message = await readErrorMessage(res);
      setError(message);
      throw new Error(message);
    }

    const data = await res.json() as PasskeyListResponse;
    setPasskeyAvailable(data.credentials.length > 0);
    setError(null);
    return data.credentials;
  },

  async listToolSessions(): Promise<ToolSessionSummary[]> {
    const res = await fetch('/api/auth/tool-sessions');
    if (!res.ok) {
      const message = await readErrorMessage(res);
      setError(message);
      throw new Error(message);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Unexpected Tool Sessions response');
    }

    setError(null);
    return data as ToolSessionSummary[];
  },

  async deleteToolSession(id: number): Promise<void> {
    const res = await fetch(`/api/auth/tool-sessions/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const message = await readErrorMessage(res);
      setError(message);
      throw new Error(message);
    }

    setError(null);
  },
};

export default authStore;
