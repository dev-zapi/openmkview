# OpenMKView - Requirements Document

## Project Overview

OpenMKView is a web-based Markdown file previewer with a VS Code-like three-column layout. It allows users to open local filesystem directories (called "projects"), browse Markdown files within them via a tree view, and preview or view the source of Markdown files with syntax highlighting.

**Tech Stack:**
- **Framework:** Next.js (full-stack, frontend + backend)
- **Styling:** Tailwind CSS + animations
- **Runtime:** Node.js (filesystem access via server-side APIs)

---

## Layout

The application uses a **three-column layout**, similar to VS Code:

```
+--------+------------------+------------------------------------+----------+
| Col 1  |     Col 2        |             Col 3                  | Outline  |
| (narrow)|  File Tree      |     Markdown Viewer                | (toggle) |
+--------+------------------+------------------------------------+----------+
```

### Column 1 - Activity Bar (narrow sidebar)

A narrow vertical bar on the far left, displaying:

1. **Project List** - Icons/avatars of currently opened projects, clickable to switch between them.
2. **"Open Project" Button** - Opens a dialog/mechanism to select a local filesystem directory as a new project.
3. **Theme Toggle** - Switch between three modes:
   - Dark
   - Light
   - System (follow OS preference)
4. **Settings Button** - Opens a system settings panel/dialog.

### Column 2 - File Explorer

- Displays the **directory tree** of the currently selected project, showing only Markdown files (`.md`, `.mdx`, etc.).
- **Header area** (top of Column 2):
  - **Line 1:** Directory name (basename of the project path)
  - **Line 2:** Full directory path, with the user's home directory prefix replaced by `~`
- Tree supports expand/collapse of subdirectories.
- Clicking a Markdown file opens it in Column 3.

### Column 3 - Markdown Viewer

- Main content area for viewing Markdown files.
- Supports two modes, togglable:
  - **Preview Mode:** Rendered Markdown (HTML output)
  - **Source Mode:** Raw Markdown source with **syntax highlighting**
- **Outline Panel** (optional, toggleable):
  - Appears on the right side of Column 3.
  - Displays the heading structure (TOC) of the current Markdown file.
  - Each heading is clickable for **quick navigation/jump** to that section.

---

## Features

### F1 - Project Management

| ID    | Description |
|-------|-------------|
| F1.1  | A **project** is a local filesystem directory. |
| F1.2  | Users can **open a project** by selecting a directory from the filesystem. |
| F1.3  | Opened projects are displayed as icons/entries in Column 1. |
| F1.4  | Users can **switch** between opened projects by clicking them in Column 1. |
| F1.5  | Users can **close** a project. Closing removes it from Column 1 but does not delete any data. |
| F1.6  | Opened projects are **persisted** (remembered across sessions). |
| F1.7  | On first visit (or when no project is open), display a **history list** of previously opened projects for quick re-opening. |

### F2 - File Tree

| ID    | Description |
|-------|-------------|
| F2.1  | Display the Markdown files in the selected project directory as a **tree structure**. |
| F2.2  | Support nested subdirectories with expand/collapse. |
| F2.3  | Clicking a file opens it in the Markdown Viewer (Column 3). |
| F2.4  | Show project header at the top: directory name + full path (home path abbreviated with `~`). |

### F3 - Markdown Viewer

| ID    | Description |
|-------|-------------|
| F3.1  | Render Markdown files as styled HTML in **preview mode**. |
| F3.2  | Display raw Markdown source with **syntax highlighting** in **source mode**. |
| F3.3  | Provide a toggle to switch between preview and source modes. |
| F3.4  | Support a toggleable **outline/TOC panel** on the right side. |
| F3.5  | The outline panel extracts headings from the Markdown and displays them hierarchically. |
| F3.6  | Clicking a heading in the outline scrolls/jumps to the corresponding section. |

### F4 - Theme / Appearance

| ID    | Description |
|-------|-------------|
| F4.1  | Support three theme modes: **Dark**, **Light**, **System**. |
| F4.2  | Theme toggle is accessible from Column 1. |
| F4.3  | Theme preference is persisted across sessions. |

### F5 - Settings

| ID    | Description |
|-------|-------------|
| F5.1  | A settings button in Column 1 opens a settings panel/dialog. |
| F5.2  | (Specific settings TBD - placeholder for future expansion.) |

---

## Data Persistence

| Item | Storage Mechanism |
|------|-------------------|
| Opened projects list | Server-side (file/DB) or browser localStorage |
| Project history | Server-side (file/DB) or browser localStorage |
| Theme preference | Browser localStorage |
| Last opened file per project | Browser localStorage (optional) |

---

## API Design (Next.js API Routes)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all opened/remembered projects |
| `/api/projects` | POST | Add a new project (by directory path) |
| `/api/projects/[id]` | DELETE | Close/remove a project |
| `/api/files/tree` | GET | Get the file tree (Markdown files only) for a given directory |
| `/api/files/content` | GET | Read the content of a specific Markdown file |

---

## Non-Functional Requirements

| ID    | Description |
|-------|-------------|
| NF1   | Smooth animations and transitions (Tailwind CSS + CSS animations). |
| NF2   | Responsive panels - columns should be resizable or adapt gracefully. |
| NF3   | Fast file tree loading, even for large directories. |
| NF4   | Markdown rendering should support GFM (GitHub Flavored Markdown). |
| NF5   | Source code syntax highlighting should cover Markdown syntax elements. |

---

## UI Flow

```
App Launch
  |
  +-- Has opened projects? 
  |     |
  |     +-- YES --> Show last active project (Col1 + Col2 + Col3)
  |     +-- NO  --> Show welcome/history page in Col3 area
  |                   |
  |                   +-- Has project history?
  |                         |
  |                         +-- YES --> Display history list for quick re-open
  |                         +-- NO  --> Show "Open Project" prompt
  |
  +-- User opens a project
  |     +-- Project added to Col1
  |     +-- File tree loaded in Col2
  |     +-- User clicks a .md file --> Rendered in Col3
  |
  +-- User closes a project
        +-- Removed from Col1
        +-- Remains in history for future re-opening
```

---

## Future Considerations (Out of Scope for v1)

- File editing / live editing
- Full-text search across project files
- Multiple file tabs in Column 3
- File watching / auto-reload on file changes
- Export to PDF/HTML
- Plugin system
