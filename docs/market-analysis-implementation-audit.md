# Market Analysis Implementation Audit

This audit tracks the current repo against the 2026 Agent Memory OS market-analysis plan. It exists to prevent overclaiming by separating shipped local/runtime capabilities from external vendor proof boundaries.

## Current Positioning

cognibrain is correctly positioned as an inspectable Agent Memory OS:

- memory you can prove, route, govern, and reuse across agent harnesses,
- evidence packs as the boundary between memory storage and agent context,
- temporal graph, scope, consent, contradiction, audit, lifecycle and benchmark surfaces,
- CLI-first install and operation with MCP-compatible agent access.

## Implementation Matrix

| Market-analysis workpackage | Current status | Evidence in repo | Verification rule |
| --- | --- | --- | --- |
| Product positioning and UX narrative | Implemented | `README.md`, `docs/agent-memory-os.md`, dashboard proof/recall/graph/timeline views | README screenshots are regenerated from the live dashboard after dashboard changes |
| Why-used evidence demo | Implemented | `memory why-used`, `POST /evidence-pack`, `GET /evidence-pack/:id`, MCP `memory_context_pack`, `usp-evidence-pack` benchmark, dashboard artifact inspector with failed question rows | CLI, HTTP, MCP and dashboard surfaces expose the same evidence-pack contract |
| MemoryRecordV2 evidence object | Implemented | `MemoryRecordV2`, JSON schema, inspect/evidence surfaces | Schema and migration paths are covered by tests |
| Validity and belief state | Implemented | `active`, `stale`, `superseded`, `contradicted`, `needs_verification`, `retracted`; dream and retrieval use these states; provider hooks can verify nuanced conflicts | Covered by deterministic and provider-ready verification paths |
| Temporal belief graph | Implemented locally | Typed relations, validity windows, graph path/search/export/explain, temporal query helpers, per-question benchmark rows | External temporal claims use the vendor-artifact import gate |
| Memory router and scopes | Implemented | user/session/app/org/project/brain/source/agent/persona routing, shared-brain federation, consented identity links with hash-only audit, dashboard Route Preview | Routing must show selected and excluded scopes before context injection |
| Shared team memory governance | Implemented | request/promote/review/revoke, reviewer permission checks, audit trail, consent boundaries | Private memory stays private until review approval changes visibility |
| Retrieval Engine vNext | Implemented locally | hybrid/RRF/graph/path modes, profiles, feedback learning, verifier/reranker hooks | Covered by deterministic fallback plus JSON-command provider hooks |
| Query intent classifier | Implemented deterministic/provider-ready | `memory intent`, route/evidence pack integration | Provider classifier quality depends on installed adapter |
| Feedback-driven learning | Implemented locally | injection feedback, connector telemetry, tool-outcome memory, training samples, learned profiles | Native harness packages can now call the shared telemetry endpoint instead of inventing private schemas |
| Episode store and ground-truth preservation | Implemented | episodes, extracted fact provenance, action memory | Privacy policies and redaction run before sensitive raw episodes are stored |
| Evidence pack export | Implemented | CLI/API/MCP evidence pack, dashboard artifact inspector | Covered by CLI, HTTP, MCP, dashboard and benchmark artifact surfaces |
| Dream as belief revision | Implemented locally | contradiction resolution, supersession, timeline summary, pattern promotion, verification queue, procedural extraction | Deterministic and provider-backed summaries/verifications share the same queue/audit path |
| Verification queue | Implemented | `memory verify`, `confirm`, `retract`, dashboard queue surfaces, connector sync/writeback status | External revalidation uses connector polling/sync records and verification audit events |
| Procedural and action memory | Implemented | procedure type/layer, `memory action`, harness action schema, connector telemetry tool outcomes | Covered by CLI/API/harness telemetry path |
| Official connector packages | Productized local packages | `cognibrain-connect`, harness templates, MCP configs, Skill install, generated harness package manifest, connector telemetry API/CLI for Claude Code, Codex, Cursor, Copilot, VS Code, OpenCode, OpenClaw, LangGraph and CrewAI | Covered by setup, templates, helper packages, tests and publish doctor |
| Two-way system connectors | Implemented as manifest-driven adapters | Official manifests for GitHub, Jira, Linear, Slack, Notion, Google Drive, Gmail and Google Calendar; list/poll/sync/writeback HTTP blocks, source-specific payload rendering, generic webhook delivery, connector telemetry | Deployment supplies vendor credentials without changing the connector contract |
| Consent and policy engine | Implemented | policy rules, retention rules, retrieval/dream/export/delete enforcement, audit events, shared-memory reviewer permissions | Covered by local and managed control-plane surfaces |
| Encrypted vault | Implemented locally | sensitive redaction/encryption metadata, key reports, rotation, backup recovery verification | Covered by AES-GCM vault metadata and external key-provider readiness reporting |
| Full answer benchmarks | Implemented with pluggable judges | certified retrieval runners, deterministic answer-generation artifacts, JSON-command answerer/judge hooks, per-question rows | Public vendor claims go through the competitor-artifact import gate |
| USP benchmarks | Implemented | `benchmark:nextgen`, `usp-evidence-pack`, public-safe leaderboard, dashboard failed-question summary | Trend artifacts are generated and exposed through benchmark APIs |
| Domain modules | Implemented | coding/research/legal/sales/support/finance/healthcare/security/privacy modules with evaluation fixtures | Covered by marketplace install and domain evaluation paths |
| Marketplace governance | Implemented locally | manifest validation, signatures, compatibility, scan/review/publish/rate/install | Covered by local registry, review workflow and publishable module metadata |
| Storage and deployment | Implemented | JSON/JSONL/SQLite, local Postgres/Cassandra compatibility files, psql-backed Postgres/Cockroach remote driver, cqlsh-backed Cassandra remote driver | Operators choose a configured durable backend through the persistence boundary |
| Managed/SaaS path | Implemented as local control-plane primitives | migration bundles, managed tenant metadata, control-plane report, remote-driver readiness | Covered by deploy artifacts, managed tenant metadata, migration export/import and publish-gate checks |
| Community/adoption plan | Implemented as contribution workflow | `docs/community.md`, `docs/partners.md`, issue templates, connector/domain/benchmark contribution contracts | Community operations use the documented review queues and partner checklist |

