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

## What Is Not Proven Yet

Direct market leadership is strongest when competitor results are imported with comparable methodology. Many public vendor claims report answer-generation accuracy, LLM-as-judge scores, different retrieval budgets, or proprietary evaluation settings. Those are useful landscape signals, but they are not apples-to-apples proof against this repo's current retrieval-only metrics.

## Competitor Artifact Format

Use `docs/market-claims.sample.json` as the schema shape. A competitor result can be used for a direct gate only when all of these are true:

- same dataset,
- same metric,
- same top-K or token budget,
- no answer leakage,
- enough per-run metadata to audit the result,
- `comparable` is set to `true`.

Run the direct-import gate:

```bash
npm run benchmark:market -- --competitors path/to/competitors.json --out artifacts/market-gate.json
```

The `directMarketComparison` section will report whether imported comparable results were beaten. If no comparable competitor artifact is present, the repo must keep the proof level at certified public benchmark baseline superiority.

Run the bundled public landscape gate:

```bash
npm run benchmark:market -- --competitors docs/public-market-claims.json --out artifacts/market-gate-public.json
```

This gate imports public BEAM claims from Graphonomous and Hindsight as recorded in `docs/public-market-claims.json`. It is reproducible, but it should still be described as a public-claim comparison rather than a vendor-signed rerun.

## Current Public Landscape

Public market material should be treated as research context until normalized into the artifact format above.

- Letta's strongest product idea is a memory hierarchy: always-visible memory blocks for stable state and on-demand archival memory for long-term semantic search. cognibrain should keep its context packs compact like memory blocks while persisting the larger store outside prompt context.
- Zep and Graphiti make temporal knowledge graphs the center of memory, especially for changing relationships and historical context. cognibrain already uses entity and graph signals in retrieval; the next step is explicit edge storage with validity windows.
- Mem0's graph memory layers nodes and edges next to embeddings so retrieval can stitch people, places, and events together. cognibrain should keep its local-first provenance model but add a write-time entity-link evolution pass.
- LangGraph and LangMem frame long-term memory as semantic, episodic, and procedural state with stores and background consolidation. cognibrain now matches that shape with layers, CLI/API persistence, and automatic dream maintenance.
- Generative Agents and A-MEM point to the same behavioral lesson: memory should not be an append-only vector pile. It should retrieve by multiple signals, periodically reflect, and evolve links or summaries as new evidence arrives.
- Mem0 publishes a benchmark repository covering LoCoMo, LongMemEval, and BEAM, and its public research page reports LoCoMo, LongMemEval, and BEAM scores for its token-efficient memory algorithm.
- Mem0's docs also state that some published managed-platform scores include proprietary optimizations, which makes OSS-vs-managed comparisons non-trivial.
- Zep publishes memory benchmark claims around temporal knowledge graphs and LongMemEval, but methodology and metric details need normalization before direct comparison.
- Hindsight reports BEAM scores across 100K, 500K, 1M, and 10M tiers, including 500K `71.1%`; `docs/public-market-claims.json` records Graphonomous BEAM 100K `95.0%` and BEAM 500K `96.9%` as of 2026-05-22.
- Several third-party market pages and community posts report competing LoCoMo/LongMemEval numbers, but many mix answer generation, retrieval, judge quality, long-context baselines, and different budgets.

## Next Evidence Work

1. Add explicit graph edges with temporal validity and contradiction supersession.
2. Add a write-time note evolution pass that updates tags, entities, and links on related memories.
3. Add full answer-generation evaluators for LoCoMo, LongMemEval, and BEAM.
4. Improve remaining BEAM information extraction, temporal reasoning, and multi-session misses.
5. Import vendor artifacts or local vendor reruns only when their dataset, metric, and budget match.
6. Add an adapter for Mem0's open benchmark repository output so local comparable runs can be imported directly.
7. Keep retrieval-only and answer-generation claims separate in every artifact and document.
8. Add a result browser in the dashboard so every failed question can be inspected.

## Sources

- Mem0 benchmark repository: https://github.com/mem0ai/memory-benchmarks
- Mem0 research page: https://mem0.ai/research-3
- Mem0 Graph Memory docs: https://docs.mem0.ai/open-source/features/graph-memory
- Zep benchmark page: https://www.getzep.com/ai-memory/benchmark
- Zep Graph Overview: https://help.getzep.com/groups
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
