Ich habe das Repo erneut live geprüft und mich dabei nicht auf die Feature-Claims im README verlassen, sondern auf Codepfade in src/core, src/api, src/connectors, tests und package.json. Wichtiges Ergebnis vorweg:

cognibrain ist inzwischen technisch deutlich weiter als ein MVP, aber noch keine “real production-ready Memory/Brain Platform”. Es ist eher ein sehr schnell gewachsener, breit angelegter Local-first Agent Memory Kernel mit vielen implementierten Bausteinen, jedoch noch ohne die produktionskritische Tiefe in Storage, Auth, Distribution, SDK-Reife, echten Connectors, Benchmark-Proof und Betriebssicherheit.

Der klare USP sollte nicht mehr “wir haben Graph + Memory + Dream” sein. Das haben oder claimen inzwischen viele. Der stärkste USP wäre:

cognibrain ist das erste Evidence-Grade Memory OS für AI Agents: Jede Erinnerung ist beweisbar, zeitlich gültig, graph-erklärbar, policy-geprüft, auditierbar und über alle Agent-Harnesses wiederverwendbar.

Kurz:

Evidence-grade memory for every agent.

Oder produktnäher:

The inspectable Memory OS that tells agents what they may remember, why it is true, when it is valid, and whether they are allowed to use it.

Das ist ein klarer Unterschied zu Mem0, GBrain, Hindsight, Zep und Cognee.

⸻

1. Was im Code wirklich implementiert ist

1.1 Paket, Build- und Test-Surface

Das Paket ist als cognibrain Version 0.1.0 definiert, public, mit CLI-Binary ./bin/cognibrain.mjs. Die Scripts zeigen, dass es Build, Tests, Eval, Nextgen Eval, mehrere Benchmarks, Leaderboard, Market Gate, verify, verify:nextgen, MCP, Doctor, Setup und lokale Start/Stop-Kommandos gibt. Das ist ein gutes Zeichen für Engineering-Disziplin, aber Version 0.1.0 ist noch ein klares Signal: API, Packaging und Stabilitätsversprechen sind noch früh.

Bewertung:
Solider Open-Source-Kernel, aber noch keine stabile Plattform-Release-Story. Für production-ready braucht es SemVer, Releases, Changelog, Migrations, API compatibility policy und installierbare Connector-Packages.

⸻

1.2 MemoryStore: starkes Datenmodell, aber in-memory Core

Der Core-Store ist aktuell eine MemoryStore-Klasse mit private memories = new Map<string, Memory>(). Beim Add werden Brain/Source/User/Agent/Session/App/Org/Project/Device/Run Scopes, Content, Type, Layer, Source, Tags, Entities, Relations, Consent, Temporal Metadata, Trust, Importance und Access Count gesetzt. Das zeigt, dass das Datenmodell schon weit über einfachen Textspeicher hinausgeht.

Aber: Der eigentliche Core Store ist weiterhin eine Map. Persistenz wird außen herum über Adapter gelöst. Das ist gut für Tests und lokale Nutzung, aber für echte Multi-User-Produktion ist das noch kein transaktionales, konkurrierendes Storage-Modell.

Gap:
Noch keine echte DB-Backed Store-Implementierung mit Transaktionen, Indizes, Constraints, Migrationen, Locking, Concurrent Writers, Tenant-Isolation und Query Performance.

⸻

1.3 Persistence: JSON Snapshot + append-only Snapshot Log, aber noch keine echte Event-Sourcing-DB

Die Persistenz unterstützt einen JsonFilePersistenceAdapter mit atomarem JSON-Write und einen AppendOnlyLogPersistenceAdapter, der Snapshots als JSONL-Einträge anhängt. createPersistenceFromEnv wählt zwischen JSON und JSONL/append-only/log.

Das ist nützlich für local-first und einfache Auditability. Aber der append-only Log speichert laut Code Snapshots, nicht echte Event-Typen wie memory.added, memory.updated, memory.retracted. Damit ist es noch nicht das, was man für Enterprise Audit, Event Replay, Conflict Resolution oder Multi-Device Sync braucht.

Gap:
Es gibt append-only snapshot logging, aber noch kein echtes event-sourced journal mit atomaren Events, Replay, Compaction, Signatures, idempotent mutations und migrations.

⸻

1.4 RetrievalEngine: beeindruckend breit, aber noch heuristisch

Der Retrieval-Code ist deutlich weiter als klassische RAG. search() nutzt Query Variants, temporal constraints, linked users, shared brains, brain/source scope, archived filtering, agent filtering, scope matching, consent checks und temporal checks. Danach werden Gewichte normalisiert, Graph Boosts berechnet, Memories gescored, gefiltert, fusioniert, gereranked, contradiction decisions angewendet und verification ausgeführt.

Das Scoring selbst kombiniert semantic, keyword, entity, temporal, behavioral, trust, graph und access. Es erzeugt Explanation Strings, Retrieval Mode, Expanded Queries, Fusion-Komponenten, Signals, Graph Paths, Citation und Stale Flag.