## Publish Claim Boundary

Safe claim:

> cognibrain is a local-first inspectable Agent Memory OS with CLI, HTTP API, MCP, dashboard, evidence packs, graph/temporal/procedural memory, policy controls, local marketplace governance and reproducible benchmark artifacts.

Bounded claim that requires external artifacts:

> cognibrain is proven best on the entire market across all vendors and production environments.

The stronger claim is gated by artifact discipline: imported vendor-comparable benchmark artifacts must use the same answerer/judge/top-k/token-budget methodology, and deployed third-party integrations attach operational proof. The code paths for telemetry, remote storage, enrichment, governance, and benchmark comparability are present and covered by tests.

## Closed Market-Plan Gaps

The following GitHub epics were created from the market-analysis gap pass and are now closed with code, docs, tests, and browser verification evidence. Any reopen should name the exact requirement and proof artifact that no longer passes.

- [#149 Gap Epic: Vendor-comparable proof and benchmark result browser](https://github.com/cognilabz/cognibrain/issues/149)
- [#153 Gap Epic: Native connector telemetry and source-system adapters](https://github.com/cognilabz/cognibrain/issues/153)
- [#156 Gap Epic: Production remote storage and managed deployment](https://github.com/cognilabz/cognibrain/issues/156)
- [#159 Gap Epic: Provider-backed intelligence and external enrichment](https://github.com/cognilabz/cognibrain/issues/159)
- [#162 Gap Epic: Hosted governance identity and consent UX](https://github.com/cognilabz/cognibrain/issues/162)
