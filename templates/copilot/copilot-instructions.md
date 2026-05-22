# cognibrain Instructions

This repository uses cognibrain for durable agent memory.

- Use `./bin/cognibrain.mjs start` to start the local API and dashboard, `./bin/cognibrain.mjs status` to inspect them, and `./bin/cognibrain.mjs stop` to stop them.
- Prefer current files and tests over memories when they conflict.
- For benchmark work, use `npm run benchmark:certified` and cite `artifacts/locomo-report.json`.
- For local verification, use `npm run verify`.
- If an MCP-capable Copilot environment is available, use the cognibrain tools:
  - `memory_context_pack` before long-running work,
  - `memory_add` after durable discoveries,
  - `memory_maintenance_status` to inspect automatic dream state,
  - `memory_dream` after major sessions, imports, handoff, or contradictions.
- Keep memory updates scoped, source-backed, and privacy-aware.
