# cognibrain memory policy

Use cognibrain MCP context before tool use and after tool results in Roo Code or Cline-style agent runs.

- Fetch `memory_context_pack`, or `memory_coding_context_pack` when exposed, before command selection and file edits.
- Let `memory_action_guard` block stale commands, generated-file edits, and known forbidden actions.
- Capture user corrections, review comments, and failing test outcomes.
- Keep `memory_patch_evidence` trails for changes that touch source files, tests, connectors, or benchmark artifacts.
