---
name: cognibrain
description: Use cognibrain for durable local memory, project context recall, automatic dream-cycle maintenance, and backend/dashboard startup in Codex.
---

# cognibrain

Use this skill when a task may depend on prior project decisions, user preferences, benchmark results, connector setup, repo conventions, or durable debugging discoveries.

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

1. Prefer MCP tools when available.
2. Call `memory_context_pack` before multi-step coding, repo archaeology, debugging loops, benchmark work, or user-preference-sensitive edits.
3. Use `memory_coding_context_pack` instead when the host exposes it and the work is code-specific.
4. Treat returned memories as evidence, not authority.
5. Verify drift-prone facts against current files, benchmark artifacts, or source systems before acting on them.
6. Call `memory_action_guard` before shell commands or file edits with durable side effects when the tool is available.

CLI fallback:

```bash
node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs memory search "<task or question>"
```

## Write Policy

Store only durable, useful facts:

- user corrections and stable preferences,
- validated setup commands,
- benchmark or simulator evidence,
- repo conventions,
- connector decisions,
- repeated failure modes with fixes.

Use `memory_add` with provenance, confidence, tags, and metadata when possible. Never store secrets, credentials, private keys, raw sensitive transcripts, or one-off scratch observations.

For non-trivial patches, call `memory_patch_evidence` with files changed, commands run, and the memory ids used.

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
