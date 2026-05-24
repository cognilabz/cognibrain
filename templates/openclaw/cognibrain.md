# cognibrain for OpenClaw

Use cognibrain for durable, inspectable context across OpenClaw sessions.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`.
- Use `.openclaw/mcp.json` to expose the `cognibrain` MCP server.
- Query `memory_context_pack` before long-running workflows.

Feed successful or rejected actions back through the shared telemetry endpoint:

```bash
MEMORY_HARNESS_ID=openclaw ./bin/cognibrain.mjs memory connector-telemetry official-code context_pack_feedback "OpenClaw context feedback"
```

Keep private memories private unless an explicit shared-memory review approves promotion.
