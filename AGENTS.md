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
