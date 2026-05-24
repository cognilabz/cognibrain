# Roadmap

## Done

- TypeScript core engine
- HTTP API
- CLI
- React dashboard
- Generic harness hook
- Stdio MCP server
- Local synthetic verification suite
- Official LoCoMo evidence-recall runner
- Official LongMemEval-S answer-session recall runner
- Official BEAM 100K and 500K retrieval-nugget runner
- Combined certified market gate for public benchmark baseline superiority
- Public BEAM market-claim artifact for reproducible same-benchmark landscape comparison
- Public documentation for setup, API, integration, configuration, connectors, and benchmarks
- JSON-command provider adapter for reranking, verification, contradiction classification, and reflection summaries
- Config-file retrieval profiles plus feedback/training-sample learning
- Canonical entity registry, typed graph report, encrypted sensitive-memory mode, and dashboard tuning controls
- Streamable HTTP MCP server mode for remote/shared clients
- Pluggable persistence with atomic JSON snapshots and append-only JSONL durable audit mode
- Next-generation epics and sub-issues mirrored from `nextplan.md`
- Graph path search, spreading activation, safe graph query, GraphML/JSON export, and configurable inferred relation substrate
- Temporal interval queries, behavioural retrieval scoring, recurring behavioural pattern mining, and persisted timeline summaries
- Staged extraction reports, provider extractor fallback, media/language envelopes, enrichment candidates, and entity merge/split operations
- Brain/source/agent/persona primitives with audit events, webhook queues, marketplace modules, and compliance reports
- `verify:nextgen` self-test loop for graph, inference, temporal/pattern, extraction/enrichment, multi-tenant audit, webhook, compliance, and marketplace behavior

## Next

1. Complete the linked next-generation sub-issues under epics #26-#38.
2. Full answer-generation benchmark layer for LoCoMo.
3. Full answer-generation benchmark layer for LongMemEval.
4. Full answer-generation benchmark layer for BEAM.
5. Improve remaining BEAM information extraction, temporal reasoning, and multi-session misses.
6. Improve LoCoMo category 3 multi-hop evidence recall.
7. Import more directly comparable vendor artifacts and normalize per-question outputs.
8. SQLite and Postgres adapters behind the persistence boundary.
9. Dashboard result browser for historical benchmark artifacts.
10. Connector packages for Claude Code, Codex, Copilot, and Cursor.

## Completion Bar

The repo should not claim broad market leadership until it can reproduce or import public benchmark claims with comparable methodology:

- same dataset,
- same question set,
- same answerer and judge or clearly separated retrieval-only metric,
- same top-K or token budget,
- published artifact with per-question results.

The public BEAM landscape gate clears this bar for the normalized 2026-05-22 public BEAM headline claims in `docs/public-market-claims.json`, but a stronger commercial audit still needs vendor-signed artifacts or local reruns with per-question outputs.