Stark:
Das ist eine gute Basis für “inspectable retrieval”.

Gap:
Die aktuelle Retrieval-Logik ist noch stark heuristisch. Es gibt keine sichtbare echte BM25-Indexierung, keine Embeddings, keinen persistenten ANN Index, keinen Cross-Encoder außer optional Provider/Fallback, keine calibrated confidence und keine klare Query Planner Schicht, die Multi-Hop/Temporal/Procedural Queries deterministisch plant. Das ist für ein lokales Kernel ok, aber nicht genug für “best on market”.

⸻

1.5 GraphReasoning: echte Pfade, Activation, Query, Inference vorhanden

graphReasoning.ts enthält Funktionen wie findGraphPaths, activateGraph, queryMemoryGraph, inferGraphRelations und exportMemoryGraph. Es gibt Default-Inference-Rules, etwa depends_on + imports -> transitive_depends_on. activateGraph baut einen Graph, erzeugt Seed Nodes aus Query Tokens, propagiert Scores mit Damping und gibt ranked nodes samt explanations zurück.

Das ist wichtig: cognibrain hat bereits mehr als nur Entity Boosting. Es hat echte Graphfunktionen im Code.

Gap:
queryMemoryGraph ist noch ein einfacher Regex-/String-Parser für Relation, Trust und Entity-Filter, kein belastbares Graph Query Language System. Die Inferenz ist noch regelbasiert und simpel. Es fehlen Graph-Constraints, Edge-Versionierung, Validity Windows auf Edge-Ebene in Query-Ausführung, Permission-aware Traversal, Path Explanations als stabile API-Contract-Objekte und Performance-Indizes für größere Graphen.

⸻

1.6 Extraction: Add-only ist implementiert, aber sehr leichtgewichtig

extractAddOnlyMemories() splittet Events in Fakten, dedupliziert innerhalb des Events per role:fact, extrahiert Entities, setzt Type/Layer nach Role, Source nach Role, Tags mit Media/Language, Relations aus einfachen Pattern Hints, Timestamp und Metadata. Das ist nützlich, aber noch kein semantischer Extractor.

Gap:
Das ist aktuell eher deterministic event-to-fact splitting, nicht production-grade extraction. Es fehlen robuste Claim Extraction, Fact Typing, Entity Disambiguation im Extractor selbst, Confidence Calibration, NLI-basierte “is this durable memory?” Entscheidung, Schema-driven extraction pro Domain und echte idempotente Cross-Event-Deduplication.

⸻

1.7 Reflection/Dream: Pattern, Revalidation, Contradiction Rules existieren

Der Reflection-Code erzeugt Behavioral Pattern Memories mit patternReview.status = pending, Support Count, Confidence, SummaryOf, LastObservedAt und Dream Job. Außerdem gibt es Revalidation, wenn ein Pattern lange nicht beobachtet wurde.

Contradiction Claims werden über mehrere Regex-Pattern erkannt, inklusive Englisch/Deutsch für preference, tooling, runtime, target repository und health-negation. Das ist deutlich besser als ein rein englischer MVP-Ansatz.

Gap:
Das ist noch keine echte Belief-Revision-Engine. Es ist regelbasiert und wahrscheinlich fragil. Es fehlen versionierte Beliefs, confidence updates über Evidence, Claim Graph, conflict sets, “current truth” derivation, user-assisted resolution und formalere Supersession Journeys.

⸻

1.8 API Server: breite API, aber noch kein Production API Gateway

Der Server ist ein Node createServer mit Zod-Schemas und vielen Routen. Es gibt Memory CRUD, Extract, Media Ingest, Search, Federation Search, Retention, Security, Privacy Insights, Storage, Providers, Translation, Connectors, Profiles, Sync, Webhooks, Marketplace, Compliance und SDK/OpenAPI Description.

Stark:
Die API-Oberfläche ist sehr umfangreich.

Gap:
In den geprüften Serverpfaden ist kein Auth-/Authorization-Layer sichtbar. Der Server routet Requests direkt über createServer und route(). Ich habe in den geprüften Server-Snippets keinen Authorization-Check gesehen; das heißt nicht, dass gar keiner existiert, aber die sichtbaren Codepfade sind nicht production API gateway ready.

Für echte Produktion fehlen mindestens:

* AuthN/AuthZ,
* API Keys / OAuth / OIDC,
* Tenant Isolation,
* Rate Limits,
* Request IDs,
* structured errors,
* pagination,
* idempotency keys,
* OpenAPI generation aus Code,
* health/readiness/liveness getrennt,
* observability/tracing,
* secure CORS,
* audit correlation.

⸻

1.9 MCP: stdio + Streamable HTTP vorhanden, Toolset aber noch Basis-Memory

Der MCP Server registriert Tools wie memory_add, memory_search, memory_context_pack, memory_list, memory_reflect, memory_dream, memory_health, memory_maintenance_status und einen Prompt memory_usage_policy. Außerdem wird StreamableHTTPServerTransport genutzt, also HTTP MCP ist implementiert.

