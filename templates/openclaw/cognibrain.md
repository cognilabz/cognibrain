# cognibrain for OpenClaw

Use cognibrain for durable, inspectable context across OpenClaw sessions before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Use CLI lifecycle commands as the default integration path.
- Actively run `./bin/cognibrain.mjs context --task "<task>" --app openclaw --agent openclaw --json` before non-trivial workflows; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as OpenClaw's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Run `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands or file edits with durable side effects.

Feed successful or rejected actions back through the shared telemetry endpoint:

```bash
MEMORY_HARNESS_ID=openclaw ./bin/cognibrain.mjs memory connector-telemetry official-code context_pack_feedback "OpenClaw context feedback"
```

Keep private memories private unless an explicit shared-memory review approves promotion.
Finish non-trivial patches with `./bin/cognibrain.mjs patch-evidence --task "<task>" --json`.
