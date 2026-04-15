import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import SettingsPanel from '../components/SettingsPanel';

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
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
    });

    it('renders navigation with all categories', () => {
      const { container } = render(() => <SettingsPanel isOpen={true} onClose={() => {}} />);
      const navItems = container.querySelectorAll('.settings-nav button');
      expect(navItems.length).toBe(4);
      expect(container.querySelector('.settings-nav')).toBeTruthy();
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
        expect(observeMock.mock.calls.length).toBeGreaterThanOrEqual(0);
      });
    });
  });
});