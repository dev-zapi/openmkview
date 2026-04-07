import type { FileNode, Project } from '../../types';
import type { RecentProject } from '../../types/openProject';

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

export const mockFileTree: FileNode[] = [
  {
    id: '/src',
    name: 'src',
    path: '/src',
    isFolder: true,
    children: [
      {
        id: '/src/components',
        name: 'components',
        path: '/src/components',
        isFolder: true,
        children: [
          {
            id: '/src/components/Header.tsx',
            name: 'Header.tsx',
            path: '/src/components/Header.tsx',
            isFolder: false,
          },
          {
            id: '/src/components/Footer.tsx',
            name: 'Footer.tsx',
            path: '/src/components/Footer.tsx',
            isFolder: false,
          },
          {
            id: '/src/components/Sidebar.tsx',
            name: 'Sidebar.tsx',
            path: '/src/components/Sidebar.tsx',
            isFolder: false,
          },
        ],
      },
      {
        id: '/src/pages',
        name: 'pages',
        path: '/src/pages',
        isFolder: true,
        children: [
          {
            id: '/src/pages/index.md',
            name: 'index.md',
            path: '/src/pages/index.md',
            isFolder: false,
          },
          {
            id: '/src/pages/about.md',
            name: 'about.md',
            path: '/src/pages/about.md',
            isFolder: false,
          },
          {
            id: '/src/pages/guide',
            name: 'guide',
            path: '/src/pages/guide',
            isFolder: true,
            children: [
              {
                id: '/src/pages/guide/getting-started.md',
                name: 'getting-started.md',
                path: '/src/pages/guide/getting-started.md',
                isFolder: false,
              },
              {
                id: '/src/pages/guide/advanced.md',
                name: 'advanced.md',
                path: '/src/pages/guide/advanced.md',
                isFolder: false,
              },
            ],
          },
        ],
      },
      {
        id: '/src/utils',
        name: 'utils',
        path: '/src/utils',
        isFolder: true,
        children: [
          {
            id: '/src/utils/helpers.ts',
            name: 'helpers.ts',
            path: '/src/utils/helpers.ts',
            isFolder: false,
          },
        ],
      },
      {
        id: '/src/index.ts',
        name: 'index.ts',
        path: '/src/index.ts',
        isFolder: false,
      },
    ],
  },
  {
    id: '/docs',
    name: 'docs',
    path: '/docs',
    isFolder: true,
    children: [
      {
        id: '/docs/README.md',
        name: 'README.md',
        path: '/docs/README.md',
        isFolder: false,
      },
      {
        id: '/docs/CHANGELOG.md',
        name: 'CHANGELOG.md',
        path: '/docs/CHANGELOG.md',
        isFolder: false,
      },
    ],
  },
  {
    id: '/README.md',
    name: 'README.md',
    path: '/README.md',
    isFolder: false,
  },
  {
    id: '/package.json',
    name: 'package.json',
    path: '/package.json',
    isFolder: false,
  },
  {
    id: '/tsconfig.json',
    name: 'tsconfig.json',
    path: '/tsconfig.json',
    isFolder: false,
  },
];