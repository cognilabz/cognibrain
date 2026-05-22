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

## Next

1. Full answer-generation benchmark layer for LoCoMo.
2. Full answer-generation benchmark layer for LongMemEval.
3. Full answer-generation benchmark layer for BEAM.
4. Improve remaining BEAM information extraction, temporal reasoning, and multi-session misses.
5. Improve LoCoMo category 3 multi-hop evidence recall.
6. Import format adapters for directly comparable vendor artifacts.
7. Streamable HTTP MCP server for remote/shared deployments.
8. Durable storage backend.
9. Configurable retrieval weights.
10. Dashboard result browser for benchmark artifacts.
11. Connector packages for Claude Code, Codex, Copilot, and Cursor.

## Completion Bar

The repo should not claim broad market leadership until it can reproduce or import public benchmark claims with comparable methodology:

- same dataset,
- same question set,
- same answerer and judge or clearly separated retrieval-only metric,
- same top-K or token budget,
- published artifact with per-question results.

The public BEAM landscape gate clears this bar for the normalized 2026-05-22 public BEAM headline claims in `docs/public-market-claims.json`, but a stronger commercial audit still needs vendor-signed artifacts or local reruns with per-question outputs.
