# cognibrain memory policy

Use the cognibrain CLI lifecycle as the durable engineering memory layer. The configured stdio extension is an optional MCP adapter for native Goose tool discovery.

- Recall project policy with `cognibrain context --task "<task>" --json` before long-running tasks.
- Check procedures and action risk with `cognibrain guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Store corrections and tool outcomes with `cognibrain correction --text "<correction>" --json` and `cognibrain outcome --command "<command>" --exit-code <code> --json`.
- Use `cognibrain patch-evidence --task "<task>" --json` after non-trivial patches.
- Use MCP tools only as optional adapters for the same lifecycle.
