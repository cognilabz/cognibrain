# cognibrain for Hermes

Use the local cognibrain runtime for durable project memory. Start it with `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs --runtime-root __COGNIBRAIN_RUNTIME_ROOT__ start` when the API is unavailable.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks, actively call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs --runtime-root __COGNIBRAIN_RUNTIME_ROOT__ context --task "<task>" --app hermes --agent hermes --json`. Do not wait for memories to appear in the prompt. Use delivered context first: if the returned context or evidence pack already answers where to inspect, what command to avoid, or which prior decision matters, act from that evidence and avoid rediscovering it with another search.

Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`. If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Hermes' automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.

Before shell commands, dependency changes, migrations, or file edits with durable side effects, call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs --runtime-root __COGNIBRAIN_RUNTIME_ROOT__ guard --action "<command>" --json`.

For code or agent-behavior changes that are intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for an explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record both review results.

After durable discoveries, record source-backed facts with `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs --runtime-root __COGNIBRAIN_RUNTIME_ROOT__ memory add "<fact>"`. Finish non-trivial patches with `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs --runtime-root __COGNIBRAIN_RUNTIME_ROOT__ patch-evidence --task "<task>" --json`.

Hermes should also use the configured `cognibrain` MCP server when MCP tools are available. Treat MCP tools as native adapters for the same lifecycle contract, not as a replacement for source-backed verification.