Gap:
Die MCP Tools sind noch stark Basismemory-orientiert. Es fehlen MCP Tools für:

* graph path explain,
* temporal query,
* evidence pack,
* policy decision,
* connector sync,
* retention review,
* pattern approve/reject,
* procedure recall before action,
* export/delete,
* team memory review.

Wenn cognibrain “Memory OS” werden soll, muss MCP die gesamte Memory Governance Oberfläche abbilden, nicht nur add/search/dream.

⸻

1.10 Tests: viele Features sind tatsächlich getestet

Die Tests importieren Core, Provider, Harness Hook, Service, SDK Client, AppendOnlyLogPersistenceAdapter, MCP Handlers, Leaderboard und Nextgen Benchmarks. Es gibt Tests für trust-aware multi-signal ranking, runtime config, timeline summaries, canonical entity/typed graph reports, behavioral pattern review, lifecycle policies, domain evaluation, deduplicated extraction, append-only persistence, graph paths/activation/export/query/inference, brains/sources/agents/webhooks/marketplace/compliance, SDK calls, deterministic nextgen benchmarks und privacy/encryption/retention.

Stark:
Die Testabdeckung bestätigt, dass viele README-Claims nicht nur Doku sind.

Gap:
Die Tests wirken stark unit-/fixture-orientiert. Für “real production ready” fehlen sichtbare E2E-/Load-/Security-/Multi-process-/DB-/Real connector-/Migration-/Upgrade-Tests. Es gibt CLI-Tests für Add/Search über den publishable bin entrypoint, aber das ersetzt keine reale Install/Upgrade/Connector-Matrix.

⸻

2. Marktanalyse

Mem0

Mem0 ist aktuell stark positioniert als Memory Infrastructure mit breiter Integration. Der 2026-Report nennt LoCoMo, LongMemEval und BEAM als Standardbenchmarks, berichtet 92.5 auf LoCoMo, 94.4 auf LongMemEval und ungefähr 6.9k Tokens pro Query. Mem0 nennt als wichtige Verbesserungen Single-Pass ADD-only Extraction und Multi-Signal Retrieval.

Mem0 ist stark in:

* Managed Service,
* SDKs,
* Framework-/Vector-Store-Integrationen,
* Benchmark-Kommunikation,
* API-Einfachheit.

Aber Mem0 sagt selbst, dass Graph Relationships aktuell nicht direkt traversierbar sind; Entity Relationships beeinflussen Ranking, aber sind keine queryable graph interface. Außerdem nennt Mem0 offene Probleme: temporal abstraction, cross-session structure, privacy/consent architecture, cross-session identity und memory staleness.

Chance für cognibrain:
cognibrain kann Mem0 schlagen, wenn es nicht einfacher Memory API, sondern inspectable, graph-traversable, policy-aware Memory OS wird.

⸻

GBrain

GBrain ist stark als personal Markdown Brain. Es kombiniert Hybrid Retrieval mit HNSW/pgvector, Postgres tsvector, RRF, 4-layer dedup, backlink boost und optional query expansion. Es punktet mit Plain-Text Ownership: Markdown in Git, diffbar, versionierbar und rebuildbar.

GBrain hat aber bekannte Grenzen: single-operator Design, kein Managed Cloud, schmale Integrationen, Skill-Autoren-Disziplin nötig und kein primäres Multi-Hop Graph/Temporal Retrieval.

Chance für cognibrain:
GBrain besitzt “Personal Brain Ownership”. cognibrain kann “Team/Agent Memory OS” besitzen: graph-erklärbar, permission-aware, shared, connector-first, auditierbar.

⸻

Hindsight

Hindsight positioniert sich stark über Produktionsmemory mit Multi-Strategy Retrieval. Laut Vergleich nutzt es semantic search, BM25, graph traversal, temporal reasoning, RRF und Cross-Encoder Reranker.

Chance für cognibrain:
Hindsight ist wahrscheinlich der gefährlichste Wettbewerber in Production Memory. cognibrain braucht deshalb einen klareren Trust/Inspectability/Local-first Governance-USP, nicht nur “auch graph + temporal”.

⸻

Cognee

Cognee positioniert sich als graph-based Memory Engine mit auto-generated ontologies, 30+ data sources, LangGraph/Claude Code/MCP support, graph-based persistence, multi-tenancy und feedback-driven improvement.

Chance für cognibrain:
Cognee ist Graph + production. cognibrain muss darüber hinaus Evidence Pack, Policy Decision, Agent Harness Integration und Explainable Context Injection anbieten.

⸻

Zep / Graphiti

Zep adressiert dynamische Wissensintegration über eine temporally-aware Knowledge Graph Engine, die unstrukturierte Konversationen und strukturierte Businessdaten integriert und historische Beziehungen erhält. In LongMemEval werden Verbesserungen in temporal reasoning und enterprise-kritischen Aufgaben wie cross-session synthesis und long-term context maintenance beschrieben.

