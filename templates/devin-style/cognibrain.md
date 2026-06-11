# Cognibrain External-Agent Memory Contract

Use the generated `.devin/cognibrain.json` command contract when this agent cannot call the Cognibrain MCP server directly.

Before non-trivial coding, debugging, CI repair, benchmark, connector, or user-preference-sensitive tasks:

- actively request a coding context pack with `cognibrain context --task "<task>" --app devin-style --agent devin-style --json`; do not wait for memories to appear in the prompt,
- parse the context pack JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`,
- if `data.context` is empty but `data.sections[].evidence[]` is non-empty, treat those delivered memories as available for automated verification rather than as "no memory",
- treat `review_required` memories as the external agent's automated review queue: verify each one against current files, tests, generated artifacts, CI, or source systems before using it,
- run the pre-tool guard before shell or file edits,
- use the CLI command contract when MCP tools are unavailable,
- keep secrets out of memory and store only env var names or redacted refs.

After tool use:

- record commands, files, exit status and test outcome,
- capture reviewer or user corrections as durable code corrections,
- finish with a patch evidence trail that cites the memories used.

For code or agent-behavior changes intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish. After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Implement actionable feedback, verify, commit, push, and repeat. Do not stop on the first `NO_CHANGES`/approval; ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases. Stop only after that recheck also returns no actionable improvements, then record the review result and recheck result.

Do not claim parity, connector support or benchmark superiority unless a current artifact proves it.
