---
name: cognibrain
description: Use Cognibrain before non-trivial Codex repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive tasks; retrieve durable local memory, run action guards, record patch evidence, and manage the local memory runtime.
---

# cognibrain

Use this skill before non-trivial Codex repository work, debugging, CI repair, benchmark changes, connector setup, or user-preference-sensitive tasks, especially when prior project decisions, repo conventions, or durable debugging discoveries may matter.

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
2. Call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs context --task "<task>" --json` before non-trivial coding, repo archaeology, debugging loops, CI repair, benchmark work, connector setup, or user-preference-sensitive edits.
3. Use delivered context first: if the context or evidence pack already answers the question, act from that evidence and avoid rediscovering the same fact with another search.
4. Call `node __COGNIBRAIN_ROOT__/bin/cognibrain.mjs guard --action "<command>" --json` before shell commands, dependency changes, migrations, or file edits with durable side effects.
5. Treat returned memories as evidence, not authority.
6. Verify drift-prone facts against current files, benchmark artifacts, or source systems before acting on them.
7. Use MCP tools such as `memory_coding_context_pack` and `memory_action_guard` only as optional native adapters when this host exposes them.

Additional memory search:

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
