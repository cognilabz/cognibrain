Analyse: aktueller Stand von cognibrain gegen Zielplan & Markt

Ich habe den aktuellen öffentlichen Stand des Repos erneut live geprüft. Wichtig: Ich bewerte hier primär das, was im Code und in den sichtbaren Projektdateien erkennbar ist, nicht nur das, was README oder Roadmap behaupten.

Kurzfazit

cognibrain ist aktuell ein sehr starker Local-first Memory Kernel, aber noch keine vollständig production-ready Memory/Brain Platform. Die Codebasis zeigt inzwischen echte Substanz: ein TypeScript-Core, CLI, API, MCP-Server, Dashboard, Benchmark-Skripte, Graph-Reasoning, Retrieval-Signale, Reflection/Dream, Extraction, Scopes, Provider-Hooks und Tests. Das Paket ist aber noch 0.1.0, nutzt im Core weiterhin eine in-memory Map als primären Store, und die sichtbaren Dependencies enthalten keine echten DB-/Auth-/Queue-/Observability-Bausteine wie PostgreSQL-, SQLite-, Redis-, OpenTelemetry- oder Auth-Bibliotheken.

Meine Einschätzung:
cognibrain ist technisch ungefähr bei “Advanced prototype / strong local platform kernel”, nicht bei “production-grade platform”. Das ist aber gut: Die richtige Basis ist da. Jetzt muss die Arbeit von “mehr Features” auf Härtung, Beweisbarkeit, Distribution, echte Storage-Backends, Auth/Policy, End-to-End-Benchmarks und Produktklarheit wechseln.

Der USP sollte weiterhin sein:

Evidence-grade Agent Memory OS
Jede Erinnerung ist beweisbar, zeitlich gültig, graph-erklärbar, policy-geprüft und über Agenten/Harnesses hinweg wiederverwendbar.

Das ist ein anderer Marktclaim als Mem0, GBrain, Zep, Cognee oder Hindsight. Mem0 ist stark bei API/Integrationen und Benchmarks, GBrain bei Markdown/Personal Brain, Zep bei Temporal KG, Cognee bei Graph/Vector Control Plane, Hindsight bei Production Memory/Integrationen. cognibrain muss die Kategorie Inspectable / Governed / Evidence-grade Memory OS besetzen.

⸻

1. Was im aktuellen Repo wirklich stark ist

1.1 Package- und Tooling-Oberfläche

Das Projekt ist als cognibrain Paket mit CLI-Binary ./bin/cognibrain.mjs definiert. Es gibt Scripts für dev, dashboard, build, test, eval, benchmark:locomo, benchmark:longmemeval, benchmark:beam, benchmark:nextgen, leaderboard, benchmark:market, benchmark:certified, verify, verify:nextgen, CLI, MCP, Doctor, Setup und lokale Start/Stop/Status-Kommandos. Das ist für ein junges Projekt sehr gut und zeigt, dass Benchmarking, CLI und lokale Runtime ernst genommen werden.

Gap: Version 0.1.0 und die sehr kleine Dependencies-Liste zeigen auch: Es ist noch keine reife Plattform mit stabiler API, DB-Backends, Auth, Observability, Queueing oder produktionsreifen SDKs.

1.2 Core Store: gutes Memory-Modell, aber noch kein Produktionsspeicher

Der Core MemoryStore ist aktuell eine Klasse mit private memories = new Map<string, Memory>(). Beim Hinzufügen werden Source, Trust, Entities, Consent, Scopes und weitere Memory-Metadaten verarbeitet, aber der grundlegende Store ist im Code sichtbar eine In-Memory-Map.

Bedeutung:
Das ist für Tests und local-first Entwicklung perfekt. Für Production bedeutet es aber: Storage muss noch abstrahiert und mit SQLite/Postgres/Cloud-Backends wirklich umgesetzt werden. JSON/JSONL oder Map-basierte Persistenz ist kein ausreichender Produktionsspeicher für Multi-User, Concurrency, Backups, Migrations, Tenant-Isolation und Audit.

1.3 Retrieval Engine: breit und inspectable, aber noch stark heuristisch

Die Retrieval Engine kombiniert mehrere Signale. Im Code ist erkennbar, dass mode, normalisierte Retrieval-Weights, Graph Boosts, Scoring, Relevance Filtering, Fusion, Reranking, Contradiction Decisions und Verification nacheinander angewendet werden. Das ist eine gute Grundlage für “explainable retrieval”.

