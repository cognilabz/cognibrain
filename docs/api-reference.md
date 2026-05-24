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

`/extract` performs staged single-pass, add-only fact extraction. Deterministic rules run first; if a JSON-command extractor is configured, low-confidence or media-heavy events can fall back to provider extraction. Events may include `mediaType` (`text`, `code`, `document`, `audio`, `image`, `video`), `language`, `uri`, and `mimeType`. The response returns written memories, `entityLinks`, extraction `stages`, auditable `failures`, `enrichmentCandidates`, and `learnedRules` suggestions for regex, provider, or translation improvements.

## Connectors, Providers, Translation, And Media

```bash
curl http://localhost:8787/connectors
curl "http://localhost:8787/connectors?kind=chat"
curl "http://localhost:8787/connectors/health?connectorId=support-chat"
curl -X POST http://localhost:8787/connectors \
  -H "content-type: application/json" \
  -d '{"id":"support-chat","name":"Support Chat","kind":"chat","version":"1.0.0","direction":"two_way","capabilities":["ingest","poll","webhook","writeback"],"auth":"token","defaultSourceKind":"transcript","metadataMapping":{"channel":"metadata.channel","messageId":"externalId","text":"content"},"privacyPolicy":"project","list":{"endpoint":"https://connector.example/list"},"poll":{"endpoint":"https://connector.example/poll"},"writeback":{"endpoint":"https://connector.example/channels/{channel}","operations":["summary","comment"]}}'
curl "http://localhost:8787/connectors/list?connectorId=support-chat"
curl -X POST http://localhost:8787/connectors/poll \
  -H "content-type: application/json" \
  -d '{"connectorId":"support-chat","userId":"dev","projectId":"memory"}'
curl -X POST http://localhost:8787/connectors/sync \
  -H "content-type: application/json" \
  -d '{"connectorId":"support-chat","userId":"dev","events":[{"role":"user","content":"Support confirmed the release note owner.","externalId":"msg-1","metadata":{"channel":"support"}}]}'
curl -X POST http://localhost:8787/connectors/writeback \
  -H "content-type: application/json" \
  -d '{"connectorId":"support-chat","operation":"summary","externalId":"thread-1","target":{"channel":"support","threadId":"thread-1"},"content":"Release note owner confirmed.","dryRun":true}'
curl -X POST http://localhost:8787/connectors/feedback \
  -H "content-type: application/json" \
  -d '{"connectorId":"support-chat","userId":"dev","kind":"accepted_change","content":"Accepted connector suggestion.","memoryIds":["mem_123"],"externalId":"thread-1"}'
curl "http://localhost:8787/connectors/sync-records?connectorId=support-chat"
curl http://localhost:8787/providers
curl -X POST http://localhost:8787/translate \
  -H "content-type: application/json" \
  -d '{"text":"Speicher soll nicht fehler","sourceLanguage":"de","targetLanguage":"en"}'
curl -X POST http://localhost:8787/ingest/media \
  -H "content-type: application/json" \
  -d '{"userId":"dev","event":{"role":"operator","content":"Speicher soll release notes erfassen.","mediaType":"audio","language":"de","uri":"file:///review.m4a"}}'
curl -X POST http://localhost:8787/ingest/media \
  -H "content-type: application/json" \
  -d '{"userId":"dev","event":{"role":"operator","content":"fixtures/media/operator-dashboard.png","mediaType":"image","uri":"file:///fixtures/media/operator-dashboard.png","mimeType":"image/png","metadata":{"ocrText":"Operator dashboard shows connector health applied.","imageLabels":["dashboard","connector health"]}}}'
curl -X POST http://localhost:8787/ingest/media \
  -H "content-type: application/json" \
  -d '{"userId":"dev","event":{"role":"operator","content":"fixtures/media/operator-brief.pdf","mediaType":"document","uri":"file:///fixtures/media/operator-brief.pdf","mimeType":"application/pdf","metadata":{"ocrText":"Operator PDF snapshot confirms connector writeback and audit trail coverage."}}}'
```

