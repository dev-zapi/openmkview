# Agent Guidelines

## Auto Commit Rule

**After every code modification, automatically commit the changes:**

1. Check if the working directory is a git repository:
   ```bash
   git rev-parse --git-dir > /dev/null 2>&1
   ```

2. If it is a git repo, automatically stage and commit:
   ```bash
   git add .
   git commit -m "<descriptive message>"
   ```

3. Commit message format:
   - Use **English**
   - Follow Conventional Commits: `<type>: <description>`
   - Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`
   - Keep first line under 50 characters

4. Before committing:
   - Run `cargo fmt` (for Rust code)
   - Run `cargo clippy` (for Rust code)
   - Run `cargo test` (for Rust code)
   - Ensure no `.unwrap()` in committed code

5. Do NOT commit if:
   - There are no changes
   - The user explicitly tells you NOT to commit
   - The repository contains secrets or sensitive files
