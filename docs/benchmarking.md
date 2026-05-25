# Benchmarking

cognibrain has seven benchmark layers:

1. `npm run eval` runs the local transparent proof suite.
2. `npm run benchmark:locomo` runs against the official LoCoMo dataset from `snap-research/locomo`.
3. `npm run benchmark:longmemeval` runs against LongMemEval-S from Hugging Face.
4. `npm run benchmark:beam` runs against BEAM splits from Hugging Face.
5. `npm run benchmark:nextgen` runs deterministic Agent Memory OS suites, including the `usp-evidence-pack` why-used benchmark.
6. `npm run benchmark:cognicode` runs CogniCodeBench, the engineering-memory benchmark for coding agents.
7. `npm run benchmark:market` combines certified artifacts into one machine-readable gate.

## Official LoCoMo Runner

LoCoMo is the benchmark released with the ACL 2024 paper "Evaluating Very Long-Term Conversational Memory of LLM Agents." The official repository states that `data/locomo10.json` contains 10 long-term conversations with sessioned dialogue, QA annotations, categories, and evidence dialog IDs.

Run the benchmark:

```bash
npm run benchmark:locomo -- --top-k 20 --out artifacts/locomo-full.json
```

If `data/benchmarks/locomo/locomo10.json` is missing, the runner downloads it from the official LoCoMo GitHub repository.

Fast development slice:

```bash
npm run benchmark:locomo -- --max-questions 80 --top-k 10 --out artifacts/locomo-smoke.json
```

## Metric

The certified runner reports `evidence_recall_at_k`: a question passes when at least one official LoCoMo evidence dialog ID appears in the retrieved top-K memories. `benchmark:certified` now also emits `artifacts/answer-generation.json` unless `--retrieval-only` is passed. That artifact stores per-question prompts, generated extractive answers, retrieved evidence ids, retrieved evidence text, expected terms and judge decisions. Set `MEMORY_BENCHMARK_ANSWERER` or `MEMORY_BENCHMARK_JUDGE` to label an external answerer or judge. Set `MEMORY_BENCHMARK_ANSWERER_COMMAND` and `MEMORY_BENCHMARK_JUDGE_COMMAND` with optional `*_ARGS` to run JSON-command answerer/judge providers; each command receives `{task, prompt, retrievedEvidence, expected}` on stdin and returns `{answer}` or `{score, passed, reason}`.

The query contains only the benchmark question. The runner does not use the ground-truth answer text for query expansion.

## USP Evidence-Pack Benchmark

`npm run benchmark:nextgen` includes `usp-evidence-pack`, a deterministic suite for the product claim that cognibrain is an inspectable Agent Memory OS. It verifies:

- why-used explanations exist for selected context,
- source citations point back to evidence,
- validity windows survive into the exported pack,
- private memories are not included without explicit private retrieval.

This suite is intentionally different from ordinary recall accuracy. It measures whether a retrieved memory can be proved, governed and reused safely.

The same benchmark command also includes `retrieval-calibration`, which checks that search results expose calibrated confidence, weak memories fall below the injection threshold, and unsafe low-confidence memories are excluded from context packs.

## CogniCodeBench

`npm run benchmark:cognicode` measures whether coding agents learn from repo corrections before the next patch. It generates 100 deterministic synthetic repository scenarios across TypeScript/Node, Python/FastAPI, Go, React and monorepo layouts.

The runner stores the first wrong action as `tool_outcome`, records a scoped correction such as `repo_policy`, `architecture_decision`, `dependency_rule`, `generated_file_rule` or `migration_note`, then evaluates the next change through a coding context pack, action guard and patch evidence trail.

Artifacts:

```bash
npm run benchmark:cognicode:generate
npm run benchmark:cognicode
```

Outputs:

- `artifacts/cognicodebench/scenarios.json`
- `artifacts/cognicodebench/run.json`

The pass gate requires at least 100 scenarios, correction carryover >= 0.90, repeated mistake rate <= 0.05, procedure recall >= 0.90, wrong-memory suppression >= 0.90, and a full score above `no_memory`, `raw_chat_history`, `vector_only`, `keyword_only`, `graph_only`, `cognibrain_without_temporal`, and `cognibrain_without_corrections`.

Methodology and scenario schema: [`docs/benchmarks/cognicodebench.md`](benchmarks/cognicodebench.md).

## Official LongMemEval-S Runner

LongMemEval is a long-term memory benchmark released with "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory." The repo uses the public LongMemEval-S cleaned dataset.

Run the benchmark:

```bash
npm run benchmark:longmemeval -- --top-k 20 --out artifacts/longmemeval-report.json
```

Fast development slice:

```bash
npm run benchmark:longmemeval -- --max-questions 60 --top-k 20 --out artifacts/longmemeval-smoke.json
```