The service seeds official manifests for email, chat, project management, docs, code, calendar, and cloud storage. Custom manifests declare direction, auth, capabilities, default source kind, metadata mapping, privacy policy, optional list/poll endpoints, and optional writeback endpoint metadata. `/connectors/list` calls a connector list endpoint and returns normalized external items. `/connectors/poll` calls a poll endpoint, ingests returned events through the same add-only extraction path, and records last state for `/connectors/health`. A `privacyPolicy` of `never_store` records the poll but writes no memories. `/connectors/sync` maps explicit external events into add-only extraction, records connector sync status, and emits audit events. `/connectors/writeback` renders source-specific export payloads for email replies, chat posts, issue updates, doc comments, code review comments, calendar notes, or generic custom connectors. With `dryRun:true` or omitted, the response is an auditable queued writeback plan. With a manifest `writeback.endpoint` and `dryRun:false`, Cognibrain sends the plan as an HTTP request with connector headers, optional HMAC signature, status-code capture, and timeout governed by `MEMORY_CONNECTOR_TIMEOUT_MS` or 10 seconds by default. `/connectors/feedback` maps accepted changes, rejected suggestions, failing tests, and user corrections into trust/importance feedback plus an auditable connector feedback memory. `/providers` reports whether JSON-command intelligence is active and which tasks fall back deterministically. `/translate` and `/ingest/media` support multilingual transcripts plus local OCR/ASR/video-frame metadata through `metadata.ocrText`, `metadata.asrText`, and `metadata.frames` while preserving `uri`, `mimeType`, original media content, and transformation history. `mediaType:"document"` with `application/pdf` uses the same local OCR envelope for PDF snapshots.

## Entity Catalog And Disambiguation

```bash
curl "http://localhost:8787/entities?userId=dev"
curl -X POST http://localhost:8787/entities/merge \
  -H "content-type: application/json" \
  -d '{"userId":"dev","canonical":"cache client","aliases":["CacheClient"]}'
curl -X POST http://localhost:8787/entities/split \
  -H "content-type: application/json" \
  -d '{"userId":"dev","canonical":"cache client","aliases":["CacheClient"]}'
```

The entity catalog returns canonical records, merge suggestions, and enrichment candidates. Merge/split operations update the alias registry, recanonicalize stored memories and relations, and record audit events.

## List Memories

```bash
curl "http://localhost:8787/memories?userId=dev"
```

## Search

```bash
curl -X POST http://localhost:8787/search \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"What language should Atlas use?","limit":5,"mode":"rrf","expandQuery":true}'
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
  "mode": "path",
  "expandQuery": true,
  "queryExpansions": ["command line", "terminal"],
  "includeLinkedIdentities": true,
  "includePrivate": false,
  "weights": {"temporal": 0.4, "trust": 0.3}
}
```

Search modes are `hybrid`, `rrf`, `graph`, and `path`. Expansion can be deterministic, provider-backed through the JSON-command intelligence adapter, or caller-supplied with `queryExpansions`. Results include explanations, `retrievalMode`, `expandedQueries`, `fusion`, graph path hints, optional contradiction metadata, and context-verification decisions when available.

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
  -d '{"id":"codex","name":"Codex","namespace":"coding","brainIds":["team-brain"],"permissions":["read","write","share"],"subscriptions":{"events":["memory.write","memory.share.request"],"brainIds":["team-brain"]}}'
curl -X PUT http://localhost:8787/personas \
  -H "content-type: application/json" \
  -d '{"id":"researcher","label":"Researcher","summaryStyle":"descriptive","privacyDefault":"private"}'
curl -X POST http://localhost:8787/agents/codex/persona \
  -H "content-type: application/json" \
  -d '{"personaId":"researcher"}'
curl "http://localhost:8787/events?agentId=codex&brainId=team-brain"
```

Brains are logical memory databases. Sources are content repositories inside a brain. Agents register namespaces, permissions, optional personas, and event subscriptions before writing scoped memories. Personas carry retrieval, summary, and privacy defaults that connectors can apply automatically.

## Feedback

```bash
curl -X POST http://localhost:8787/feedback \
  -H "content-type: application/json" \
  -d '{"userId":"dev","memoryId":"<id>","kind":"helpful"}'