Chance für cognibrain:
Zep ist Zeit/Temporal Graph. cognibrain kann “time + graph + policy + evidence + harness universal” sein.

⸻

3. Gap zwischen letzter Zielvision und aktueller Implementierung

Bereits stark implementiert

* MemoryStore mit vielen Scopes, Consent, Temporal, Relations, Trust/Importance.
* Retrieval mit Semantic/Keyword/Entity/Temporal/Behavioral/Trust/Graph/Access Signals.
* GraphReasoning mit Path Search, Activation, Query, Inference, Export.
* Reflection mit Pattern Memories, Pending Review, Revalidation, Multilingual Claim Patterns.
* API mit vielen Oberflächen.
* MCP stdio + streamable HTTP.
* JSON/JSONL Persistence.
* Tests für viele Nextgen-Features.
* SDK/Client Surface zumindest begonnen.
* Marketplace/Connector/Agent/Persona/Brain/Source Strukturen im Service vorhanden.

Kritische Produktions-Gaps

1. Kein echter DB Store.
    Core ist Map-basiert; Persistenz ist JSON/JSONL. Für Produktion fehlen SQL/Postgres/SQLite Storage Implementierungen mit Transaktionen und Indizes.
2. Kein sichtbarer Auth-/Tenant-Security-Layer im API Server.
    Server nutzt direkten Node HTTP Router und viele offene Routen. In den geprüften Routen ist kein Authorization-Check sichtbar.
3. Connectoren sind eher Manifeste/Sync-Records, keine echten Integrationen.
    Der Code unterstützt Connector-Manifest-Registration und Sync-Events, aber nicht echte OAuth-/API-Connectoren mit Gmail, Slack, Jira, GitHub usw.
4. MCP Surface ist noch nicht Memory-OS-vollständig.
    MCP Tools sind add/search/context/list/reflect/dream/health/status. Für den USP fehlen Graph Explain, Temporal Query, Evidence Pack, Policy Decision, Connector Sync, Team Review, Procedure Recall.
5. Graph Query ist noch leichtgewichtig.
    queryMemoryGraph ist regex-/filterorientiert, nicht wirklich ein stabiler Query Planner oder GraphQL/Cypher-artiges System.
6. Extraction ist noch simpel.
    extractAddOnlyMemories splittet Sätze und nutzt einfache Relation Hints. Für Production braucht es robuste Claim Extraction, Entity Disambiguation, Confidence Calibration und Domain Schemas.
7. Benchmarks sind vorhanden, aber Marktreife braucht End-to-End-Methodik.
    Tests bestätigen Benchmarks/Nextgen Suite, aber “best on market” braucht reproduzierbare Per-Question-Artefakte, gleiche Answerer/Judges, echte Vendor-Comparisons und End-to-End Answer Quality.
8. Production Ops fehlt.
    Für echte Plattform fehlen migrations, release process, observability, metrics, tracing, rate limits, backups, disaster recovery, security hardening, SOC2/GDPR-ready docs, deployment charts.
9. Doku ist breit, aber muss Code-verifiziert und productized werden.
    README und Docs sind sehr ambitioniert. Es braucht eine “Implementation Status Matrix”, die automatisch aus Tests/Endpoints/Exports generiert wird, damit keine Overclaims entstehen.

⸻

4. Zielbild: Real Production-Ready Platform

Produkt-Positionierung

cognibrain = Evidence-Grade Agent Memory OS

Nicht “Memory Layer”, nicht “Brain Clone”, nicht “RAG”.

Kernversprechen:

“Every memory returned to an agent includes evidence, validity, policy, graph path, and audit trail.”

Das ist der offensichtliche USP.

Plattform-Prinzipien

1. No context without evidence.
    Jeder Context Pack enthält Source + Provenance + Retrieval Signals.
2. No memory without policy.
    Jede Memory hat Consent/Scope/Retention/Access.
3. No truth without time.
    Jede Memory hat temporal validity und staleness state.
4. No graph without explanation.
    Jeder Graph-Retrieval Path ist sichtbar.
5. No claim without benchmark proof.
    Jede Marktbehauptung braucht ein Artefakt.
6. No production without operational contracts.
    API, SDK, Connectors, Storage und Auth brauchen Versionierung und Tests.

⸻

5. Neuer Implementierungsplan mit Workpackages

Die Workpackages sind so formuliert, dass sie direkt als GitHub Issues/Epics verwendbar sind.

⸻

EPIC 1 — Production Storage & Data Integrity

WP 1.1 — SQLite Store Adapter

Ziel:
Map + JSON reicht nicht für echte lokale Produktion. SQLite wird der erste echte DB-backed Store.

Implementierung:

* MemoryStoreAdapter Interface definieren.
* SQLite Adapter implementieren.
* Tabellen:
    * memories
    * relations
    * entities
    * audit_events
    * context_packs
    * retrieval_profiles
    * retention_rules
