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
import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';

// Generic repository interface
interface Repository<T extends { id: number }> {
  findAll(): Promise<T[]>;
  findById(id: number): Promise<T | null>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: number, entity: Partial<T>): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// Abstract base class with generics
abstract class BaseService<T extends { id: number }> extends EventEmitter {
  protected repository: Repository<T>;
  private readonly logger: Console;

  constructor(repository: Repository<T>) {
    super();
    this.repository = repository;
    this.logger = console;
  }

  async getAll(): Promise<T[]> {
    try {
      const items = await this.repository.findAll();
      this.emit('fetched', items.length);
      return items;
    } catch (error) {
      this.logger.error('Failed to fetch items:', error);
      throw error;
    }
  }

  abstract validate(entity: Partial<T>): boolean;
}

// Concrete implementation
class UserService extends BaseService<User> {
  private readonly cache = new Map<number, User>();

  constructor(repository: Repository<User>) {
    super(repository);
  }

  validate(entity: Partial<User>): boolean {
    if (!entity.name || entity.name.trim().length < 2) return false;
    if (!entity.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entity.email)) return false;
    return true;
  }

  async createUser(data: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    if (!this.validate(data)) {
      throw new Error('Invalid user data');
    }

    const user = await this.repository.create({
      ...data,
      createdAt: new Date(),
    });

    this.cache.set(user.id, user);
    return user;
  }

  async getUserById(id: number): Promise<User | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    const user = await this.repository.findById(id);
    if (user) {
      this.cache.set(id, user);
    }
    return user;
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }
}

// Express middleware
function authMiddleware(roles: User['role'][] = ['user']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as User | undefined;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}

// Async utility with error handling
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw new Error('Unreachable');
}

// Enum and type utilities
enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  InternalServerError = 500,
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

function createResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

// Export
export {
  UserService,
  authMiddleware,
  withRetry,
  HttpStatus,
  createResponse,
  type ApiResponse,
  type Repository,
};
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