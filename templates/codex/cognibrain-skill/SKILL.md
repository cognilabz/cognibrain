---
name: cognibrain
description: Mandatory for non-trivial Codex repository work before reading or editing code: actively query Cognibrain context, parse delivered memories and evidence packs, verify them against code/tests, run action guards before durable side effects, record patch evidence, and manage the local memory runtime. Use without waiting for the user to mention memory or this skill.
---

# cognibrain

Use this skill before non-trivial Codex repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive tasks, especially when prior project decisions, repo conventions, or durable debugging discoveries may matter.

This skill is an active memory pull, not a passive reminder. Codex must ask Cognibrain for context; do not wait for memories to appear in the prompt.

## Mandatory Trigger

For Codex, selecting this skill is mandatory for non-trivial repository work. If the task involves code changes, debugging, CI, benchmarks, connectors, repo review, commits, user preferences, or prior project decisions, stop before deeper exploration and run the retrieval policy below.

Do not wait for the user to say "memory", "Cognibrain", or "use the skill". If the first context call was missed, run it as soon as the miss is noticed and state that the process was corrected.

## Start Runtime

Before long tasks, make sure the local memory runtime is available:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs start
```

Check or stop it with:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs status
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs stop
```

The daemon starts the local HTTP API. Add `--dashboard` only when a browser dashboard is needed. It writes state and logs under the current project at `.cognibrain/`, or under `COGNIBRAIN_RUNTIME_ROOT` when that variable is set.

Run `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs doctor` when setup or runtime behavior looks stale.

## Retrieval Policy

1. Use the daemon-backed CLI lifecycle as the default integration path.
2. At the start of every non-trivial task, call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs context --task "<task>" --app codex --agent codex --json` before broad repo exploration or edits.
3. Parse the returned JSON, not only the top-level `context` string. Read `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
4. If `data.context` is empty but `data.sections[].evidence[]` is non-empty, Cognibrain still delivered memories. Do not treat this as "no memory"; use the evidence list as an automated review queue for what to verify in code/tests.
5. Use delivered context first: if the context or evidence pack already answers where to inspect, what command to avoid, or which prior decision matters, start from that evidence and avoid rediscovering the same fact with another search.
6. Treat returned memories as evidence, not authority. Verify drift-prone or high-impact facts against current files, benchmark artifacts, source systems, tests, or generated artifacts before acting on them.
7. When the task scope changes, an initial query returns no relevant memories, or a failure repeats, call `context` again with the sharper task wording.
8. Call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs guard --action "<command>" --json` before shell commands, dependency changes, migrations, or file edits with durable side effects.
9. Use MCP tools such as `memory_coding_context_pack` and `memory_action_guard` only as optional native adapters when this host exposes them.

## Automated Review Policy

`review_required` does not mean "ignore this memory" and it must not require a human or separate evidence judge for normal Codex work. In Codex, the automated review queue is:

1. Read each `review_required` item from `data.sections[].evidence[]`.
2. Use it to choose targeted files, commands, or checks to inspect.
3. Promote it mentally to usable task context only after current code, tests, CLI behavior, generated artifacts, CI, or source systems confirm it.
4. If verification contradicts the memory, do not use it; record correction or patch evidence after the fix.
5. If verification is impossible and the memory affects a high-impact action, fail closed for that action and say what could not be verified.

When reporting work, mention the Cognibrain context pack id when it materially influenced the task. For debugging whether Codex received memory, inspect `.memory-harness.json` for an audit event with `metadata.deliveryEvent === "context.delivered"` and the matching `metadata.contextPackId`.

Additional memory search:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs memory search "<task or question>"
```

## Post-Push Live Review Policy

For code or agent-behavior changes that are intended to land, complete local verification, commit, and push to `main` unless the user explicitly asks for another branch or no publish.

After each push, ask the live ChatGPT/code-review coworker to review the pushed commit or diff. Treat that review as an external reviewer, not as proof by itself.

Implement actionable feedback, verify locally, commit, push again, and repeat the live review cycle.

Do not stop on the first `NO_CHANGES`/approval. Ask for one explicit recheck focused on missed improvements, stop-event mistakes, regressions, and uncovered edge cases.

Stop only after the recheck also returns no actionable improvements. Record the review result and recheck result in the final report or patch evidence.

## Write Policy

Store only durable, useful facts:

- user corrections and stable preferences,
- validated setup commands,
- benchmark or simulator evidence,
- repo conventions,
- connector decisions,
- repeated failure modes with fixes.

Use `memory_add` with provenance, confidence, tags, and metadata when possible. Never store secrets, credentials, private keys, raw sensitive transcripts, or one-off scratch observations.

For non-trivial patches, call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs patch-evidence --task "<task>" --json` with files changed, commands run, and the memory ids used. Use `memory_patch_evidence` only as an optional MCP adapter when available.

CLI fallback:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs memory add "<durable memory>"
```

## Dream Policy

Automatic dreaming is enabled by the local backend unless `MEMORY_AUTO_DREAM=false`.

Use `memory_maintenance_status` to inspect counters. Call `memory_dream` after major sessions, imports, contradictions, or before handoff. The backend also runs due dreams by write threshold and interval.

CLI fallback:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs memory maintenance
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs memory dream
```
