# cognibrain Instructions

This repository uses cognibrain for durable agent memory.

- Use `./bin/cognibrain.mjs start` to start the local API, `./bin/cognibrain.mjs status` to inspect it, and `./bin/cognibrain.mjs stop` to stop it. Add `--dashboard` only when a browser dashboard is needed.
- Prefer current files and tests over memories when they conflict.
- For benchmark work, use `npm run internal -- benchmark:certified` and cite the generated artifact under `artifacts/`.
- For local verification, use `npm run verify`.
- Use the CLI lifecycle as the default agent path:
  - `./bin/cognibrain.mjs context --task "<task>" --json` before long-running work,
  - `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands or file edits with durable side effects,
  - `./bin/cognibrain.mjs outcome --command "<command>" --exit-code <code> --json` after important tool results,
  - `./bin/cognibrain.mjs patch-evidence --task "<task>" --json` after non-trivial patches.
- If an MCP-capable Copilot environment is available, use MCP tools only as optional adapters for the same lifecycle.
- Keep memory updates scoped, source-backed, and privacy-aware.