Stark:
cognibrain ist bereits deutlich weiter als ein einfacher Vektorstore. Es gibt Retrieval-Modes, Gewichtung, Graphsignale, Verification und Kontextformatierung.

Gap:
Die aktuelle Engine wirkt noch stark regel-/heuristikgetrieben. Es ist nicht erkennbar, dass bereits echte DB-gestützte BM25-Indizes, pgvector/ANN-Suche, Cross-Encoder-Reranking als Standard, kalibrierte Confidence Scores oder ein stabiler Query Planner produktionsreif existieren. Für Marktführung muss Retrieval von “heuristisch stark” zu planner-driven, benchmarked, calibrated and backend-indexed wachsen.

1.4 Graph Reasoning: echte Substanz vorhanden

graphReasoning.ts enthält echte Funktionen für findGraphPaths, activateGraph, queryMemoryGraph und inferGraphRelations. findGraphPaths nutzt BFS-artige Traversal-Logik mit maxDepth, Relationstypen und Pfad-Scoring. activateGraph implementiert eine Art spreading activation mit Seeds, Damping, Depth und ranked Results. inferGraphRelations kann aus Regelkombinationen neue Relation ableiten.

Stark:
Das ist ein echter Differenzierungsanker. Viele Systeme behaupten “Graph”, nutzen ihn aber nur als Retrieval-Boost. cognibrain hat bereits erste echte Graph-Reasoning-Primitiven.

Gap:
queryMemoryGraph wirkt noch sehr einfach: Relation, Trust und Entity werden per Regex aus einem Query-String herausgezogen. Das ist kein stabiler Graph Query Planner, kein GraphQL/Cypher-Äquivalent und kein permission-aware Graph Execution Layer. Für Production muss daraus ein echtes, getestetes Graph-Query-System werden.

1.5 Extraction: Add-only vorhanden, aber noch leichtgewichtig

extractAddOnlyMemories() splittet Event-Content in Facts, dedupliziert pro Event/Role, extrahiert Entities und erzeugt MemoryInput-Objekte. Das ist ein guter Start für add-only Memory und Agent/Event-Ingestion.

Gap:
Das ist noch keine robuste Claim Extraction. Für “beste Memory-Plattform” braucht es strukturierte Claims: Subject, Predicate, Object, Time, Scope, Confidence, Source, Durability, Sensitivity, Relations. Der aktuelle Ansatz ist eher “deterministic sentence/fact splitter”.

1.6 Reflection/Dream: Architektur vorhanden, aber noch keine echte Belief-Revision-Engine

ReflectionEngine existiert und nimmt Lifecycle Policy, Contradiction Detector und Summarizer entgegen. Das ist architektonisch gut, weil deterministic fallback und provider-backed intelligence möglich sind.

Gap:
Die nächste Stufe ist nicht “noch bessere Summaries”, sondern eine echte Belief Revision Engine: Claims, Evidence Sets, Conflict Sets, Supersession, Current Truth, Validity Windows und Review/Verification Queues.

1.7 MCP: vorhanden, aber noch zu “Basic Memory Tool”-orientiert

Der MCP Server nutzt @modelcontextprotocol/sdk, registriert Tools wie memory_add, memory_search, memory_context_pack, memory_list, memory_reflect, memory_dream, memory_health und memory_maintenance_status. Es gibt auch Streamable HTTP MCP.

Stark:
MCP ist live im Code. Das ist wichtig für Distribution.

Gap:
Für “Memory OS” fehlen MCP Tools für:

* memory_explain
* memory_graph_path
* memory_policy_check
* memory_evidence_pack
* memory_temporal_query
* memory_procedure_recall
* memory_action_record
* memory_connector_sync
* memory_review_queue

Aktuell kann ein Agent Memory nutzen, aber noch nicht wirklich Memory Governance über MCP betreiben.

⸻

2. Marktbild gegen cognibrain

Mem0

Mem0 ist aktuell stark bei Distribution, API, Integrationen und Benchmarks. Mem0 nennt LoCoMo, LongMemEval und BEAM als Standardbenchmarks und berichtet 92.5 auf LoCoMo, 94.4 auf LongMemEval und ca. 6.9k Tokens pro Query. Außerdem nennt Mem0 21 Frameworks und 20 Vector Stores sowie offene Probleme wie temporal abstraction, cross-session identity und memory staleness.

