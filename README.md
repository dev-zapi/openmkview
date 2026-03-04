<div align="center">

# OpenMKView

**A modern, web-based Markdown previewer with a VS Code-inspired interface.**

Browse local directories, preview `.md` / `.mdx` files, manage Git — all from the browser.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Why OpenMKView?

Most Markdown previewers are either too simple (no project management) or too heavy (full IDEs). OpenMKView sits in the sweet spot — a lightweight, browser-based tool that lets you **open any local folder as a project**, navigate its Markdown files with a familiar tree view, and preview them with beautiful rendering and syntax highlighting.

No Electron. No desktop app. Just `npm run dev` and you're ready.

---

## Features

### Three-Column VS Code Layout

A familiar, productive layout: **Activity Bar** (project switching) → **File Explorer** (directory tree) → **Markdown Viewer** (preview / source / diff).

All panels are resizable via drag, with sizes persisted across sessions.

### Markdown Rendering

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks
- **Shiki syntax highlighting** — VS Code-grade, 100+ language grammars with dual-theme support (`github-light` / `github-dark`)
- **Preview mode** — beautifully styled HTML output with `@tailwindcss/typography`
- **Source mode** — raw Markdown with full syntax highlighting
- **Diff mode** — inline diff against the latest Git HEAD version

### Project Management

- Open any local directory as a "project"
- Switch between multiple open projects via the Activity Bar
- Project history — quickly reopen previously closed projects
- All state persisted in a local SQLite database

### File Explorer

- Virtual-scrolling tree powered by **react-arborist** — handles large directories smoothly
- Filters to `.md` / `.mdx` files automatically
- Nested subdirectories with expand/collapse
- Project header shows directory name + full path (with `~` abbreviation)

### Outline Panel

- Auto-generated Table of Contents from heading structure
- Click any heading to jump to that section instantly
- Toggleable — show/hide without layout shift

### Built-in Git Integration

Full Git client built right in — no terminal needed:

| Action | Description |
|--------|-------------|
| **Status** | View modified, staged, and untracked files |
| **Add / Commit** | Stage files and commit with a message |
| **Push / Pull** | Sync with remote repositories |
| **Pull --rebase** | Rebase-based pull for clean history |
| **Fetch** | Fetch remote refs without merging |
| **Log** | Browse commit history with details |
| **Diff** | View file diffs (working tree & staged) |
| **Show** | Inspect any commit's full diff |
| **Exec** | Run arbitrary Git commands |

### Theming & Customization

- **Dark / Light / System** themes with seamless switching
- Configurable **UI font** and **Markdown font** (family + size)
- Adjustable Markdown content width — full-width or fixed (e.g., `70%`, `800px`)
- Table width mode — auto-fit or full-width

### Mobile-Friendly

Responsive layout with a completely different mobile experience (< 768px): sheet-based sidebar navigation and overlay outline panel.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) (Radix UI primitives) |
| State | [Zustand 5](https://zustand.docs.pmnd.rs/) with persist middleware |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (WAL mode) |
| Markdown | [unified](https://unifiedjs.com/) / remark / rehype pipeline |
| Syntax Highlighting | [Shiki 3](https://shiki.style/) (dual themes via CSS variables) |
| File Tree | [react-arborist](https://github.com/brimdata/react-arborist) |
| Panels | [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) |
| Git | Node.js `child_process` — full Git CLI wrapper |
| Search | [fuzzysort](https://github.com/farzher/fuzzysort) + [fast-glob](https://github.com/mrmlnc/fast-glob) |
| Diff Viewer | [@pierre/diffs](https://www.npmjs.com/package/@pierre/diffs) |
| Icons | [Lucide React](https://lucide.dev/) |
| Fonts | [Geist](https://vercel.com/font) (Sans + Mono) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** (or pnpm / yarn / bun)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/openmkview.git
cd openmkview

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm run start
```

---

## Project Structure

```
openmkview/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API endpoints
│   │   │   ├── projects/       #   Project CRUD
│   │   │   ├── files/          #   File tree & content
│   │   │   ├── settings/       #   Settings persistence
│   │   │   ├── directories/    #   Directory search
│   │   │   └── git/            #   Git operations (12 actions)
│   │   ├── project/            # Dynamic [projectId]/[[...filePath]] routes
│   │   └── globals.css         # Global styles & Tailwind
│   ├── components/
│   │   ├── activity-bar/       # Left sidebar — project switching
│   │   ├── file-explorer/      # File tree panel
│   │   ├── markdown-viewer/    # Preview, source, diff, welcome page
│   │   ├── outline-panel/      # Heading TOC panel
│   │   ├── git/                # Git panel, log, diff, command dialogs
│   │   ├── settings/           # Settings dialog
│   │   ├── layout/             # App shell, providers, mobile nav
│   │   └── ui/                 # shadcn/ui base components
│   ├── hooks/                  # Custom hooks (URL sync, mobile detection)
│   ├── lib/                    # Core utilities
│   │   ├── store.ts            #   Zustand store (single source of truth)
│   │   ├── db.ts               #   SQLite database layer
│   │   ├── markdown.ts         #   Unified markdown pipeline
│   │   └── utils.ts            #   Shared utilities
│   └── types/                  # TypeScript type definitions
├── data/                       # SQLite database files (gitignored)
├── package.json
├── next.config.ts
├── tsconfig.json
└── components.json             # shadcn/ui configuration
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | `GET` | List all open and historical projects |
| `/api/projects` | `POST` | Open a new project by directory path |
| `/api/projects/[id]` | `DELETE` | Close a project (soft delete) |
| `/api/files/tree` | `GET` | Get Markdown file tree for a project directory |
| `/api/files/content` | `GET` | Read file content (with path traversal protection) |
| `/api/settings` | `GET` | Retrieve system settings |
| `/api/settings` | `PUT` | Update system settings |
| `/api/directories/search` | `GET` | Fuzzy + path-based directory search |
| `/api/git` | `POST` | Execute Git operations (12 supported actions) |

---

## Architecture Highlights

- **URL-driven state** — The URL (`/project/{id}/{filePath}`) is the single source of truth, bidirectionally synced with Zustand via `useUrlSync`
- **No full-page reloads** — File tree clicks use `pushState()` for instant navigation without remounting components
- **HMR-safe database** — SQLite singleton stored on `globalThis` to survive hot module replacement in development
- **Dual Shiki themes** — Both light and dark themes are rendered simultaneously; CSS variables handle the switch — zero flicker on theme change
- **Server components where possible** — Pages are thin wrappers; heavy lifting happens in client `<AppShell />`

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint checks |

---

## License

This project is open source and available under the [MIT License](LICENSE).
