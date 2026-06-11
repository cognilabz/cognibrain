# cognibrain memory policy

Use the cognibrain CLI lifecycle before non-trivial tool use and after tool results in Roo Code or Cline-style agent runs. MCP is optional when the host exposes native cognibrain tools.

- Actively fetch context with `cognibrain context --task "<task>" --app roo-cline --agent roo-cline --json` before command selection and file edits; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Roo/Cline's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Let `cognibrain guard --action "<command>" --json` block stale commands, generated-file edits, and known forbidden actions.
- Capture user corrections, review comments, and failing test outcomes with `cognibrain correction` and `cognibrain outcome`.
- Keep `cognibrain patch-evidence --task "<task>" --json` trails for changes that touch source files, tests, connectors, or benchmark artifacts.
- Use MCP tools only as optional adapters for the same lifecycle.
