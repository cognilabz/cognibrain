# cognibrain

Use the `cognibrain` CLI lifecycle when the task may depend on prior project decisions, user preferences, benchmark results, connector setup, or durable debugging discoveries. MCP is an optional adapter when the host exposes native cognibrain tools.

Runtime:

- Start the local API with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Check state with `./bin/cognibrain.mjs status`; stop it with `./bin/cognibrain.mjs stop`.
- Install the Codex Skill with `./bin/cognibrain.mjs skill install`.

Before long-running work:

- Call `./bin/cognibrain.mjs context --task "<task>" --json` with the user request.
- Treat returned memories as evidence, not authority.
- Verify drift-prone facts against current files, benchmark artifacts, or source systems.
- Call `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands or file edits with durable side effects.
- Use `memory_context_pack`, `memory_coding_context_pack`, and `memory_action_guard` only as optional MCP adapters when available.

After durable discoveries:

- Call `./bin/cognibrain.mjs memory add "<fact>"` for user corrections, validated benchmark results, connector decisions, setup commands, and project conventions.
- Include `sourceKind`, `sourceConfidence`, tags, and metadata when possible.
- For non-trivial patches, call `./bin/cognibrain.mjs patch-evidence --task "<task>" --json` with files changed, commands run, and memory ids used.

After large sessions:

- Call `./bin/cognibrain.mjs dream-plan --json` before handoff, release, or source refresh. The backend also runs due dreams automatically by write threshold and interval.
