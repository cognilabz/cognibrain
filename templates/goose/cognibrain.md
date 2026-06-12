# cognibrain memory policy

Use the cognibrain CLI lifecycle as the durable engineering memory layer before non-trivial repository work. The configured stdio extension is an optional MCP adapter for native Goose tool discovery.

- Actively recall project policy with `__COGNIBRAIN_COMMAND__ context --task "<task>" --app goose --agent goose --json` before non-trivial tasks; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Goose's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Check procedures and action risk with `__COGNIBRAIN_COMMAND__ guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Store corrections and tool outcomes with `__COGNIBRAIN_COMMAND__ correction --text "<correction>" --json` and `__COGNIBRAIN_COMMAND__ outcome --command "<command>" --exit-code <code> --json`.
- Use `__COGNIBRAIN_COMMAND__ patch-evidence --task "<task>" --json` after non-trivial patches.
- Use MCP tools only as optional adapters for the same lifecycle.
- For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
