# openmkview-annotations eval benchmark

| Eval | Configuration | Passed | Total | Pass rate |
|---|---|---|---|---|
| eval-1-read-feedback | with_skill | 4 | 4 | 100% |
| eval-1-read-feedback | without_skill | 4 | 4 | 100% |
| eval-2-create-from-quote | with_skill | 6 | 6 | 100% |
| eval-2-create-from-quote | without_skill | 3 | 5 | 60% |
| eval-3-resolve-author | with_skill | 4 | 4 | 100% |
| eval-3-resolve-author | without_skill | 4 | 4 | 100% |

**With skill:** 100% mean pass rate  
**Baseline:** 87% mean pass rate  

## Notes
- eval-2-create-from-quote/without_skill: 2 failed assertion(s) — Baseline: hand-crafted anchor is Active; Baseline: stored blockText is a projected rendered block