The current certified metric is `answer_session_recall_at_k`: a question passes when at least one listed `answer_session_ids` value appears in the retrieved top-K memories. The runner ingests each haystack session through `LongMemEvalUserSimulator` and uses only the benchmark question for retrieval.

## Official BEAM Runner

BEAM is the ICLR 2026 benchmark released with "Beyond a Million Tokens: Benchmarking and Enhancing Long-Term Memory in LLMs." The public Hugging Face dataset contains 100K, 500K, and 1M splits; this repo currently certifies against the 100K and 500K splits.

Run the benchmark:

```bash
npm run benchmark:beam -- --split 100K --top-k 20 --out artifacts/beam-report.json
npm run benchmark:beam:500k
```

Fast development slice:

```bash
npm run benchmark:beam -- --split 100K --max-conversations 2 --max-questions 40 --top-k 20 --out artifacts/beam-smoke.json
```

The current metric is `retrieval_nugget_score_at_k`: a question passes when retrieved memories overlap at least one BEAM ideal-response or rubric nugget by 50% after stopword removal. Abstention questions pass only when retrieved evidence has low overlap with the question. The answer-generation artifact reuses the same per-question BEAM rows and records generated answers plus deterministic nugget/term coverage so answer quality can be tracked separately from retrieval evidence.

## User Simulator

`LocomoUserSimulator` ingests each LoCoMo conversation chronologically:

- creates a participant memory,
- stores each dialogue turn as an episodic memory,
- preserves `sampleId`, `sessionId`, and `diaId` metadata,
- optionally stores LoCoMo session summaries as reflection memories.

This simulates a user interacting with a harness over many sessions instead of loading the whole conversation into a single prompt.

## Baselines

Every certified run compares cognibrain against:

- `vector-only`
- `keyword-only`
- `recency-only`

The pass gate requires cognibrain to beat the best included baseline on the same dataset slice and top-K.

The certified market gate combines the latest LoCoMo, LongMemEval-S, BEAM 100K, and BEAM 500K artifacts when present:

```bash
npm run benchmark:market -- --out artifacts/market-gate.json
```

Direct competitor comparison is opt-in and artifact-driven:

```bash
npm run benchmark:market -- --competitors path/to/competitors.json --out artifacts/market-gate.json
```

The competitor artifact format is documented in `docs/market-comparison.md` and illustrated by `docs/market-claims.sample.json`. Any artifact that sets `comparable:true` must include per-question rows, so the market gate and dashboard can inspect failed or unmatched questions instead of relying on headline scores.

## Production Load Smoke

Local production-readiness runs can generate latency, throughput, connector-sync, dream, and memory-usage proof:

```bash
npm run benchmark:load -- --memories 10000 --concurrent-writes 50 --concurrent-searches 20 --connector-events 20 --out artifacts/load-benchmark-10k-dream.json
npm run benchmark:load -- --memories 100000 --concurrent-writes 100 --concurrent-searches 20 --connector-events 20 --no-dream --out artifacts/load-benchmark-100k.json
NODE_OPTIONS=--max-old-space-size=8192 npm run benchmark:load -- --memories 1000000 --concurrent-writes 200 --concurrent-searches 20 --connector-events 20 --no-dream --out artifacts/load-benchmark-1m.json
```

The artifact reports P50/P95/P99 latency for writes, searches, connector sync, and dream maintenance; write/search/sync throughput; failure count; RSS and heap usage. The default command is intentionally local and deterministic. The 1M local run is a self-hosted process proof; managed-service capacity certification should run the same artifact schema against the target storage backend and deployment profile.

For real PostgreSQL storage proof, run:

```bash
npm run verify:postgres
```

This starts or reuses a local Postgres 16 container, resets the cognibrain schema, applies the remote-driver migrations, verifies the generated `tsvector` plus GIN index, checks cross-user tenant isolation, and writes `artifacts/postgres-live.json`. The 2026-05-24 local run passed with 25 writes, 10 searches, zero failures, migration count `3 -> 3`, and no Bob-search leak of Alice's Atlas memory. This is self-hosted Postgres proof; managed-service capacity certification still belongs to the target deployment.

## Current Market Context

The public market is noisy. Mem0's benchmark suite documents LoCoMo, LongMemEval, and BEAM as benchmark targets, and its public material reports strong LoCoMo and LongMemEval numbers. Other vendors publish their own numbers, often with different answerers, judges, datasets, and retrieval budgets.

For honest open-source comparison, this repo separates:

- retrieval certification on official public data,
- answer-generation artifacts with per-question prompts, generated answers, evidence ids and judge decisions,
- local baseline comparison,
- vendor/public-claim comparison that requires comparable methodology metadata.

Do not claim market leadership from a synthetic suite alone. Use `artifacts/locomo-report.json`, `artifacts/longmemeval-report.json`, `artifacts/beam-report.json`, `artifacts/beam-500k-report.json`, and `artifacts/market-gate.json` as the current certified evidence base.

