# openmkview-annotations eval benchmark

| Eval | Configuration | Passed | Total | Pass rate |
|---|---|---|---|---|
| eval-1-read-feedback | with_skill | 4 | 4 | 100% |
| eval-1-read-feedback | without_skill | 4 | 4 | 100% |
| eval-2-create-from-quote | with_skill | 8 | 8 | 100% |
| eval-2-create-from-quote | without_skill | 4 | 7 | 57% |
| eval-3-resolve-author | with_skill | 4 | 4 | 100% |
| eval-3-resolve-author | without_skill | 4 | 4 | 100% |

**With skill:** 100% mean pass rate  
**Baseline:** 86% mean pass rate  

## Notes
- eval-2-create-from-quote/without_skill: 3 failed assertion(s) — Baseline: stored anchor equals the CLI builder (structural); Baseline: stored blockText is a projected rendered block; Baseline: the raw-line anchor resolves Active through the real frontend resolver

