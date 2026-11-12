# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner-developer self-hosting OpenMKView on a personal machine and accessing it from multiple devices (desktop, phone, tablet) over the LAN. One trusted human, many screens — not concurrent multi-user. As an open-source community project, the secondary audience is other developers who clone the repo and run their own instance; README, docs, and first-run experience are their front door.

## Product Purpose

A web-based Markdown and HTML previewer: open any local folder as a project, navigate its files in a tree, and view them as rendered preview, source, or diff — with light editing and a built-in Git client. Success means a reliable self-hosted daily tool the owner depends on, and a public project other developers can adopt and run themselves.

## Positioning

Between too-simple previewers (no project management) and full IDEs (too heavy). The differentiator: no Electron, no desktop app, no Node.js — a Rust server you start with `cargo run` and use from any browser on the LAN, with SQLite persistence and an OpenCode-Web-UI-inspired three-column layout (Activity Bar → File Explorer → Viewer).

## Operating Context

- Self-hosted on a personal machine, reached over the LAN; passkey authentication guards the exposed server.
- Projects are real local directories (often Git repos) containing docs; the file tree mirrors their real structure.
- Runs offline-tolerant as a PWA: when the server is unreachable the app degrades to read-only Offline Mode from browser caches (ADR 0002).
- Config and data follow XDG base directories (Config Root / Data Root, overridable via `OPENMKVIEW_CONFIG_HOME` / `OPENMKVIEW_DATA_HOME`, ADR 0001).
- State persists in a local SQLite database (projects, settings, panel sizes, history).

## Capabilities and Constraints

Confirmed functionality:

- Markdown rendering (GFM), sandboxed HTML preview, source and edit modes (CodeMirror), diff against Git HEAD.
- Built-in Git client: status, add/commit, push, pull (incl. rebase), fetch, log, diff, show, approved exec.
- File tree per ADR 0004: full real-directory traversal; Hidden Entries (dot-prefix) behind a per-browser toggle; Ignored Files never shown; Placeholder Directories shown but not expandable; Source Fallback (Shiki highlight, read-only) for any text file without a dedicated renderer.
- Rendering customization: content width, table density and wrapping, 13 Shiki code themes, scoped Custom Stylesheet (ADR 0003), delete protection via protected paths.

Technical constraints:

- Backend: Rust / Actix-web 4 / rusqlite, static assets embedded (rust-embed).
- Frontend: SolidJS + Vite + Tailwind 4, PWA, vitest unit tests, Playwright e2e.
- Rendered document content is untrusted input: DOMPurify sanitization, sandboxed iframes, CSP.

## Brand Commitments

Name "OpenMKView", MIT license, Rust/Actix/SQLite badge identity in the README, "inspired by OpenCode Web UI" framing.

## Evidence on Hand

- `README.md` — feature catalog, positioning, tech stack, architecture.
- `GLOSSARY.md` — canonical domain terms (Config Root, Data Root, Offline Mode, Hidden Entry, Placeholder Directory, Source Fallback, …).
- `docs/adr/0001`–`0004` — decided constraints (storage paths, offline PWA, scoped stylesheet, tree rules).
- `frontend/DESIGN.md` — a working redesign document for the Markdown viewer header (not a full design-system record).
- No user research, testimonials, usage data, or case studies exist; future work must not fabricate any.

## Product Principles

1. **Lightweight self-hosting is the product.** One `cargo run`, no Node, no Electron, minimal resources; features that add weight must earn their place.
2. **Preview first.** Beautiful, fast rendering of local docs is the core; editing and Git serve it — OpenMKView does not become an IDE.
3. **One trusted user, many devices.** The security boundary is LAN exposure with passkey auth, and rendered content is sanitized as untrusted even on a personal server.
4. **Desktop and mobile are both first-class.** Mobile breakage is a real bug, not backlog polish.
5. **The repo is the front door.** Docs, terminology (GLOSSARY), and first-run experience serve community adopters, not just the owner.