Was cognibrain daraus lernen muss:
Mem0 gewinnt über einfache Integration und Trust durch Benchmarks. cognibrain muss deshalb offizielle Connector Packages und reproduzierbare Benchmarks priorisieren.

Wo cognibrain gewinnen kann:
Mem0 beschreibt selbst, dass Entity Relationships aktuell Ranking beeinflussen, aber nicht direkt als queryable Graph Interface traversiert werden können. Genau hier kann cognibrain mit Graph Paths, Evidence Packs und Temporal Belief Graph differenzieren.

GBrain

GBrain ist stark bei Personal Brain, Markdown Ownership, Hybrid Retrieval, Zero-LLM Entity Extraction, Fail-Improve Loop, Backlink-Boosting und “compiled truth + timeline”.

GBrain ist aber bewusst single-operator, self-host only, integrationsschmal und kein echtes Multi-Tenant-Produkt. Es ist laut Review nicht als Multi-Tenant Memory Infrastructure für tausende Endnutzer gebaut.

Was cognibrain daraus lernen muss:
Ownership und Inspectability sind extrem wertvoll. “Markdown/Git-like auditability” ist ein emotionaler Produktvorteil.

Wo cognibrain gewinnen kann:
Nicht als Personal Markdown Brain, sondern als Team- und Agenten-übergreifendes Evidence Memory OS mit Governance, Policy, Graph und Connectors.

Cognee

Cognee positioniert sich als Graph + Vector Memory Engine mit durable storage, graph-based reasoning, self-host/cloud, multi-tenancy, feedback-driven improvement und 30+ data sources.

Was cognibrain daraus lernen muss:
Graph + Multi-Tenancy + Connectors sind Marktstandard für Production-Ansprüche, nicht “nice to have”.

Wo cognibrain gewinnen kann:
Cognee ist stark in “Memory Control Plane”. cognibrain sollte stärker in Evidence-grade Context Injection werden: nicht nur Graph Memory, sondern jedes Context Pack ist erklärbar, policy-checked, zeitlich validiert und auditierbar.

Zep / Graphiti und Forschungsrichtung

Zep/Graphiti zeigt, dass Temporal Knowledge Graphs ein harter Markttrend sind. Das Paper beschreibt Graphiti als temporally-aware Knowledge Graph Engine, die unstrukturierte Konversationen und strukturierte Businessdaten integriert und historische Beziehungen erhält.

MemMachine geht in Richtung Ground-Truth-Preservation und speichert komplette Episoden, um lossy extraction zu vermeiden. Das ist sehr relevant: Für echte Memory-Plattformen reicht “extrahierte Facts speichern” nicht; man braucht Original-Episoden als Beweisquelle.

APEX-MEM kombiniert Property Graph, append-only storage und retrieval-time conflict resolution für temporally coherent long-term memory. Das ist nahezu genau die Richtung, in die cognibrain gehen sollte.

⸻

3. Reifegrad-Matrix gegen Ziel “beste Memory/Brain Platform”

Bewertung

Core Memory Model: 70%

Gut: Trust, Source, Relations, Scopes, Consent, Temporal Metadata sind im Modell und Store sichtbar.
Gap: kein stabiler versionierter Evidence Object Contract, keine echte DB-Constraints, keine Belief-State-Maschine.

Retrieval: 65%

Gut: Multi-Signal, Graph, Rerank, Verify, Modes, Context Pack.
Gap: keine produktionsreife BM25-/Vector-Backend-Implementierung sichtbar, keine kalibrierte Confidence, kein Query Planner.

Graph Reasoning: 60%

Gut: Graph Paths, Activation, Inference existieren.
Gap: Query Language ist noch primitiv; keine permission-aware Graph Traversal Engine; keine temporal path validity.

Reflection/Dream: 55%

Gut: Reflection Engine mit Detector/Summarizer Hooks.
Gap: keine volle Belief Revision, keine Verification Queue als Kernprodukt, keine Current Truth Engine.

Storage/Persistence: 35%

Gut: local-first, Map, JSON/JSONL wahrscheinlich vorhanden.
Gap: keine echte SQLite/Postgres/transactional production store Schicht sichtbar; keine Migration-/Replay-/Compaction-Story.

API/MCP: 50%

Gut: API und MCP existieren; MCP Streamable HTTP existiert.
Gap: Auth, Rate Limits, API versioning, OpenAPI generation, production errors, MCP Governance Tools fehlen.

