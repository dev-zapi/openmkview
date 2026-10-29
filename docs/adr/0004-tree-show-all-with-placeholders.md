# Show all files in the tree with placeholder directories

The file tree used to whitelist markdown/HTML/image extensions and prune `.git`/`node_modules` entirely, so most of a real project was invisible. We decided the tree shows every real entry (real directory walk; empty directories and directories containing only hidden entries included), governed by three orthogonal rules: dot-prefixed entries become **Hidden Entries** (hidden by default, toggled from the project menu, per-browser preference); **Ignored Files** (default `.DS_Store`, `Thumbs.db`) never show; and heavy directories (default `node_modules`, `target`, `dist`, `build`, `.git`, `.svn`, `.hg` — editable in server settings) become **Placeholder Directories**: visible as nodes, but expanding shows only a "not expandable" notice instead of enumerating contents. Placeholder directories are also protected from delete/trash alongside `protectedPaths`, which keeps its own list (so `.github`/`.obsidian` remain browsable). Any file without a dedicated renderer opens in the read-only **Source Fallback** view (Shiki highlight, 1 MB truncation, lossy UTF-8 decode with a notice); binaries show a placeholder page; there is deliberately no read blacklist — the project root is the sandbox.

## Considered Options

- **Prune heavy directories entirely** (the old behavior for `.git`/`node_modules`): hides that the directory exists at all; rejected — the tree should stay honest about the project's shape.
- **Literal show-all with full expansion**: VCS internals and dependency caches hold 10⁴–10⁵ entries and would swamp the tree; rejected on performance.
- **Chosen**: visible-but-not-expandable placeholders — honest about shape, cheap to render.
