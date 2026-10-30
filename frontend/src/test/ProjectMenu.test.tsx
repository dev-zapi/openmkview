import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import ProjectMenu from '../components/ProjectMenu';
import { Menu, MenuTrigger } from '../components/ui/Menu';
import { fileTreeVisibilityStore } from '../stores/fileTreeVisibilityStore';

const renderMenu = (overrides: Record<string, unknown> = {}) => {
  const props = {
    gitUnavailable: false,
    pullDisabled: false,
    onRefresh: vi.fn(),
    onFetch: vi.fn(),
    onPull: vi.fn(),
    onEdit: vi.fn(),
    onCloseProject: vi.fn(),
    ...overrides,
  };
  render(() => (
    <Menu defaultOpen>
      <MenuTrigger aria-label="Project actions" />
      <ProjectMenu {...props} />
    </Menu>
  ));
  return props;
};

describe('ProjectMenu', () => {
  it('runs fetch and pull from grouped project actions', async () => {
    const props = renderMenu();

    await fireEvent.click(await screen.findByRole('menuitem', { name: 'Fetch' }));
    await fireEvent.click(screen.getByRole('menuitem', { name: 'Pull' }));

    expect(props.onFetch).toHaveBeenCalledOnce();
    expect(props.onPull).toHaveBeenCalledOnce();
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('shows project operation progress and disables both git actions', async () => {
    renderMenu({ gitOperation: 'fetch' });

    expect(((await screen.findByRole('menuitem', { name: 'Fetching...' })) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('menuitem', { name: 'Pull' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables pull for unsaved changes without disabling fetch', async () => {
    renderMenu({ pullDisabled: true });

    expect(((await screen.findByRole('menuitem', { name: 'Fetch' })) as HTMLButtonElement).disabled).toBe(false);
    const pull = screen.getByRole('menuitem', { name: 'Pull' }) as HTMLButtonElement;
    expect(pull.disabled).toBe(true);
    expect(pull.getAttribute('title')).toBe('Save or discard unsaved changes before pulling');
  });

  it('closes on an outside click and can be reopened', async () => {
    renderMenu();

    await fireEvent.mouseDown(document.body);
    await fireEvent.click(document.body);

    expect(screen.queryByRole('menu')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Project actions' }));

    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('closes when Escape is pressed', async () => {
    renderMenu();

    await fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles hidden files from a checkable menu item', async () => {
    fileTreeVisibilityStore.setShowHidden(false);
    renderMenu();

    const toggle = await screen.findByRole('menuitemcheckbox', { name: 'Show Hidden Files' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    expect(fileTreeVisibilityStore.showHidden()).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('openmkview-show-hidden')).toBe('true');
  });
});
