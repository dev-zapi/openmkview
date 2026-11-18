import { Component, createResource, createSignal, Show } from 'solid-js';
import { authStore } from '../stores/authStore';
import { Button, Input } from './ui';

const fetchVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/version');
    if (!response.ok) return null;
    const body = (await response.json()) as { version?: string };
    return body.version ?? null;
  } catch {
    return null;
  }
};

const LoginPage: Component = () => {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [passkeySubmitting, setPasskeySubmitting] = createSignal(false);
  const [version] = createResource(fetchVersion);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await authStore.login(username().trim(), password());
      setPassword('');
    } catch {
      // error is already stored in authStore
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setPasskeySubmitting(true);

    try {
      await authStore.loginWithPasskey();
    } catch {
      // error is already stored in authStore
    } finally {
      setPasskeySubmitting(false);
    }
  };

  return (
    <div class="login-shell">
      <div class="login-panel">
        <div class="login-panel-header">
          <div class="login-mark">OM</div>
          <div>
            <h1>OpenMKView</h1>
            <p>Sign in to continue</p>
          </div>
        </div>

        <form class="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label class="login-field">
            <span>Username</span>
            <Input
              type="text"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              autocomplete="username"
              required
            />
          </label>

          <label class="login-field">
            <span>Password</span>
            <Input
              type="password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              autocomplete="current-password"
              required
            />
          </label>

          <Show when={authStore.error()}>
            <div class="login-error">{authStore.error()}</div>
          </Show>

          <Button class="login-submit" type="submit" disabled={submitting()}>
            <Show when={submitting()}>
              <span class="btn-spinner" aria-hidden="true" />
            </Show>
            {submitting() ? 'Signing in...' : 'Sign in'}
          </Button>

          <Show when={authStore.passkeyAvailable()}>
            <div class="login-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <Button
              class="login-passkey"
              variant="outline"
              type="button"
              onClick={() => void handlePasskeyLogin()}
              disabled={passkeySubmitting()}
            >
              <Show when={passkeySubmitting()}>
                <span class="btn-spinner" aria-hidden="true" />
              </Show>
              {passkeySubmitting() ? 'Waiting for Passkey...' : 'Sign in with Passkey'}
            </Button>
          </Show>
        </form>

        <Show when={version()}>
          <p class="login-version">{version()}</p>
        </Show>
      </div>
    </div>
  );
};

export default LoginPage;