Connectors/Distribution: 30%

Gut: Connector-Manifeste/Sync-Surface claims und API-Oberflächen existieren.
Gap: keine echten official installable connector packages oder echte System-Connectoren mit OAuth/API-Sync als Produkt sichtbar.

Benchmarks/Proof: 50%

Gut: viele Scripts, certified benchmark commands, nextgen eval.
Gap: “best on market” braucht End-to-End Answer Benchmarks, methodisch faire Vendor-Artefakte, Per-Question Outputs, public reproducibility.

Production Ops: 20%

Gut: Doctor/Setup/local status.
Gap: keine klaren Auth/tenant/observability/deployment/migration/security-hardening Bausteine.

Gesamt: ca. 50–55% auf dem Weg zur Plattform, aber 70–75% auf dem Weg zu einem sehr guten lokalen Agent-Memory-Kernel.

⸻

4. Erreichbarkeit des Ziels

Ja, cognibrain kann den Zielstand erreichen. Aber nur, wenn die nächsten Schritte nicht weiter Feature-Expansion sind, sondern Produktionshärtung + USP-Schärfung + Distribution + Proof.

Der gefährlichste Fehler wäre jetzt: Noch mehr Features einbauen, während Storage/Auth/Connectors/Docs/Benchmarks nicht produktionsreif sind.

Der richtige Weg:

1. Memory OS Contract stabilisieren.
2. Production Storage und Auth einbauen.
3. Evidence Packs und Policy Enforcement als Kern-USP liefern.
4. Graph/Temporal Retrieval produktionsreif machen.
5. Offizielle Harness Connector Packages veröffentlichen.
6. Benchmark- und Doku-Claims automatisch an Code-Tests binden.

⸻

5. Neuer Implementierungsplan

EPIC 1 — Product Contract: Evidence-grade Memory OS

WP 1.1 — MemoryRecord v2 finalisieren

Ziel:
Ein stabiler, versionierter Memory-Record als Kernvertrag.

Beschreibung:
Der aktuelle Store zeigt bereits viele Felder. Diese müssen in ein offizielles MemoryRecordV2 Schema überführt werden: content, source, scope, consent, trust, importance, temporal validity, relations, graph refs, audit refs, evidence refs.

Umsetzung:

* MemoryRecordV2 Type definieren.
* JSON Schema erzeugen.
* Migration von aktuellem Memory.
* API gibt nur noch versionierte Records zurück.
* Docs generieren aus Schema.

Akzeptanzkriterien:

* Schema ist testbar.
* API und SDK nutzen denselben Type.
* Breaking Changes nur über Versionierung.

⸻

WP 1.2 — EvidencePack als First-Class Object

Ziel:
Jeder Agent-Kontext muss beweisbar sein.

Beschreibung:
Ein EvidencePack enthält Query, Retrieval Plan, Scope, Policy Decision, Memories, Graph Paths, Temporal States, Contradiction Status, Scores und Source Citations.

Umsetzung:

* EvidencePack Type.
* ContextPack persistieren.
* GET /context-packs/:id/evidence.
* CLI memory evidence <id>.
* MCP Tool memory_evidence_pack.

Akzeptanzkriterien:

* Jede Retrieval-Session kann exportiert werden.
* EvidencePack ist JSON Schema valid.
* Dashboard zeigt EvidencePack lesbar.

⸻

WP 1.3 — “Why was this retrieved?” überall

Ziel:
Den USP sichtbar machen.

Beschreibung:
Jede Memory im Context Pack muss erklären, warum sie verwendet wurde.

Umsetzung:

* whyIncluded
* whyNotExcluded
* scoreBreakdown
* policyDecision
* graphPath
* temporalValidity
* contradictionWarnings

Akzeptanzkriterien:

* CLI, API, MCP und Dashboard zeigen dieselbe Explanation.
* Demo zeigt den Unterschied zu Mem0/GBrain in 2 Minuten.

⸻

EPIC 2 — Production Storage

WP 2.1 — StorageAdapter Interface

Ziel:
Core Store von in-memory Map entkoppeln.

Beschreibung:
Aktuell ist MemoryStore sichtbar Map-basiert. Das muss in eine Adapter-Schicht mit InMemoryStore, SQLiteStore, PostgresStore getrennt werden.

Umsetzung:

* Interface:
    * create
    * update
    * delete
    * archive
    * list
    * searchIndexUpdate
    * auditWrite
    * transaction
