import type { GitCommit, GitDiff, DiffHunk, DiffLine } from '../../types';

/**
 * Mock Git commit data
 */
export const mockCommits: GitCommit[] = [
  {
    hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
    shortHash: 'a1b2c3d',
    message: 'feat: add new Markdown preview feature',
    author: 'John Doe',
    date: new Date().toISOString(),
  },
  {
    hash: 'b2c3d4e5f6789012345678901234567890abcde1',
    shortHash: 'b2c3d4e',
    message: 'fix: fix file tree expansion issue',
    author: 'Jane Smith',
    date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    hash: 'c3d4e5f6789012345678901234567890abcdef12',
    shortHash: 'c3d4e5f',
    message: 'docs: update README documentation',
    author: 'John Doe',
    date: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    hash: 'd4e5f6789012345678901234567890abcdef1234',
    shortHash: 'd4e5f67',
    message: 'refactor: restructure components',
    author: 'Jane Smith',
    date: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    hash: 'e5f6789012345678901234567890abcdef123456',
    shortHash: 'e5f6789',
    message: 'style: optimize dark theme styles',
    author: 'John Doe',
    date: new Date(Date.now() - 345600000).toISOString(),
  },
];

/**
 * Mock Git branch data
 */
export const mockBranches: string[] = [
  'main',
  'develop',
  'feature/markdown-preview',
  'feature/git-diff',
  'bugfix/file-tree',
];

/**
 * Mock Git tag data
 */
export const mockTags: string[] = [
  'v1.0.0',
  'v1.1.0',
  'v1.2.0',
  'v2.0.0-beta',
];

/**
 * Mock Git status data
 */
export const mockGitStatus = {
  branch: 'main',
  ahead: 2,
  behind: 0,
  staged: ['src/components/Header.tsx'],
  unstaged: ['src/utils/helpers.ts'],
  untracked: ['temp.txt'],
  conflicts: [],
};

/**
 * Create Mock Diff data
 */
export function createMockDiff(
  oldContent: string,
  newContent: string,
  oldFileName: string,
  newFileName: string
): GitDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // Simple diff algorithm to generate hunks
  const hunks: DiffHunk[] = [];
  const lines: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined && newLine !== undefined) {
      lines.push({
        type: 'add',
        content: newLine,
        newLineNumber: i + 1,
      });
    } else if (oldLine !== undefined && newLine === undefined) {
      lines.push({
        type: 'remove',
        content: oldLine,
        oldLineNumber: i + 1,
      });
    } else if (oldLine !== newLine) {
      lines.push({
        type: 'remove',
        content: oldLine,
        oldLineNumber: i + 1,
      });
      lines.push({
        type: 'add',
        content: newLine,
        newLineNumber: i + 1,
      });
    } else {
      lines.push({
        type: 'normal',
        content: oldLine,
        oldLineNumber: i + 1,
        newLineNumber: i + 1,
      });
    }
  }

  hunks.push({
    oldStart: 1,
    oldLines: oldLines.length,
    newStart: 1,
    newLines: newLines.length,
    lines,
  });

  return {
    oldContent,
    newContent,
    oldFileName,
    newFileName,
    hunks,
  };
}

/**
 * Mock file diff data
 */
export const mockFileDiffs: Record<string, GitDiff> = {
  '/README.md': createMockDiff(
    `# OpenMKView

A simple Markdown viewer.

## Features

- Markdown preview
- File browsing

## Installation

npm install
`,
    `# OpenMKView

A modern Markdown viewer and Git Diff tool.

## Features

- 📝 Markdown preview
- 🔀 Git Diff
- 📁 Project browser
- 🎨 Theme switching

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    'README.md',
    'README.md'
  ),
};