import { Component, createSignal, Show } from 'solid-js';
import { authStore } from '../stores/authStore';

const LoginPage: Component = () => {
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);

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
            <input
              type="text"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              autocomplete="username"
              required
            />
          </label>

          <label class="login-field">
            <span>Password</span>
            <input
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

          <button class="login-submit" type="submit" disabled={submitting()}>
            {submitting() ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
