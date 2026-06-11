# cognibrain memory policy

Use the local cognibrain CLI lifecycle before non-trivial repository work, multi-step edits, risky tool calls, CI repair, benchmark changes, connector setup, user-preference-sensitive edits, or repeated debugging loops.

- Actively query project memory with `cognibrain context --task "<task>" --app windsurf --agent windsurf --json` before changing files with repo-specific rules; do not wait for memories to appear in the prompt.
- Parse returned context JSON, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Treat `review_required` as Windsurf's automated review queue: verify the memory against current code, tests, generated artifacts, CI, or source systems before using it.
- Respect `cognibrain guard --action "<command>" --json` warnings for forbidden commands and generated files.
- Record durable corrections with `memory_add` after review feedback, command failures, benchmark discoveries, or connector decisions.
- Finish non-trivial patches with `cognibrain patch-evidence --task "<task>" --json`.
