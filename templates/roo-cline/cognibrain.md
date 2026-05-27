# cognibrain memory policy

Use the cognibrain CLI lifecycle before tool use and after tool results in Roo Code or Cline-style agent runs. MCP is optional when the host exposes native cognibrain tools.

- Fetch context with `cognibrain context --task "<task>" --json` before command selection and file edits.
- Let `cognibrain guard --action "<command>" --json` block stale commands, generated-file edits, and known forbidden actions.
- Capture user corrections, review comments, and failing test outcomes with `cognibrain correction` and `cognibrain outcome`.
- Keep `cognibrain patch-evidence --task "<task>" --json` trails for changes that touch source files, tests, connectors, or benchmark artifacts.
- Use MCP tools only as optional adapters for the same lifecycle.
