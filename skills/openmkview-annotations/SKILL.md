---
name: openmkview-annotations
description: Read and write OpenMKView Annotations as an agent — list a file's or project's annotation threads, create an Annotation from a quoted span, reply under your own Author name, and resolve feedback. Use this skill whenever the user mentions OpenMKView annotations, annotation threads, review comments, 标注, comments left on a Markdown file, human feedback to consume, or asks you to annotate a document, leave review notes, respond to a reviewer, or close out feedback. Trigger it even when the user only says "look at the comments on README.md", "what does the reviewer want", "leave a note on this paragraph", or "resolve the annotations from claude" — the CLI in this skill is the supported way to do that, and hand-writing Anchor JSON without it usually produces an Outdated annotation.
---

# OpenMKView Annotations

OpenMKView is a Markdown previewer with a human↔agent review surface: an
**Annotation** is a thread attached to a file in a registered project, and both
the human and an agent write **Replies** into it. Humans use the web UI; you use
the zero-dependency CLI in `scripts/omk.mjs`. This skill teaches when to use it
and the two collaboration loops it exists for.

Vocabulary follows the project `GLOSSARY.md`:

- **Annotation** — one thread, attached to a file (text span or whole block).
- **Reply** / **Note** — one entry in the thread; every note has an **Author**
  (free text) and an agent flag (`isAgent`).
- **Anchor** — the reference to document content; the CLI computes it for you.
- **Resolved** — the whole thread is dealt with. **Outdated** — the Anchor no
  longer matches after an edit. **Missing File** — the file at the stored path
  no longer exists (the wire field is `missingFile`).
- **Tool Session** — the non-expiring bearer credential agent clients use.

Do not invent or hand-craft Anchor JSON. `create` fetches the file through the
files API and builds a legal Anchor client-side. A hand-built Anchor is accepted
by the server (it only validates shape) but often resolves **Outdated** —
especially whole-block anchors, quotes that span a soft line break, and
ambiguous quotes — because resolution matches the *rendered* text, not the raw
Markdown.

## Init first

Before any read or write, configure the CLI for the instance. Instances are
either **open** (no login) or **auth-enabled**.

An open instance needs no credentials. If `OPENMKVIEW_URL` is already exported
and one project is registered, you can call the CLI directly; running `init`
anyway is the simplest way to persist the URL for later commands. Auth-enabled
instances require `init` (or `login`) first.

Check first, then act:

```bash
node scripts/omk.mjs init --url http://127.0.0.1:4567
```

- Open instance: `init` prints `{"authRequired":false,...}` and writes a config
  with `"token": null`. Nothing else is needed.
- Auth-enabled instance: `init` asks for the username and password, exchanges
  them **once** for a Tool Session token, and writes the config. The password is
  never stored and is never accepted as a command-line flag. Supply credentials
  through `OPENMKVIEW_USERNAME` / `OPENMKVIEW_PASSWORD` (or answer the prompts):

  ```bash
  OPENMKVIEW_USERNAME=alice OPENMKVIEW_PASSWORD=secret \
    node scripts/omk.mjs init --url http://127.0.0.1:4567 --label "claude on laptop"
  ```

The config lives at `~/.config/openmkview/agent.json`, mode `0600`, holding only
`url` and `token`. `OPENMKVIEW_URL` overrides the URL;
`OPENMKVIEW_AGENT_CONFIG` overrides the config path (useful for isolated test
instances). `login` re-runs only the credential exchange when a config already
exists.

**A `401` means the Tool Session was revoked or was never stored, or the
`OPENMKVIEW_URL` points at a different instance** (sessions never expire, so
there are no other causes): either the config has no token because auth was
never initialized, the token's row was deleted, or the URL targets another
instance that never saw this token. The CLI exits non-zero and prints
`Tool Session revoked — run omk.mjs init`; ask the user to re-init or run
`login` with fresh credentials. Do not retry a 401.

## CLI at a glance

Run `node scripts/omk.mjs --help` for the full text. Successful output is JSON
on stdout. Errors are JSON on stderr (`{"error":"..."}`) with a non-zero exit
code — branch on the exit code, not on prose.

