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
  "brainId": "team-brain",
  "sourceId": "engineering-notes",
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
  "profileId": "coding",
  "includeLinkedIdentities": true,
  "includePrivate": false,
  "weights": {"temporal": 0.4, "trust": 0.3}
}
```

Results include explanations, graph path hints, and context-verification decisions when available.

## Brains, Sources, Agents, And Personas

```bash
curl -X POST http://localhost:8787/brains \
  -H "content-type: application/json" \
  -d '{"name":"Team Brain","ownerUserId":"dev","orgId":"team-a","visibility":"team"}'
curl -X POST http://localhost:8787/sources \
  -H "content-type: application/json" \
  -d '{"brainId":"team-brain","name":"Engineering Notes","kind":"docs"}'
curl -X POST http://localhost:8787/agents \
  -H "content-type: application/json" \
  -d '{"id":"codex","name":"Codex","namespace":"coding","brainIds":["team-brain"],"permissions":["read","write"]}'
curl -X PUT http://localhost:8787/personas \
  -H "content-type: application/json" \
  -d '{"id":"researcher","label":"Researcher","summaryStyle":"descriptive","privacyDefault":"private"}'
```

Brains are logical memory databases. Sources are content repositories inside a brain. Agents register namespaces and permissions before writing scoped memories. Personas carry retrieval, summary, and privacy defaults that connectors can apply.

## Feedback

```bash
curl -X POST http://localhost:8787/feedback \
  -H "content-type: application/json" \
  -d '{"userId":"dev","memoryId":"<id>","kind":"helpful"}'
```

Supported feedback kinds are `helpful`, `wrong`, `stale`, `always_include`, `never_include`, `private`, `shareable`, `approve_pattern`, and `reject_pattern`. Feedback updates bounded trust/importance metadata, handles inferred-pattern review, and feeds later retrieval tuning.

## Retrieval Profiles

```bash
curl http://localhost:8787/profiles
curl -X PUT http://localhost:8787/profiles \
  -H "content-type: application/json" \
  -d '{"id":"coding","label":"Coding","weights":{"trust":0.4,"entity":0.3,"graph":0.2,"keyword":0.1}}'
curl -X POST http://localhost:8787/profiles/learn \
  -H "content-type: application/json" \
  -d '{"id":"learned-coding"}'
curl -X POST http://localhost:8787/profiles/training-samples \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"Redis cache","outcome":"accepted","signals":{"entity":1,"trust":0.8}}'
```

Profiles store normalized weights with provenance. The learning endpoint derives a bounded profile from accumulated feedback events and labeled training samples, then records sample count and loss metadata.

## Identity Links And Timelines

```bash
curl -X POST http://localhost:8787/identity-links \
  -H "content-type: application/json" \
  -d '{"primaryUserId":"device-b","linkedUserId":"device-a","consentToken":"user-approved-token"}'
curl http://localhost:8787/timeline/dev
curl "http://localhost:8787/graph?userId=dev"
curl "http://localhost:8787/graph/paths?userId=dev&from=atlas&to=redisadapter&maxDepth=3"
curl -X POST http://localhost:8787/graph/query \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"MATCH (a)-[:depends_on]->(b) WHERE trust>0.8"}'
curl -X POST http://localhost:8787/graph/infer
curl -X POST http://localhost:8787/lifecycle/preview \
  -H "content-type: application/json" \
  -d '{"userId":"dev","policy":{"archiveAfterDays":30}}'
```

Identity links require an explicit consent token and store only a hash of that token. Timelines expose event time, validity windows, supersession metadata, and day/week/month period groupings. The graph endpoints expose canonical entities, aliases, typed relation edges, ranked connection paths, safe graph-query matches, and rule-based inferred relations. Lifecycle preview reports keep/fade/archive/protect actions without mutating memory state.

## Events, Webhooks, Marketplace, And Compliance

```bash
curl -X POST http://localhost:8787/webhooks \
  -H "content-type: application/json" \
  -d '{"url":"https://example.invalid/memory","events":["memory.write","inference.run"]}'
curl http://localhost:8787/events
curl -X POST http://localhost:8787/marketplace/install \
  -H "content-type: application/json" \
  -d '{"id":"persona-researcher","kind":"persona","name":"Researcher","version":"1.0.0","description":"Citation-heavy defaults","manifest":{"id":"researcher","label":"Researcher","summaryStyle":"descriptive"}}'
curl http://localhost:8787/marketplace
curl http://localhost:8787/compliance
```

Every write/update/delete/search/extract/reflect/share/inference operation records an audit event. Webhooks are queued as local delivery records so operators can inspect retries before enabling real network delivery. Marketplace installs persist module metadata and can materialize personas. Compliance reports summarize storage scope, consent, retention, delete-on-request, encryption metadata, and audit counts.

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

## Domain Evaluation

```bash
curl -X POST http://localhost:8787/domain/evaluate
```

When the service is configured with a domain module, this endpoint runs the module's application-level fixtures and records a benchmark metric event.

## Nextgen Verification

```bash
npm run verify:nextgen
```

This loop runs unit tests, the synthetic retrieval evaluation, the next-generation feature evaluation, and the production dashboard build. The nextgen evaluator writes `artifacts/nextgen-eval.json` and proves graph inference/path explanation, graph query, multi-tenant audit, webhook event feeds, compliance retention, and marketplace persona installation.
