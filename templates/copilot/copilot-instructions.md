# cognibrain Instructions

This repository uses cognibrain for durable agent memory.

- Use `./bin/cognibrain.mjs start` to start the local API, `./bin/cognibrain.mjs status` to inspect it, and `./bin/cognibrain.mjs stop` to stop it. Add `--dashboard` only when a browser dashboard is needed.
- Prefer current files and tests over memories when they conflict.
- For benchmark work, use `npm run benchmark:certified` and cite `artifacts/locomo-report.json`.
- For local verification, use `npm run verify`.
- If an MCP-capable Copilot environment is available, use the cognibrain tools:
  - `memory_context_pack` before long-running work,
  - `memory_coding_context_pack` for code-specific context when exposed,
  - `memory_action_guard` before shell commands or file edits with durable side effects,
  - `memory_add` after durable discoveries,
  - `memory_patch_evidence` after non-trivial patches,
  - `memory_maintenance_status` to inspect automatic dream state,
  - `memory_dream` after major sessions, imports, handoff, or contradictions.
- Keep memory updates scoped, source-backed, and privacy-aware.
