# Benchmark Results

This page records the current checked benchmark artifacts. It is a results
snapshot, not a how-to guide.

![Benchmark result charts](assets/benchmark-results.svg)

## Artifact Snapshot

| Artifact | Generated | Result |
| --- | --- | --- |
| `artifacts/nextgen-benchmarks.json` | 2026-06-01T08:58:18.770Z | Passed |
| `artifacts/cognicodebench/run.json` | 2026-06-01T08:58:41.688Z | Passed |
| `artifacts/arena/run.json` | 2026-06-01T09:01:21.781Z | Passed |
| `artifacts/arena/native-competitors.json` | 2026-06-01T08:53:30.159Z | Passed |
| `artifacts/answer-generation.json` | 2026-06-01T09:01:23.340Z | Passed |
| `artifacts/leaderboard.json` | 2026-06-01T09:01:23.630Z | Passed |
| `artifacts/benchmark-hardening.json` | 2026-06-01T09:01:30.207Z | Passed |
| `artifacts/external-hard-summary.json` | 2026-06-01T10:07:13.482Z | Passed |
| `artifacts/locomo-report.json` | 2026-05-28T12:56:23.302Z | Passed |
| `artifacts/longmemeval-report.json` | 2026-05-28T12:59:05.579Z | Passed |
| `artifacts/beam-report.json` | 2026-05-29T06:54:33.618Z | Passed |
| `artifacts/beam-500k-report.json` | 2026-05-29T07:00:53.320Z | Passed |
| `artifacts/beam-1m-report.json` | 2026-05-29T07:12:40.727Z | Passed |

## Public Benchmark Datasets

| Dataset | Metric | Cognibrain | Strongest local baseline |
| --- | --- | ---: | ---: |
| LoCoMo | Evidence recall@K | 58.7% (902/1536) | Keyword only 43.4% |
| LongMemEval-S | Answer-session recall@K | 99.6% (498/500) | Keyword only 99.0% |
| BEAM 100K | Retrieval nugget score@K | 45.3% (181/400) | Keyword only 27.8% |
| BEAM 500K | Retrieval nugget score@K | 44.0% (308/700) | Keyword only 22.4% |
| BEAM 1M | Retrieval nugget score@K | 50.3% (352/700) | Keyword only 27.6% |

## Benchmark Integrity

| Signal | Result |
| --- | --- |
| CogniCodeBench integrity score | 45.0% |
| CogniCodeBench overfit risk | Medium |
| Scenario leakage | High severity |
| Patch realism | Medium severity |
| Baseline separation | Medium severity |

## BEAM Weaknesses

| Split | Weakest categories | Improvement signal |
| --- | --- | --- |
| 100K | Abstention 0.0%, instruction following 10.0%, temporal reasoning 20.0% | Add unsupported-question gating, stronger instruction-evidence scoring, and temporal normalization. |
| 500K | Abstention 0.0%, temporal reasoning 18.6%, knowledge update 24.3% | Reduce plausible-but-unsupported retrieval and improve fresh fact/version evidence. |
| 1M | Abstention 0.0%, temporal reasoning 21.4%, knowledge update 24.3% | Treat abstention and temporal/freshness retrieval as the next benchmark-driven workstream. |

## Claim Boundaries

Benchmark claims on this page are limited to the checked artifacts listed above.
Older or stronger rows are not carried forward without a current artifact.

## CogniCodeBench

| Metric | Result |
| --- | ---: |
| Scenarios | 1000 |
| Correction carry-over | 100.0% |
| Repeated mistake rate | 0.0% |
| Procedure recall | 100.0% |
| Patch correctness | 100.0% |
| Evidence completeness | 100.0% |
| Wrong-memory suppression | 100.0% |
| Source-reference correctness | 100.0% |
| Granular patch correctness | 100.0% |
| Long-horizon recall | 100.0% |

Diagnostics: integrity 45.0%, overfit risk medium. The current run flags
scenario leakage, generated patch realism, and baseline separation as benchmark
design weaknesses to fix before using CogniCodeBench as a standalone quality
claim.

## Baselines

| Baseline | Score | Repeated mistake rate |
| --- | ---: | ---: |
| No memory | 0.0% | 100.0% |
| Raw chat history | 0.0% | 100.0% |
| Vector only | 12.2% | 100.0% |
| Semantic only | 12.2% | 100.0% |
| Keyword only | 33.3% | 75.0% |
| Graph only | 29.4% | 85.0% |
| Temporal only | 13.9% | 95.0% |
| Procedure only | 50.0% | 90.0% |
| Cognibrain without temporal | 98.3% | 0.0% |
| Cognibrain without corrections | 26.1% | 90.0% |

## Arena

| System | Proof level | Mode | Scenarios | Score |
| --- | --- | --- | ---: | ---: |
| Cognibrain | `same-run-full` | `full-local` | 300 | 97.5% |
| LangMem | `same-run-native` | `native-command` | 300 | 66.7% |
| Graphiti/Zep | `same-run-api-shape` | `api-shape` | 300 | 66.7% |
| Zep | `same-run-api-shape` | `api-shape` | 300 | 66.7% |
| GBrain | `same-run-api-shape` | `api-shape` | 300 | 66.7% |
| Cognee | `same-run-api-shape` | `api-shape` | 300 | 60.0% |
| Basic Memory | `same-run-api-shape` | `api-shape` | 300 | 60.0% |
| Mem0 | `same-run-api-shape` | `api-shape` | 300 | 15.0% |

## Native Competitor Smoke

| System | Proof level | Mode | Scenarios | Score | Repeated mistake rate |
| --- | --- | --- | ---: | ---: | ---: |
| Cognibrain | `same-run-full` | `full-local` | 30 | 96.7% | 0.0% |
| Mem0 | `same-run-native` | `native-command` | 30 | 66.7% | 100.0% |
| LangMem | `same-run-native` | `native-command` | 30 | 66.7% | 100.0% |
| GBrain | `same-run-cli` | `cli-command` | 30 | 66.7% | 100.0% |
| Basic Memory | `same-run-native` | `native-command` | 30 | 66.7% | 100.0% |
| Graphiti/Zep | `credential-blocked` | `blocked-command` | 30 | 0.0% | 100.0% |
| Cognee | `credential-blocked` | `blocked-command` | 30 | 0.0% | 100.0% |

## External Hard

This diagnostic run uses public datasets with stricter retrieval budgets than
the default snapshot. It is intended to expose weak margins, not to replace the
standard artifact rows above.

| Dataset | Metric | Cognibrain | Strongest baseline | Gap |
| --- | --- | ---: | ---: | ---: |
| LoCoMo | Evidence recall@1, no summaries | 35.7% | Keyword only 32.2% | +3.6% |
| LongMemEval-S | Answer-session recall@1 | 75.4% | Keyword only 74.2% | +1.2% |
| BEAM 100K | Retrieval nugget score@5 | 26.8% | Keyword only 12.0% | +14.8% |
| BEAM 500K | Retrieval nugget score@5 | 22.1% | Keyword only 4.7% | +17.4% |
| BEAM 1M | Retrieval nugget score@5 | 25.6% | Keyword only 10.0% | +15.6% |

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
`73bda620cb66a2db11bc0d12326d03e7323e90f17931309be462159067f2368e`