| Command | What it does |
|---|---|
| `init [--url U] [--username U] [--label L]` | Detect auth, exchange credentials once, write config |
| `login [--url U] [--username U] [--label L]` | Re-exchange credentials for a new Tool Session |
| `projects list [--open]` | List Registered Projects (camelCase fields, including `isOpen`); `--open` keeps open ones |
| `projects open <dir>` | Validate the directory, then register or re-open it (idempotent); prints the project |
| `projects detect [<dir>]` | Report whether a directory (default: cwd) is a Registered Project's root or nested inside one; includes the `matches` list, deepest first |
| `list [--file PATH] [--project ID\|NAME\|PATH] [--author A] [--resolved\|--unresolved] [--orphans] [--new\|--since TS] [--text QUERY]` | Read threads. With `--file`: that file. Without: the project management list, including Missing File rows |
| `show <id> [--project P] [--context N]` | Find one thread by id; `--context N` adds N neighboring blocks around the Anchor |
| `create --file PATH (--body TEXT \| --body-file PATH) [--quote TEXT] [--author NAME] [--human] [--project P]` | Create a thread, optionally anchored to a quoted span |
| `reply <id> (--body TEXT \| --body-file PATH) [--author NAME] [--human]` | Append a Reply |
| `resolve <id...> [--undo] [--project P]` | Resolve (or un-resolve) one or more threads |
| `delete <id...> [--project P]` | Delete threads |
| `batch-resolve <id...> --project P [--undo]` | Resolve many in one call |
| `batch-delete <id...> --project P` | Delete many in one call |

Write identity: writes default to author `agent` with `isAgent: true`, which is
what marks your voice in the web UI. Pass `--author claude` to name yourself.
Use `--human` only when writing on the human's behalf: it sets
`isAgent: false` and defaults the author to `human`.

Bodies: `create` and `reply` take `--body TEXT`, or `--body-file PATH` to read
the body from a file (`--body-file -` reads all of stdin) when `--body` is
absent. `--body` wins if both are passed.

Project resolution: pass `--project` with an id, name, or path. Without it, an
absolute `--file` selects its Containing Project; if no registered project
contains it, the working directory is not consulted and the command reports
the file as outside the project. A relative or absent `--file` falls back to
the current working directory, which selects the deepest Registered Project
whose root is the cwd or an ancestor of it — open or **Closed** alike, since a
Closed project stays fully addressable. A single registered project is used
automatically when nothing else matches; with several projects the error now
lists every choice inline (`id name (path)`), so no extra `projects list`
round trip is needed.

`list` without `--file` uses the management endpoint, so it also shows
**Missing File** threads (`missingFile: true`). `--orphans` keeps only those.
`list --file` returns `[]` when the file no longer exists.

`list --text QUERY` is a case-insensitive substring match over the thread's
`snapshot` and every note body — a quick way to find the thread that mentioned
a term, not a full query language. `list --new` keeps threads created, or with
a note appended, since the previous successful project-wide `--new` read, then
advances a per-instance, per-project cursor (stored beside the agent config in
`agent-cursor.json`). Adding `--file` or `--author` to `--new` still filters
the output but deliberately does **not** advance the cursor, because those
flags narrow the server-side read and advancing past the returned rows would
silently skip other files' or authors' updates; the CLI prints a warning to
stderr. Use the unfiltered project-level read (`list --project P --new`) when
you mean "everything new since last time". `list --since TIMESTAMP` applies
the same activity test to an ISO or SQLite (`YYYY-MM-DD HH:MM:SS`) timestamp
with no state. The two are mutually exclusive. `show --context N` (`N >= 0`)
adds a `context` array with N neighboring blocks around each anchored block
(`N = 0` returns just the anchored blocks; `anchor: true` marks them); it is
`null` when the file cannot be read, never an error.

## Workflow A — consume human feedback, act, resolve

This is the primary loop: a human reads a document, leaves an Annotation, and
you turn it into a change and close the thread.

1. **Find the feedback.** Prefer the file the user named:

   ```bash
   node scripts/omk.mjs list --file README.md
   node scripts/omk.mjs list --project my-docs --unresolved --author alice
   node scripts/omk.mjs list --project my-docs --new
   ```

   `list --new` shows only feedback added since your last `--new` read: a
   human replying inside an old thread counts as new too, not just newly
   created threads. Read the JSON: each thread has `snapshot` (the anchored
   text), `resolved`, `relativePath`, and a `notes` array. Each note carries
   `author`, `isAgent`, and `body`. A human note has `isAgent: false`; treat
   its `author` as the person's name. A legacy note has `author: null` and
   reads as "—".

2. **Inspect the exact thread** when the scope is unclear:

   ```bash
   node scripts/omk.mjs show 7
   ```

3. **Do the work** in the project files with your normal tools. The Annotation
   lives in SQLite, never inside the document, so editing the file is safe. If
   the edit moves or renames the file, use the app's file operations (the
   annotation paths migrate); a filesystem move outside the app turns the thread
   into **Missing File**.

4. **Reply with what you did**, under your own name:

   ```bash
   node scripts/omk.mjs reply 7 --body "Clarified the prerequisite in the Setup section (commit abc123)." --author claude
   ```

5. **Resolve the thread** once the request is satisfied:

   ```bash
   node scripts/omk.mjs resolve 7
   ```

   If several threads came from the same Author, close them together:

   ```bash
   node scripts/omk.mjs list --project my-docs --author alice --unresolved
   node scripts/omk.mjs batch-resolve 7 8 9 --project my-docs
   ```

