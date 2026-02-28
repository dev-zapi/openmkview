# Copilot Instructions for OpenMKView

OpenMKView is a web-based Markdown file previewer with a VS Code-like 3-column layout (Activity Bar → File Explorer → Markdown Viewer). It is built with Next.js 15 (App Router) and uses a local SQLite database for project/settings persistence.

## Tech Stack

- **Framework**: Next.js 15.5 with App Router (`src/app/`)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 with `@tailwindcss/typography`
- **UI Components**: shadcn/ui (Radix UI primitives) in `src/components/ui/`
- **State Management**: Zustand with persist middleware (`src/lib/store.ts`)
- **Database**: better-sqlite3 (server-side only, `src/lib/db.ts`)
- **Markdown**: unified/remark/rehype pipeline with Shiki syntax highlighting
- **File Tree**: react-arborist
- **Resizable Panels**: react-resizable-panels
- **Icons**: lucide-react

## Development Commands

- **Dev server**: `npm run dev`
- **Build**: `npm run build` (or `npx next build`)
- **Lint**: `npm run lint`
- **Start**: `npm run start`

## Repository Structure

- `src/app/` — Next.js App Router pages and API routes
  - `api/` — REST API endpoints (projects, files, settings)
  - `project/[projectId]/[[...filePath]]/` — Dynamic project/file routes
- `src/components/` — React components organized by feature
  - `ui/` — shadcn/ui base components (do not edit manually)
  - `activity-bar/` — Left sidebar with project tabs
  - `file-explorer/` — File tree panel
  - `markdown-viewer/` — Markdown preview and source view
  - `outline-panel/` — Heading outline/TOC panel
  - `settings/` — Settings dialog
  - `layout/` — App shell and providers
- `src/hooks/` — Custom React hooks (e.g., `use-url-sync.ts`)
- `src/lib/` — Utilities and store (`store.ts`, `db.ts`, `utils.ts`)
- `src/types/` — TypeScript type definitions
- `data/` — SQLite database files (gitignored)

## Key Architecture Patterns

1. **URL-based routing**: URL drives state via `useUrlSync` hook — `/project/{id}/{relativePath}` syncs with Zustand store. Use `window.history.pushState()` for in-page navigation that shouldn't remount components (e.g., file tree clicks).
2. **State management**: Single Zustand store (`useAppStore`) manages all app state. Use `useShallow` for selective subscriptions to avoid unnecessary re-renders.
3. **Server components**: Pages are thin wrappers rendering client `<AppShell />`. API routes handle all data access.
4. **File tree scroll preservation**: File clicks use `pushState` + direct store fetch instead of `router.push()` to avoid remounting the tree component.

## Coding Guidelines

- Use TypeScript strict mode — no `any` types unless absolutely necessary
- Follow existing code style: functional components, arrow functions, named exports
- Use shadcn/ui components from `src/components/ui/` for UI elements
- Use `lucide-react` for icons
- All client components must have `"use client"` directive
- Keep components small and focused; extract hooks for complex logic
- Use Tailwind CSS utility classes; avoid custom CSS unless needed for prose/markdown styling
- Chinese language is preferred for commit messages and comments when communicating with the user
