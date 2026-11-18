# openmkview-annotations evals

The skill-creator loop applied to this skill: a synthetic fixture project, a
scratch OpenMKView instance, three realistic prompts run once with the skill
(the CLI) and once without it (raw HTTP plus a hand-crafted Anchor), quantitative
assertions, and committed results.

## Layout

```
evals/
├── evals.json              prompts + expectations (skill-creator schema)
├── fixture/                synthetic Markdown project (wrapped prose, code, table)
├── scripts/
│   ├── boot-fixture.sh     boot open|auth scratch instance, write env.sh
│   ├── stop-fixture.sh     stop and clean a fixture root
│   ├── run-evals.sh        the whole loop (boots, runs, asserts, grades)
│   ├── verify-anchor.mjs   check a stored Anchor against the CLI builder
│   ├── baseline-raw.mjs    no-skill baseline (raw HTTP, naive Anchor)
│   ├── summarize-list.mjs  deterministic "answer" from a list JSON
│   ├── summarize-benchmark.mjs  grading.json -> benchmark.json/.md
│   └── assert.mjs          append a graded assertion (viewer schema)
└── results/iteration-1/    committed outputs, grading.json, benchmark, review
```

## Run it

```bash
cargo build                          # needs target/debug/openmkview
frontend: npm install               # only for the resolver-seam assertion
node --version                      # >= 18
skills/openmkview-annotations/evals/scripts/run-evals.sh
```

The script boots both an open and an auth instance on ephemeral ports under
`~/.cache/omk-eval.*` (never `/tmp`), registers `fixture/`, and exits non-zero if
any **with-skill** or **smoke** assertion fails. Baseline failures on the anchor
fidelity assertions are expected and reported separately.

## What each run does

| Eval | With skill | Without skill |
|---|---|---|
| read-feedback | `omk list --file README.md` | `curl /api/annotations` |
| create-from-quote | `omk create --file README.md --quote "fox jumps"` | POST a hand-crafted Anchor built from the raw source line |
| resolve-author | `omk list --author claude --unresolved` + `omk batch-resolve` | GET `?author=`, loop PUT `/resolved` |

The fixture's `## Overview` paragraph is hard-wrapped, so the rendered block
text is `The quick brownfox jumps overthe lazy dog.` The CLI projects that
correctly; the baseline's raw-line Anchor (`fox jumps over`) is accepted by the
server but is **Outdated**. `verify-anchor.mjs` proves the difference by
comparing the stored Anchor with the CLI builder, and the frontend
`omkCli.test.ts` suite proves the builder resolves Active through the real
Preview resolver seam.

## Auth smoke

The harness also exercises the init-first flow on an auth instance: exchange
credentials once, read with a Bearer token, revoke the Tool Session, see the
exact re-init hint on 401, then `login` to restore access.

## Review records

`results/iteration-1/review.md` holds the structured self-review and the
assertion verdict table. Browser review was not practical in the headless
implementation environment; the ticket allows a structured self-review, and the
resolver-seam suite supplies the browser-equivalent evidence.
