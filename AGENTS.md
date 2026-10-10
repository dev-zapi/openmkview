# Agent Guidelines

## Auto Commit Rule

**After every code modification, automatically commit:**

1. Run `cargo fmt && cargo clippy && cargo test` (Rust code)
2. `git add . && git commit -m "<type>: <description>"`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
   - Use English, keep under 50 chars

**Do NOT commit if:**
- No changes
- User says not to
- Contains secrets

## Agent skills

### Issue tracker

Issues live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `GLOSSARY.md` at root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
