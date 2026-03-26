import type { FileContent, Heading } from '../../types';

/**
 * Mock 文件内容数据
 */
export const mockFileContents: Record<string, FileContent> = {
  '/README.md': {
    content: `# OpenMKView

一个现代化的 Markdown 查看器和 Git Diff 工具。

## 功能特性

- 📝 **Markdown 预览** - 支持 GitHub 风格的 Markdown 渲染
- 🔀 **Git Diff** - 可视化的文件差异对比
- 📁 **项目浏览器** - 树形结构浏览项目文件
- 🎨 **主题切换** - 支持亮色/暗色主题

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
\`\`\`

## 项目结构

\`\`\`
openmkview/
├── src/
│   ├── components/    # UI 组件
│   ├── services/      # API 服务
│   ├── stores/        # 状态管理
│   └── types/         # TypeScript 类型
├── docs/              # 文档
└── e2e/               # E2E 测试
\`\`\`

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
`,
    headings: [
      { depth: 1, text: 'OpenMKView', id: 'openmkview' },
      { depth: 2, text: '功能特性', id: '功能特性' },
      { depth: 2, text: '快速开始', id: '快速开始' },
      { depth: 2, text: '项目结构', id: '项目结构' },
      { depth: 2, text: '贡献指南', id: '贡献指南' },
      { depth: 2, text: '许可证', id: '许可证' },
    ],
    fileName: 'README.md',
    path: '/README.md',
    fileSize: 1024,
    lastModified: new Date().toISOString(),
  },
  '/docs/README.md': {
    content: `# 文档目录

这里是项目的文档目录。

## 文档列表

- [更新日志](./CHANGELOG.md) - 查看项目的版本更新历史

## 开发文档

详细的开发文档正在编写中...
`,
    headings: [
      { depth: 1, text: '文档目录', id: '文档目录' },
      { depth: 2, text: '文档列表', id: '文档列表' },
      { depth: 2, text: '开发文档', id: '开发文档' },
    ],
    fileName: 'README.md',
    path: '/docs/README.md',
    fileSize: 256,
    lastModified: new Date(Date.now() - 86400000).toISOString(),
  },
  '/src/pages/index.md': {
    content: `# 欢迎使用 OpenMKView

这是一个示例 Markdown 文件。

## 简介

OpenMKView 是一个强大的 Markdown 查看工具，支持：

- 实时预览
- 代码高亮
- 表格支持
- 任务列表

### 代码示例

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}
\`\`\`

### 表格示例

| 功能 | 状态 | 描述 |
|------|------|------|
| Markdown 预览 | ✅ | 已完成 |
| Git Diff | ✅ | 已完成 |
| 主题切换 | ✅ | 已完成 |

### 任务列表

- [x] 完成基础功能
- [x] 添加测试
- [ ] 优化性能
- [ ] 添加更多主题

> 提示：这是一个引用块示例。
`,
    headings: [
      { depth: 1, text: '欢迎使用 OpenMKView', id: '欢迎使用-openmkview' },
      { depth: 2, text: '简介', id: '简介' },
      { depth: 3, text: '代码示例', id: '代码示例' },
      { depth: 3, text: '表格示例', id: '表格示例' },
      { depth: 3, text: '任务列表', id: '任务列表' },
    ],
    fileName: 'index.md',
    path: '/src/pages/index.md',
    fileSize: 512,
    lastModified: new Date().toISOString(),
  },
  '/src/pages/guide/getting-started.md': {
    content: `# 快速开始指南

本指南将帮助你快速上手 OpenMKView。

## 安装

### 前置要求

- Node.js 18+
- npm 或 yarn

### 安装步骤

1. 克隆仓库

\`\`\`bash
git clone https://github.com/example/openmkview.git
cd openmkview
\`\`\`

2. 安装依赖

\`\`\`bash
npm install
\`\`\`

3. 启动开发服务器

\`\`\`bash
npm run dev
\`\`\`

## 下一步

- 阅读 [高级用法](./advanced.md) 了解更多功能
- 查看 [API 文档](../api/README.md) 了解接口详情
`,
    headings: [
      { depth: 1, text: '快速开始指南', id: '快速开始指南' },
      { depth: 2, text: '安装', id: '安装' },
      { depth: 3, text: '前置要求', id: '前置要求' },
      { depth: 3, text: '安装步骤', id: '安装步骤' },
      { depth: 2, text: '下一步', id: '下一步' },
    ],
    fileName: 'getting-started.md',
    path: '/src/pages/guide/getting-started.md',
    fileSize: 384,
    lastModified: new Date(Date.now() - 172800000).toISOString(),
  },
};

/**
 * 获取 Mock 文件内容
 */
export function getMockFileContent(path: string): FileContent | null {
  return mockFileContents[path] || null;
}

/**
 * 生成默认的 Mock 文件内容
 */
export function generateDefaultFileContent(path: string): FileContent {
  const fileName = path.split('/').pop() || 'file';
  const ext = fileName.split('.').pop()?.toLowerCase();

  let content = '';
  const headings: Heading[] = [];

  if (ext === 'md') {
    content = `# ${fileName}\n\n这是一个示例 Markdown 文件。\n`;
    headings.push({ depth: 1, text: fileName, id: fileName.toLowerCase() });
  } else if (ext === 'ts' || ext === 'tsx') {
    content = `// ${fileName}\n\nexport default {};\n`;
  } else if (ext === 'js' || ext === 'jsx') {
    content = `// ${fileName}\n\nexport default {};\n`;
  } else if (ext === 'json') {
    content = `{\n  "name": "${fileName}"\n}\n`;
  } else {
    content = `// ${fileName}\n`;
  }

  return {
    content,
    headings,
    fileName,
    path,
    fileSize: content.length,
    lastModified: new Date().toISOString(),
  };
}