# cognibrain for OpenCode

Use cognibrain as the durable Agent Memory OS for this workspace before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

Runtime:

- Start memory with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Check health with `./bin/cognibrain.mjs status`.
- Use the CLI lifecycle commands as the default integration path.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks, run `./bin/cognibrain.mjs context --task "<task>" --json`. Use delivered context first: if the context or evidence pack already answers the question, act from that evidence and avoid rediscovering the same fact with another search. Treat memory as evidence: verify current files, tests, and source systems before acting on stale facts.

Before shell commands or file edits with durable side effects, run `./bin/cognibrain.mjs guard --action "<command>" --json`.

After useful tool outcomes, send telemetry:

```bash
MEMORY_HARNESS_ID=opencode MEMORY_COMMAND="<command>" ./bin/cognibrain.mjs memory connector-telemetry official-code tool_outcome "OpenCode tool outcome"
```

After durable project discoveries, add a source-backed memory with tags and confidence. Finish non-trivial patches with `./bin/cognibrain.mjs patch-evidence --task "<task>" --json`.
