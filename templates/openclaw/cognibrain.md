# cognibrain for OpenClaw

Use cognibrain for durable, inspectable context across OpenClaw sessions.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Use `.openclaw/mcp.json` to expose the `cognibrain` MCP server.
- Query `memory_context_pack` before long-running workflows, or `memory_coding_context_pack` when the host exposes it.
- Call `memory_action_guard` before shell commands or file edits with durable side effects when available.

Feed successful or rejected actions back through the shared telemetry endpoint:

```bash
MEMORY_HARNESS_ID=openclaw ./bin/cognibrain.mjs memory connector-telemetry official-code context_pack_feedback "OpenClaw context feedback"
```

Keep private memories private unless an explicit shared-memory review approves promotion.
Finish non-trivial patches with `memory_patch_evidence`.
