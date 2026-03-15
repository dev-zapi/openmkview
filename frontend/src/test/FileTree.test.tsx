import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import FileTree from '../components/FileTree';
import type { FileNode } from '../types';

describe('FileTree', () => {
  const mockNodes: FileNode[] = [
    {
      name: 'src',
      path: '/project/src',
      isFolder: true,
      children: [
        {
          name: 'index.ts',
          path: '/project/src/index.ts',
          isFolder: false,
        },
        {
          name: 'App.tsx',
          path: '/project/src/App.tsx',
          isFolder: false,
        },
      ],
    },
    {
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

  it('expands folder when clicked', () => {
    const mockOnFileClick = vi.fn();
    render(() => <FileTree nodes={mockNodes} onFileClick={mockOnFileClick} />);

    const folderItem = screen.getByText('src');
    fireEvent.click(folderItem);

    expect(screen.getByText('index.ts')).toBeTruthy();
    expect(screen.getByText('App.tsx')).toBeTruthy();
  });
});
