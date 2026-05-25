# Same Benchmark, No Slogan

The fastest way to oversell memory is to compare a demo sentence against someone else's product category. Cognibrain's public comparison rule is simpler: same scenario stream, same metric names, same artifact, visible proof level.

The current Benchmark Arena compares:

| Rank | System | Score | Repeated mistake rate | Proof level | Declared gaps |
| --- | --- | ---: | ---: | --- | ---: |
| 1 | Cognibrain | 97.22% | 0.00% | `same-run-full` | 0 |
| 2 | Graphiti/Zep | 66.67% | 83.33% | `same-run-api-shape` | 2 |
| 3 | GBrain | 66.67% | 83.33% | `same-run-api-shape` | 2 |
| 4 | Cognee | 44.45% | 100.00% | `same-run-api-shape` | 2 |
| 5 | LangMem | 22.22% | 100.00% | `same-run-api-shape` | 2 |
| 6 | Mem0 | 11.11% | 100.00% | `same-run-api-shape` | 3 |

This is aggressive enough to be useful and bounded enough to be true:

- Cognibrain is the only `same-run-full` system in this local runner because it executes the product pipeline: correction capture, coding context, action guard and patch evidence.
- Competitor rows are local compatibility adapters with explicit gaps, not managed-cloud certifications.
- The public claim is not "best memory product"; it is "on this replayable engineering-memory benchmark, Cognibrain is the only runner with full local proof."

Artifacts:

- `artifacts/arena/run.json`
- `public/benchmark-arena/results.json`
- [`../benchmarks/proof-levels.md`](../benchmarks/proof-levels.md)

Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`.
