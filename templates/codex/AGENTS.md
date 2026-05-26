# cognibrain

Use the `cognibrain` MCP server when the task may depend on prior project decisions, user preferences, benchmark results, connector setup, or durable debugging discoveries.

Runtime:

- Start the local API with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Check state with `./bin/cognibrain.mjs status`; stop it with `./bin/cognibrain.mjs stop`.
- Install the Codex Skill with `./bin/cognibrain.mjs skill install`.

Before long-running work:

- Call `memory_context_pack` with the user request; use `memory_coding_context_pack` when the host exposes it for coding-specific work.
- Treat returned memories as evidence, not authority.
- Verify drift-prone facts against current files, benchmark artifacts, or source systems.
- Call `memory_action_guard` before shell commands or file edits with durable side effects when the tool is available.

After durable discoveries:

- Call `memory_add` for user corrections, validated benchmark results, connector decisions, setup commands, and project conventions.
- Include `sourceKind`, `sourceConfidence`, tags, and metadata when possible.
- For non-trivial patches, call `memory_patch_evidence` with files changed, commands run, and memory ids used.

After large sessions:

- Call `memory_maintenance_status` to see whether automatic dreaming is enabled.
- Call `memory_dream` after major imports, contradictions, handoff, or release. The backend also runs due dreams automatically by write threshold and interval.
