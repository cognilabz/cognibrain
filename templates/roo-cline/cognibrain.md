# cognibrain memory policy

Use the cognibrain CLI lifecycle before non-trivial tool use and after tool results in Roo Code or Cline-style agent runs. MCP is optional when the host exposes native cognibrain tools.

- Actively fetch context with `__COGNIBRAIN_COMMAND__ context --task "<task>" --app roo-cline --agent roo-cline --json` before command selection and file edits; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Roo/Cline's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Let `__COGNIBRAIN_COMMAND__ guard --action "<command>" --json` block stale commands, generated-file edits, and known forbidden actions.
- Capture user corrections, review comments, and failing test outcomes with `__COGNIBRAIN_COMMAND__ correction` and `__COGNIBRAIN_COMMAND__ outcome`.
- Keep `__COGNIBRAIN_COMMAND__ patch-evidence --task "<task>" --json` trails for changes that touch source files, tests, connectors, or benchmark artifacts.
- Use MCP tools only as optional adapters for the same lifecycle.
- For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
