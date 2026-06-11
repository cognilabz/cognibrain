# cognibrain Instructions

This repository uses cognibrain for durable agent memory. Use it before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

- Use `./bin/cognibrain.mjs start` to start the local API, `./bin/cognibrain.mjs status` to inspect it, and `./bin/cognibrain.mjs stop` to stop it. Add `--dashboard` only when a browser dashboard is needed.
- Prefer current files and tests over memories when they conflict.
- For benchmark work, use `npm run internal -- benchmark:certified` and cite the generated artifact under `artifacts/`.
- For local verification, use `npm run verify`.
- Use the CLI lifecycle as the default agent path:
  - `./bin/cognibrain.mjs context --task "<task>" --app copilot --agent copilot --json` before non-trivial work,
  - `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands or file edits with durable side effects,
  - `./bin/cognibrain.mjs outcome --command "<command>" --exit-code <code> --json` after important tool results,
  - `./bin/cognibrain.mjs patch-evidence --task "<task>" --json` after non-trivial patches.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`; do not rely only on the top-level context string.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Copilot's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- If an MCP-capable Copilot environment is available, use MCP tools only as optional adapters for the same lifecycle.
- Keep memory updates scoped, source-backed, and privacy-aware.
