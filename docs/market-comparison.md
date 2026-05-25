# Market Comparison

## What Is Proven Now

The current repo proves certified public benchmark baseline superiority:

- LoCoMo evidence recall@20 beats the best included local baseline.
- LongMemEval-S answer-session recall@20 beats the best included local baseline.
- BEAM 100K and 500K retrieval nugget score@20 beat the best included local baseline.
- BEAM 100K reaches `96.50%`, which is above the Graphonomous BEAM 100K public claim of `95.0%` recorded in `docs/public-market-claims.json` on 2026-05-22; BEAM 500K reaches `97.57%`, above the recorded Graphonomous `96.9%` and Hindsight `71.1%` claims for that tier.
- `npm run benchmark:market` writes a combined machine-readable artifact to `artifacts/market-gate.json`.
- `docs/public-market-claims.json` normalizes the public BEAM claims recorded on 2026-05-22 so the direct comparison can be re-run into `artifacts/market-gate-public.json`.

This is stronger than a synthetic demo because the certified runners use public benchmark datasets and user simulators that ingest sessions chronologically.

The current repo also proves a category-specific Engineering Memory OS loop through CogniCodeBench. That artifact is intentionally synthetic: it measures whether coding-agent corrections, review feedback, commands, tool outcomes, generated-file rules, and codebase migrations carry into the next patch. It should be compared with other coding-agent memory systems only when they run the same scenario schema and report the same correction carryover, repeated mistake, procedure recall, evidence, and stale-rule metrics.

## Proof Boundary

Direct market leadership is only claimed against artifacts that use comparable methodology. Many public vendor claims report answer-generation accuracy, LLM-as-judge scores, different retrieval budgets, or proprietary evaluation settings. Those are useful landscape signals, while this repo keeps retrieval-first metrics, deterministic answer-generation artifacts, and public-claim comparisons separated.

## Competitor Artifact Format

Use `docs/market-claims.sample.json` as the canonical schema shape. The importer also accepts simple row arrays or `results`/`benchmarks` arrays from vendor benchmark exports and normalizes fields such as `provider`, `system`, `score`, `recall`, `top_k`, and `mean_tokens`. A competitor result can be used for a direct gate only when all of these are true:

- same dataset,
- same metric,
- same top-K or token budget,
- no answer leakage,
- enough per-run metadata and per-question rows to audit the result,
- `comparable` is set to `true`.

Run the direct-import gate:

```bash
npm run benchmark:market -- --competitors path/to/competitors.json --out artifacts/market-gate.json
```

The `directMarketComparison` section reports whether imported comparable results were beaten. If no comparable competitor artifact is present, the repo reports certified public benchmark baseline superiority plus the bundled public-claim comparison level.

Run the bundled public landscape gate:

```bash
npm run benchmark:market -- --competitors docs/public-market-claims.json --out artifacts/market-gate-public.json
```

This gate imports public BEAM claims from Graphonomous and Hindsight as recorded in `docs/public-market-claims.json`. It is reproducible and is described as a public-claim comparison rather than a vendor-signed rerun.

## Current Public Landscape

Public market material should be treated as research context until normalized into the artifact format above.