Resolve only what you actually addressed. If a thread needs human input, reply
with the question and leave it unresolved — the human sees the reply in the web
UI. Use `--undo` to re-open a thread resolved by mistake.

## Workflow B — produce annotations, hand off to human review

Use this when the *human* should review your output, or when you are adding
review comments of your own.

1. **Create an Annotation on the exact span** the reviewer should see. Quote
   the text as the reader sees it (rendered text, not raw Markdown syntax; for
   hard-wrapped prose the lines join without a space):

   ```bash
   node scripts/omk.mjs create --file README.md \
     --quote "The quick brownfox jumps overthe lazy dog." \
     --body "This sentence is a placeholder. Suggest replacing it with a real example." \
     --author claude
   ```

   `create` fetches the file, computes the Anchor, and returns the created
   thread as JSON (including its `id`). The web UI shows the highlight
   immediately. Without `--quote` the Annotation anchors the whole file, which
   is useful for a file-level review note.

2. **Tell the human where to look** — the file path and the quoted text are
   enough; the web UI renders the thread in the annotation column.

3. **Continue the conversation** with `reply` and close it with `resolve` after
   the human responds. If the human edits the document and the Anchor no longer
   matches, the thread shows **Outdated**; the human can re-anchor it in the UI.

4. **Clean up** notes that should not persist with `delete` (or `batch-delete`).

Anchors are advisory references, not authorization. Do not treat an Author name
or `isAgent` as identity; the instance owner controls who can reach the API.

## Working with several authors and Missing Files

- `?author` / `--author` filters threads containing at least one note by that
  exact string. Filtering by `claude` finds your threads; filtering by a human's
  name finds theirs.
- `--resolved` / `--unresolved` are client-side filters over the thread's
  Resolved flag.
- `list` without `--file` includes rows whose stored path no longer exists.
  They are **Missing File** (`missingFile: true`), not **Outdated** — the Anchor
  cannot be evaluated without the file. Surface them to the human; do not guess
  a replacement path.

## When something goes wrong

| Symptom | Meaning and action |
|---|---|
| `Tool Session revoked — run omk.mjs init` (exit non-zero) | The token was revoked or never stored. Run `init`/`login` with credentials. |
| `Quote not found in file: "..."` | The quote does not match rendered text. Read the file, use the exact rendered span, or use no `--quote` for a whole-file note. |
| `File is binary: <path>` / `File is truncated and cannot be anchored: <path>` | `create` refuses files it cannot anchor faithfully. Annotate a Markdown/text file instead. |
| `Multiple projects found — pass --project ...` | Two or more projects are registered and none contains the target. The error now lists every choice inline (`id name (path)`); pass id, name, or path — or run the command from inside the project. |
| `No projects registered — run omk.mjs projects open <dir>` | Nothing is registered on this instance. Register the directory with `projects open <dir>`; the CLI validates it (Markdown/HTML must exist) before registering. |
| `Cannot register <dir>: <reason>` | `projects open` rejected the directory. Known reasons are translated to English: directory does not exist, path is not a directory, no Markdown or HTML files found in the directory. |
| `Cannot reach <url>` | The instance is down or the URL is wrong. Check `OPENMKVIEW_URL`. |
| Annotation missing on reload / shows Outdated | The document changed. Reply with what changed; ask the human to re-anchor. |

## Reference material

- `references/api.md` — the full annotation + auth HTTP API, verified response
  shapes, the exact error strings, Anchor construction rules, a zero-dependency
  Python Anchor builder, and curl recipes for **every** CLI operation. Read it
  when Node is unavailable, when you need an endpoint the CLI does not expose
  (edit a note, re-anchor, clear a project, revoke a Tool Session), or when you
  must debug a raw response.
- `scripts/omk.mjs` — the CLI entry point (zero dependencies, Node ≥ 18). Run
  `--help` for the complete flag list. The implementation lives beside it in
  `scripts/lib/` (`markdown.mjs` block model + Anchor construction,
  `domain.mjs` pure project/thread helpers, `client.mjs` config/HTTP/prompts,
  `commands.mjs` dispatch); the whole `scripts/` directory travels with the
  skill, so only Node itself is needed.
- `evals/` — the fixture project, boot script, three eval prompts, and committed
  with/without-skill results; useful as executable examples of both workflows.

## Ground rules

- Never hand-craft Anchor JSON if the CLI can build it.
- Never write the password to disk; only the URL and Tool Session token belong
  in the config.
- Reply and resolve; do not silently delete a human's thread.
- Announce authorship honestly (`--author`, `--human`) so the web UI can mark
  the agent's voice distinctly.
