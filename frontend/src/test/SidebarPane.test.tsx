import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import SidebarPane from '../components/SidebarPane';

describe('SidebarPane', () => {
  const project = { id: 1, name: 'Alpha', path: '/alpha' };
  const nodes = [{ id: '1', name: 'README.md', path: 'README.md', isFolder: false }];

  it('renders project header and file tree', () => {
    render(() => (
      <SidebarPane
        project={project}
        nodes={nodes}
        expandedFolders={new Set()}
        sidebarWidth={280}
        transition="none"
        onRefresh={() => {}}
        onEdit={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onFolderToggle={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onStartDragging={() => {}}
      />
    ));

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('README.md')).toBeTruthy();
  });

  it('calls resize handler on mouse down', () => {
    const onStartDragging = vi.fn();
    const { container } = render(() => (
      <SidebarPane
        project={project}
        nodes={nodes}
        expandedFolders={new Set()}
        sidebarWidth={280}
        transition="none"
        onRefresh={() => {}}
        onEdit={() => {}}
        onCloseProject={() => {}}
        onFileClick={() => {}}
        onFolderToggle={() => {}}
        onDelete={() => {}}
        onCopyPath={() => {}}
        onRename={() => {}}
        onStartDragging={onStartDragging}
      />
    ));

    const handle = container.querySelector('.sidebar-resize-handle');
    expect(handle).toBeTruthy();
    fireEvent.mouseDown(handle!);
    expect(onStartDragging).toHaveBeenCalled();
  });
});
