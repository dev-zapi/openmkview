import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authStore } from '../../stores/authStore';

describe('authStore.checkStatus', () => {
  beforeEach(() => {
    authStore.setAuthRequired(true);
    authStore.setAuthenticated(true);
    authStore.setUsername(null);
    authStore.setError(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies auth status from a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        authRequired: true,
        authenticated: true,
        passkeyConfigured: false,
        passkeyAvailable: false,
      }), { status: 200 }),
    ));

    const result = await authStore.checkStatus();

    expect(result?.authenticated).toBe(true);
    expect(authStore.authenticated()).toBe(true);
    expect(authStore.loading()).toBe(false);
  });

  it('exposes the logged-in username from auth status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        authRequired: true,
        authenticated: true,
        username: 'Jonas',
        passkeyConfigured: false,
        passkeyAvailable: false,
      }), { status: 200 }),
    ));

    const result = await authStore.checkStatus();

    expect(result?.username).toBe('Jonas');
    expect(authStore.username()).toBe('Jonas');
  });

  it('clears the username when there is no authenticated session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        authRequired: true,
        authenticated: false,
        passkeyConfigured: false,
        passkeyAvailable: false,
      }), { status: 200 }),
    ));

    await authStore.checkStatus();

    expect(authStore.username()).toBeNull();
  });

  it('marks the session unauthenticated on an explicit 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
    ));

    const result = await authStore.checkStatus();

    expect(result).toBeNull();
    expect(authStore.authenticated()).toBe(false);
    expect(authStore.loading()).toBe(false);
  });

  it('keeps the session state on network failure (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      new TypeError('Failed to fetch'),
    ));

    const result = await authStore.checkStatus();

    // 网络失败不代表未认证：不抛错、不改变登录态，交由离线 UI 处理
    expect(result).toBeNull();
    expect(authStore.authenticated()).toBe(true);
    expect(authStore.loading()).toBe(false);
  });
});
