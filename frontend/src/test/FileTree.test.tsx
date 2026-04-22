import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import FileTree from '../components/FileTree';
import type { FileNode } from '../types';

describe('FileTree', () => {
  const mockNodes: FileNode[] = [
    {
      id: 'src',
      name: 'src',
      path: '/project/src',
      isFolder: true,
      children: [
        {
          id: 'src/index.ts',
          name: 'index.ts',
          path: '/project/src/index.ts',
          isFolder: false,
        },
        {
          id: 'src/App.tsx',
          name: 'App.tsx',
          path: '/project/src/App.tsx',
          isFolder: false,
        },
      ],
    },
    {
      id: 'README.md',
      name: 'README.md',
      path: '/project/README.md',
      isFolder: false,
    },
  ];

  it('renders file tree correctly', () => {
    const mockOnFileClick = vi.fn();
    const { container } = render(() => (
      <FileTree nodes={mockNodes} onFileClick={mockOnFileClick} />
    ));

    expect(container.querySelector('.file-tree')).toBeTruthy();
    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('README.md')).toBeTruthy();
  });

  it('calls onFileClick when file is clicked', () => {
    const mockOnFileClick = vi.fn();
    render(() => <FileTree nodes={mockNodes} onFileClick={mockOnFileClick} />);

    const fileItem = screen.getByText('README.md');
    fireEvent.click(fileItem);

    expect(mockOnFileClick).toHaveBeenCalledWith('/project/README.md', 'README.md');
  });

  it('expands folder when clicked with expandedFolders', () => {
    const mockOnFileClick = vi.fn();
    const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(new Set());
    
    const mockOnFolderToggle = (path: string, expanded: boolean) => {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (expanded) {
          newSet.add(path);
        } else {
          newSet.delete(path);
        }
        return newSet;
      });
    };

    render(() => (
      <FileTree 
        nodes={mockNodes} 
        onFileClick={mockOnFileClick}
        expandedFolders={expandedFolders()}
        onFolderToggle={mockOnFolderToggle}
      />
    ));

    const folderItem = screen.getByText('src');
    fireEvent.click(folderItem);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });

  it('calls onFolderToggle when folder is clicked', () => {
    const mockOnFileClick = vi.fn();
    const mockOnFolderToggle = vi.fn();

    render(() => (
      <FileTree 
        nodes={mockNodes} 
        onFileClick={mockOnFileClick}
        expandedFolders={new Set()}
        onFolderToggle={mockOnFolderToggle}
      />
    ));

    const folderItem = screen.getByText('src');
    fireEvent.click(folderItem);

    expect(mockOnFolderToggle).toHaveBeenCalledWith('/project/src', true);
  });

  it('opens file when Enter is pressed on a file item', () => {
    const mockOnFileClick = vi.fn();
    render(() => <FileTree nodes={mockNodes} onFileClick={mockOnFileClick} />);

    const fileItem = screen.getByRole('button', { name: 'README.md' });
    fireEvent.keyDown(fileItem, { key: 'Enter' });

    expect(mockOnFileClick).toHaveBeenCalledWith('/project/README.md', 'README.md');
  });

  it('does not toggle empty folders', () => {
    const mockOnFolderToggle = vi.fn();
    const mockOnFileClick = vi.fn();

    render(() => (
      <FileTree
        nodes={[
          {
            id: 'empty',
            name: 'empty',
            path: '/project/empty',
            isFolder: true,
            children: [],
          },
        ]}
        onFileClick={mockOnFileClick}
        expandedFolders={new Set()}
        onFolderToggle={mockOnFolderToggle}
      />
    ));

    fireEvent.click(screen.getByText('empty'));

    expect(mockOnFolderToggle).not.toHaveBeenCalled();
  });
});
