import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import ProjectMenu from '../components/ProjectMenu';

const renderMenu = (overrides: Record<string, unknown> = {}) => {
  const props = {
    isOpen: true,
    position: { top: 40, right: 12 },
    gitUnavailable: false,
    pullDisabled: false,
    onRefresh: vi.fn(),
    onFetch: vi.fn(),
    onPull: vi.fn(),
    onEdit: vi.fn(),
    onCloseProject: vi.fn(),
    onCloseMenu: vi.fn(),
    ...overrides,
  };
  render(() => <ProjectMenu {...props} />);
  return props;
};

describe('ProjectMenu', () => {
  it('runs fetch and pull from grouped project actions', async () => {
    const props = renderMenu();

    await fireEvent.click(screen.getByRole('menuitem', { name: 'Fetch' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Pull' }));

    expect(props.onFetch).toHaveBeenCalledOnce();
    expect(props.onPull).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('shows project operation progress and disables both git actions', () => {
    renderMenu({ gitOperation: 'fetch' });

    expect((screen.getByRole('menuitem', { name: 'Fetching...' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('menuitem', { name: 'Pull' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables pull for unsaved changes without disabling fetch', () => {
    renderMenu({ pullDisabled: true });

    expect((screen.getByRole('menuitem', { name: 'Fetch' }) as HTMLButtonElement).disabled).toBe(false);
    const pull = screen.getByRole('menuitem', { name: 'Pull' }) as HTMLButtonElement;
    expect(pull.disabled).toBe(true);
    expect(pull.getAttribute('title')).toBe('Save or discard unsaved changes before pulling');
  });
});