curl -X POST http://localhost:8787/feedback/injection \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"release graph proof","injectedMemoryIds":["mem_good","mem_bad"],"acceptedMemoryIds":["mem_good"],"rejectedMemoryIds":["mem_bad"],"outcome":"accepted","signals":{"graph":0.9,"trust":0.8}}'
```

Supported feedback kinds are `helpful`, `wrong`, `stale`, `always_include`, `never_include`, `private`, `shareable`, `approve_pattern`, and `reject_pattern`. Feedback updates bounded trust/importance metadata, handles inferred-pattern review, and feeds later retrieval tuning. Injection feedback records accepted and rejected context packs, updates affected memories, adds a retrieval training sample, and produces or refreshes a scoped learned profile.

The equivalent CLI is `cognibrain memory feedback-injection "release graph proof" accepted <good-id>,<bad-id> '{"graph":0.9,"trust":0.8}' <good-id> <bad-id>`. The final two optional CSV arguments, or `MEMORY_ACCEPTED_IDS` and `MEMORY_REJECTED_IDS`, let a harness send mixed accepted/rejected context packs from one injection.

## Retrieval Profiles

```bash
curl http://localhost:8787/profiles
curl -X PUT http://localhost:8787/profiles \
  -H "content-type: application/json" \
  -d '{"id":"coding","label":"Coding","weights":{"trust":0.4,"entity":0.3,"graph":0.2,"keyword":0.1}}'
curl -X POST http://localhost:8787/profiles/learn \
  -H "content-type: application/json" \
  -d '{"id":"learned-coding","scope":{"userId":"dev","projectId":"atlas"}}'
curl -X POST http://localhost:8787/profiles/training-samples \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"Redis cache","outcome":"accepted","signals":{"entity":1,"trust":0.8}}'
```

Profiles store normalized weights with provenance. The learning endpoint derives a bounded profile from accumulated feedback events and labeled training samples, can scope learning by user/project/app/org/agent, then records sample count and loss metadata.

## Identity Links And Timelines

```bash
curl -X POST http://localhost:8787/identity-links \
  -H "content-type: application/json" \
  -d '{"primaryUserId":"device-b","linkedUserId":"device-a","consentToken":"user-approved-token"}'
curl -X POST http://localhost:8787/search \
  -H "content-type: application/json" \
  -d '{"userId":"teammate","orgId":"org-1","query":"release architecture","includeSharedBrains":true,"brainIds":["brain_team"]}'
curl -X POST http://localhost:8787/federation/search \
  -H "content-type: application/json" \
  -d '{"userId":"teammate","agentId":"codex","orgId":"org-1","query":"release architecture","brainIds":["team-brain","org-brain"]}'
curl -X POST http://localhost:8787/memories/mem_123/share-request \
  -H "content-type: application/json" \
  -d '{"orgId":"org-1","requestedBy":"codex","note":"Useful for the team playbook."}'
curl -X POST http://localhost:8787/memories/mem_123/promote \
  -H "content-type: application/json" \
  -d '{"orgId":"org-1"}'
curl -X POST http://localhost:8787/memories/mem_123/share-revoke \
  -H "content-type: application/json" \
  -d '{"actorId":"codex","reason":"No longer approved."}'
curl -X POST http://localhost:8787/memories/mem_123/consent \
  -H "content-type: application/json" \
  -d '{"visibility":"public","allowTraining":true}'
curl "http://localhost:8787/audit?memoryId=mem_123"
curl -X POST http://localhost:8787/memories/mem_123/revert \
  -H "content-type: application/json" \
  -d '{}'
curl http://localhost:8787/storage
curl -X POST http://localhost:8787/sync/offline-operations \
  -H "content-type: application/json" \
  -d '{"type":"add","userId":"local","input":{"userId":"local","content":"Offline note captured before reconnecting."}}'
curl -X POST http://localhost:8787/sync/run
curl http://localhost:8787/timeline/dev
curl -X POST http://localhost:8787/timeline/dev/summarize \
  -H "content-type: application/json" \
  -d '{"granularity":"week","persist":true,"style":"concise"}'
curl "http://localhost:8787/temporal/dev?after=2026-05-01T00:00:00.000Z&before=2026-06-01T00:00:00.000Z"
curl http://localhost:8787/patterns/dev
curl "http://localhost:8787/graph?userId=dev"
curl "http://localhost:8787/graph/paths?userId=dev&from=atlas&to=redisadapter&maxDepth=3&relationTypes=depends_on,imports"
curl "http://localhost:8787/graph/activate?userId=dev&query=atlas%20redis&maxDepth=3"
curl "http://localhost:8787/graph/export?userId=dev&format=graphml&minTrust=0.7"
curl -X POST http://localhost:8787/graph/query \
  -H "content-type: application/json" \
  -d '{"userId":"dev","query":"MATCH (a)-[:depends_on]->(b) WHERE trust>0.8 RETURN a,b,trust"}'
