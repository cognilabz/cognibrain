# cognibrain for OpenCode

Use cognibrain as the durable Agent Memory OS for this workspace.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Check health with `./bin/cognibrain.mjs status`.
- Use the generated `.opencode/mcp.json` server named `cognibrain`.

Before multi-step coding, request `memory_context_pack` for the current task, or `memory_coding_context_pack` when the host exposes it. Treat memory as evidence: verify current files, tests, and source systems before acting on stale facts.

Before shell commands or file edits with durable side effects, call `memory_action_guard` when available.

After useful tool outcomes, send telemetry:

```bash
MEMORY_HARNESS_ID=opencode MEMORY_COMMAND="<command>" ./bin/cognibrain.mjs memory connector-telemetry official-code tool_outcome "OpenCode tool outcome"
```

After durable project discoveries, add a source-backed memory with tags and confidence. Finish non-trivial patches with `memory_patch_evidence`.
