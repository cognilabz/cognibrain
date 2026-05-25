# Integration Guide

cognibrain exposes four integration surfaces:

- HTTP API from `src/api/server.ts`
- CLI from `bin/cognibrain.mjs`
- Harness hook from `src/connectors/harnessHook.ts`
- MCP stdio server from `src/connectors/mcpServer.ts`

## Harness Hook

```ts
import { MemoryStore, RetrievalEngine } from "./src/core";
import { HarnessMemoryHook } from "./src/connectors/harnessHook";

const store = new MemoryStore();
const retrieval = new RetrievalEngine(store);

const hook = new HarnessMemoryHook({
  add: store.add.bind(store),
  search: ({ userId, agentId, query, limit }) =>
    retrieval.search({ userId, agentId, query, limit })
});

const prepared = hook.beforeLlmCall({
  userId: "dev",
  agentId: "codex",
  prompt: "How should we validate parity?"
});

console.log(prepared.memoryContext);
hook.afterLlmCall(prepared, "Run simulator, browser, and backend checks.");
```

## CLI

```bash
./bin/cognibrain.mjs memory add "Codex prefers compact memory citations"
./bin/cognibrain.mjs memory search "citation preference"
./bin/cognibrain.mjs memory reflect
./bin/cognibrain.mjs memory dream
./bin/cognibrain.mjs memory health
```

## MCP

Run a local stdio MCP server:

```bash
./bin/cognibrain.mjs mcp
```

Register that command in any MCP-capable harness. The server exposes:

- `memory_add`
- `memory_search`
- `memory_context_pack`
- `memory_list`
- `memory_reflect`
- `memory_dream`
- `memory_health`

Use `memory_context_pack` before long-running agent work and `memory_add` after durable discoveries. Run `memory_dream` before handoff, release, or any long idle period so the store can summarize, fade, reevaluate, and reorganize itself.

## Local Services

```bash
./bin/cognibrain.mjs start   # API, with open-port probing
./bin/cognibrain.mjs         # CLI home for runtime, memories, connections and config
./bin/cognibrain.mjs status
./bin/cognibrain.mjs dashboard   # optional browser dashboard
./bin/cognibrain.mjs stop
npm run verify               # tests + evaluation + build
```

## Evidence Review

Run the certified benchmark loop:

```bash
npm run benchmark:certified
```

Inspect the generated artifacts:

- `artifacts/locomo-report.json`
- `artifacts/longmemeval-report.json`
- `artifacts/beam-report.json`
- `artifacts/beam-500k-report.json`
- `artifacts/market-gate.json`

Use the CLI for daily local operation. Start the optional dashboard only when you want the Certified Benchmark Evidence browser section to review current scores, BEAM ability coverage, and pasted JSON artifacts:

```bash
./bin/cognibrain.mjs dashboard
```

The dashboard is intentionally read-only for benchmark files. Paste a report JSON into Artifact Inspector when reviewing a local run, CI artifact, or external competitor artifact.