* InMemoryAdapter als bisheriger Default.
* Persistence Adapter nicht mehr nur Snapshot, sondern Store-Backend.

Akzeptanzkriterien:

* Bestehende Tests laufen gegen InMemory.
* Neue Testmatrix läuft gegen SQLite.
* API kennt Store nicht direkt.

⸻

WP 2.2 — SQLite Backend

Ziel:
Real local production.

Umsetzung:

* SQLite Tables:
    * memories
    * relations
    * entities
    * audit_events
    * context_packs
    * retrieval_profiles
    * retention_rules
* SQLite FTS5 für Keyword Search.
* Migrations.
* Backup/restore.

Akzeptanzkriterien:

* MEMORY_STORAGE_BACKEND=sqlite funktioniert.
* 100k Memory Smoke Test.
* Migrations idempotent.

⸻

WP 2.3 — Postgres Backend

Ziel:
Team/Enterprise Backend.

Umsetzung:

* Postgres Adapter.
* Connection Pool.
* Transactions.
* tsvector Index.
* optional pgvector später.
* Tenant Indexes.

Akzeptanzkriterien:

* Multi-user tests laufen.
* Transaction rollback getestet.
* Performance Report vorhanden.

⸻

WP 2.4 — Event-Sourced Audit Journal

Ziel:
Aus Snapshot-Log wird echter Audit/Event-Stream.

Events:

* memory.created
* memory.updated
* memory.retracted
* memory.superseded
* context_pack.created
* policy.denied
* dream.action
* connector.ingested

Akzeptanzkriterien:

* Replay erzeugt gleichen State.
* Events haben actor, hash, previousHash.
* Export ist signierbar.

⸻

EPIC 3 — Auth, Policy & Tenant Isolation

WP 3.1 — Auth Layer für API

Ziel:
API produktionsfähig machen.

Beschreibung:
Der sichtbare API-Server hat sehr viele Routen, aber in den geprüften Snippets ist kein harter Auth-Layer sichtbar. Für Production ist das kritisch.

Umsetzung:

* API Key Auth.
* Optional OIDC/JWT.
* Dev Mode explizit.
* Actor Context:
    * userId
    * orgId
    * agentId
    * permissions.

Akzeptanzkriterien:

* Alle Mutationsrouten brauchen Auth.
* Tests für 401/403.
* Dev Mode zeigt Warnung.

⸻

WP 3.2 — Policy Engine

Ziel:
Consent/Scope darf nicht nur Metadata sein.

Umsetzung:

* canRead
* canWrite
* canDelete
* canPromote
* canUseInContext
* Enforcement in:
    * search
    * graph traversal
    * evidence pack
    * dream
    * export
    * connector sync.

Akzeptanzkriterien:

* Private Memory leakt nicht in Team Context.
* Graph Traversal stoppt an verbotenen Nodes.
* Policy Denials werden auditiert.

⸻

WP 3.3 — Tenant Isolation Test Suite

Ziel:
Sicherheit beweisen.

Umsetzung:

* Fuzz Tests für Scope Leakage.
* Cross-brain tests.
* Encrypted memory tests.
* Connector source permission tests.

Akzeptanzkriterien:

* Kein Tenant kann fremde Memory lesen.
* CI blockiert Scope Regression.

⸻

EPIC 4 — Retrieval Engine v2

WP 4.1 — Query Planner

Ziel:
Retrieval soll geplant werden, nicht nur alle Signale kombinieren.

Query-Typen:

* fact lookup
* temporal
* graph/multi-hop
* procedure
* contradiction
* project state
* team memory
* connection explanation

Umsetzung:

* Deterministischer Classifier.
* Optional Provider Classifier.
* Planner Output:
    * selected strategies
    * excluded strategies
    * reason
    * risk level

Akzeptanzkriterien:

* Temporal Query nutzt Temporal Strategy.
* Multi-hop Query nutzt Graph Strategy.
* Planner Explanation wird im EvidencePack gespeichert.

⸻

WP 4.2 — Real Lexical Search

Ziel:
Keyword-Suche produktionsreif machen.

Umsetzung:

* SQLite FTS5.
* Postgres tsvector.
* Fallback: heutige token coverage.
* Ranking-Tests.

Akzeptanzkriterien:

* Keyword Search ist indexgestützt.
* 100k Memory Benchmark.
* BM25/FTS Scores in Explanation sichtbar.

