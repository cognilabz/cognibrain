# cognibrain memory policy

Use the cognibrain CLI lifecycle as the durable engineering memory layer before non-trivial repository work. The configured stdio extension is an optional MCP adapter for native Goose tool discovery.

- Actively recall project policy with `cognibrain context --task "<task>" --app goose --agent goose --json` before non-trivial tasks; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Goose's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Check procedures and action risk with `cognibrain guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Store corrections and tool outcomes with `cognibrain correction --text "<correction>" --json` and `cognibrain outcome --command "<command>" --exit-code <code> --json`.
- Use `cognibrain patch-evidence --task "<task>" --json` after non-trivial patches.
- Use MCP tools only as optional adapters for the same lifecycle.
