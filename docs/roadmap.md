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
- One-command connector installer surface through `cognibrain-connect`
- Pluggable persistence with atomic JSON snapshots and append-only JSONL durable audit mode
- SQLite transactional persistence with append-only SQL event table and JSON-to-SQL migration coverage
- Postgres-compatible and Cockroach-compatible SQL persistence contracts with append-only event rows, logical replication metadata, and JSON/SQL migration coverage
- Cassandra-compatible wide-column storage is implemented for CI/package validation with partition keys, clustering keys, quorum metadata and range-sharding capability reporting
- psql-backed Postgres/Cockroach remote driver and cqlsh-backed Cassandra remote driver capability paths
- Next-generation epics and sub-issues mirrored from `nextplan.md`
- Graph path search, spreading activation, safe graph query, GraphML/JSON export, and configurable inferred relation substrate
- Temporal interval queries, behavioural retrieval scoring, recurring behavioural pattern mining, and persisted timeline summaries
- Staged extraction reports, provider extractor fallback, media/language envelopes, enrichment candidates, and entity merge/split operations
- Brain/source/agent/persona primitives with audit events, webhook queues, marketplace modules, and compliance reports
- Packaged connector setup for Claude Code, OpenAI Codex, Cursor, GitHub Copilot, VS Code, OpenCode, OpenClaw, LangGraph, and CrewAI
- Connector telemetry for accepted/rejected suggestions, context-pack feedback, and tool outcomes
- Domain modules for coding, research, legal, sales, support, finance, healthcare, security, and strict privacy
- Dashboard artifact inspector with per-question benchmark row summaries
- `verify:nextgen` self-test loop for graph, inference, temporal/pattern, extraction/enrichment, multi-tenant audit, webhook, compliance, and marketplace behavior
- Deterministic answer-generation artifact runner over benchmark reports, used to keep answer artifacts separate from retrieval metrics

## Production Gates

1. `npm run verify:nextgen` must pass.
2. `npm run doctor:publish` must pass without warnings after `setup --all-harnesses`.
3. Dashboard proof, recall, graph, timeline, dream, marketplace, and artifact-inspector flows must render in a live browser.
4. Public claims must link to generated artifacts with comparable methodology and per-question rows.
5. One-command setup must generate connector packages for every harness named in `nextplan.md`.

## Completion Bar

The repo should not claim broad market leadership until it can reproduce or import public benchmark claims with comparable methodology:

- same dataset,
- same question set,
- same answerer and judge or clearly separated retrieval-only metric,
- same top-K or token budget,
- published artifact with per-question results.

The public BEAM landscape gate clears this bar for the normalized 2026-05-22 public BEAM headline claims in `docs/public-market-claims.json`. Direct vendor comparisons require either imported vendor-signed artifacts or local reruns with the same public question rows, answerer, judge, top-K, and token budget.