⸻

WP 4.3 — Vector Backend Interface

Ziel:
Semantik optional, aber professionell.

Umsetzung:

* Embedding Provider Interface.
* Local embeddings.
* OpenAI-compatible embeddings.
* pgvector.
* privacy-off mode.

Akzeptanzkriterien:

* Keine API-Key Pflicht.
* Embedding Index optional.
* Semantic Score erklärbar.

⸻

WP 4.4 — Retrieval Calibration

Ziel:
Scores sollen interpretierbar werden.

Umsetzung:

* Confidence Calibration.
* unsafe-to-inject threshold.
* calibration benchmark.
* score distribution report.

Akzeptanzkriterien:

* Result hat confidence.
* Low-confidence Memories werden gewarnt oder ausgeschlossen.
* Dashboard zeigt Calibration.

⸻

EPIC 5 — Temporal Belief Graph

WP 5.1 — Belief State Machine

Ziel:
Memory muss Wahrheitsstatus kennen.

States:

* active
* stale
* superseded
* contradicted
* retracted
* needs_verification
* archived

Umsetzung:

* State Transition Rules.
* Retrieval beachtet State.
* Dream erzeugt State Changes.
* EvidencePack zeigt State.

Akzeptanzkriterien:

* Superseded Memory wird nicht blind genutzt.
* Historische Query kann alten Zustand finden.
* Contradicted Memory braucht Warning.

⸻

WP 5.2 — Temporal Graph Paths

Ziel:
Graphpfade müssen zeitlich gültig sein.

Umsetzung:

* Edge validFrom, validUntil.
* Path validity intersection.
* Query date support.
* “valid now” default.

Akzeptanzkriterien:

* Graph Path zeigt Gültigkeitsfenster.
* Query “am Datum X” funktioniert.
* Ungültige Pfade werden markiert.

⸻

WP 5.3 — Belief Revision Engine

Ziel:
Widersprüche als Entwicklung modellieren.

Umsetzung:

* Claim model.
* Evidence sets.
* Conflict sets.
* Supersession.
* Current belief selector.
* Review action.

Akzeptanzkriterien:

* “User used React, now Vue” wird Journey.
* Current truth ist ableitbar.
* Audit zeigt Entscheidungsgrund.

⸻

EPIC 6 — Extraction v2

WP 6.1 — Structured Claim Extraction

Ziel:
Extraction von Satzsplit zu Claim Objects entwickeln.

Claim-Felder:

* subject
* predicate
* object
* qualifiers
* time
* source
* confidence
* scope
* sensitivity
* durability

Akzeptanzkriterien:

* Extractor gibt Claims aus.
* Memory entsteht aus Claims.
* Tests für noisy chat, code, decisions.

⸻

WP 6.2 — Durable/Ephemeral Classifier

Ziel:
Nicht alles darf langfristig gespeichert werden.

Klassen:

* ignore
* session
* working
* project
* long_term
* procedure
* ask_user
* reject/encrypt

Akzeptanzkriterien:

* Smalltalk wird nicht long-term.
* Secrets werden blockiert oder verschlüsselt.
* User corrections werden gespeichert.

⸻

WP 6.3 — Ground Truth Episode Store

Ziel:
Lossy extraction vermeiden.

Beschreibung:
MemMachine zeigt, dass Ground-Truth-Preservation ein wichtiger Trend ist. cognibrain sollte vollständige Episoden speichern, aus denen Memories extrahiert wurden.

Umsetzung:

* Episode records:
    * conversation turns
    * tool calls
    * source refs
    * files touched
    * timestamps
    * hashes
* Memory references Episode IDs.

Akzeptanzkriterien:

* Jede Memory kann auf Ursprung zurückgeführt werden.
* EvidencePack kann Episode-Auszug enthalten.
* Retention Policy gilt auch für Episoden.

⸻

EPIC 7 — MCP as Memory OS

WP 7.1 — MCP Graph Tools

Neue Tools:

* memory_graph_path
* memory_graph_query
* memory_graph_activate
* memory_explain_connection

Akzeptanzkriterien:

* Agent kann Graphpfad über MCP abrufen.
* Scope/Policy wird enforced.
* Result enthält citations.

⸻

WP 7.2 — MCP Evidence & Policy Tools

Neue Tools:

* memory_evidence_pack
* memory_policy_check
* memory_verify_claim
* memory_retention_review