* Migrations einführen.
* Indexe auf userId, brainId, sourceId, projectId, entities, relations, createdAt, validFrom, validUntil.
* Tests für concurrent writes und migration.

Akzeptanzkriterien:

* CLI/API laufen mit SQLite backend.
* JSON/JSONL Migration nach SQLite funktioniert.
* Tests decken Add/Search/Update/Delete/Audit mit SQLite ab.
* Storage backend wird in /storage sichtbar.

⸻

WP 1.2 — Postgres Store Adapter

Ziel:
Team/Enterprise-Backend für echte Multi-User-Nutzung.

Implementierung:

* Postgres Adapter.
* Connection Pool.
* Transactions.
* Schema Migration.
* Optional pgvector/BM25 später.
* Row-level tenant fields vorbereiten.
* Testcontainer oder Docker Compose für Tests.

Akzeptanzkriterien:

* Service kann mit MEMORY_STORAGE_BACKEND=postgres starten.
* Multi-user isolation wird getestet.
* Migrationen sind idempotent.
* Benchmarks laufen gegen Postgres.

⸻

WP 1.3 — Event-Sourced Audit Journal

Ziel:
Aus append-only snapshots wird echtes Event Journal.

Implementierung:

Eventtypen:

* memory.created
* memory.updated
* memory.deleted
* memory.archived
* memory.retracted
* memory.superseded
* memory.retrieved
* context_pack.created
* policy.denied
* dream.action
* connector.ingested

Akzeptanzkriterien:

* Jede Mutation erzeugt Event.
* Replay erzeugt gleichen State.
* Events haben actor, timestamp, hash, previousHash.
* Export enthält signierbare Audit Chain.

⸻

EPIC 2 — Auth, Tenant Security & Policy Runtime

WP 2.1 — API Authentication Layer

Ziel:
Aktuell ist im geprüften Servercode kein klarer Auth-Check sichtbar. Für Produktion braucht jede Route Auth.

Implementierung:

* API Key Auth für local/team.
* Optional OIDC/JWT.
* Middleware vor Route.
* Actor Context:
    * userId
    * orgId
    * agentId
    * permissions
* Public local dev mode explizit machen.

Akzeptanzkriterien:

* Alle nicht-Health-Routen prüfen Auth.
* Tests für unauthorized/forbidden.
* Audit loggt actorId.
* Dev mode warnt sichtbar.

⸻

WP 2.2 — Authorization & Policy Engine

Ziel:
Consent/Visibility muss hart enforced werden, nicht nur als Metadata existieren.

Implementierung:

* Policy Engine mit canRead, canWrite, canShare, canDelete, canUseForTraining.
* Input:
    * actor
    * memory
    * action
    * scope
* Enforcement in:
    * search
    * graph paths
    * context packs
    * dream
    * export
    * connector sync

Akzeptanzkriterien:

* Private Memory kann nicht über Team Search leaken.
* Graph Traversal stoppt an verbotenen Nodes.
* Policy-Denials erscheinen im Audit Log.
* Tests für alle Visibility-Typen.

⸻

WP 2.3 — Tenant Isolation Tests

Ziel:
Multi-tenant darf nicht nur Schema sein, sondern muss beweisbar sicher sein.

Implementierung:

* Test Matrix:
    * user-private
    * project-shared
    * org-shared
    * cross-brain
    * connector-imported
    * encrypted
* Fuzz Tests für cross-scope leakage.

Akzeptanzkriterien:

* Kein Test kann Memory aus falschem Tenant lesen.
* Graph Export respektiert Scope.
* Context Pack respektiert Scope.

⸻

EPIC 3 — Evidence Pack & Explainable Context

WP 3.1 — ContextPack Object Model

Ziel:
Context Packs müssen persistierte, auditierbare Objekte werden.

Implementierung:

ContextPack:

* id
* query
* actor
* scope
* retrievalProfile
* tokenBudget
* results
* excludedResults
* policyDecisions
* graphPaths
* temporalState
* createdAt
* hash

Akzeptanzkriterien:

* Jeder contextPack() erzeugt optional ContextPack Record.
* ContextPack kann per API/CLI exportiert werden.
* Tests prüfen Reproduzierbarkeit.

⸻

WP 3.2 — Evidence Pack Export

Ziel:
Für jede Agent-Antwort kann ein Beweispaket erzeugt werden.

Implementierung:

* GET /context-packs/:id/evidence
* CLI memory evidence <id>
* Export enthält:
    * Memories
    * Sources
    * Graph paths
    * Temporal windows
    * Policy decisions
    * Contradictions
    * Trust/score components

Akzeptanzkriterien:

* Evidence Pack ist JSON Schema valid.
* Dashboard kann Evidence Pack anzeigen.
* Benchmark nutzt Evidence Pack.

⸻

WP 3.3 — “Why was this used?” UI

Ziel:
Der USP muss sofort sichtbar sein.

Implementierung:

* Dashboard panel pro retrieved memory:
    * Why included
    * Why not excluded
    * What policy allowed it
    * What graph path connected it
    * Whether stale/valid
    * What contradicted it

