import type { GitCommit, GitDiff, DiffHunk, DiffLine } from '../../types';

/**
 * Mock Git 提交数据
 */
export const mockCommits: GitCommit[] = [
  {
    hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
    shortHash: 'a1b2c3d',
    message: 'feat: 添加新的 Markdown 预览功能',
    author: 'John Doe',
    date: new Date().toISOString(),
  },
  {
    hash: 'b2c3d4e5f6789012345678901234567890abcde1',
    shortHash: 'b2c3d4e',
    message: 'fix: 修复文件树展开问题',
    author: 'Jane Smith',
    date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    hash: 'c3d4e5f6789012345678901234567890abcdef12',
    shortHash: 'c3d4e5f',
    message: 'docs: 更新 README 文档',
    author: 'John Doe',
    date: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    hash: 'd4e5f6789012345678901234567890abcdef1234',
    shortHash: 'd4e5f67',
    message: 'refactor: 重构组件结构',
    author: 'Jane Smith',
    date: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    hash: 'e5f6789012345678901234567890abcdef123456',
    shortHash: 'e5f6789',
    message: 'style: 优化暗色主题样式',
    author: 'John Doe',
    date: new Date(Date.now() - 345600000).toISOString(),
  },
];

/**
 * Mock Git 分支数据
 */
export const mockBranches: string[] = [
  'main',
  'develop',
  'feature/markdown-preview',
  'feature/git-diff',
  'bugfix/file-tree',
];

/**
 * Mock Git 标签数据
 */
export const mockTags: string[] = [
  'v1.0.0',
  'v1.1.0',
  'v1.2.0',
  'v2.0.0-beta',
];

/**
 * Mock Git 状态数据
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
 * 创建 Mock Diff 数据
 */
export function createMockDiff(
  oldContent: string,
  newContent: string,
  oldFileName: string,
  newFileName: string
): GitDiff {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  // 简单的 diff 算法生成 hunks
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
 * Mock 文件 Diff 数据
 */
export const mockFileDiffs: Record<string, GitDiff> = {
  '/README.md': createMockDiff(
    `# OpenMKView

一个简单的 Markdown 查看器。

## 功能

- Markdown 预览
- 文件浏览

## 安装

npm install
`,
    `# OpenMKView

一个现代化的 Markdown 查看器和 Git Diff 工具。

## 功能特性

- 📝 Markdown 预览
- 🔀 Git Diff
- 📁 项目浏览器
- 🎨 主题切换

## 快速开始

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    'README.md',
    'README.md'
  ),
};