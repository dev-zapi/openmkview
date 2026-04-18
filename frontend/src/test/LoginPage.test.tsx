import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import LoginPage from '../components/LoginPage';
import { authStore } from '../stores/authStore';

describe('LoginPage', () => {
  beforeEach(() => {
    authStore.setError(null);
    authStore.setPasskeyAvailable(false);
    authStore.setAuthenticated(false);
    authStore.setAuthRequired(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login form', () => {
    render(() => <LoginPage />);
    expect(screen.getByText('Sign in to continue')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('does not show passkey button when not available', () => {
    authStore.setPasskeyAvailable(false);
    render(() => <LoginPage />);
    expect(screen.queryByText('Sign in with Passkey')).toBeNull();
  });

  it('shows passkey button when available', () => {
    authStore.setPasskeyAvailable(true);
    render(() => <LoginPage />);
    expect(screen.getByText('Sign in with Passkey')).toBeTruthy();
  });

  it('shows or divider when passkey is available', () => {
    authStore.setPasskeyAvailable(true);
    render(() => <LoginPage />);
    expect(screen.getByText('or')).toBeTruthy();
  });

  it('displays error message from authStore', () => {
    authStore.setError('Invalid credentials');
    render(() => <LoginPage />);
    expect(screen.getByText('Invalid credentials')).toBeTruthy();
  });

  it('submits login form with username and password', async () => {
    const loginSpy = vi.spyOn(authStore, 'login').mockResolvedValue();
    render(() => <LoginPage />);

    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;

    fireEvent.input(usernameInput, { target: { value: 'admin' }, currentTarget: { value: 'admin' } });
    fireEvent.input(passwordInput, { target: { value: 'secret' }, currentTarget: { value: 'secret' } });
    fireEvent.submit(screen.getByText('Sign in').closest('form')!);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('admin', 'secret');
    });
  });

  it('calls loginWithPasskey when passkey button clicked', async () => {
    authStore.setPasskeyAvailable(true);
    const passkeySpy = vi.spyOn(authStore, 'loginWithPasskey').mockResolvedValue();
    render(() => <LoginPage />);

    fireEvent.click(screen.getByText('Sign in with Passkey'));

    await waitFor(() => {
      expect(passkeySpy).toHaveBeenCalled();
    });
  });

  it('shows waiting state during passkey login', async () => {
    authStore.setPasskeyAvailable(true);
    let resolveLogin: () => void;
    const loginPromise = new Promise<void>((resolve) => { resolveLogin = resolve; });
    vi.spyOn(authStore, 'loginWithPasskey').mockReturnValue(loginPromise);

    render(() => <LoginPage />);
    fireEvent.click(screen.getByText('Sign in with Passkey'));

    await waitFor(() => {
      expect(screen.getByText('Waiting for Passkey...')).toBeTruthy();
    });

    resolveLogin!();
  });

  it('handles passkey login failure gracefully', async () => {
    authStore.setPasskeyAvailable(true);
    vi.spyOn(authStore, 'loginWithPasskey').mockRejectedValue(new Error('Passkey failed'));

    render(() => <LoginPage />);
    fireEvent.click(screen.getByText('Sign in with Passkey'));

    await waitFor(() => {
      // Button should return to normal state after failure
      expect(screen.getByText('Sign in with Passkey')).toBeTruthy();
    });
  });
});
