# Advanced Features

## Multi-Signal Retrieval

Retrieval combines semantic token overlap, keyword coverage, entity matches, temporal decay, trust, and graph reachability. Entity extraction is zero-dependency: every write links proper nouns, paths, quoted phrases, and lowercase compound terms such as `operator gate` or `dream cycle`. Query-time entity matching boosts exact compound phrases without letting random transcript words become graph edges, so the graph stays useful without requiring an external graph database.

Benchmark runners use the same principle: lexical anchors keep factual recall stable, while fused retrieval reserves part of the top-K for graph and semantic hits that keyword-only ranking would otherwise block.

A result must have actual relevance evidence; trust and recency alone cannot inject unrelated memories.

## Trust and Provenance

Each memory carries a source kind and confidence. Human and reviewed-code sources start with higher trust than agent or transcript sources. Search results include citations and stale flags so harnesses can decide how much context to inject.

## Reflection

`ReflectionEngine` runs the maintenance loop. In product language this is the dream cycle: the system rethinks stored memories, reevaluates evidence quality, summarizes repeated themes, fades stale low-utility memories, reflects contradictions, and reorganizes memories into better layers.

The cycle returns a `lifecycle` report with:

- `evaluated`: active memories inspected,
- `summarized`: new reflection memories created,
- `faded`: stale low-utility memories whose trust or importance was lowered,
- `archived`: stale memories removed from active retrieval,
- `reorganized`: memories moved into a better layer or type,
- `qualityScore`: remaining memory-store quality from `0` to `1`,
- `issues` and `actions`: audit text for dashboards and logs.

Pinned memories are never faded or archived. Reflection summaries include `summaryOf` provenance in metadata so a user can audit where a dream came from.

## Self-Verification

`npm run eval` runs a synthetic benchmark with single-hop, multi-hop, temporal correction, contradiction, and abstention cases. It compares cognibrain against vector-only, keyword-only, and recency-only baselines and writes `artifacts/evaluation-report.json`.

## Dashboard

The dashboard is the local operator UI for the API-backed memory platform. It shows the platform runtime, operator gate, ranked evidence, trust meters, automatic dream status, reflection controls, and benchmark proof.
