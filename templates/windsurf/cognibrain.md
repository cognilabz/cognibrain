# cognibrain memory policy

Use the local cognibrain MCP server before multi-step edits, risky tool calls, or repeated debugging loops.

- Query project memory with `memory_context_pack`, or `memory_coding_context_pack` when the host exposes it, before changing files with repo-specific rules.
- Respect action-guard warnings for forbidden commands and generated files.
- Record durable corrections with `memory_add` after review feedback, command failures, benchmark discoveries, or connector decisions.
- Finish non-trivial patches with a patch evidence trail that cites memories, commands, and files changed.