Akzeptanzkriterien:

* Agent kann Memory vor Nutzung prüfen.
* Unsafe Memory wird markiert.
* EvidencePack via MCP abrufbar.

⸻

WP 7.3 — MCP Procedure Tools

Neue Tools:

* memory_procedure_recall
* memory_action_record
* memory_action_outcome

Akzeptanzkriterien:

* Agent ruft vor Tool Call passende Procedure ab.
* Tool-Ergebnisse werden Memory.
* Wiederholte Fehler werden Patterns.

⸻

EPIC 8 — Procedural & Action Memory

WP 8.1 — Procedural Memory first-class

Ziel:
Workflows als Memory Type behandeln.

Felder:

* trigger
* scope
* steps
* confidence
* lastSuccess
* lastFailure
* owner
* evidence

Akzeptanzkriterien:

* Vor Release wird passende Procedure retrieved.
* Procedure-Erfolg wird gelernt.
* Veraltete Procedure wird revalidiert.

⸻

WP 8.2 — Agent Action Memory

Ziel:
Agenten erinnern, was sie getan haben.

Speichern:

* command executed
* file changed
* test passed/failed
* PR created
* error fixed
* deployment result

Akzeptanzkriterien:

* “Was hat letztes Mal geholfen?” funktioniert.
* Tool outcomes werden Evidence.
* Fehlerpatterns werden erkannt.

⸻

EPIC 9 — Real Connectors & Distribution

WP 9.1 — Connector SDK

Ziel:
Manifeste zu echten Connectors machen.

Lifecycle:

* install
* auth
* sync
* incremental sync
* webhook
* backfill
* revoke

Akzeptanzkriterien:

* Beispielconnector läuft gegen Testservice.
* Connector Status im Dashboard.
* Secrets sicher.

⸻

WP 9.2 — GitHub Connector

Scope:

* Issues
* PRs
* reviews
* commits
* actions
* releases
* labels

Akzeptanzkriterien:

* PR decisions werden Memories.
* Test failures werden Action Memories.
* Repo Graph entsteht automatisch.

⸻

WP 9.3 — Slack/Discord Connector

Scope:

* threads
* reactions
* decisions
* links
* channel scopes

Akzeptanzkriterien:

* Decision Candidate landet in Review Queue.
* Channel Permissions werden respektiert.
* Source Link im EvidencePack.

⸻

WP 9.4 — Official Harness Packages

Priorität:

1. Claude Code
2. Codex CLI
3. Cursor
4. GitHub Copilot
5. VS Code
6. LangGraph/CrewAI

Akzeptanzkriterien:

* Ein Install-Befehl pro Harness.
* Context Pack Hook.
* Feedback Hook.
* Health Check.
* Doku + Demo.

⸻

EPIC 10 — API, SDK & Documentation

WP 10.1 — OpenAPI aus Code generieren

Ziel:
Doku und Code dürfen nicht auseinanderlaufen.

Umsetzung:

* Zod-to-OpenAPI.
* /openapi.json.
* API Version /v1.
* CI validiert Spec.

Akzeptanzkriterien:

* SDK kann aus Spec getestet werden.
* Docs sind generiert, nicht manuell geraten.

⸻

WP 10.2 — TypeScript SDK v1

Scope:

* Auth
* retries
* typed errors
* pagination
* memories
* search
* graph
* evidence
* policy
* connectors

Akzeptanzkriterien:

* Integration Tests gegen API.
* SemVer.
* Examples.

⸻

WP 10.3 — Python SDK v1

Ziel:
Agent-Frameworks erreichen.

Akzeptanzkriterien:

* PyPI Package.
* LangGraph/CrewAI Beispiele.
* Parität für Search/Evidence/Graph/Policy.

⸻

WP 10.4 — Production Documentation

Docs:

* Local install
* Team install
* Production install
* Storage backends
* Auth/security
* Policy model
* Connector development
* Backup/restore
* Migrations
* Benchmark methodology

Akzeptanzkriterien:

* “Production install” ist realistisch.
* Doku enthält klare warnings für dev mode.
* Implementation Status Matrix existiert.

⸻

EPIC 11 — Benchmarks & Proof

WP 11.1 — End-to-End Answer Benchmarks

Ziel:
Nicht nur Retrieval, sondern Antwortqualität.

Benchmarks:

* LoCoMo
* LongMemEval
* BEAM
* Nextgen graph/temporal/custom

