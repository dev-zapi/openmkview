import type { FileNode, Project } from '../../types';
import type { RecentProject } from '../../types/openProject';

/**
 * Mock 项目数据
 */
export const mockProjects: Project[] = [
  {
    id: 1,
    name: 'openmkview',
    path: '/Users/demo/projects/openmkview',
  },
  {
    id: 2,
    name: 'my-docs',
    path: '/Users/demo/projects/my-docs',
  },
  {
    id: 3,
    name: 'awesome-project',
    path: '/Users/demo/projects/awesome-project',
  },
];

/**
 * Mock 最近项目数据
 */
export const mockRecentProjects: RecentProject[] = [
  {
    id: '1',
    name: 'openmkview',
    path: '/Users/demo/projects/openmkview',
    last_opened_at: new Date().toISOString(),
    type: 'rust',
  },
  {
    id: '2',
    name: 'my-docs',
    path: '/Users/demo/projects/my-docs',
    last_opened_at: new Date(Date.now() - 86400000).toISOString(),
    type: 'markdown',
  },
  {
    id: '3',
    name: 'awesome-project',
    path: '/Users/demo/projects/awesome-project',
    last_opened_at: new Date(Date.now() - 172800000).toISOString(),
    type: 'typescript',
  },
];

/**
 * Mock 文件树数据
 */
export const mockFileTree: FileNode[] = [
  {
    name: 'src',
    path: '/src',
    isFolder: true,
    children: [
      {
        name: 'components',
        path: '/src/components',
        isFolder: true,
        children: [
          {
            name: 'Header.tsx',
            path: '/src/components/Header.tsx',
            isFolder: false,
          },
          {
            name: 'Footer.tsx',
            path: '/src/components/Footer.tsx',
            isFolder: false,
          },
          {
            name: 'Sidebar.tsx',
            path: '/src/components/Sidebar.tsx',
            isFolder: false,
          },
        ],
      },
      {
        name: 'pages',
        path: '/src/pages',
        isFolder: true,
        children: [
          {
            name: 'index.md',
            path: '/src/pages/index.md',
            isFolder: false,
          },
          {
            name: 'about.md',
            path: '/src/pages/about.md',
            isFolder: false,
          },
          {
            name: 'guide',
            path: '/src/pages/guide',
            isFolder: true,
            children: [
              {
                name: 'getting-started.md',
                path: '/src/pages/guide/getting-started.md',
                isFolder: false,
              },
              {
                name: 'advanced.md',
                path: '/src/pages/guide/advanced.md',
                isFolder: false,
              },
            ],
          },
        ],
      },
      {
        name: 'utils',
        path: '/src/utils',
        isFolder: true,
        children: [
          {
            name: 'helpers.ts',
            path: '/src/utils/helpers.ts',
            isFolder: false,
          },
        ],
      },
      {
        name: 'index.ts',
        path: '/src/index.ts',
        isFolder: false,
      },
    ],
  },
  {
    name: 'docs',
    path: '/docs',
    isFolder: true,
    children: [
      {
        name: 'README.md',
        path: '/docs/README.md',
        isFolder: false,
      },
      {
        name: 'CHANGELOG.md',
        path: '/docs/CHANGELOG.md',
        isFolder: false,
      },
    ],
  },
  {
    name: 'README.md',
    path: '/README.md',
    isFolder: false,
  },
  {
    name: 'package.json',
    path: '/package.json',
    isFolder: false,
  },
  {
    name: 'tsconfig.json',
    path: '/tsconfig.json',
    isFolder: false,
  },
];