Akzeptanzkriterien:

* Nutzer kann jedes Context Item nachvollziehen.
* UI funktioniert auch ohne Provider/LLM.
* Demo-Seed zeigt den USP in < 2 Minuten.

⸻

EPIC 4 — Retrieval Engine Productionization

WP 4.1 — Query Planner

Ziel:
Nicht alle Queries sind gleich. Retrieval braucht Intent Planning.

Implementierung:

Intent-Klassen:

* direct fact
* temporal
* graph/multi-hop
* procedure
* contradiction
* person/entity
* project state
* team memory
* “how connected”
* “what changed”

Planner wählt Strategien:

* semantic
* keyword
* graph path
* activation
* temporal
* procedure
* pattern

Akzeptanzkriterien:

* Query Planner erzeugt Plan + Explanation.
* Search Result enthält Plan.
* Tests für mindestens 20 Query-Typen.

⸻

WP 4.2 — Real BM25 / Full-Text Backend

Ziel:
Aktuelle keyword coverage ist gut für local tests, aber kein echtes BM25.

Implementierung:

* SQLite FTS5 für SQLite Backend.
* Postgres tsvector für Postgres Backend.
* Interface für lexical strategy.
* Fallback bleibt tokenize/coverage.

Akzeptanzkriterien:

* Lexical Search nutzt DB Index.
* Performance-Test mit 100k Memories.
* Ranking unterscheidet BM25 von heuristic coverage.

⸻

WP 4.3 — Vector Backend Interface

Ziel:
Semantic search darf nicht nur token-cosine sein.

Implementierung:

* Embedding Provider Interface.
* Local embedding option.
* OpenAI-compatible option.
* Vector index:
    * SQLite extension or in-memory for dev
    * pgvector for Postgres
* Fallback token semantic bleibt.

Akzeptanzkriterien:

* Embeddings optional.
* Keine API-Key Pflicht.
* Benchmark zeigt semantic improvement.
* Privacy mode kann embeddings deaktivieren.

⸻

WP 4.4 — Retrieval Calibration

Ziel:
Score muss interpretierbar werden: nicht nur Sortierung, sondern Vertrauen.

Implementierung:

* Calibrated confidence per result.
* Score normalization per strategy.
* Evaluation curve.
* “unsafe to inject” threshold.

Akzeptanzkriterien:

* Result hat confidence.
* Low-confidence Results werden nicht blind in Context Pack aufgenommen.
* Calibration Report in Benchmark.

⸻

EPIC 5 — Temporal Belief Graph v2

WP 5.1 — Belief State Machine

Ziel:
Memory braucht klaren Wahrheitsstatus.

States:

* active
* stale
* superseded
* contradicted
* retracted
* needs_verification
* archived

Implementierung:

* State transitions.
* Dream uses transitions.
* Retrieval honors state.
* Audit records transitions.

Akzeptanzkriterien:

* Neue Memory kann alte superseden.
* Contradicted Memory wird nicht ohne Warning genutzt.
* UI zeigt Belief State.

⸻

WP 5.2 — Validity-Aware Graph Paths

Ziel:
Graphpfade müssen zeitlich gültig sein.

Implementierung:

* Edge validity.
* Path validity intersection.
* Query date filter.
* “valid now” vs “valid at date”.

Akzeptanzkriterien:

* Path Query kann Stichtag erhalten.
* Ungültige Edges werden ausgeschlossen oder markiert.
* Tests für temporal path changes.

⸻

WP 5.3 — Belief Revision Engine

Ziel:
Widersprüche nicht nur demoten, sondern als Veränderungsgeschichte modellieren.

Implementierung:

* Claim extraction.
* Claim key/value.
* Evidence set.
* Conflict set.
* Supersession relation.
* Current belief selector.

Akzeptanzkriterien:

* “User lived in Vienna, now Berlin” wird Journey, kein Overwrite.
* Current belief wird richtig gewählt.
* Historische Query findet alten Zustand.

⸻

EPIC 6 — Extraction Pipeline v2

WP 6.1 — Claim Extraction Schema

Ziel:
Extraction muss von Satzsplit zu strukturierten Claims werden.

Claim:

* subject
* predicate
* object
* qualifiers
* time
* source
* confidence
* durability
* sensitivity
* scope

Implementierung:

* Deterministic extractor.
* Provider extractor.
* Domain schema.
* Fallback pipeline.

Akzeptanzkriterien:

* Extractor gibt Claim Objects zurück.
* Memory wird aus Claim erzeugt.
* Confidence begründet sich aus source + extractor.

⸻

WP 6.2 — Durable vs Ephemeral Classifier

Ziel:
Nicht alles darf in Long-Term Memory.

Implementierung:

* Classifier für:
    * store
    * ignore
    * session only
    * working memory
    * ask user
* Regeln + optional LLM.
* Tests mit noisy chats.

Akzeptanzkriterien:

