# Advanced Features

## Multi-Signal Retrieval

Retrieval combines semantic token overlap, keyword coverage, entity matches, temporal decay, trust, and graph reachability. Entity extraction is zero-dependency: every write links proper nouns, paths, quoted phrases, and lowercase compound terms such as `operator gate` or `dream cycle`. Query-time entity matching boosts exact compound phrases without letting random transcript words become graph edges, so the graph stays useful without requiring an external graph database.

The ranker now accepts configurable weights while preserving the benchmarked default profile. Retrieval profiles can be stored with user/project/app/org scope, selected per search, loaded from `MEMORY_CONFIG_PATH`, or learned from feedback and labeled outcome samples. Search results expose signal explanations, graph path hints, and a deterministic context-verification decision. A lightweight rerank pass runs before context verification, and a JSON-command provider adapter can connect NLI, LLM, or cross-encoder tools without becoming required for local install.

Benchmark runners use the same principle: lexical anchors keep factual recall stable, while fused retrieval reserves part of the top-K for graph and semantic hits that keyword-only ranking would otherwise block.

A result must have actual relevance evidence; trust and recency alone cannot inject unrelated memories.

## Add-Only Extraction And Scopes

The `/extract` surface implements a deterministic single-pass, add-only write path. It accepts user, assistant, tool, system, and operator events; splits durable facts; stores agent/tool actions as first-class memories; deduplicates repeated extracted facts by hash; and links entities during write. Changed facts are appended rather than overwritten so temporal evolution remains inspectable, with supersession relations added when a newer fact appears to replace an older one.

Each memory can carry `userId`, `agentId`, `sessionId`, `appId`, `orgId`, `projectId`, `deviceId`, and `runId`. Search composes these scopes so a harness can isolate a session, aggregate across an app, or include organization-shared memory only when policy allows it. Identity links are explicit consent records that store only a hashed subject token and allow cross-device recall only when callers opt into linked identities.

## Privacy And Feedback

The default local service redacts common secrets before storing memory text. Consent metadata supports private, user, org, and public visibility plus retention and delete-on-request policy. Feedback events such as `helpful`, `wrong`, `always_include`, and `never_include` update bounded trust/importance scores and create audit metadata for later learning.

Domain modules can enrich writes, choose default retrieval weights, tune lifecycle policy, swap the redaction mode, define aliases, and ship application-level evaluation fixtures. The built-in coding module tags API, CLI, class, test, package, endpoint, and import memories so programming work can lean harder on entity and graph signals without changing the public API. Entity extraction also recognizes code symbols, endpoints, package names, repository aliases, and common German/English variants. Sensitive writes can be redacted, rejected, archived, or encrypted with AES-GCM metadata when `MEMORY_ENCRYPTION_KEY` is configured.

## Typed Relations And Time

Memories can store typed relations such as `calls`, `imports`, `depends_on`, `supersedes`, `contradicts`, `confirmed_by`, `suggested_by`, and `executed_by`. The service maintains a canonical entity registry with aliases and memory ids, and `/graph` exposes typed relation edges with direction, confidence, and validity metadata. Retrieval blends entity overlap and typed relation hints into graph scoring and exposes the graph path in result explanations.

Temporal metadata tracks event time, valid windows, last confirmation, supersession, and verification due dates. Search parses simple before/after/last-week temporal constraints, and the timeline API exposes event order plus daily, weekly, and monthly period groupings. Dream maintenance schedules verification for time-sensitive stale facts instead of relying only on age-based archival.

## Graph-Native Reasoning

The next-generation graph substrate adds ranked path search, a compact graph query surface, and auditable inference rules. `graphPaths(from, to)` traverses memory and entity nodes across typed edges, returning the shortest and highest-confidence chains with explanations. `graphQuery()` accepts safe `MATCH ... :relation ... WHERE trust>n` style queries for harnesses that need structured graph inspection. `runInference()` applies typed relation rules such as `depends_on + imports -> transitive_depends_on`, records an audit event, and writes inferred edges back to the store with evidence.

