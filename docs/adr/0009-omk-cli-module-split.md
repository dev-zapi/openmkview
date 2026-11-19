# Split the omk CLI Into Modules Behind a Stable Entry Point

Spec #28 shipped the agent CLI as a single-file, zero-dependency `scripts/omk.mjs` (~1340 lines): Markdown block parsing, Anchor construction, HTTP, prompts, config, and command dispatch all in one file, with `commandBatchResolve`/`commandBatchDelete` repeating the batch branch of `commandResolve`/`commandDelete`. By 2026-11 the file had grown past what one screen of structure could explain, and every concern touched every other.

**Decision:**
- `scripts/` becomes a small module directory behind the unchanged entry point `scripts/omk.mjs`:
  - `lib/markdown.mjs` — the pure block model and Anchor construction (no Node APIs, no state),
  - `lib/client.mjs` — config, argument parsing, JSON output, HTTP, interactive prompts, and the Tool Session exchange,
  - `lib/commands.mjs` — command implementations and dispatch.
- The zero-npm-dependency, Node ≥ 18 contract is unchanged: the modules use only relative ESM imports and Node built-ins. The whole `scripts/` directory travels with the skill, so invoking `node scripts/omk.mjs <command>` behaves exactly as before.
- The entry re-exports the pure parser/anchor functions (`parseMarkdownBlocks`, `buildAnchorFromMarkdown`, `hashBlockContent`, `normalizeBlockText`, `writeIdentity`, `CONTEXT_LENGTH`), so the frontend vitest suite that imports them through the entry keeps working unmodified.
- The batch duplication is gone: the batch branch of `resolve`/`delete` and the dedicated `batch-resolve`/`batch-delete` commands share one code path per endpoint.

**Considered Options:**
- Keep the single-file contract and reorganize internally — rejected: section discipline does not stop the cross-concern growth, and the known batch duplication was a symptom of exactly that.
- Build-time bundling (multi-file sources, esbuild-bundled single-file artifact) — rejected: it introduces a build chain and a generated artifact in every diff for a ~1400-line tool, while consumers gain nothing the module directory does not already provide.
- Renaming or relocating the entry point — rejected: SKILL.md workflows, `smoke.sh`, documented `node scripts/omk.mjs` invocations, and the vitest import seam all target `scripts/omk.mjs`.

**Consequences:**
- A consumer that copies only `scripts/omk.mjs` (not the directory) breaks. The skill's distribution unit was already the whole `skills/openmkview-annotations/` directory (spec #28 "Skill layout"), so no supported flow is affected; SKILL.md now says so explicitly.
- The frontend test seam depends on the entry's re-exports staying in sync with the pure functions; the vitest suite fails if one is dropped, which is the desired guard.
- Spec #28's "single-file" implementation decision is superseded by this ADR; the "zero-dependency Node `.mjs` inside the skill's `scripts/`" part survives verbatim.

## Addendum (2026-11-19)

`lib/client.mjs` had accumulated pure domain helpers alongside its transport duties. Those helpers now live in `lib/domain.mjs`: project normalization (`normalizeProject`), project containment (`projectMatchesFor`, `projectChoices`, `isPathUnder`), and thread-freshness tests (`parseTimestamp`, `latestThreadActivity`, `isThreadNewSince`). `client.mjs` returns to config, argument parsing, HTTP, prompts, and the Tool Session exchange. The `--new` cursor file I/O stays in `client.mjs` because it is stateful filesystem access, not domain logic; it imports `parseTimestamp` from `domain.mjs`. The entry point re-exports `normalizeProject` and `projectMatchesFor` from `domain.mjs`, so the frontend test seam is unchanged.
