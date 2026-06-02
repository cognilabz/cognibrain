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
| `artifacts/original-public-benchmarks.json` | 2026-06-02T09:05:43.612Z | Partial: upstream LongMemEval BM25 and Basic Memory full benchmark marker suite passed; Mem0 exact upstream is blocked by stale dependency ref |
| `artifacts/realworld-benchmark-protocol.json` | 2026-06-02T12:47:28.983Z | Protocol ready; 0 current artifacts are fair market-wide real-world leaderboard evidence |
| `artifacts/realworld-blackbox.json` | 2026-06-02T11:18:17.144Z | Neutral harness ready; quality not scored because the LLM/harness judge and external competitor commands are blocked |
| `artifacts/realworld-blackbox-openai-intelligence.json` | 2026-06-02T12:47:28.928Z | Controlled blocked-judge rerun; raw outputs retained, strict judge-contract validation active, external raw-output and finite metric contract validation active, safe delivery boundary active, and secret-safe provenance recorded; no current quality score is reportable |
| `artifacts/realworld-blackbox-openai-intelligence-success.json` | not generated | Last-successful judged smoke slot; only updated by scoreable LLM/harness runs |
| `artifacts/external-basic-memory.json` | 2026-06-01T12:37:07Z | Adapter diagnostic, not an original benchmark |
| `artifacts/locomo-report.json` | 2026-05-28T12:56:23.302Z | Passed |
| `artifacts/longmemeval-report.json` | 2026-05-28T12:59:05.579Z | Passed |
| `artifacts/beam-report.json` | 2026-05-29T06:54:33.618Z | Passed |
| `artifacts/beam-500k-report.json` | 2026-05-29T07:00:53.320Z | Passed |
| `artifacts/beam-1m-report.json` | 2026-05-29T07:12:40.727Z | Passed |

## Public Benchmark Dataset Stress

These rows are Cognibrain runs against public-style datasets and local
baselines. They are useful regression evidence, but they are not original
product runs for other memory systems and are not a fair market leaderboard.

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
The real-world protocol currently classifies 0 checked artifacts as fair
cross-system leaderboard evidence.
The current LLM-intelligence artifact is judge-blocked and intentionally reports
no quality score. It retains same-manifest raw outputs for Cognibrain, Basic
Memory and LangMem so retrieval weaknesses remain inspectable while the
LLM/harness judge is unavailable.

## Real-World Fairness Boundary

The current real-world protocol artifact is a preregistration and evidence
classifier, not a score table. A result is leaderboard-eligible only when the
dataset, prompts, scoring, budgets, and adapter contract are frozen before
system tuning; every system receives the same input stream; every system runs
through its original package, CLI, SDK, service, or official API; and raw
outputs, cost, latency, versions, errors, and scorer traces are retained.

Current artifact classes:

| Artifact | Evidence class | Leaderboard eligible | Why |
| --- | --- | --- | --- |
| `artifacts/realworld-blackbox.json` | `neutral-blackbox-smoke` | No | Same frozen manifest, raw outputs and latency/cost fields, but quality scoring is blocked until `MEMORY_REALWORLD_JUDGE_COMMAND` and external competitor commands are configured. |
| `artifacts/realworld-blackbox-openai-intelligence.json` | `llm-intelligence-neutral-smoke` | No | The current rerun reached the same frozen manifest and original-system commands, retained raw outputs, and blocked quality scoring because the configured judge failed. |
| `artifacts/realworld-blackbox-openai-intelligence-success.json` | `llm-intelligence-last-successful-judged-smoke` | No | Separate last-successful slot; credential-blocked latest attempts must not overwrite scoreable judged evidence. |
| `artifacts/original-public-benchmarks.json` | `upstream-original-evidence` | No | Original upstream evidence and blockers, but not all systems on one neutral protocol. |
| `artifacts/external-hard-summary.json` | `cognibrain-public-dataset-stress` | No | Cognibrain versus local baselines, not original competitor product runs. |
| `artifacts/arena/run.json` | `cognibrain-designed-adapter-diagnostic` | No | CogniCode scenarios and capability-profile adapters are Cognibrain-shaped. |
| `artifacts/arena/native-competitors.json` | `native-smoke-on-cognibrain-designed-scenarios` | No | Some native paths run, but the scenario family is still Cognibrain-designed. |
| `artifacts/external-basic-memory.json` | `custom-adapter-diagnostic` | No | Basic Memory is run through a local adapter, not an official or preregistered generic adapter. |
| `artifacts/cognicodebench/run.json` | `internal-product-benchmark` | No | Strong internal regression suite, not a neutral cross-system benchmark. |

## Real-World Black-Box Smoke

