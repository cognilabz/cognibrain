# cognibrain memory policy

Use cognibrain as the evidence handoff for Amp-style external agent work before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

- Actively pull a context pack before changing code; use `cognibrain context --task "<task>" --app sourcegraph-amp --agent sourcegraph-amp --json` or the coding-specific context path when the host exposes it.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Amp's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Run an action guard before shell commands or file edits with durable side effects when the integration supports it.
- Preserve source references for issue, PR, CI, doc, chat, and incident evidence.
- Store review corrections, command failures, and release-gate decisions, then write patch evidence for non-trivial changes.
- Do not claim tenant or production proof unless the checked artifacts contain it.
- For code or agent-behavior changes intended to land, verify locally, commit, push to `main`, ask the live ChatGPT/code-review coworker to review the pushed commit or diff, implement actionable feedback, re-verify, re-push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases, and stop only when that recheck also finds no actionable improvements.
