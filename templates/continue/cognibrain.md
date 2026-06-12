# cognibrain memory policy

Use cognibrain as the project memory source when Continue asks for repo context, prepares a code action, or handles non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

- Pull `__COGNIBRAIN_COMMAND__ context --task "<task>" --app continue --agent continue --json` before non-trivial exploration or applying edits.
- Parse the returned JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`; do not rely only on the top-level context string.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` or stale entries as Continue's automated review queue: inspect current files, tests, generated artifacts, CI, or source systems before using them.
- Run `__COGNIBRAIN_COMMAND__ guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Record accepted and rejected suggestions as feedback so repeated mistakes do not come back.
- Finish non-trivial patches with `__COGNIBRAIN_COMMAND__ patch-evidence --task "<task>" --json`.
- Cite connector-backed decisions from GitHub, Jira, Confluence, Notion, Slack, or Linear when they affect code.
- For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