This is the first neutral harness implementation. It uses a frozen
`realworld-blackbox-v1` manifest and a generic `reset`, `ingest`, `query`,
`export-raw-outputs`, `teardown` contract. It records raw outputs, setup
blockers, latency percentiles and cost fields. Score, recall, abstention and
leakage quality metrics stay `not scored` until `MEMORY_REALWORLD_JUDGE_COMMAND`
points to a fixed LLM/harness judge. Structured evidence-id matches are
diagnostics only; they are not quality scores and are not leaderboard proof.
The checked LLM path is `scripts/benchmark/realworld-openai-judge.mjs`, which
passes retrieved text rather than retrieved evidence IDs to the judge.
Judged runs are fail-closed: the harness requires exactly one decision for
every manifest query, no unknown or duplicate query IDs, finite 0..1 score and
confidence values, strict JSON booleans for decision fields, and finite
latency/cost metrics from external command runners. Malformed judged outputs
retain raw retrieval outputs but are not quality-scored or leaderboard-eligible.
Configured original-system command failures are separated from missing
credentials: non-zero exits, invalid JSON, and missing judged raw-output shapes
are classified as `same-run-command` contract diagnostics with no quality score,
not as `credential-blocked` rows.
It is still not a leaderboard because the default no-score artifact has no
LLM/harness judge command or original competitor commands configured.

| System | Evidence class | Judge | Score | Recall | Abstention | Leakage | p95 latency | Boundary |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Cognibrain | `same-run-full` | `missing:blocked` | not scored | not scored | not scored | not scored | 9 ms | Real local product run, but quality claims are blocked until an LLM/harness judge scores the retained raw outputs. |
| Keyword baseline | `local-baseline` | `missing:blocked` | not scored | not scored | not scored | not scored | 1 ms | Baseline only, never a product-system leaderboard row. |
| Mem0, Basic Memory, LangMem, Graphiti, Zep, Cognee, GBrain | `credential-blocked` | `missing:blocked` | not scored | not scored | not scored | not scored | 0 ms | Missing `MEMORY_REALWORLD_*_COMMAND` runner commands in the no-score default run. |

Immediate Cognibrain raw-output diagnostics: support queries can retrieve an
unrelated decoy alongside the correct evidence; temporal-update queries can
retrieve stale and current evidence together; deleted-token abstention can
still retrieve unrelated support facts instead of returning no evidence. These
signals define the next retrieval work, but they are diagnostics only until the
LLM/harness judge scores them.

## LLM-Intelligence Retrieval Smoke

This separate smoke run configures `MEMORY_INTELLIGENCE_COMMAND` with
`scripts/benchmark/openai-memory-intelligence.mjs` and scores delivered outputs
with `scripts/benchmark/realworld-openai-judge.mjs`. It keeps raw diagnostics
for excluded candidates but passes only non-excluded delivered text to the
quality judge. The current checked rerun is judge-blocked, so the rows below
are not quality scores; they are raw-output and latency diagnostics.

| System | Retrieval intelligence | Judge | Score | Recall | Abstention | Leakage | p95 latency | Boundary |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Cognibrain | OpenAI-compatible JSON command | `missing:blocked` | not scored | not scored | not scored | not scored | 10 ms | Same-run full product raw outputs retained; quality blocked until the LLM/harness judge succeeds. |
| Basic Memory | Original `basic-memory==0.21.5` local package, CLI reindex, MCP `search_notes` | `missing:blocked` | not scored | not scored | not scored | not scored | 776 ms | Original package command raw outputs retained; quality blocked until the LLM/harness judge succeeds. |
| LangMem | Original `langmem==0.0.30` package with `langgraph.store.memory.InMemoryStore` and upstream memory tools | `missing:blocked` | not scored | not scored | not scored | not scored | 0 ms | Original package command raw outputs retained; quality blocked until the LLM/harness judge succeeds. |
| Keyword baseline | None | `missing:blocked` | not scored | not scored | not scored | not scored | 0 ms | Baseline only; current judge blocked. |

The current improvement in code is the provider path, not a fresh market score:
JSON-command intelligence calls now use compact result payloads and a bounded
short-lived response cache, so repeated semantic LLM/harness judgements do not
pay duplicate process and provider cost. This keeps retrieval intelligence
provider-driven while targeting the previous latency weakness. Provider
evidence is also fail-closed at the memory level: `answerable=true` alone does
not authorize delivery, the top-level verdict must carry strict boolean
`answerable` and finite 0..1 confidence fields, and every returned memory must
have an explicit per-memory LLM/harness decision with finite 0..1 confidence
before it can enter injected context; malformed answerable provider output is
converted to excluded evidence rather than calibrated from heuristics. Direct
harness decisions must use valid decision values, no unknown or duplicate
memory ids, and retrieval calibration preserves earlier `unsafeToInject` flags
instead of overriding them. The
real-world Cognibrain adapter applies the same delivery boundary: review-gated
or otherwise `unsafeToInject` retrieval results stay in raw diagnostics but are
not exported as delivered `retrievedText` for the quality judge. External
original-system runners are also fail-closed against the frozen manifest: raw
outputs must contain exactly one output for every query id, no unknown or
duplicate query ids, finite latency values, and no more than the query `topK`
returned text/evidence items. Cost and latency gate fields must be finite
non-negative numbers; malformed metric fields keep raw diagnostics but do not
pass the cost/latency eligibility gate. The harness now
also separates latest-attempt artifacts from the last successful judged artifact
so credential failures do not erase scoreable scientific evidence, and it keeps
same-manifest raw outputs when judge failures happen after retrieval. The
current artifact also records judge and command fingerprints without raw command
values, and redacts diagnostic blocked reasons before writing them.

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

