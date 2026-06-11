# cognibrain memory policy

Use the local cognibrain CLI lifecycle before non-trivial repository work, multi-step edits, risky tool calls, CI repair, benchmark changes, connector setup, user-preference-sensitive edits, or repeated debugging loops.

- Actively query project memory with `cognibrain context --task "<task>" --app windsurf --agent windsurf --json` before changing files with repo-specific rules; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Windsurf's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Respect `cognibrain guard --action "<command>" --json` warnings for forbidden commands and generated files.
- Record durable corrections with `memory_add` after review feedback, command failures, benchmark discoveries, or connector decisions.
- Finish non-trivial patches with `cognibrain patch-evidence --task "<task>" --json`.
- For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