Akzeptanzkriterien:

* Gleicher Answerer.
* Gleicher Judge.
* Gleicher Top-K/Token Budget.
* Per-question artifacts.

⸻

WP 11.2 — USP Benchmark Suite

Misst:

* graph path correctness
* temporal validity
* evidence citation correctness
* policy enforcement
* contradiction suppression
* procedure recall
* cross-agent reuse

Akzeptanzkriterien:

* Läuft in CI.
* Ergebnisse im Dashboard.
* README Claims entstehen aus Artefakten.

⸻

WP 11.3 — Load & Reliability Benchmarks

Tests:

* 10k / 100k / 1M memories
* concurrent writes
* concurrent search
* connector sync
* dream jobs
* DB migrations

Akzeptanzkriterien:

* P50/P95/P99 Latenzen.
* Throughput.
* Fehlerverhalten.
* Memory usage.

⸻

EPIC 12 — Product Proof & UX

WP 12.1 — 5-Minute “Memory OS” Demo

Ziel:
USP sofort sichtbar machen.

Demo zeigt:

* Agent query
* Router decision
* ContextPack
* EvidencePack
* Graph Path
* Temporal Validity
* Policy Decision
* Feedback Loop

Akzeptanzkriterien:

* GIF/Screenshot in README.
* Demo lokal reproduzierbar.
* Neue Nutzer verstehen Differenz zu Mem0/GBrain sofort.

⸻

WP 12.2 — Implementation Status Matrix

Ziel:
Keine Overclaims.

Matrix-Spalten:

* feature
* code implemented
* API exposed
* CLI exposed
* MCP exposed
* dashboard exposed
* tests
* docs
* production-ready

Akzeptanzkriterien:

* Matrix ist im Repo.
* CI prüft einige Statuspunkte.
* README verweist auf Matrix.

⸻

6. Priorisierung für den nächsten Build-Zyklus

Priorität 1 — Plattform-Fundament

1. StorageAdapter Interface
2. SQLite Backend
3. API Auth Layer
4. Policy Engine
5. EvidencePack Object
6. OpenAPI aus Code

Warum: Das macht aus dem Kernel eine Plattformbasis.

Priorität 2 — USP beweisen

1. Query Planner
2. Temporal Belief State
3. Multi-Hop Graph Retrieval v2
4. EvidencePack Export
5. “Why was this retrieved?” UI
6. USP Benchmark Suite

Warum: Das macht cognibrain sichtbar anders.

Priorität 3 — Distribution

1. MCP Evidence/Graph Tools
2. Claude Code Connector Package
3. Codex Connector Package
4. GitHub Connector
5. TypeScript SDK v1
6. Production Docs

Warum: Ohne Distribution gewinnt der Markt nicht.

Priorität 4 — Enterprise Readiness

1. Postgres Backend
2. Tenant Isolation Tests
3. Audit Event Journal
4. Connector SDK
5. Load Benchmarks
6. Compliance Reports

Warum: Das macht “production-ready” glaubwürdig.

⸻

7. Zusammenfassung

Der aktuelle Stand ist stark, aber noch nicht production-ready. Die Codebasis beweist, dass cognibrain bereits viele anspruchsvolle Konzepte enthält: Graph Paths, Activation, Retrieval Fusion, Reflection, MCP, Benchmarks, Scopes und Provider Hooks. Gleichzeitig zeigen Code und Package-Struktur, dass die Plattform noch in einer frühen Produktphase ist: Core Store ist in-memory, echte DB-Backends fehlen sichtbar, Auth/Policy sind noch nicht als harter Runtime-Layer erkennbar, MCP deckt nur Basis-Memory ab, Connectors sind noch keine produktionsreifen Integrationen und Benchmarks müssen auf End-to-End Answer Quality und USP-Proof erweitert werden.

Der Weg zur besten Plattform ist erreichbar, aber der Fokus muss sich ändern:

Nicht mehr: “noch mehr Features”.

Sondern:

Aus dem starken lokalen Memory Kernel ein Evidence-grade Agent Memory OS mit Production Storage, Auth, Policy, Evidence Packs, Query Planner, realen Connectors, SDKs, Benchmarks und klarer Doku machen.

Wenn ihr das konsequent umsetzt, kann cognibrain eine eigene Marktposition besetzen:

The inspectable Memory OS for agents — every memory has evidence, validity, policy, graph explanation and audit trail.