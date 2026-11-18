# Eval review — iteration 2 (authoritative)

- Skill: `openmkview-annotations`
- Product commit: `eadf984` (binary version `v0.2.0-eadf984`)
- Date: 2026-11-18
- Harness: `evals/scripts/run-evals.sh` (deterministic + browser + agent layers)
- Results: `evals/results/iteration-2/`
- Iteration 1 is superseded: its "stored anchor == CLI builder" heuristic was
  not a valid Active/Outdated oracle, so its resolver-status conclusions are
  replaced by the real-resolver results below.

## Method

Three layers, deliberately separated:

1. **Deterministic layer** (`run-evals.sh`): the exact CLI sequences SKILL.md
   teaches, versus raw HTTP plus a hand-crafted Anchor
   (`evals/scripts/baseline-raw.mjs`). State is reset between each run. This
   layer checks JSON shapes, authorship, filters, counts, and — critically —
   runs the **real frontend resolver** (`resolveAnchor` over blocks produced by
   the real render pipeline) on both stored Anchors.
2. **Real-agent layer** (`run-agent-evals.sh`): `claude -p` sessions with the
   skill installed in `.claude/skills/` and Bash permitted, given the eval-1
   and eval-2 prompts. Transcripts, final answers, created annotations, and
   resolver statuses are committed under `agent-runs/`.
3. **Browser layer** (`browser-review.mjs`, Playwright): the real web UI at a
   fixture instance, reading the annotation column's user-visible state,
   author, and Agent badge, with a screenshot.

A fixture project (`evals/fixture/`) provides hard-wrapped prose, ATX/setext
headings, fenced code, blockquotes, lists, a table, and an image. Instances run
with `OPENMKVIEW_DATA_HOME` / `OPENMKVIEW_CONFIG_HOME` under
`~/.cache/omk-eval.*` (never `/tmp`), in open and auth modes.

## Prompts

1. **read-feedback** — "I'm reviewing feedback left on the fixture project's
   README.md. List the annotations on README.md and tell me what the human wants
   me to change. Don't change anything yet."
2. **create-from-quote** — "Create an annotation on README.md quoting
   'fox jumps' and saying: 'Explain what the fox represents; this is a
   placeholder.' Use your author name claude."
3. **resolve-author** — "Resolve every annotation authored by claude in the
   fixture project, then confirm none remain unresolved. Leave the human's
   annotations alone."

## Verdicts

### Deterministic layer

| Eval | Assertion | with skill | baseline |
|---|---|---|---|
| 1 | list JSON parses | PASS | PASS |
| 1 | both seeded annotations returned | PASS | PASS |
| 1 | author alice / isAgent false | PASS | PASS |
| 1 | two distinct threads with expected anchored spans | PASS | PASS |
| 2 | create JSON has an id | PASS | PASS |
| 2 | author claude / isAgent true | PASS | PASS |
| 2 | anchor references the requested span | PASS | PASS |
| 2 | stored anchor equals the CLI builder (structural) | PASS | **FAIL** |
| 2 | blockText is a projected rendered block | PASS | **FAIL** |
| 2 | **real resolver status** | **resolved (Active)** | **outdated** |
| 2 | oracle control (opposite anchor in same run) | PASS (raw-line → outdated) | PASS (CLI → resolved) |
| 2 | frontend projection suite (13 tests) | PASS | n/a |
| 3 | author filter returns claude threads | PASS | PASS |
| 3 | batch resolve updates exactly those threads | PASS | PASS |
| 3 | no unresolved claude annotations remain | PASS | PASS |
| 3 | other authors untouched | PASS | PASS |

Totals: with-skill **16/16**; baseline **12/15** (the three failures are the
Anchor-fidelity assertions, expected); auth smoke **6/6**.

### Real-agent layer

| Run | Assertion | Verdict |
|---|---|---|
| eval 1 | skill drives `omk.mjs` | PASS |
| eval 1 | lists through the CLI | PASS |
| eval 1 | answer names the Node 18 requirement | PASS |
| eval 1 | answer names the placeholder-sentence request | PASS |
| eval 1 | answer synthesizes (non-echo remainder > 200 chars with a synthesis term) | PASS |
| eval 2 | creates through the CLI | PASS |
| eval 2 | annotation exists with author claude / isAgent true | PASS |
| eval 2 | created anchor resolves Active through the real resolver (control Outdated) | PASS |
| eval 2 | note body carries the requested review request | PASS |

Totals: **9/9**. The eval-2 session ran the skill's `init` and `create`
commands against the fixture and produced an annotation whose stored anchor
resolved **resolved** (Active); the raw-line control in the same run resolved
**outdated**.

### Differential check

The Python Anchor helper in `references/api.md` matches the CLI on **20/20**
cases: fixture files plus escaped-pipe table cells (`x \| y` → `x | y`), lists
with continuations inside and beyond the container column, wrapped prose,
blockquotes, setext headings, tables, images, and whole-file anchors.
`differential-anchor-check.json` lists every case.

### Browser review

Playwright opened `README.md` in the real web UI and read the annotation column:

| Surface | Observed |
|---|---|
| CLI-created annotation state | **Active** |
| CLI-created annotation author | **claude** |
| CLI-created annotation badge | **Agent** |
| Raw-line baseline state | **Outdated** (`data-outdated="true"`) |

Evidence: `browser-review/annotation-column.png` and
`browser-review/browser-review.json`.

## Findings

1. **The real resolver is the authority.** It ignores `blockHash`, scores
   `blockText` as one signal, and can resolve an anchor that merely matches a
   quote plus context. The valid claim is not "stored == builder" but "the
   rendered-block resolver returns resolved". The harness now asserts that
   directly, in both directions (with-skill resolved, raw-line control
   outdated; and the mirror control for the baseline run).
2. **A genuinely Outdated baseline.** The baseline emits a whole-block segment
   whose `blockText` is the raw source line. `selectWholeBlock` requires exact
   equality with a rendered block, so hard-wrapped prose makes it Outdated.
3. **Reading and resolving are API-capable without the skill.** Evals 1 and 3
   pass in both configurations; the skill's value there is procedural. Eval 2
   is the discriminating case.
4. **The agent actually uses the skill.** In the committed transcripts the
   session reads the installed skill, runs `omk.mjs init`, then `omk.mjs list`
   / `omk.mjs create` with the documented flags, and in eval 1 answers with a
   synthesized change plan rather than only echoing note bodies.
5. **The documented fallback is faithful.** When Bash is unavailable, the
   fresh-session trigger check (`results/trigger-check.md`) showed the session
   reading `references/api.md` and switching to the HTTP endpoints; the
   differential check keeps the Python Anchor helper byte-identical to the CLI.

## Discussion

- The eval-1 answer legitimately quotes the note bodies in a table while also
  synthesizing a plan. The synthesis assertion therefore removes the two exact
  bodies and requires substantial non-echo content plus a synthesis term,
  instead of banning verbatim quotes (which would reject a good answer).
- The baseline is one plausible no-skill implementation (raw source-line
  whole-block anchor), not a distribution over models. It demonstrates the
  failure mode the skill removes; the oracle controls prove the failure is the
  anchor, not a broken pipeline.
- The Python helper hashes Unicode code points while the CLI hashes UTF-16
  code units; astral-plane characters can differ. Documented in `api.md` with a
  "use the CLI" caveat.

## Remaining limitations

- The browser review checks the annotation column and its badges, not
  pixel-level highlight geometry.
- The real-agent layer uses the locally configured model; it is one session per
  prompt, not a multi-model distribution.
- No installer/distribution is in scope; the skill is versioned at the repo
  root.