This is still local-first and deterministic by default: no graph database or hosted service is required for multi-hop explanation. Provider-backed expansion can be layered on top later without changing the API shape.

## Brains, Sources, Agents, And Marketplace

Brains are first-class logical memory databases, and sources are content repositories inside a brain. Memories can now carry `brainId` and `sourceId`, while agents register namespaces, permissions, and optional personas before writing. The service enforces brain/source existence and agent write permissions, which is the foundation for team memories, cross-brain federation, and multi-agent collaboration.

The local marketplace registry stores connectors, domain modules, personas, and retrieval profiles. Installing a persona module materializes it into the persona registry so setup flows and dashboards can preview modules before applying them.

## Audit, Webhooks, And Compliance

Every core action records an append-only audit event: memory write/update/delete/share, extraction, search, reflection, webhook registration, marketplace installation, and inference. Webhook registrations produce queued delivery records for matching audit events, creating an inspectable event-feed boundary before real network delivery is enabled.

Compliance reports summarize memory counts, brain/source counts, consent visibility, encrypted entries, expired retention entries, delete-on-request flags, and audit counts by type. This gives operators a concrete exportable control surface instead of a policy note buried in documentation.

## Trust and Provenance

Each memory carries a source kind and confidence. Human and reviewed-code sources start with higher trust than agent or transcript sources. Search results include citations and stale flags so harnesses can decide how much context to inject.

## Reflection

`ReflectionEngine` runs the maintenance loop. In product language this is the dream cycle: the system rethinks stored memories, reevaluates evidence quality, summarizes repeated themes, fades stale low-utility memories, reflects contradictions, and reorganizes memories into better layers.

Contradiction detection now uses a multilingual claim registry for preferences, tooling, runtime, target repository, and health-negation claims. Optional external contradiction classifiers can override or confirm pairwise decisions, which is the extension point for NLI models.

Reflection summaries remain deterministic by default, but an optional summarizer can generate higher-quality prose. Generated summaries still preserve `summaryOf`, `dreamedAt`, `dreamJob`, and provider metadata so operators can audit the source evidence. A safety gate flags generated summaries that introduce unsupported named entities.

The cycle returns a `lifecycle` report with:

- `evaluated`: active memories inspected,
- `summarized`: new reflection memories created,
- `faded`: stale low-utility memories whose trust or importance was lowered,
- `archived`: stale memories removed from active retrieval,
- `reorganized`: memories moved into a better layer or type,
- `qualityScore`: remaining memory-store quality from `0` to `1`,
- `issues` and `actions`: audit text for dashboards and logs.

Pinned memories and lifecycle-protected layers/source kinds are never faded or archived. Reflection summaries include `summaryOf` provenance in metadata so a user can audit where a dream came from. Behavioral pattern memories include support counts, recurrence metadata, confidence, last-observed timestamps, revalidation decay, and a pending review marker that can be approved or rejected through feedback.

## Self-Verification

`npm run eval` runs a synthetic benchmark with single-hop, multi-hop, temporal correction, contradiction, and abstention cases. It compares cognibrain against vector-only, keyword-only, and recency-only baselines and writes `artifacts/evaluation-report.json`. CI uploads this artifact on every push and pull request. Scheduled and manually triggered CI runs execute `npm run benchmark:certified` and upload the certified market-proof JSON artifacts.

`npm run verify:nextgen` extends the loop with `src/eval/nextgen.ts`, which proves the new graph, inference, brain/source, webhook, compliance, and marketplace surfaces using deterministic fixtures before building the production dashboard.

## Dashboard

The dashboard is the local operator UI for the API-backed memory platform. It shows the platform runtime, operator gate, ranked evidence, trust meters, scope/consent metadata, feedback controls, retrieval/lifecycle sliders, automatic dream status, reflection controls, graph/time explanations, runtime analytics, benchmark trends, and benchmark proof.
