# Advanced Features

## Multi-Signal Retrieval

Retrieval combines semantic token overlap, keyword coverage, entity matches, temporal decay, trust, and graph reachability. Entity extraction is zero-dependency: every write links proper nouns, paths, quoted phrases, and lowercase compound terms such as `operator gate` or `dream cycle`. Query-time entity matching boosts exact compound phrases without letting random transcript words become graph edges, so the graph stays useful without requiring an external graph database.

The ranker now accepts configurable weights while preserving the benchmarked default profile. Retrieval profiles can be stored with user/project/app/org scope, selected per search, or learned from feedback samples. Search results expose signal explanations, graph path hints, and a deterministic context-verification decision. A lightweight rerank pass runs before context verification, and optional NLI, LLM, or cross-encoder providers can plug into the reranker or verifier interfaces without becoming required for local install.

Benchmark runners use the same principle: lexical anchors keep factual recall stable, while fused retrieval reserves part of the top-K for graph and semantic hits that keyword-only ranking would otherwise block.

A result must have actual relevance evidence; trust and recency alone cannot inject unrelated memories.

## Add-Only Extraction And Scopes

The `/extract` surface implements a deterministic single-pass, add-only write path. It accepts user, assistant, tool, system, and operator events; splits durable facts; stores agent/tool actions as first-class memories; deduplicates repeated extracted facts by hash; and links entities during write. Changed facts are appended rather than overwritten so temporal evolution remains inspectable, with supersession relations added when a newer fact appears to replace an older one.

Each memory can carry `userId`, `agentId`, `sessionId`, `appId`, `orgId`, `projectId`, `deviceId`, and `runId`. Search composes these scopes so a harness can isolate a session, aggregate across an app, or include organization-shared memory only when policy allows it. Identity links are explicit consent records that store only a hashed subject token and allow cross-device recall only when callers opt into linked identities.

## Privacy And Feedback

The default local service redacts common secrets before storing memory text. Consent metadata supports private, user, org, and public visibility plus retention and delete-on-request policy. Feedback events such as `helpful`, `wrong`, `always_include`, and `never_include` update bounded trust/importance scores and create audit metadata for later learning.

Domain modules can enrich writes, choose default retrieval weights, tune lifecycle policy, swap the redaction mode, define aliases, and ship application-level evaluation fixtures. The built-in coding module tags API, CLI, class, test, package, endpoint, and import memories so programming work can lean harder on entity and graph signals without changing the public API. Entity extraction also recognizes code symbols, endpoints, package names, repository aliases, and common German/English variants.

## Typed Relations And Time

Memories can store typed relations such as `calls`, `imports`, `depends_on`, `supersedes`, `contradicts`, `confirmed_by`, `suggested_by`, and `executed_by`. Retrieval blends entity overlap and typed relation hints into graph scoring and exposes the graph path in result explanations.

Temporal metadata tracks event time, valid windows, last confirmation, supersession, and verification due dates. Search parses simple before/after/last-week temporal constraints, and the timeline API exposes event order plus monthly period groupings. Dream maintenance schedules verification for time-sensitive stale facts instead of relying only on age-based archival.

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

Pinned memories and lifecycle-protected layers/source kinds are never faded or archived. Reflection summaries include `summaryOf` provenance in metadata so a user can audit where a dream came from. Behavioral pattern memories include support counts, recurrence metadata, confidence, last-observed timestamps, and revalidation decay.

## Self-Verification

`npm run eval` runs a synthetic benchmark with single-hop, multi-hop, temporal correction, contradiction, and abstention cases. It compares cognibrain against vector-only, keyword-only, and recency-only baselines and writes `artifacts/evaluation-report.json`. CI uploads this artifact on every push and pull request. Scheduled and manually triggered CI runs execute `npm run benchmark:certified` and upload the certified market-proof JSON artifacts.

## Dashboard

The dashboard is the local operator UI for the API-backed memory platform. It shows the platform runtime, operator gate, ranked evidence, trust meters, scope/consent metadata, automatic dream status, reflection controls, graph/time explanations, runtime analytics, and benchmark proof.
