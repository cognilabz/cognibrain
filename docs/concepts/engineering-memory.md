# Engineering Memory

Engineering Memory is the codebase-aware memory layer used by cognibrain for coding agents.

## Kinds

- `repo_policy`
- `architecture_decision`
- `review_correction`
- `tool_outcome`
- `procedure`
- `forbidden_action`
- `migration_note`
- `test_strategy`
- `dependency_rule`
- `generated_file_rule`

Each kind is stored under `metadata.engineering` with codebase scope, confidence and optional command, correction, validity and evidence fields.

Claim ID: `CB-CLAIM-CONTEXT`.