This is a Cognibrain lifecycle diagnostic, not a fair real-world leaderboard.
Rows with `api-shape` proof levels are capability models, not original product
runs. Arena command runners must return structured JSON checks; raw text output
is retained as diagnostic evidence but is not parsed into success scores.

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

This smoke run checks native runner plumbing on Cognibrain-designed scenarios.
It can expose setup and adapter weaknesses, but it is not a neutral
cross-system result table.

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

## Original Public Benchmarks

This run uses cloned upstream benchmark repositories directly. It does not
count local adapters as original benchmark evidence.

Protocol classes: `exact-upstream` means original code, command and scoring;
`dependency-stabilized` means original code and scoring with documented external
dependency environment; adapter diagnostics are not counted as original scores.

| System | Benchmark | Status | Evidence |
| --- | --- | --- | --- |
| LongMemEval official flat-bm25 baseline | LongMemEval official retrieval | Passed | 500 rows, 419 scored, recall_any@1 70.6%, recall_any@5 88.8%, recall_any@10 92.6% |
| Basic Memory | Basic Memory full upstream benchmark marker suite | Passed | 20 tests, 1 skipped, 33 JSONL metric rows, cold index 13.48 notes/sec, hybrid p95 20.05 ms, postgres-openai paraphrase hybrid recall@5 87.5% |
| Mem0 OSS, exact upstream | Mem0 memory-benchmarks Docker server | Blocked | Original `docker/mem0/requirements.txt` pins `mem0ai` to deleted git ref `feat/v3-pipeline`, so exact upstream build fails before benchmark execution. |
| Mem0 OSS, repaired package pin | Mem0 memory-benchmarks LOCOMO official smoke | Failed | Repaired only the ignored upstream clone to `mem0@main`; official runner ingested 419/419 chunks, then `/search` returned 500 because current `mem0.search` rejects top-level `user_id` and expects `filters`. Result: 1 question, 0 retrieved memories, top_10/top_20 score 0.0. |
| Mem0 Cloud | Mem0 memory-benchmarks LOCOMO/LongMemEval/BEAM | Blocked | `MEM0_API_KEY`, `MEM0_ORGANIZATION_ID`, and `MEM0_PROJECT_ID` missing |
| Basic Memory | LOCOMO/LongMemEval/BEAM original suites | Not comparable as original-only | No official Basic Memory adapter exists in the cloned upstream runners |
| LOCOMO original RAG/QA scripts | snap-research/locomo | Blocked | Original RAG path expects upstream embeddings/model assets |
| BEAM original LIGHT/RAG/long-context scripts | mohammadtavakoli78/BEAM | Blocked | Qwen, reader, GPT, and LLM-judge configuration missing |

## Original Benchmark Learnings

| Priority | Improvement | Evidence |
| --- | --- | --- |
| P0 | Capture external benchmark environment in artifacts | Basic Memory only became fully reproducible after `DOCKER_HOST`, OpenAI provider availability, and HF download mode were explicit. |
| P0 | Keep exact-upstream, repaired-upstream and adapter results separate | Mem0 exact upstream failed before scoring; repaired `mem0@main` ran ingest but failed search due API drift. |
| P1 | Add latency percentiles to Cognibrain public benchmarks | Basic Memory exposes p95/p99 by retrieval mode; our public rows emphasize quality more than performance shape. |
| P1 | Build a preregistered black-box memory API benchmark | Basic Memory has no official LoCoMo/LongMemEval/BEAM adapter, so fair comparison needs a neutral API contract defined before systems are added. |
| P2 | Split quality reports into lexical, paraphrase, temporal, update, abstention and provenance buckets | Basic Memory reports lexical/paraphrase quality separately; our BEAM weaknesses already show temporal and abstention gaps. |

## Basic Memory Adapter Diagnostic

This is a local adapter diagnostic, not an original public benchmark. It uses
`basic-memory==0.21.5` through Markdown files, Basic Memory full-text
reindexing, and MCP `search_notes`.

| Dataset | Metric | Basic Memory | Cognibrain same sample | Delta |
| --- | --- | ---: | ---: | ---: |
| LoCoMo | Evidence recall@1, session notes | 6.1% | 35.8% | -29.7% |
| LongMemEval-S | Answer-session recall@1, session notes | 1.0% | 75.0% | -74.0% |
| BEAM 100K | Retrieval nugget score@5, message notes | 41.0% | 26.8% | +14.2% |
| BEAM 500K | Retrieval nugget score@5, message notes | 34.4% | 22.1% | +12.3% |
| BEAM 1M | Retrieval nugget score@5, message notes | 39.3% | 25.6% | +13.7% |

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
