<div align="center">

# OpenMKView

**A modern, web-based Markdown previewer inspired by OpenCode Web UI — Now in Rust!**

Browse local directories, preview `.md` / `.mdx` files, manage Git — all from the browser.

[![Rust](https://img.shields.io/badge/Rust-2021-black?logo=rust)](https://www.rust-lang.org/)
[![Actix-web](https://img.shields.io/badge/Actix--web-4-F44336?logo=actix)](https://actix.rs/)
[![SQLite](https://img.shields.io/badge/SQLite-rusqlite-003B57?logo=sqlite&logoColor=white)](https://github.com/rusqlite/rusqlite)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Why OpenMKView?

Most Markdown previewers are either too simple (no project management) or too heavy (full IDEs). OpenMKView sits in the sweet spot — a lightweight, browser-based tool that lets you **open any local folder as a project**, navigate its Markdown files with a familiar tree view, and preview them with beautiful rendering.

No Electron. No desktop app. No Node.js. Just `cargo run` and you're ready.

Built with Rust for **maximum performance** and **minimal resource usage**.

---

## Features

### Three-Column Layout (Inspired by OpenCode Web UI)

A familiar, productive layout: **Activity Bar** (project switching) → **File Explorer** (directory tree) → **Markdown Viewer** (preview / source / diff).

All panels are resizable via drag, with sizes persisted across sessions.

### Markdown Rendering

- **GitHub Flavored Markdown** — tables, task lists, strikethrough, autolinks
- **pulldown-cmark** — fast, efficient CommonMark parser
- **Preview mode** — beautifully styled HTML output
- **Source mode** — raw Markdown text
- **Diff mode** — inline diff against the latest Git HEAD version

### Project Management

- Open any local directory as a "project"
- Switch between multiple open projects via the Activity Bar
- Project history — quickly reopen previously closed projects
- All state persisted in a local SQLite database

### File Explorer

- Recursive directory tree
- Filters to `.md` / `.mdx` files automatically
- Nested subdirectories with expand/collapse
- Smart exclusion of `node_modules` and `.git` directories

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

- Configurable **Markdown content width** — full-width or fixed (e.g., `70%`, `800px`, `900px`)
- Configurable **table width mode** — auto-fit or full-width
- Settings persisted in SQLite database

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Actix-web 4](https://actix.rs/) |
| Language | [Rust](https://www.rust-lang.org/) 2021 Edition |
| Database | [rusqlite](https://github.com/rusqlite/rusqlite) 0.32 (SQLite) |
| Template | [Askama](https://github.com/djc/askama) 0.13 |
| Markdown | [pulldown-cmark](https://github.com/raphlinus/pulldown-cmark) 0.12 |
| Serialization | [serde](https://serde.rs/) + serde_json |
| Static Assets | [rust-embed](https://github.com/pyrossh/rust-embed) 8 |
| Syntax Highlighting | [syntect](https://github.com/trishume/syntect) 5.3.0 |
| Utilities | uuid, walkdir, glob, chrono, anyhow |

---

## Architecture

OpenMKView follows a clean, layered architecture:

```
HTTP Request → Handlers → Services → Repositories → Database
                     ↓
                   Models
```

- **Handlers**: HTTP request/response handling
- **Services**: Core business logic
- **Repositories**: Data access layer (SQL queries)
- **Models**: Data structures

This separation ensures:
- ✅ Clear responsibilities
- ✅ Easy testing
- ✅ Maintainable codebase
- ✅ Proper error handling with `AppError` type

---

## Getting Started

### Prerequisites

- **Rust** >= 1.70 (2021 Edition)
- **Git** (for Git features)

### Installation

```bash
# Clone the repository
git clone https://github.com/dev-zapi/openmkview.git
cd openmkview

# Build and run (development mode)
cargo run
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
# Optimized release build
cargo build --release

# Run the release binary
./target/release/openmkview
```

### Development Commands

```bash
# Run development server
cargo run

# Build (debug)
cargo build

# Build (release)
cargo build --release

# Run tests
cargo test

# Format code
cargo fmt

# Lint code
cargo clippy
```

---

## Project Structure

```
openmkview/
├── src/
│   ├── main.rs                 # Application entry point & routing
│   ├── lib.rs                  # Module exports
│   ├── errors/
│   │   └── mod.rs              # Unified error handling (AppError)
│   ├── models/
│   │   ├── mod.rs
│   │   ├── project.rs          # Project data models
│   │   ├── file.rs             # File tree & content models
│   │   └── settings.rs         # Settings models
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs       # Database initialization
│   │   └── repositories/
│   │       ├── mod.rs
│   │       ├── project_repo.rs # Project CRUD operations
│   │       └── settings_repo.rs# Settings CRUD operations
│   ├── services/
│   │   ├── mod.rs
│   │   ├── project_service.rs  # Project business logic
│   │   ├── file_service.rs     # File operations
│   │   ├── git_service.rs      # Git command wrappers
│   │   ├── markdown_service.rs # Markdown rendering
│   │   └── settings_service.rs # Settings management
│   └── handlers/
│       ├── mod.rs
│       ├── project_handler.rs  # Project API endpoints
│       ├── file_handler.rs     # File API endpoints
│       ├── git_handler.rs      # Git API endpoints
│       └── settings_handler.rs # Settings API endpoints
├── static/                     # Static assets (CSS, JS, icons)
├── src/templates/              # HTML templates
├── data/                       # SQLite database (gitignored)
├── Cargo.toml
└── Cargo.lock
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | `GET` | Main HTML page |
| `/api/projects` | `GET` | List all open and historical projects |
| `/api/projects` | `POST` | Open a new project by directory path |
| `/api/projects/:id` | `DELETE` | Close a project (soft delete) |
| `/api/files/tree` | `GET` | Get Markdown file tree for a project |
| `/api/files/content` | `GET` | Read file content (with path traversal protection) |
| `/api/files` | `POST` | Create a new file |
| `/api/files` | `PUT` | Rename a file |
| `/api/files` | `DELETE` | Delete a file |
| `/api/settings` | `GET` | Retrieve system settings |
| `/api/settings` | `PUT` | Update system settings |
| `/api/git` | `POST` | Execute Git operations (12 supported actions) |

---

## Usage Guide

### Open a Project

1. Click "📂 打开项目" button
2. Enter the absolute path to your Markdown directory
3. Click OK

### Browse Files

- Click folder icons to expand/collapse directories
- Click files to view content

### View Modes

- **Preview**: Rendered Markdown with GitHub Flavored Markdown support
- **Source**: Raw Markdown text
- **Diff**: Compare with Git HEAD version

### Git Operations

1. Click 🌿 button in Activity Bar to open Git panel
2. View file status (color-coded):
   - 🟡 Yellow: Modified
   - 🟢 Green: Added
   - 🔴 Red: Deleted
   - 🔵 Blue: Untracked
3. Use action buttons:
   - **Stage All**: Stage all changes
   - **Commit**: Commit with message
   - **Push**: Push to remote
   - **Pull**: Pull from remote

### Settings

1. Click ⚙️ button in Activity Bar
2. Configure:
   - Markdown width (full, 70%, 800px, 900px)
   - Table width mode (auto, full)
3. Click "Save"

---

## Troubleshooting

### Port Already in Use

Error: "Address already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Cannot Open Project

Ensure you enter an **absolute path** and the directory exists.

### Git Operations Fail

Ensure the project directory is a Git repository (contains `.git` folder).

### Database Issues

Reset by deleting the database file:

```bash
rm data/openmkview.db
```

---

## Performance Comparison

| Metric | Next.js Version | Rust Version |
|--------|-----------------|--------------|
| Binary Size | ~200MB (node_modules) | ~15MB |
| Memory Usage | ~150MB | ~20MB |
| Startup Time | ~3s | ~0.5s |
| Dependencies | 500+ npm packages | 50 Rust crates |

---

## Roadmap

- [ ] Syntax highlighting for code blocks (syntect)
- [ ] File search with fuzzy matching
- [ ] Keyboard shortcuts
- [ ] Multi-cursor editing in source mode
- [ ] Plugin system for custom renderers
- [ ] Dark/Light theme toggle
- [ ] Mobile responsive improvements

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feat/amazing-feature`)
3. **Commit** your changes using conventional commits
4. **Push** to the branch (`git push origin feat/amazing-feature`)
5. Open a **Pull Request**

### Code Standards

- Use Rust 2021 Edition features
- Follow existing code style
- Use `AppResult<T>` for public APIs
- Avoid `.unwrap()` — use `?` or proper error handling
- Write unit tests for service layer
- Run `cargo fmt` and `cargo clippy` before committing

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**OpenMKView** — Built with ❤️ using Rust

[Report Bug](https://github.com/dev-zapi/openmkview/issues) · [Request Feature](https://github.com/dev-zapi/openmkview/issues)

</div>
