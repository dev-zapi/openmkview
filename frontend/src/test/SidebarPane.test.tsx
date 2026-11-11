import { describe, it, expect, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import SidebarPane from '../components/SidebarPane';

describe('SidebarPane', () => {
  const project = { id: 1, name: 'Alpha', path: '/alpha' };
  const nodes = [{ id: '1', name: 'README.md', path: 'README.md', isFolder: false }];

  it('renders project header and file tree', () => {
    const { container } = render(() => (
      <SidebarPane
        project={project}
        nodes={nodes}
        open={true}
        sidebarWidth={280}
        transition="none"
        gitUnavailable={false}
        pullDisabled={false}
        onRefresh={() => {}}
        onGitAction={async () => true}
        onEdit={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onCollapse={() => {}}
        onStartDragging={() => {}}
      />
    ));

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(container.querySelector('.pierre-file-tree-host')).toBeTruthy();
  });

  it('collapses and reopens without unmounting the file tree', () => {
    const [open, setOpen] = createSignal(true);
    const { container } = render(() => (
      <SidebarPane
        project={project}
        nodes={nodes}
        open={open()}
        sidebarWidth={280}
        transition="none"
        gitUnavailable={false}
        pullDisabled={false}
        onRefresh={() => {}}
        onGitAction={async () => true}
        onEdit={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onStartDragging={() => {}}
        onCollapse={() => setOpen(false)}
      />
    ));

    const sidebar = container.querySelector('#file-tree-sidebar');
    const fileTree = container.querySelector('.pierre-file-tree-host');
    expect(sidebar?.hasAttribute('hidden')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(sidebar?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('.pierre-file-tree-host')).toBe(fileTree);

    setOpen(true);
    expect(sidebar?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('.pierre-file-tree-host')).toBe(fileTree);
  });

  it('calls resize handler on mouse down', () => {
    const onStartDragging = vi.fn();
    const { container } = render(() => (
      <SidebarPane
        project={project}
        nodes={nodes}
        open={true}
        sidebarWidth={280}
        transition="none"
        gitUnavailable={false}
        pullDisabled={false}
        onRefresh={() => {}}
        onGitAction={async () => true}
        onEdit={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onCollapse={() => {}}
        onStartDragging={onStartDragging}
      />
    ));

    const handle = container.querySelector('.sidebar-resize-handle');
    expect(handle).toBeTruthy();
    fireEvent.mouseDown(handle!);
    expect(onStartDragging).toHaveBeenCalled();
  });
});
