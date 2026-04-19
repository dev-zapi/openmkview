import { createSignal } from 'solid-js';
import type {
  AuthStatus,
  PasskeyCeremonyStart,
  PasskeyCredentialSummary,
  PasskeyListResponse,
} from '../types/app';
import { settingsStore } from './settingsStore';
import {
  ensureWebauthnSupport,
  prepareCreationOptions,
  prepareRequestOptions,
  serializeAuthenticationCredential,
  serializeRegistrationCredential,
} from '../utils/webauthn';

function applyAuthStatus(data: AuthStatus) {
  setAuthRequired(data.authRequired);
  setAuthenticated(data.authenticated);
  setPasskeyConfigured(Boolean(data.passkeyConfigured));
  setPasskeyAvailable(Boolean(data.passkeyAvailable));
  setPasskeyOrigin(data.passkeyOrigin || null);
  if (typeof data.sessionTimeoutMinutes === 'number' && data.sessionTimeoutMinutes > 0) {
    settingsStore.updateSettings({ sessionTimeoutMinutes: data.sessionTimeoutMinutes });
  }
}

const [authRequired, setAuthRequired] = createSignal(false);
const [authenticated, setAuthenticated] = createSignal(true);
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
  passkeyConfigured,
  passkeyAvailable,
  passkeyOrigin,
  loading,
  error,
  setAuthenticated,
  setAuthRequired,
  setPasskeyConfigured,
  setPasskeyAvailable,
  setPasskeyOrigin,
  setLoading,
  setError,

  async checkStatus(): Promise<AuthStatus> {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json() as AuthStatus;
      applyAuthStatus(data);
      setError(null);
      return data;
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
    setPasskeyConfigured(false);
    setPasskeyAvailable(false);
    setPasskeyOrigin(null);
  },

  async loginWithPasskey(): Promise<void> {
    setLoading(true);

    try {
      ensureWebauthnSupport();
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
      const message = error instanceof Error ? error.message : 'Passkey login failed';
      setError(message);
      throw error;
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
      const message = error instanceof Error ? error.message : 'Passkey registration failed';
      setError(message);
      throw error;
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
};

export default authStore;
