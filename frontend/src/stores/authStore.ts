import { createSignal } from 'solid-js';
import type { AuthStatus } from '../types/app';
import { settingsStore } from './settingsStore';

function applyAuthStatus(data: AuthStatus) {
  setAuthRequired(data.authRequired);
  setAuthenticated(data.authenticated);
  if (typeof data.sessionTimeoutMinutes === 'number' && data.sessionTimeoutMinutes > 0) {
    settingsStore.updateSettings({ sessionTimeoutMinutes: data.sessionTimeoutMinutes });
  }
}

const [authRequired, setAuthRequired] = createSignal(false);
const [authenticated, setAuthenticated] = createSignal(true);
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal<string | null>(null);

async function readErrorMessage(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({ error: res.statusText }));
  return data.error || `Request failed with status ${res.status}`;
}

export const authStore = {
  authRequired,
  authenticated,
  loading,
  error,
  setAuthenticated,
  setAuthRequired,
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
  },
};

export default authStore;
