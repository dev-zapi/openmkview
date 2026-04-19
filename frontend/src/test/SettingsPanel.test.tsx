import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import SettingsPanel from '../components/SettingsPanel';
import { DEFAULT_SETTINGS } from '../types/app';
import { authStore } from '../stores/authStore';

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    authStore.setPasskeyConfigured(false);
    authStore.setPasskeyAvailable(false);
    authStore.setPasskeyOrigin(null);
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ themes: [], credentials: [] }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <SettingsPanel isOpen={false} onClose={() => {}} />
    ));
    expect(container.innerHTML).toBe('');
  });

  it('renders settings panel when open', () => {
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders all settings sections', () => {
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getAllByText('Markdown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Themes').length).toBeGreaterThan(0);
    expect(screen.getByText('Trash Settings')).toBeTruthy();
  });

  it('renders passkey management when auth is enabled', async () => {
    authStore.setPasskeyConfigured(true);
    authStore.setPasskeyOrigin('https://example.com');
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);

    await waitFor(() => {
      expect(screen.getAllByText('Passkeys').length).toBeGreaterThan(0);
      expect(screen.getByText('Add Passkey for This Domain')).toBeTruthy();
    });
  });

  it('shows current domain passkey status when configured', async () => {
    authStore.setPasskeyConfigured(true);
    authStore.setPasskeyAvailable(false);
    authStore.setPasskeyOrigin('https://example.com');

    render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);

    await waitFor(() => {
      expect(screen.getByText('Current site: https://example.com')).toBeTruthy();
      expect(screen.getByText('Passkey is configured for this domain, but no Passkeys are registered yet.')).toBeTruthy();
    });
  });

  it('disables passkey registration when current domain is not configured', async () => {
    authStore.setPasskeyConfigured(false);

    render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Passkey Unavailable for This Domain' });
      expect(button).toHaveProperty('disabled', true);
      expect(screen.getByText('Passkey is not enabled for this domain.')).toBeTruthy();
    });
  });

  it('shows a focused-tab message when passkey registration loses focus', async () => {
    authStore.setPasskeyConfigured(true);
    authStore.setPasskeyAvailable(false);
    authStore.setPasskeyOrigin('https://example.com');
    vi.spyOn(window, 'prompt').mockReturnValue('Device 1');
    vi.spyOn(authStore, 'registerPasskey').mockRejectedValue(
      new Error('Passkey requires the current tab to stay focused. Please return to this tab and try again.'),
    );

    render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Passkey for This Domain' }));

    await waitFor(() => {
      expect(
        screen.getByText('Passkey requires the current tab to stay focused. Please return to this tab and try again.'),
      ).toBeTruthy();
    });
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => <SettingsPanel isOpen={true} onClose={onClose} />);

    const closeBtn = container.querySelector('.close-btn');
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <SettingsPanel isOpen={true} onClose={onClose} />
    ));

    const overlay = container.querySelector('.settings-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('does not call onClose when panel clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => <SettingsPanel isOpen={true} onClose={onClose} />);

    const panel = container.querySelector('.settings-panel');
    if (panel) {
      fireEvent.click(panel);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it('loads saved settings into the form', async () => {
    localStorage.setItem('openmkview-settings', JSON.stringify({
      ...DEFAULT_SETTINGS,
      themeMode: 'dark',
      uiFontSize: '18px',
      markdownWidth: 'fixed',
      fixedWidth: '720px',
    }));

    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect((screen.getByLabelText('Theme Mode') as HTMLSelectElement).value).toBe('dark');
      expect((screen.getByLabelText('Content Width') as HTMLSelectElement).value).toBe('fixed');
      expect((screen.getByLabelText('UI Font Size') as HTMLInputElement).value).toBe('18px');
      expect((screen.getByLabelText('Fixed Width Value') as HTMLInputElement).value).toBe('720px');
    });
  });

  it('saves settings and calls onSave', async () => {
    const onSave = vi.fn();
    vi.spyOn(window, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ...DEFAULT_SETTINGS, markdownWidth: 'fixed', fixedWidth: '720px' }),
    } as Response);
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Content Width'), { target: { value: 'fixed' }, currentTarget: { value: 'fixed' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Fixed Width Value')).toBeTruthy();
    });

    fireEvent.input(screen.getByLabelText('Fixed Width Value'), {
      currentTarget: { value: '720px' },
      target: { value: '720px' },
    });
    fireEvent.click(screen.getByText('Save Settings'));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('openmkview-settings') || '{}');
      expect(saved.markdownWidth).toBe('fixed');
      expect(saved.fixedWidth).toBe('720px');
    });
    expect(document.body.classList.contains('light-theme') || document.body.classList.contains('dark-theme')).toBe(true);
    expect(onSave).toHaveBeenCalled();
  });

  it('applies font preset buttons', async () => {
    render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Helvetica' }));

    await waitFor(() => {
      expect(screen.getByDisplayValue('"Helvetica Neue", Arial, sans-serif')).toBeTruthy();
    });
  });

  describe('navigation', () => {
    let scrollIntoViewMock: ReturnType<typeof vi.fn>;
    let IntersectionObserverMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      IntersectionObserverMock = vi.fn(function(this: IntersectionObserver) {
        this.observe = vi.fn();
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      }) as any;
      window.IntersectionObserver = IntersectionObserverMock as any;
    });

    afterEach(() => {
      vi.restoreAllMocks();
        vi.spyOn(window, 'fetch').mockResolvedValue({
          ok: true,
          json: async () => ({ themes: [], credentials: [] }),
        } as Response);
      });

    it('renders navigation with all categories', () => {
      const { container } = render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      const navItems = container.querySelectorAll('.settings-nav button');
      expect(navItems.length).toBe(4);
      expect(container.querySelector('.settings-nav')).toBeTruthy();
    });

    it('renders auth-only navigation categories when auth is enabled', () => {
      const { container } = render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);
      const navItems = container.querySelectorAll('.settings-nav button');
      expect(navItems.length).toBe(6);
    });

    it('clicking navigation item triggers scrollIntoView', () => {
      const { container } = render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      
      const themesBtn = container.querySelector('.settings-nav button');
      if (themesBtn) {
        fireEvent.click(themesBtn);
        expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      }
    });

    it('clicking navigation item switches active class', () => {
      const { container } = render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      const navButtons = container.querySelectorAll('.settings-nav button');
      
      if (navButtons.length >= 2) {
        expect(navButtons[0].classList.contains('active')).toBe(true);
        fireEvent.click(navButtons[1]);
        expect(navButtons[0].classList.contains('active')).toBe(false);
        expect(navButtons[1].classList.contains('active')).toBe(true);
      }
    });

    it('IntersectionObserver is created when panel opens', async () => {
      render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      await waitFor(() => {
        expect(IntersectionObserverMock).toHaveBeenCalled();
      });
    });

    it('IntersectionObserver observes all sections', async () => {
      const observeMock = vi.fn();
      IntersectionObserverMock.mockImplementation(function(this: IntersectionObserver) {
        this.observe = observeMock;
        this.unobserve = vi.fn();
        this.disconnect = vi.fn();
      } as any);
      
      render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      
        await waitFor(() => {
          expect(observeMock).toHaveBeenCalledTimes(4);
        });
      });

      it('IntersectionObserver observes auth-only sections when auth is enabled', async () => {
        const observeMock = vi.fn();
        IntersectionObserverMock.mockImplementation(function(this: IntersectionObserver) {
          this.observe = observeMock;
          this.unobserve = vi.fn();
          this.disconnect = vi.fn();
        } as any);

        render(() => <SettingsPanel isOpen={true} onClose={() => {}} authRequired={true} />);

        await waitFor(() => {
          expect(observeMock).toHaveBeenCalledTimes(6);
        });
      });
  });
});
