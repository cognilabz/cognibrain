# cognibrain

Use the `cognibrain` CLI lifecycle before non-trivial repository work, debugging, CI repair, benchmark changes, connector setup, user-preference-sensitive edits, or work that may depend on prior project decisions. MCP is an optional adapter when the host exposes native cognibrain tools.

Always-on memory rule:

- This rule is required even when the Codex skill was not selected. Treat Cognibrain context as the first operational step for non-trivial repo work, not as optional skill advice.
- If you have not run `./bin/cognibrain.mjs context --task "<task>" --app codex --agent codex --json` in this turn, run it before deeper file exploration, implementation, review, or durable side effects.
- Do not wait for the user to mention memory, Cognibrain, or a skill. Missing the context pull is a process failure that should be corrected immediately and called out.
- Do not claim memory was used unless a context id, evidence pack, readback, or patch-evidence id was actually observed.

Runtime:

- Start the local API with `./bin/cognibrain.mjs start`; add `--dashboard` only when a browser dashboard is needed.
- Check state with `./bin/cognibrain.mjs status`; stop it with `./bin/cognibrain.mjs stop`.
- Install the Codex Skill with `./bin/cognibrain.mjs skill install`.

Before non-trivial work:

- Actively call `./bin/cognibrain.mjs context --task "<task>" --app codex --agent codex --json` with the user request before deeper exploration or edits. Do not wait for memories to appear in the prompt.
- Parse the returned JSON, not only the top-level `context` string. Read `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
- If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Do not treat this as "no memory"; use `review_required` evidence as an automated review queue for targeted code/test verification.
- Use delivered context first: if the context or evidence pack already answers where to inspect, what command to avoid, or which prior decision matters, start from that evidence and avoid rediscovering the same fact with another search.
- Treat returned memories as evidence, not authority.
- Verify drift-prone facts against current files, benchmark artifacts, or source systems.
- Call `./bin/cognibrain.mjs guard --action "<command>" --json` before shell commands, dependency changes, migrations, or file edits with durable side effects.
- Use `memory_context_pack`, `memory_coding_context_pack`, and `memory_action_guard` only as optional MCP adapters when available.

Post-push live review loop:

- For code or agent-behavior changes that are intended to land, complete the normal local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish.
- After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Treat that review as an external reviewer, not as proof by itself.
- Implement actionable review feedback, verify locally, commit, push again, and repeat the live review cycle.
- Do not stop on the first `NO_CHANGES`/approval. Ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases.
- Stop only after the recheck also returns no actionable improvements. Record the review result and recheck result in the final report or patch evidence.

After durable discoveries:

- Call `./bin/cognibrain.mjs memory add "<fact>"` for user corrections, validated benchmark results, connector decisions, setup commands, and project conventions.
- Include `sourceKind`, `sourceConfidence`, tags, and metadata when possible.
- For non-trivial patches, call `./bin/cognibrain.mjs patch-evidence --task "<task>" --json` with files changed, commands run, and memory ids used.

After large sessions:

- Call `./bin/cognibrain.mjs dream-plan --json` before handoff, release, or source refresh. The backend also runs due dreams automatically by write threshold and interval.
