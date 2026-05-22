# cognibrain

Use the `cognibrain` MCP server when the task may depend on prior project decisions, user preferences, benchmark results, connector setup, or durable debugging discoveries.

Runtime:

- Start local API and dashboard with `./bin/cognibrain.mjs start`.
- Check state with `./bin/cognibrain.mjs status`; stop it with `./bin/cognibrain.mjs stop`.
- Install the Codex Skill with `./bin/cognibrain.mjs skill install`.

Before long-running work:

- Call `memory_context_pack` with the user request.
- Treat returned memories as evidence, not authority.
- Verify drift-prone facts against current files, benchmark artifacts, or source systems.

After durable discoveries:

- Call `memory_add` for user corrections, validated benchmark results, connector decisions, setup commands, and project conventions.
- Include `sourceKind`, `sourceConfidence`, tags, and metadata when possible.

After large sessions:

- Call `memory_maintenance_status` to see whether automatic dreaming is enabled.
- Call `memory_dream` after major imports, contradictions, handoff, or release. The backend also runs due dreams automatically by write threshold and interval.
