# openmkview-annotations evals

The skill-creator loop applied to this skill: a synthetic fixture, scratch
OpenMKView instances, three realistic prompts, quantitative assertions, a real
agent layer, a Playwright browser review, and committed results.

## Layout

```
evals/
├── evals.json                      prompts + expectations (skill-creator schema)
├── fixture/                        synthetic Markdown project
├── scripts/
│   ├── boot-fixture.sh             boot open|auth scratch instance, write env.sh
│   ├── stop-fixture.sh             stop and clean a fixture root
│   ├── run-evals.sh                deterministic + differential + browser + agent loop
│   ├── run-agent-evals.sh          real `claude -p` sessions with the skill installed
│   ├── baseline-raw.mjs            no-skill baseline (raw HTTP, raw-line whole-block Anchor)
│   ├── resolver-status.mjs         REAL oracle: render blocks + frontend resolveAnchor
│   ├── verify-anchor.mjs           structural CLI-builder comparison (not the oracle)
│   ├── differential-anchor-check.mjs  api.md Python helper vs the CLI
│   ├── browser-review.mjs          Playwright: Active/Outdated, author, Agent badge
│   ├── filter-transcript.mjs       compact, committed agent transcripts
│   ├── summarize-list.mjs          deterministic read-layer summary
│   ├── summarize-benchmark.mjs     grading.json -> benchmark.json/.md
│   ├── merge-grading.mjs           merge browser assertions into grading.json
│   └── assert.mjs                  append one graded assertion (viewer schema)
└── results/
    ├── iteration-2/                authoritative results (re-run after review)
    └── trigger-check.md            fresh-session trigger evidence
```

## Run it

```bash
cargo build                              # target/debug/openmkview
cd frontend && npm install && npm run build   # browser review needs dist/
cd .. && skills/openmkview-annotations/evals/scripts/run-evals.sh
```

Requirements: bash, curl, node >= 18, python3 (differential check), Chromium
for Playwright (installed in the Playwright cache), and the `claude` CLI for the
agent layer. The agent layer runs nested `claude -p` sessions in an isolated
scratch workspace with `--permission-mode bypassPermissions` (authorized for
this check) so the skill's CLI can execute.

## Layers

| Layer | What it proves |
|---|---|
| Deterministic | JSON shapes, authorship, filters, and the **real resolver status** for both the CLI and a raw-line baseline. |
| Differential | The Python Anchor helper in `references/api.md` is byte-identical to the CLI across the fixture, escaped-pipe tables, and list continuations. |
| Browser | The real web UI renders the CLI annotation as **Active** with author `claude` and an **Agent** badge, and the raw-line baseline as **Outdated**. |
| Agent | A fresh `claude -p` session with the skill installed drives `omk.mjs`, answers eval 1 with a synthesized plan, and creates an Active annotation for eval 2. |

The deterministic layer resets annotation state between every run. Baseline
failures on the three Anchor-fidelity assertions are expected and reported
separately; the harness exits non-zero only for unexpected failures.

## Results

`results/iteration-2/review.md` holds the verdict tables, the real resolver
statuses, the browser evidence, and the agent transcript summary. Iteration 1 is
superseded because its structural "stored == builder" heuristic was not a valid
Active/Outdated oracle.
