import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const projectsFixture = [
  { id: 1, name: 'Alpha', path: '/workspace/alpha', color: '#123456' },
  { id: 2, name: 'Beta', path: '/workspace/beta', color: '#654321' },
];

vi.mock('../services/api', () => ({
  api: {
    getProjects: vi.fn().mockResolvedValue(projectsFixture),
    getFileTree: vi.fn().mockResolvedValue([]),
    getFileContent: vi.fn(),
    closeProject: vi.fn().mockResolvedValue(undefined),
    updateProjectColor: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn(),
    searchFavicons: vi.fn().mockResolvedValue([]),
    getFileRawUrl: vi.fn(() => ''),
  },
}));

vi.mock('../services/shikiWorkerClient', () => ({
  initWorker: vi.fn().mockResolvedValue(undefined),
  highlightCodeWorker: vi.fn().mockResolvedValue({ html: '' }),
  terminateWorker: vi.fn(),
}));

beforeEach(() => {
  (global as any).fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: async () => ({}),
  });
  window.history.pushState({}, '', '/');
  // Reset appStore state between tests
  vi.resetModules();
});

describe('Menu Target highlight in Activity Bar', () => {
  it('highlights the menu target when context menu opens', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');

    // Right-click Alpha to open context menu
    fireEvent.contextMenu(alphaButton);

    // Alpha should have menu-target class and aria-expanded="true"
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('moves menu target when right-clicking a different project', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');
    const betaButton = await screen.findByTitle('Beta');

    // Right-click Alpha
    fireEvent.contextMenu(alphaButton);
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
    });

    // Right-click Beta
    fireEvent.contextMenu(betaButton);

    // Beta should now have menu-target, Alpha should not
    await waitFor(() => {
      expect(betaButton.classList.contains('menu-target')).toBe(true);
      expect(betaButton.getAttribute('aria-expanded')).toBe('true');
      expect(alphaButton.classList.contains('menu-target')).toBe(false);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('clears menu target when color picker closes', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');

    // Right-click Alpha to open context menu
    fireEvent.contextMenu(alphaButton);
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
    });

    // Close the color picker by clicking the close button (× symbol)
    const closeButton = await screen.findByText('×');
    fireEvent.click(closeButton);

    // Menu target should be cleared
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(false);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('supports both active and menu-target classes simultaneously', async () => {
    const { default: App } = await import('../App');
    const { projectStore } = await import('../stores/projectStore');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');

    // Make Alpha the active project
    fireEvent.click(alphaButton);
    await waitFor(() => expect(projectStore.state.activeProject?.id).toBe(1));

    // Wait a bit for the click to fully settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // Right-click Alpha (the active project)
    fireEvent.contextMenu(alphaButton);

    // Should have both active and menu-target classes
    await waitFor(() => {
      expect(alphaButton.classList.contains('active')).toBe(true);
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('clears menu target when a color is selected', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');

    // Right-click Alpha to open context menu
    fireEvent.contextMenu(alphaButton);
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
    });

    // Click a color preset (they have color values as titles)
    const colorPreset = await screen.findByTitle('#FF6B6B');
    fireEvent.click(colorPreset);

    // Menu target should be cleared
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(false);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('clears menu target when Close Project is chosen', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    const alphaButton = await screen.findByTitle('Alpha');

    // Right-click Alpha to open context menu
    fireEvent.contextMenu(alphaButton);
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
    });

    // Click "Close Project"
    const closeProjectButton = await screen.findByText('Close Project');
    fireEvent.click(closeProjectButton);

    // Menu target should be cleared (and Alpha should be gone)
    await waitFor(() => {
      expect(screen.queryByTitle('Alpha')).toBeNull();
    });
  });

  it('highlights menu target even when no project is active', async () => {
    const { default: App } = await import('../App');
    const { projectStore } = await import('../stores/projectStore');
    render(() => <App />);

    // Verify no project is active
    await waitFor(() => expect(projectStore.state.activeProject).toBeNull());

    const alphaButton = await screen.findByTitle('Alpha');

    // Right-click Alpha (no active project)
    fireEvent.contextMenu(alphaButton);

    // Alpha should have menu-target class
    await waitFor(() => {
      expect(alphaButton.classList.contains('menu-target')).toBe(true);
      expect(alphaButton.getAttribute('aria-expanded')).toBe('true');
    });
  });
});
