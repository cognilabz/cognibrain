# cognibrain for OpenClaw

Use cognibrain for durable, inspectable context across OpenClaw sessions before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

Runtime:

- Start memory with `__COGNIBRAIN_COMMAND__ start`; add `--dashboard` only when a browser dashboard is needed.
- Use CLI lifecycle commands as the default integration path.
- Actively run `__COGNIBRAIN_COMMAND__ context --task "<task>" --app openclaw --agent openclaw --json` before non-trivial workflows; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as OpenClaw's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Run `__COGNIBRAIN_COMMAND__ guard --action "<command>" --json` before shell commands or file edits with durable side effects.

Feed successful or rejected actions back through the shared telemetry endpoint:

```bash
MEMORY_HARNESS_ID=openclaw __COGNIBRAIN_COMMAND__ memory connector-telemetry official-code context_pack_feedback "OpenClaw context feedback"
```

Keep private memories private unless an explicit shared-memory review approves promotion.
Finish non-trivial patches with `__COGNIBRAIN_COMMAND__ patch-evidence --task "<task>" --json`.

For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
