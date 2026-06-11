# Cognibrain Memory Contract

Use the cognibrain CLI lifecycle as the default memory access path before non-trivial repository work. The generated `.vscode/mcp.json` server named `cognibrain` is an optional native adapter for hosts that benefit from MCP tool discovery.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks:

- Actively call `./bin/cognibrain.mjs context --task "<task>" --app vscode --agent vscode --json`; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as VS Code's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Call `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands, dependency changes, migrations, destructive actions, or file edits with durable side effects.
- Use `memory_coding_context_pack`, `memory_context_pack`, and `memory_action_guard` only as MCP adapters when the host exposes them.

After changes:

- Call `./bin/cognibrain.mjs outcome --command "<command>" --exit-code <code> --json` for important tool results.
- Call `./bin/cognibrain.mjs correction --text "<correction>" --json` when a user or reviewer corrects the agent.
- Call `./bin/cognibrain.mjs patch-evidence --task "<task>" --json` after non-trivial patches.
- Call `./bin/cognibrain.mjs dream-plan --json` for handoff, release, or source-refresh workflows.