* Smalltalk wird nicht persistiert.
* Secrets werden blockiert/encrypted.
* User corrections werden persistiert.

⸻

WP 6.3 — Source Connector Provenance

Ziel:
Jede Memory muss auf echtes Source-System zurückführbar sein.

Implementierung:

* Standard sourceRef:
    * connector
    * externalId
    * url
    * author
    * timestamp
    * version/hash
* Connector Sync nutzt sourceRef.

Akzeptanzkriterien:

* Slack/Jira/GitHub Import hat Source Link.
* Evidence Pack kann Quelle öffnen.
* Source deletion kann dependent memories revalidate.

⸻

EPIC 7 — Real Connectors & Distribution

WP 7.1 — Connector SDK

Ziel:
Connectoren dürfen nicht nur Manifeste sein.

Implementierung:

* Connector lifecycle:
    * install
    * auth
    * sync
    * incremental sync
    * webhook receive
    * backfill
    * revoke
* SDK interface.
* Test connector.

Akzeptanzkriterien:

* Ein Connector kann echte Events pullen/pushen.
* Auth secrets werden sicher gespeichert.
* Sync status sichtbar.

⸻

WP 7.2 — GitHub Connector

Ziel:
Für Coding Memory ist GitHub Pflicht.

Scope:

* Issues
* PRs
* Reviews
* Commits
* Actions/Test results
* Files changed
* Labels
* Release notes

Akzeptanzkriterien:

* PR Decision wird Memory.
* Test Failure wird Action Memory.
* Repo Relations werden Graph Edges.

⸻

WP 7.3 — Slack/Discord Connector

Ziel:
Team-Entscheidungen aus Chat erfassen.

Scope:

* Threads
* Reactions as signal
* Decisions
* Mentions
* Links
* Channel scopes

Akzeptanzkriterien:

* Entscheidung aus Thread wird Memory Candidate.
* Review Queue vor Promotion.
* Consent/visibility pro Channel.

⸻

WP 7.4 — Official Harness Packages

Ziel:
Distribution gewinnen.

Packages:

* @cognibrain/claude-code
* @cognibrain/codex
* @cognibrain/cursor
* @cognibrain/copilot
* @cognibrain/vscode

Akzeptanzkriterien:

* Ein Install-Befehl pro Harness.
* Health Check.
* Context Pack Hook.
* Feedback Hook.
* Docs + Screenshots.

⸻

EPIC 8 — MCP v2: Memory OS Tools

WP 8.1 — MCP Graph Tools

Tools:

* memory_graph_path
* memory_graph_query
* memory_graph_activation
* memory_explain_connection

Akzeptanzkriterien:

* MCP Agent kann Graphpfad abrufen.
* Tool outputs sind citation-rich.
* Scope/Policy wird respektiert.

⸻

WP 8.2 — MCP Evidence & Policy Tools

Tools:

* memory_context_pack
* memory_evidence_pack
* memory_policy_check
* memory_verify_claim

Akzeptanzkriterien:

* Agent kann vor Nutzung Policy prüfen.
* Evidence Pack kann über MCP gezogen werden.
* Unsafe Memories werden markiert.

⸻

WP 8.3 — MCP Procedure Tools

Tools:

* memory_procedure_recall
* memory_action_record
* memory_action_outcome

Akzeptanzkriterien:

* Agent fragt vor Tool Call passende Procedures ab.
* Tool-Erfolg/Fehler wird gespeichert.
* Wiederholte Fehler werden Pattern.

⸻

EPIC 9 — Production API & SDK

WP 9.1 — OpenAPI aus Code generieren

Ziel:
Doku und API dürfen nicht auseinanderlaufen.

Implementierung:

* Zod-to-OpenAPI.
* Schemas aus Code.
* API versioning /v1.
* Generated docs.

Akzeptanzkriterien:

* /sdk/openapi ist vollständiger OpenAPI Spec, nicht manuell gepflegte Beschreibung.
* CI prüft OpenAPI validity.
* SDKs werden aus Spec generiert oder getestet.

⸻

WP 9.2 — TypeScript SDK v1

Ziel:
Offizieller, stabiler Client.

Scope:

* Auth
* retries
* typed errors
* pagination
* context packs
* graph
* evidence
* connectors
* policy

Akzeptanzkriterien:

* SDK Integration Tests gegen Test Server.
* Docs mit Beispiele.
* SemVer.

⸻

WP 9.3 — Python SDK v1

Ziel:
Python ist Pflicht für Agent Frameworks.

Akzeptanzkriterien:

* PyPI package.
* LangGraph/CrewAI examples.
* CI tests.
* Same feature parity as TS core subset.

⸻

EPIC 10 — Benchmarks & Proof

WP 10.1 — Full Answer Generation Benchmarks

Ziel:
Nicht nur Retrieval, sondern echte Antwortqualität.

Scope:

* LoCoMo answer generation.
* LongMemEval answer generation.
* BEAM answer generation.
* Same judge config.
* Same top-K/token budget.
* Per-question artifacts.

