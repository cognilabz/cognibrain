# cognibrain memory policy

Use the local cognibrain CLI lifecycle before multi-step edits, risky tool calls, or repeated debugging loops.

- Query project memory with `cognibrain context --task "<task>" --json` before changing files with repo-specific rules.
- Respect `cognibrain guard --action "<command>" --json` warnings for forbidden commands and generated files.
- Record durable corrections with `memory_add` after review feedback, command failures, benchmark discoveries, or connector decisions.
- Finish non-trivial patches with `cognibrain patch-evidence --task "<task>" --json`.
