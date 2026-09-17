import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

const projectsFixture = [
  { id: 1, name: 'Alpha', path: '/workspace/alpha', color: '#123456' },
  { id: 2, name: 'Beta', path: '/workspace/beta', color: '#654321' },
];

const closeProjectSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('../services/api', () => ({
  api: {
    getProjects: vi.fn().mockResolvedValue(projectsFixture),
    getFileTree: vi.fn().mockResolvedValue([]),
    getFileContent: vi.fn(),
    closeProject: closeProjectSpy,
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
  closeProjectSpy.mockClear();
});

describe('closing a project from the activity-bar context menu', () => {
  it('closes the right-clicked project, not the active one', async () => {
    const { default: App } = await import('../App');
    const { projectStore } = await import('../stores/projectStore');
    render(() => <App />);

    const betaButton = await screen.findByTitle('Beta');
    await screen.findByTitle('Alpha');

    // Make Beta (id 2) the active project.
    fireEvent.click(betaButton);
    await waitFor(() => expect(projectStore.state.activeProject?.id).toBe(2));

    // Right-click Alpha (id 1) and choose "Close Project".
    fireEvent.contextMenu(screen.getByTitle('Alpha'));
    fireEvent.click(await screen.findByText('Close Project'));

    await waitFor(() => expect(closeProjectSpy).toHaveBeenCalled());
    expect(closeProjectSpy).toHaveBeenCalledWith(1);

    // Alpha is gone; the active Beta remains untouched.
    await waitFor(() => expect(screen.queryByTitle('Alpha')).toBeNull());
    expect(screen.getByTitle('Beta')).toBeTruthy();
  });

  it('closes the right-clicked project when nothing is active', async () => {
    const { default: App } = await import('../App');
    render(() => <App />);

    await screen.findByTitle('Alpha');

    // No active project: right-click Alpha (id 1) and choose "Close Project".
    fireEvent.contextMenu(screen.getByTitle('Alpha'));
    fireEvent.click(await screen.findByText('Close Project'));

    await waitFor(() => expect(closeProjectSpy).toHaveBeenCalled());
    expect(closeProjectSpy).toHaveBeenCalledWith(1);
  });
});