curl -X POST http://localhost:8787/graph/infer \
  -H "content-type: application/json" \
  -d '{"rules":[{"id":"custom","label":"depends + imports","when":{"left":"depends_on","right":"imports"},"then":"transitive_depends_on","confidence":0.56}]}'
curl -X POST http://localhost:8787/lifecycle/preview \
  -H "content-type: application/json" \
  -d '{"userId":"dev","policy":{"archiveAfterDays":30}}'
curl http://localhost:8787/learning/dream-policy/dev
curl -X POST http://localhost:8787/learning/observations/dev \
  -H "content-type: application/json" \
  -d '{"persist":true,"style":"descriptive","limit":3}'
curl "http://localhost:8787/learning/predictions/dev?query=Friday%20release%20review&limit=3"
```

Identity links require an explicit consent token and store only a hash of that token. Shared-brain retrieval is opt-in via `includeSharedBrains` and `brainIds`, then still respects consent and org visibility. `/federation/search` reports searched and blocked brains so agents can audit cross-brain access. Shared-memory review supports request, promote, and revoke steps with audit events. `/storage` reports active and available persistence adapters. `/sync/*` lets offline clients queue add/update/delete/consent operations, replay them, and inspect conflicts. `/audit` exposes filtered provenance logs, and memory revert restores the last captured write/update/delete/consent snapshot. Timelines expose event time, validity windows, supersession metadata, and hour/day/week/month period groupings. Timeline summarization can return deterministic or provider-backed summaries and optionally persist auditable reflection memories with `summaryOf` provenance. Temporal interval queries consider event and validity windows, then return filtered events plus changed entities. Pattern reports include reviewed dream patterns, deterministic recurring weekday/entity/tag patterns, sequence patterns, confidence, and false-positive risk for operator approval. The learning endpoints preview adaptive dream thresholds from health and feedback, generate cited observations from memory clusters, and return prediction/prefetch reports with anomaly flags for stale or risky memories. The graph endpoints expose canonical entities, aliases, typed relation edges, ranked connection paths, spreading activation, safe graph-query matches, configurable rule-based inferred relations, and filtered JSON/GraphML exports. Path edges include confidence, trust, timestamp, source and memory provenance. Lifecycle preview reports keep/fade/archive/protect actions without mutating memory state.

## Events, Webhooks, Marketplace, And Compliance

```bash
curl -X POST http://localhost:8787/webhooks \
  -H "content-type: application/json" \
  -d '{"url":"https://example.invalid/memory","events":["memory.write","inference.run","connector.sync","provider.call"]}'
curl http://localhost:8787/webhooks/deliveries
curl -X POST http://localhost:8787/webhooks/deliver \
  -H "content-type: application/json" \
  -d '{}'
curl -X POST http://localhost:8787/webhooks/deliver \
  -H "content-type: application/json" \
  -d '{"real":true}'
curl http://localhost:8787/events
curl "http://localhost:8787/audit?type=sync.run"
curl -X POST http://localhost:8787/marketplace/install \
  -H "content-type: application/json" \
  -d '{"id":"persona-researcher","kind":"persona","name":"Researcher","version":"1.0.0","description":"Citation-heavy defaults","manifest":{"id":"researcher","label":"Researcher","summaryStyle":"descriptive"}}'
curl -X POST http://localhost:8787/marketplace/install \
  -H "content-type: application/json" \
  -d '{"id":"domain-research"}'
curl -X POST http://localhost:8787/marketplace/plan \
  -H "content-type: application/json" \
  -d '{"id":"retrieval-trust-heavy"}'
curl http://localhost:8787/marketplace
curl http://localhost:8787/sdk/openapi
curl http://localhost:8787/benchmarks/trend
curl http://localhost:8787/benchmarks/leaderboard
curl -X POST http://localhost:8787/migration/export \
  -H "content-type: application/json" \
  -d '{"target":"managed","backupRef":"local-backup://2026-05","ssoProvider":"oidc","secretManager":"vault"}'
curl -X POST http://localhost:8787/backup/verify \
  -H "content-type: application/json" \
  --data-binary @managed-bundle.json
curl -X POST http://localhost:8787/migration/import \
  -H "content-type: application/json" \
  --data-binary @managed-bundle.json
curl http://localhost:8787/compliance
curl http://localhost:8787/compliance/export
curl -X POST http://localhost:8787/retention/rules \
  -H "content-type: application/json" \
  -d '{"label":"Transcript archive","retentionDays":30,"action":"archive","scope":{"sourceKind":"transcript"}}'
curl -X POST http://localhost:8787/retention/enforce \
  -H "content-type: application/json" \
  -d '{"userId":"dev"}'
curl http://localhost:8787/security/keys
curl http://localhost:8787/security/key-provider
curl http://localhost:8787/security/transport
curl -X POST http://localhost:8787/security/key-rotation \
  -H "content-type: application/json" \
  -d '{"keyId":"local","keyVersion":"2","backupRef":"local-backup://2026-05"}'
curl "http://localhost:8787/privacy/insights?epsilon=0.8&k=3"
```

`/webhooks/deliver` defaults to the deterministic local delivery simulator used by tests and offline harnesses. Passing `{"real":true}` sends queued deliveries as HTTP `POST` requests to the registered webhook URL; CLI users can set `MEMORY_WEBHOOK_REAL_HTTP=true` before `webhook-deliver` for the same behavior. Each real delivery body is `{"deliveryId": "...", "event": {...}}` and includes `x-cognibrain-delivery`, `x-cognibrain-event`, and `user-agent: cognibrain-webhook/0.1`. Registrations with `secretRef` receive `x-cognibrain-signature: sha256=<hex>`, computed over the exact JSON body. Delivery records expose attempts, `lastStatusCode`, `lastError`, `lastAttemptAt`, and retry backoff timestamps through `/webhooks/deliveries`. Real HTTP delivery times out after `MEMORY_WEBHOOK_TIMEOUT_MS` or 10 seconds by default so unhealthy endpoints cannot block the queue indefinitely.

Every write/update/delete/search/extract/reflect/share/share-request/share-revoke/agent/persona/connector/provider/inference/entity-merge/entity-split/consent/revert/sync operation records an audit event. Webhooks are queued as local delivery records so operators can inspect retries, simulate delivery, and verify retry metadata before enabling real network delivery. Marketplace installs persist module metadata, validate security scan metadata, materialize personas, register connectors, and save retrieval profiles. `/sdk/openapi` exposes the generated client/API description, and `/migration/export` produces a local-to-managed or backup bundle with SSO, secret-manager labels, Docker/Compose/Kubernetes deployment artifact references, and a concrete import workflow. `/backup/verify` checks encrypted-memory recovery without exposing plaintext, and `/migration/import` restores exported memories plus profiles, personas, connectors, marketplace modules and retention rules. Retention rules can target memory user, brain, source, source kind, visibility, entity, relation type, or tag and are enforced before search and dream. Compliance reports summarize storage scope, consent, retention rules, delete-on-request, encryption key provider status, backup recovery, transport security, data flows, and audit counts. Privacy insights return noised aggregates and suppress groups below the configured k-anonymity threshold.

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

This loop runs unit tests, the synthetic retrieval evaluation, the next-generation feature evaluation, deterministic nextgen benchmark suites, public leaderboard artifact generation, and the production dashboard build. The nextgen evaluator writes `artifacts/nextgen-eval.json`; `benchmark:nextgen` writes `artifacts/nextgen-benchmarks.json` plus `artifacts/benchmark-trend.json`; `leaderboard` writes `artifacts/leaderboard.json` with anonymized score metadata and no raw prompts. Together they prove graph inference/path explanation, graph activation, graph query, GraphML/JSON export, temporal interval and pattern reporting, behavioural retrieval scoring, timeline summaries, staged extraction/enrichment, entity merge suggestions, connector ingestion, injection-feedback learning, adaptive dream policy, generated observations, prediction reports, security/compliance retention, key rotation, privacy insights, multi-tenant audit, webhook event feeds, marketplace persona installation, and public benchmark publication safety.
