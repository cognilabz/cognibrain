# cognibrain for OpenCode

Use cognibrain as the durable Agent Memory OS for this workspace before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive edits.

Runtime:

- Start memory with `__COGNIBRAIN_COMMAND__ start`; add `--dashboard` only when a browser dashboard is needed.
- Check health with `__COGNIBRAIN_COMMAND__ status`.
- Use the CLI lifecycle commands as the default integration path.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks, actively run `__COGNIBRAIN_COMMAND__ context --task "<task>" --app opencode --agent opencode --json`. Do not wait for memories to appear in the prompt. Use delivered context first: if the context or evidence pack already answers where to inspect, what command to avoid, or which prior decision matters, act from that evidence and avoid rediscovering the same fact with another search. Treat memory as evidence: verify current files, tests, and source systems before acting on stale facts.

Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`. If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as OpenCode's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.

Before shell commands or file edits with durable side effects, run `__COGNIBRAIN_COMMAND__ guard --action "<command>" --json`.

After useful tool outcomes, send telemetry:

```bash
MEMORY_HARNESS_ID=opencode MEMORY_COMMAND="<command>" __COGNIBRAIN_COMMAND__ memory connector-telemetry official-code tool_outcome "OpenCode tool outcome"
```

After durable project discoveries, add a source-backed memory with tags and confidence. Finish non-trivial patches with `__COGNIBRAIN_COMMAND__ patch-evidence --task "<task>" --json`.

For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.