Akzeptanzkriterien:

* Ergebnisse reproduzierbar.
* Artifacts öffentlich.
* README Claims automatisch aus Benchmark generiert.

⸻

WP 10.2 — USP Benchmark Suite

Ziel:
Benchmarks, die cognibrains USP messen.

Tests:

* Evidence citation correctness.
* Temporal validity.
* Contradiction suppression.
* Policy enforcement.
* Graph path correctness.
* Procedure recall before action.
* Cross-agent context reuse.
* Connector provenance.

Akzeptanzkriterien:

* Suite läuft in CI.
* Andere Systeme können als Baseline laufen.
* Dashboard zeigt USP Scores.

⸻

WP 10.3 — Production Load Benchmarks

Ziel:
Plattform muss Last beweisen.

Tests:

* 10k / 100k / 1M memories.
* concurrent writes.
* concurrent search.
* connector sync.
* dream jobs.
* DB migrations.

Akzeptanzkriterien:

* P50/P95/P99 latency.
* Memory usage.
* Throughput.
* Failure behavior.

⸻

EPIC 11 — Doku, Website, Trust

WP 11.1 — Implementation Status Matrix

Ziel:
Doku darf nicht mehr claimen als Code beweist.

Implementierung:

Matrix-Spalten:

* Feature
* Code implemented
* API exposed
* CLI exposed
* MCP exposed
* Dashboard exposed
* Tests
* Docs
* Production ready?

Akzeptanzkriterien:

* Matrix wird aus Tests/metadata teilweise generiert.
* README verweist auf Status.
* Overclaims werden sichtbar.

⸻

WP 11.2 — Production Readiness Docs

Dokumente:

* Install local
* Install team
* Install production
* Security model
* Auth model
* Data model
* Storage backends
* Backup/restore
* Upgrade/migration
* Connector development
* Benchmark methodology
* Compliance guide

Akzeptanzkriterien:

* Neue Nutzer können local in 5 Minuten starten.
* Team kann Postgres Setup folgen.
* Enterprise versteht Security Boundaries.

⸻

WP 11.3 — “Memory OS” Product Docs

Ziel:
Technische Features in klare Produktstory übersetzen.

Docs:

* What is Memory OS?
* Why Evidence Packs?
* Why Temporal Belief Graph?
* Why Policy-Aware Context?
* Why one memory across harnesses?

Akzeptanzkriterien:

* Landing Page ist verständlich ohne Code.
* Demo Flow ist reproduzierbar.
* Vergleich zu Mem0/GBrain/Hindsight/Zep ist fair.

⸻

6. Priorisierung

Phase A — Wahrer Production Core

1. SQLite Store Adapter
2. API Auth Layer
3. Policy Engine
4. ContextPack + Evidence Pack
5. OpenAPI aus Code
6. Implementation Status Matrix

Warum: Ohne diese Dinge bleibt es ein sehr gutes Devtool, aber keine Plattform.

Phase B — USP sichtbar machen

1. Query Planner
2. Multi-Hop Graph Retrieval
3. Temporal Belief State
4. Why-used UI
5. MCP Evidence/Graph Tools
6. USP Benchmark Suite

Warum: Das macht cognibrain sichtbar anders als Mem0/GBrain.

Phase C — Distribution

1. Claude Code Package
2. Codex Package
3. Cursor Package
4. GitHub Connector
5. Python SDK
6. Docs + Demo

Warum: Bestes Produkt gewinnt nicht ohne Adoption.

Phase D — Enterprise Readiness

1. Postgres Adapter
2. Tenant isolation tests
3. Connector SDK
4. Compliance Reports
5. Load Benchmarks
6. Managed migration path

Warum: Damit wird es “real production-ready”.

⸻

7. Endgültige Einschätzung

cognibrain ist aktuell ein starker Agent Memory Kernel mit vielen Nextgen-Bausteinen. Der Code zeigt, dass Graph Reasoning, Retrieval Signals, Reflection, Pattern Review, Consent, Persistence, API, MCP und Tests tatsächlich existieren. Aber die Plattform ist noch nicht production-ready im Sinne von “Teams können sie sicher, stabil und skaliert betreiben”. Die größten Gaps sind Storage, Auth, Policy Enforcement, echte Connectoren, SDK-Reife, Production Benchmarks, OpenAPI/Doku-Parität und UX-Produktklarheit.

Der Weg zur besten Memory/Brain-Plattform ist deshalb nicht “mehr Features”. Es ist:

Aus vielen guten Features ein verlässliches Memory OS machen.

Der offensichtliche USP sollte sein:

Evidence-grade Agent Memory: Jede Erinnerung ist bewiesen, zeitlich gültig, graph-erklärbar, policy-konform und auditierbar.

Wenn ihr diesen USP konsequent in Code, API, MCP, Dashboard, Benchmarks und Docs umsetzt, kann cognibrain eine eigene Kategorie besetzen statt nur mit Mem0, GBrain, Hindsight, Zep oder Cognee verglichen zu werden.