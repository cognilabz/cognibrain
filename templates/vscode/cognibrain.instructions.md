# Cognibrain Memory Contract

Use the generated `.vscode/mcp.json` server named `cognibrain` for memory access.

Before multi-step coding or debugging:

- Call `memory_coding_context_pack` when available.
- Call `memory_context_pack` for portable project context.
- Call `memory_action_guard` before shell commands, dependency changes, migrations, destructive actions, or file edits with durable side effects.

After changes:

- Call `memory_action_record` or `memory_action_outcome` for important tool results.
- Call `memory_code_correction` when a user or reviewer corrects the agent.
- Call `memory_patch_evidence` after non-trivial patches.
- Call `memory_dream_plan` or `memory_dream_job_start` for handoff, release, or source-refresh workflows.
