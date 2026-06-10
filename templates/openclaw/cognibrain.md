# cognibrain for OpenClaw

Use cognibrain for durable, inspectable context across OpenClaw sessions before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Use CLI lifecycle commands as the default integration path.
- Run `./bin/cognibrain.mjs context --task "<task>" --json` before non-trivial workflows.
- Run `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands or file edits with durable side effects.

Feed successful or rejected actions back through the shared telemetry endpoint:

```bash
MEMORY_HARNESS_ID=openclaw ./bin/cognibrain.mjs memory connector-telemetry official-code context_pack_feedback "OpenClaw context feedback"
```

Keep private memories private unless an explicit shared-memory review approves promotion.
Finish non-trivial patches with `./bin/cognibrain.mjs patch-evidence --task "<task>" --json`.
