# cognibrain for OpenCode

Use cognibrain as the durable Agent Memory OS for this workspace.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`.
- Check health with `./bin/cognibrain.mjs status`.
- Use the generated `.opencode/mcp.json` server named `cognibrain`.

Before multi-step coding, request a context pack for the current task. Treat memory as evidence: verify current files, tests, and source systems before acting on stale facts.

After useful tool outcomes, send telemetry:

```bash
MEMORY_HARNESS_ID=opencode MEMORY_COMMAND="<command>" ./bin/cognibrain.mjs memory connector-telemetry official-code tool_outcome "OpenCode tool outcome"
```

After durable project discoveries, add a source-backed memory with tags and confidence.
