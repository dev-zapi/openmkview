import type { FileContent } from '../../types';

export const mockFileContents: Record<string, FileContent> = {
  '/README.md': {
    content: `# OpenMKView

A modern Markdown viewer and Git Diff tool.

## Features

- 📝 **Markdown Preview** - GitHub-flavored Markdown rendering
- 🔀 **Git Diff** - Visual file difference comparison
- 📁 **Project Browser** - Tree structure file browsing
- 🎨 **Theme Switching** - Light/dark theme support

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Project Structure

\`\`\`
openmkview/
├── src/
│   ├── components/    # UI components
│   ├── services/      # API services
│   ├── stores/        # State management
│   └── types/         # TypeScript types
├── docs/              # Documentation
└── e2e/               # E2E tests
\`\`\`

## Contributing

Issues and Pull Requests are welcome!

## License

MIT License
`,
    fileName: 'README.md',
    path: '/README.md',
    fileSize: 1024,
    lastModified: new Date().toISOString(),
  },
  '/docs/README.md': {
    content: `# Documentation

This is the project documentation directory.

## Document List

- [Changelog](./CHANGELOG.md) - View project version update history

## Development Documentation

Detailed development documentation is being written...
`,
    fileName: 'README.md',
    path: '/docs/README.md',
    fileSize: 256,
    lastModified: new Date(Date.now() - 86400000).toISOString(),
  },
  '/src/pages/index.md': {
    content: `# Welcome to OpenMKView

This is a sample Markdown file.

## Introduction

OpenMKView is a powerful Markdown viewing tool that supports:

- Live preview
- Code highlighting
- Table support
- Task lists

### Code Example

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

### Table Example

| Feature | Status | Description |
|------|------|------|
| Markdown Preview | ✅ | Completed |
| Git Diff | ✅ | Completed |
| Theme Switching | ✅ | Completed |

### Task List

- [x] Complete basic features
- [x] Add tests
- [ ] Optimize performance
- [ ] Add more themes

> Note: This is an example quote block.
`,
    fileName: 'index.md',
    path: '/src/pages/index.md',
    fileSize: 512,
    lastModified: new Date().toISOString(),
  },
  '/src/pages/guide/getting-started.md': {
    content: `# Quick Start Guide

This guide will help you get started with OpenMKView quickly.

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation Steps

1. Clone the repository

\`\`\`bash
git clone https://github.com/example/openmkview.git
cd openmkview
\`\`\`

2. Install dependencies

\`\`\`bash
npm install
\`\`\`

3. Start development server

\`\`\`bash
npm run dev
\`\`\`

## Next Steps

- Read [Advanced Usage](./advanced.md) for more features
- Check [API Documentation](../api/README.md) for interface details
`,
    fileName: 'getting-started.md',
    path: '/src/pages/guide/getting-started.md',
    fileSize: 384,
    lastModified: new Date(Date.now() - 172800000).toISOString(),
  },
};

export function getMockFileContent(path: string): FileContent | null {
  return mockFileContents[path] || null;
}

export function generateDefaultFileContent(path: string): FileContent {
  const fileName = path.split('/').pop() || 'file';
  const ext = fileName.split('.').pop()?.toLowerCase();

  let content = '';

  if (ext === 'md') {
    content = `# ${fileName}\n\nThis is a sample Markdown file.\n`;
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
    fileName,
    path,
    fileSize: content.length,
    lastModified: new Date().toISOString(),
  };
}