# API Reference

Base URL: `http://localhost:8787`

## Health

```bash
curl http://localhost:8787/health
```

Returns memory counts, freshness, trust, coverage, contradiction count, and aggregate health score.

## Create Memory

```bash
curl -X POST http://localhost:8787/memories \
  -H "content-type: application/json" \
  -d '{
    "userId": "dev",
    "content": "Project Atlas uses TypeScript for all harness components.",
    "source": {"kind": "human", "confidence": 0.96},
    "tags": ["project", "typescript"]
  }'
```

Memory writes can include scope, consent, relations, and temporal metadata:

```json
{
  "userId": "dev",
  "sessionId": "session-42",
  "appId": "codex",
  "orgId": "team-a",
  "consent": {"visibility": "user", "retentionUntil": "2026-12-31T00:00:00.000Z"},
  "relations": [{"type": "depends_on", "targetEntity": "redis"}],
  "temporal": {"eventAt": "2026-05-23T10:00:00.000Z"}
}
```

The default redaction policy checks writes for common secrets and stores redacted text instead of raw secret values.

## Extract Add-Only Memories

```bash
curl -X POST http://localhost:8787/extract \
  -H "content-type: application/json" \
  -d '{
    "userId": "dev",
    "sessionId": "s1",
    "appId": "codex",
    "events": [
      {"role": "user", "content": "Atlas now uses Redis for cache."},
      {"role": "tool", "content": "Verified npm test passed for Atlas."}
    ]
  }'
```

`/extract` performs deterministic single-pass, add-only fact extraction. It appends facts, stores agent/tool actions as first-class memories, links entities, and returns `entityLinks`.

## List Memories

```bash
curl "http://localhost:8787/memories?userId=dev"
```

## Search

```bash
curl -X POST http://localhost:8787/search \
  -H "content-type: application/json" \
  -d '{"userId": "dev", "query": "What language should Atlas use?", "limit": 5}'
```

Search results include ranked memories, signal breakdowns, citations, and stale flags.

Search accepts optional scope and retrieval-weight overrides:

```json
{
  "userId": "dev",
  "sessionId": "s1",
  "appId": "codex",
  "scopeMode": "session",
  "includePrivate": false,
  "weights": {"temporal": 0.4, "trust": 0.3}
}
```

Results include explanations, graph path hints, and context-verification decisions when available.

## Feedback

```bash
curl -X POST http://localhost:8787/feedback \
  -H "content-type: application/json" \
  -d '{"userId":"dev","memoryId":"<id>","kind":"helpful"}'
```

Supported feedback kinds are `helpful`, `wrong`, `stale`, `always_include`, `never_include`, `private`, and `shareable`. Feedback updates bounded trust/importance metadata and feeds later retrieval tuning.

## Reflection

```bash
curl -X POST http://localhost:8787/reflection \
  -H "content-type: application/json" \
  -d '{"userId": "dev"}'
```

Reflection clusters repeated themes, creates summaries, demotes contradictions, fades stale low-utility memories, reorganizes procedural memories, and returns a `lifecycle` report.

## Dream Cycle

```bash
curl -X POST http://localhost:8787/dream \
  -H "content-type: application/json" \
  -d '{"userId": "dev"}'
```

`/dream` is an alias for the full maintenance cycle. Use the word `dream` for scheduled background maintenance and `reflection` for explicit user-triggered cleanup. Both return:

- `created`: new reflection summaries,
- `demoted`: memories whose trust or lifecycle state changed,
- `contradictions`: lower-quality claims superseded by stronger evidence,
- `lifecycle`: evaluated, summarized, faded, archived, reorganized, quality score, issues, and actions.

## Maintenance

```bash
curl http://localhost:8787/maintenance
```

Returns automatic dream-cycle policy and per-user counters.

```bash
curl -X POST http://localhost:8787/maintenance/dream-due
```

Runs dreams for every due user and returns `dreamedUsers`.

## Metrics, Export, And Delete

```bash
curl http://localhost:8787/metrics
curl http://localhost:8787/export/dev
curl -X DELETE http://localhost:8787/users/dev/memories
```

Metrics are local-first aggregates for searches, no-hit searches, feedback, dreams, and quality score. Export/delete provide the initial GDPR-style memory control surface.
