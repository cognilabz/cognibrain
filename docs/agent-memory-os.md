# Agent Memory OS

cognibrain is positioned as an inspectable Agent Memory OS, not just a vector store or chat-history cache.

The operating-system boundary is the context pack. A harness asks a question, cognibrain routes memory by scope, retrieves candidate facts, verifies consent and lifecycle state, and returns an evidence pack that explains why each memory was allowed into context.

## Core Claim

Memory you can prove, route, govern, and reuse across every agent.

## Product Contract

Every context pack should answer these questions:

- What memory was selected?
- Why was it selected?
- Which source and citation support it?
- Is it valid now?
- Is it stale, contradicted, private, or needs review?
- Which graph path or retrieval signal made it relevant?
- Which user, project, app, brain, source, agent, or org scope allowed it?

The canonical stored object is MemoryRecordV2. It is add-only compatible with older memories and includes `schemaVersion:"2.0"`, scope, source, consent, trust, confidence, importance, validity metadata, belief state, relations, provenance citations and an audit trail.

## First Five Minutes Demo

1. Add or seed memories with source, trust, consent, entities and validity metadata.
2. Run a why-used query:

```bash
./bin/cognibrain.mjs memory why-used "Why should Atlas run tests before release?"
```

3. Inspect the returned evidence pack:

- `context` is the compact block safe for agent injection.
- `results[].retrieval.signals` shows semantic, keyword, entity, temporal, behavioural, trust, graph and access signals.
- `results[].retrieval.explanation` shows the strongest reason phrases.
- `results[].retrieval.graphPaths` shows graph path evidence when available.
- `results[].validity` shows event time, validity window, confirmation and stale state.
- `results[].consent` and `results[].scope` show why the memory may be used.

4. Run the USP benchmark:

```bash
npm run benchmark:nextgen -- --out artifacts/nextgen-benchmarks.json
```

The `usp-evidence-pack` suite verifies why-used explanations, source citation correctness, temporal validity and consent-boundary enforcement.

## Comparison Lens

| Market pattern | Common gap | cognibrain answer |
| --- | --- | --- |
| Drop-in memory API | Hard to inspect why a fact entered context | Evidence packs explain score signals, citations, graph paths and lifecycle state |
| Personal markdown brain | Strong ownership, weaker team/runtime integration | Brains, sources, agents, personas, API, MCP, CLI and dashboard share one runtime |
| Temporal graph memory | Time-aware, but often product-specific | Validity metadata is available in CLI/API/MCP evidence output |
| Graph/vector control plane | Hybrid retrieval without context-governance story | Consent, audit, retention, marketplace, storage and benchmark surfaces are part of the product |

## Implementation Surfaces

- CLI: `memory route`, `memory intent`, `memory why-used`, `memory evidence-pack`
- HTTP: `POST /route`, `POST /intent`, `POST /evidence-pack`
- MCP: `memory_context_pack` returns `evidencePack`
- Benchmarks: `usp-evidence-pack` in `benchmark:nextgen`
- Dashboard: Recall QA shows context pack preview and per-result retrieval signals
- Graph: `/graph/explain` and `memory explain A B` show time-aware connection paths with evidence ids and validity windows
- Episodes: `/episodes` and `memory episodes` preserve raw extraction context and link derived facts back to ground truth
- Actions: `/actions` and `memory action` store commands, changed files, test outcomes, PRs and fixed errors as first-class episodic memory
- Verification: `/verification/:userId`, `memory verify`, `memory confirm`, and `memory retract` make dream-time belief revision actionable