Run only retrieval certification when you do not want answer artifacts:

```bash
npm run benchmark:certified -- --retrieval-only
```

Generate README market claims from artifacts:

```bash
npm run docs:market-claims
```

## Latest LoCoMo Result

Latest full no-answer-leak run:

```text
cognibrain: 1095/1536 evidence recall@20 = 71.29%
Best included baseline: 981/1536 evidence recall@20 = 63.87%
```

This is a real official-dataset improvement over included baselines. It is not yet a full market-leadership result because public market claims usually use answer-generation accuracy and may use different judges or budgets.

## Latest LongMemEval-S Result

Latest full no-answer-leak run:

```text
cognibrain: 497/500 answer-session recall@20 = 99.40%
Best included baseline: 495/500 answer-session recall@20 = 99.00%
```

The improvement comes from a query-only retrieval selector: lexical recall for ordinary factual questions, semantic retrieval for advice and temporal follow-up questions, and vector retrieval for ordinal list recall. The selector does not use answer text or evidence IDs.

For local production-load proof, `artifacts/load-benchmark-10k-dream.json`, `artifacts/load-benchmark-100k.json`, and `artifacts/load-benchmark-1m.json` cover the planv1 10k/100k/1M matrix. The 2026-05-25 10k run passed with 18 dream actions, zero failures, search p95 `63.92ms`, connector-sync p95 `2.83ms`, RSS `243.80MB`, and heap `95.09MB`. The refreshed 100k run passed with zero failures, write p95 `0.09ms`, search p95 `418.28ms`, connector-sync p95 `22.57ms`, RSS `689.56MB`, and heap `460.14MB`. The 1M run passed with zero failures, write p95 `0.08ms`, search p95 `3908.88ms`, connector-sync p95 `283.05ms`, RSS `2026.81MB`, and heap `3816.85MB`. This is local process proof, not managed-service capacity certification.

## Latest BEAM Result

Latest full 100K split no-answer-leak run:

```text
cognibrain: 386/400 retrieval nugget score@20 = 96.50%
Best included baseline: 328/400 retrieval nugget score@20 = 82.00%
```

Per-ability result:

```text
abstention: 40/40
contradiction_resolution: 40/40
event_ordering: 40/40
information_extraction: 37/40
instruction_following: 38/40
knowledge_update: 36/40
multi_session_reasoning: 37/40
preference_following: 39/40
summarization: 40/40
temporal_reasoning: 39/40
```

Latest full 500K split no-answer-leak run:

```text
cognibrain: 683/700 retrieval nugget score@20 = 97.57%
Best included baseline: 554/700 retrieval nugget score@20 = 79.14%
```

Per-ability 500K result:

```text
abstention: 70/70
contradiction_resolution: 70/70
event_ordering: 70/70
information_extraction: 65/70
instruction_following: 70/70
knowledge_update: 69/70
multi_session_reasoning: 65/70
preference_following: 69/70
summarization: 70/70
temporal_reasoning: 65/70
```

The largest remaining BEAM weaknesses are information extraction, temporal reasoning, and multi-session reasoning. Abstention uses a query-only no-evidence policy for requests that ask for absent specific details instead of stuffing near-topic memories into the answer context; contextual neighbor expansion plus stricter no-evidence handling raised the total 500K run from `615/700` to `683/700`.

## Latest Certified Market Gate

Latest combined artifact: `artifacts/market-gate.json`

```text
LoCoMo: +7.42 percentage points over best included baseline
LongMemEval-S: +0.40 percentage points over best included baseline
BEAM 100K: +14.50 percentage points over best included baseline
BEAM 500K: +18.43 percentage points over best included baseline
```

This is certified public benchmark baseline superiority. It is not a direct commercial-vendor result unless comparable vendor artifacts are imported and evaluated with the same metric, top-K, and budget.

When a competitor artifact is supplied, inspect `directMarketComparison` in `artifacts/market-gate.json`. The direct market comparison passes only when every imported comparable result is beaten. `docs/public-market-claims.json` contains public BEAM claims recorded on 2026-05-22 that can be checked with:

```bash
npm run benchmark:market -- --competitors docs/public-market-claims.json --out artifacts/market-gate-public.json
```

## Sources

- LoCoMo official repo: https://github.com/snap-research/locomo
- LoCoMo paper: https://arxiv.org/abs/2402.17753
- Mem0 memory benchmark suite: https://github.com/mem0ai/memory-benchmarks
- LongMemEval paper: https://arxiv.org/abs/2410.10813
- LongMemEval-S dataset: https://huggingface.co/datasets/LIXINYI33/longmemeval-s
- BEAM official repo: https://github.com/mohammadtavakoli78/BEAM
- BEAM paper: https://arxiv.org/abs/2510.27246
- BEAM dataset: https://huggingface.co/datasets/Mohammadta/BEAM