- Letta's strongest product idea is a memory hierarchy: always-visible memory blocks for stable state and on-demand archival memory for long-term semantic search. cognibrain should keep its context packs compact like memory blocks while persisting the larger store outside prompt context.
- Zep and Graphiti make temporal knowledge graphs the center of memory, especially for changing relationships and historical context. cognibrain has typed relation edges, validity windows, graph path search, spreading activation, graph export, and connection explanation in the local runtime; vendor-comparable temporal graph artifacts are handled by the same import gate used for all external claims.
- GBrain is strongest as a personal-brain and markdown-ownership workflow with backlinks and operator-curated knowledge. cognibrain is positioned differently: API-first Engineering Memory OS, multi-agent/team scopes, policy-aware context injection, connector writeback, and benchmark artifacts that test whether coding agents actually apply corrections in later patches.
- Mem0's current open-source direction emphasizes ADD-only extraction, hybrid search, and built-in entity linking instead of a separate graph-store dependency. cognibrain now follows that lesson locally by extracting proper nouns, paths, quoted phrases, and lowercase compound entities on every write.
- LangGraph and LangMem frame long-term memory as semantic, episodic, and procedural state with stores and background consolidation. cognibrain now matches that shape with layers, CLI/API persistence, and automatic dream maintenance.
- Generative Agents and A-MEM point to the same behavioral lesson: memory should not be an append-only vector pile. It should retrieve by multiple signals, periodically reflect, and evolve links or summaries as new evidence arrives.
- Mem0 publishes a benchmark repository covering LoCoMo, LongMemEval, and BEAM, and its public research page reports LoCoMo, LongMemEval, and BEAM scores for its token-efficient memory algorithm.
- Mem0's docs also state that some published managed-platform scores include proprietary optimizations, which makes OSS-vs-managed comparisons non-trivial.
- Zep publishes memory benchmark claims around temporal knowledge graphs and LongMemEval, but methodology and metric details need normalization before direct comparison.
- Hindsight reports BEAM scores across 100K, 500K, 1M, and 10M tiers, including 500K `71.1%`; `docs/public-market-claims.json` records Graphonomous BEAM 100K `95.0%` and BEAM 500K `96.9%` as of 2026-05-22.
- Several third-party market pages and community posts report competing LoCoMo/LongMemEval numbers, but many mix answer generation, retrieval, judge quality, long-context baselines, and different budgets.

## Evidence Work Implemented From The Market Plan

1. Vendor-comparable import artifacts require per-question rows with matching dataset, metric, answerer/judge, top-K or token budget.
2. Deterministic answer-generation artifacts can be rerun with external JSON-command answerer/judge commands while keeping retrieval-only and answer-generation claims separated.
3. BEAM, LoCoMo, LongMemEval, nextgen, USP, answer-generation, and market-gate artifacts publish per-question details.
4. Generic vendor artifact adapters normalize per-question rows for imported competitor claims.
5. The dashboard artifact inspector summarizes failed benchmark rows without requiring raw JSON inspection.
6. Native harness packages can send accepted/rejected suggestions, context-pack feedback, and tool outcomes through `/connectors/telemetry`.
7. Production remote database paths include psql-backed Postgres/Cockroach and cqlsh-backed Cassandra drivers behind the persistence boundary.
8. External enrichment is productized through enrichment candidates, explicit approval, `/entities/enrich`, CLI `entity-enrich`, and provider extractor hooks.

## Sources

- Mem0 benchmark repository: https://github.com/mem0ai/memory-benchmarks
- Mem0 research page: https://mem0.ai/research-3
- Mem0 v3 memory algorithm migration: https://docs.mem0.ai/migration/oss-v2-to-v3
- Zep benchmark page: https://www.getzep.com/ai-memory/benchmark
- Zep Graph Overview: https://help.getzep.com/v2/understanding-the-graph
- Graphiti docs: https://docs.falkordb.com/agentic-memory/graphiti.html
- Letta memory blocks: https://docs.letta.com/guides/agents/memory-blocks/
- Letta archival memory: https://docs.letta.com/guides/agents/archival-memory
- LangGraph Deep Agents memory: https://docs.langchain.com/oss/javascript/deepagents/long-term-memory
- LangMem concepts: https://langchain-ai.github.io/langmem/concepts/conceptual_guide/
- Generative Agents paper: https://arxiv.org/abs/2304.03442
- A-MEM paper: https://arxiv.org/abs/2502.12110
- Hindsight BEAM results: https://hindsight.vectorize.io/blog/2026/04/02/beam-sota
- Hindsight benchmark dashboard: https://benchmarks.hindsight.vectorize.io/
- Graphonomous BEAM benchmark: https://graphonomous.com/benchmarks/beam
- BEAM official repo: https://github.com/mohammadtavakoli78/BEAM
- BEAM dataset: https://huggingface.co/datasets/Mohammadta/BEAM
- BEAM paper: https://arxiv.org/abs/2510.27246
- LongMemEval paper: https://arxiv.org/abs/2410.10813
- LoCoMo paper: https://arxiv.org/abs/2402.17753
