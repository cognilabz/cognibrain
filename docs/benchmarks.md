# Benchmark Results

This page records the current checked benchmark artifacts. It is a results
snapshot, not a how-to guide.

![Benchmark result charts](assets/benchmark-results.svg)

## Artifact Snapshot

| Artifact | Generated | Status |
| --- | --- | --- |
| `artifacts/cognicodebench/run.json` | 2026-05-28T09:42:09.272Z | Passed |
| `artifacts/arena/run.json` | 2026-05-28T09:42:39.284Z | Passed |
| `artifacts/benchmark-hardening.json` | 2026-05-28T09:43:15.120Z | Passed |

## CogniCodeBench

| Metric | Result |
| --- | ---: |
| Scenarios | 1000 |
| Correction carry-over | 1.000 |
| Repeated mistake rate | 0.000 |
| Procedure recall | 1.000 |
| Patch correctness | 1.000 |
| Evidence completeness | 1.000 |
| Wrong-memory suppression | 1.000 |
| Source-reference correctness | 1.000 |
| Granular patch correctness | 1.000 |
| Long-horizon recall | 1.000 |

## Baselines

| Baseline | Score | Repeated mistake rate |
| --- | ---: | ---: |
| No memory | 0.000 | 1.000 |
| Raw chat history | 0.000 | 1.000 |
| Vector only | 0.122 | 1.000 |
| Semantic only | 0.122 | 1.000 |
| Keyword only | 0.333 | 0.750 |
| Graph only | 0.294 | 0.850 |
| Temporal only | 0.139 | 0.950 |
| Procedure only | 0.500 | 0.900 |
| Cognibrain without temporal | 0.983 | 0.000 |
| Cognibrain without corrections | 0.261 | 0.900 |

## Arena

| System | Proof level | Mode | Scenarios | Score |
| --- | --- | --- | ---: | ---: |
| Cognibrain | `same-run-full` | `full-local` | 300 | 0.9717 |
| Mem0 | `same-run-api-shape` | `api-shape` | 300 | 0.1500 |
| Graphiti/Zep | `same-run-api-shape` | `api-shape` | 300 | 0.6667 |
| Zep | `same-run-api-shape` | `api-shape` | 300 | 0.6667 |
| Cognee | `same-run-api-shape` | `api-shape` | 300 | 0.6000 |
| LangMem | `credential-blocked` | `blocked-command` | 300 | 0.0000 |
| GBrain | `same-run-api-shape` | `api-shape` | 300 | 0.6667 |

## Hardening

| Check | Result |
| --- | --- |
| Scenario dataset present | Pass |
| Scenario schema present | Pass |
| Dataset hash present | Pass |
| Scenario generation pinned | Pass |
| Real-repo track present | Pass |
| Real-repo workflows present | Pass |
| Competitor proof levels bounded | Pass |
| Native competitor path exists | Pass |

Dataset: `artifacts/cognicodebench/scenarios.json`

SHA-256:
`ea86f5903464a64cb3415003b9a3faa19857e271203ee518dcc6bd368dc11868`
