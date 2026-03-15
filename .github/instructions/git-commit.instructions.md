---
applyTo: "**/*.rs"
---

# Git Commit Guidelines

## Basic Requirements

- **Must execute git commit after each modification**
- Do not accumulate multiple changes before committing
- Keep commits atomic, each commit should contain only one logical change

## Commit Message Format

Follow the Conventional Commits specification: `<type>: <description>`

### Type Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add file search functionality` |
| `fix` | Bug fix | `fix: fix Markdown rendering error` |
| `refactor` | Code refactoring (no functional change) | `refactor: optimize database connection pool` |
| `docs` | Documentation update | `docs: update API documentation` |
| `style` | Code style (no functional impact) | `style: format code` |
| `test` | Add or modify tests | `test: add project service unit tests` |
| `chore` | Build/tool/configuration changes | `chore: update dependency versions` |

### Description Requirements

- Use **English** for all commit messages
- Be concise and clear, explain **what was done** and **why**
- First line should not exceed 50 characters
- If needed, add a blank line followed by a detailed description

## Pre-commit Checklist

1. ✅ Run `cargo fmt` to format code
2. ✅ Run `cargo clippy` to check code quality
3. ✅ Run `cargo test` to ensure tests pass
4. ✅ Check `git status` to confirm correct files for commit
5. ✅ Write a proper commit message

## Examples

```bash
# New feature
git commit -m "feat: add Git history view functionality"

# Bug fix
git commit -m "fix: fix file path validation logic error"

# Refactor
git commit -m "refactor: extract Git operations to independent service layer

- Remove Git-related logic from handlers
- Create git_service.rs to encapsulate all Git commands
- Improve code testability and maintainability"

# Documentation
git commit -m "docs: add API endpoint documentation to README"
```

## Prohibited Actions

- ❌ Using vague commit messages (e.g., "update", "fix stuff", "wip")
- ❌ Committing code with `.unwrap()` (use `?` or proper error handling)
- ❌ Not running tests after committing
- ❌ Accumulating large changes in a single commit
