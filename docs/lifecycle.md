# Memory Lifecycle

cognibrain treats memory as a living store, not a pile of notes. The lifecycle loop is called `dream` in user-facing surfaces and `reflection` in lower-level APIs.

## Plain-English Model

- Store: save durable facts with source and confidence.
- Retrieve: find relevant memories with multiple signals, not vector similarity alone, including zero-dependency entity links.
- Evaluate: check whether memories are fresh, trusted, useful, and supported.
- Rethink: compare contradictory claims and keep the better-supported one.
- Summarize: create compact reflection memories from repeated themes.
- Fade: lower the trust or importance of stale low-utility memories.
- Archive: remove very stale low-utility memories from active retrieval.
- Reorganize: move procedures, transcript guesses, and stable facts into the right memory layer.

## Commands

```bash
./bin/cognibrain.mjs memory dream
```

```bash
curl -X POST http://localhost:8787/dream \
  -H "content-type: application/json" \
  -d '{"userId": "dev"}'
```

MCP clients can call:

```text
memory_dream
memory_maintenance_status
```

## Automatic Dreaming

Automatic dreaming is enabled by default in the local API and CLI. It is designed to be predictable rather than mysterious:

- every write increments a per-user counter,
- the counter triggers a dream when it reaches `MEMORY_DREAM_WRITE_THRESHOLD`,
- after a user has dreamed once, new writes also become due when `MEMORY_DREAM_INTERVAL_HOURS` has elapsed,
- the API checks due users every `MEMORY_DREAM_CHECK_INTERVAL_MINUTES`,
- manual `memory_dream`, `/dream`, or `./bin/cognibrain.mjs memory dream` resets that user's counter.

Inspect the state:

```bash
./bin/cognibrain.mjs memory maintenance
curl http://localhost:8787/maintenance
```

## What Good Looks Like

A healthy dream report should have:

- a high `qualityScore`,
- no active contradiction markers,
- summaries with `summaryOf` provenance,
- low-value stale memories faded or archived,
- procedural memories moved into the `procedural` layer,
- transcript guesses either reviewed, faded, or kept out of long-term retrieval.

## Safety Rules

- Pinned memories are never faded or archived.
- Trust alone cannot retrieve unrelated memories; relevance evidence is still required.
- Dream summaries are auditable because they retain source memory IDs in metadata.
- The system stores provenance on every memory so users can inspect where a claim came from.
- Connectors should never store secrets or raw sensitive transcripts unless a project has an explicit policy for that.

## Verification

The lifecycle behavior is covered by `tests/core.test.ts`:

- contradiction demotion,
- lifecycle quality reporting,
- cluster summarization,
- stale memory fading,
- stale memory archiving,
- procedural reorganization,
- MCP dream handler output.
