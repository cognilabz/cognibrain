Neuer Report: cognibrain Live-Stand, Marktanalyse, Gap-Analyse & Implementierungsplan

0. Kurzfazit

cognibrain ist inzwischen deutlich mehr als ein MVP. Das Repo zeigt aktuell 21 Commits, keine offenen Issues und eine recht breite Projektstruktur mit src, sdk, templates, tests, docs, docker, scripts, CLI, Dashboard und Benchmark-Oberfläche. Das README positioniert cognibrain als local-first TypeScript Memory Platform mit Memory Engine, HTTP API, CLI, MCP Connector, Harness Hook, Dashboard, Benchmark Suite und dream Maintenance Loop. Es claimt außerdem source quality, trust, citations, lifecycle state, retrieval evidence, graph paths, brain/source scope, audit events und pluggable persistence.

Aber: Der Code- und Package-Stand zeigt weiterhin, dass cognibrain noch eher ein sehr fortgeschrittener Local-first Memory Kernel ist als eine “real production-ready platform”. Das Package ist weiterhin 0.1.0, die sichtbare Dependency-Liste enthält keine klassischen Production-Bausteine wie DB-Client, Auth/OIDC, Observability, Queue, ORM oder Migration-Library, und die Konfigurationsdoku sagt explizit, dass die aktuelle Implementierung ohne API Keys, Datenbanken oder hosted vector stores läuft.

Der strategische Weg ist deshalb klar:

Nicht noch mehr generische Memory-Features bauen, sondern cognibrain zu einem production-ready Engineering Memory OS machen.

Der neue USP sollte sehr konkret auf euren Usecase gehen:

cognibrain ist das Engineering Memory OS, mit dem Coding Agents aus jeder Korrektur, jedem Review, jedem Tool-Ergebnis und jeder Codebase-Änderung lernen.

Oder als Hero-Claim:

Stop fixing the same agent mistake twice.

Das ist klarer und stärker als “beste Memory-Plattform”, weil Entwickler sofort verstehen, warum sie es brauchen.

⸻

1. Was aktuell wirklich im Repo sichtbar ist

1.1 Projektstruktur und Reifegrad

Das Repo enthält aktuell neben src auch sdk, templates, tests, docs, docker, scripts, PRODUCT.md, DESIGN.md, SECURITY.md, Makefile und bootstrap.sh. Das ist gut, weil es zeigt, dass cognibrain nicht nur ein Core-Experiment ist, sondern bereits Richtung Produktverpackung, SDKs, Templates und Setup denkt.

Das Paket ist aber weiterhin Version 0.1.0. Die Scripts sind umfangreich: build, test, eval, eval:nextgen, benchmark:locomo, benchmark:longmemeval, benchmark:beam, benchmark:nextgen, leaderboard, benchmark:market, benchmark:certified, verify, verify:nextgen, mcp, doctor, setup, start:local und install:codex-skill. Das ist stark für Benchmark- und Devtool-Reife, aber noch nicht automatisch “Platform Readiness”.

Bewertung:
cognibrain ist auf dem Weg von “Kernel” zu “Platform”, aber noch nicht dort. Der nächste Schritt muss Packaging, Auth, Storage, SDKs, Connectoren, OpenAPI, E2E-Benchmarks und Production Docs sein.

⸻

1.2 Core Engine

Das src/core Verzeichnis enthält unter anderem config.ts, domain.ts, entityRegistry.ts, evaluation.ts, extraction.ts, graphReasoning.ts, health.ts, identity.ts, privacy.ts, providers.ts, reflection.ts, retrieval.ts, runtimeConfig.ts, store.ts, text.ts und types.ts. Das zeigt eine klare modulare Architektur: Memory Model, Retrieval, Graph Reasoning, Reflection, Identity, Privacy, Providers und Domain Logic sind getrennt.

Im aktuellen store.ts ist aber weiterhin eine MemoryStore-Klasse sichtbar, deren Kern ein private memories = new Map<string, Memory>() ist. Gleichzeitig werden bereits viele wichtige Felder beim Add angelegt: brainId, sourceId, userId, agentId, sessionId, appId, orgId, projectId, deviceId, runId, Content, Type, Source, Tags, Entities usw.

Bewertung:
Das Memory-Modell ist schon anspruchsvoll. Der Store selbst ist aber noch ein Local/In-Memory-Kern. Für “real production-ready” braucht ihr einen echten Storage Layer mit SQLite/Postgres, Migrationen, Indizes, Transaktionen, Concurrency und Replay.

⸻

1.3 Retrieval

Die Doku beschreibt einen Ranker, der semantic token overlap, keyword coverage, entity match, temporal decay, behavioural cadence, pattern fit, trust/importance, graph boost, typed relationship hints, access frequency und evidence gating kombiniert. Dazu kommen konfigurierbare Gewichte, JSON-command Intelligence Provider für rerank, verify, contradiction, summarize und extract, sowie Feedback-basierte Learned Retrieval Profiles.

Das ist als Produktvision stark. Der Codebestand zeigt auch eine große retrieval.ts mit 442 Zeilen, also kein triviales Retrieval-Modul. Gleichzeitig ist aus Package- und Config-Stand nicht ersichtlich, dass echte DB-gestützte BM25/FTS-Backends, pgvector/ANN-Backends oder produktionsreife Cross-Encoder bereits als Standard integriert sind; die aktuelle Doku spricht von lokalem Betrieb ohne Datenbanken oder hosted vector stores.

Bewertung:
Retrieval ist feature-reich, aber als Plattform noch zu heuristisch/local-first. Für Marktführung muss daraus ein planner-driven, backend-indexed, calibrated retrieval system werden.

⸻

1.4 Graph Reasoning

graphReasoning.ts existiert als eigenes Core-Modul mit 263 Zeilen. In der Roadmap sind Graph Path Search, Spreading Activation, safe graph query, GraphML/JSON Export und inferred relation substrate als erledigt aufgeführt.

Das ist ein wichtiger Vorteil gegenüber vielen Memory-Systemen. Mem0 beschreibt selbst, dass es im neuen Algorithmus Entity Relationships nicht mehr als direkt traversierbare Graph-Schnittstelle anbietet: Beziehungen beeinflussen Retrieval-Ranking, können aber nicht direkt traversiert werden.

Bewertung:
cognibrain hat hier einen echten Differenzierungshebel. Aber aus dem aktuellen Stand muss jetzt eine stabile Graph API / Graph Query / Path Explainer / Temporal Graph Validity werden, nicht nur ein internes Modul.

⸻

1.5 MCP und Integrationen

Das README zeigt MCP-Start über stdio und HTTP (./bin/cognibrain.mjs mcp, MCP_PORT=8788 ./bin/cognibrain.mjs mcp --http) und listet die verfügbaren MCP Tools: memory_add, memory_search, memory_context_pack, memory_list, memory_reflect, memory_dream, memory_health, memory_maintenance_status. Außerdem sind Connector Templates für Claude Code, Codex, GitHub Copilot und Cursor unter templates/ erwähnt.

Gap:
Die aktuelle MCP-Oberfläche ist noch stark “Memory CRUD + Search + Dream”. Für eine echte Memory-OS-Plattform fehlen MCP Tools für:

* Graph Path Explain,
* Evidence Pack,
* Policy Check,
* Procedure Recall,
* Action Outcome Recording,
* Temporal Query,
* Connector Sync,
* Review Queue,
* Retention Enforcement.

⸻

1.6 Doku und aktuelle Roadmap

Die Roadmap listet sehr viele Dinge als “Done”: TypeScript Core Engine, HTTP API, CLI, React Dashboard, Harness Hook, stdio MCP, LoCoMo/LongMemEval/BEAM Runner, Market Gate, Provider Adapter, Retrieval Profiles, Entity Registry, Typed Graph Report, encrypted sensitive memory, HTTP MCP, JSON/JSONL Persistence, Graph Path Search, Spreading Activation, Temporal Interval Queries, Behavioural Retrieval, Pattern Mining, Timeline Summaries, staged extraction, provider fallback, media/language envelopes, brain/source/agent/persona primitives, webhooks, marketplace modules und compliance reports.

Die Roadmap nennt aber auch die wichtigsten noch offenen nächsten Schritte: Full answer-generation Benchmarks für LoCoMo, LongMemEval und BEAM; Verbesserung von BEAM Information Extraction/Temporal/Multi-session Misses; LoCoMo Category 3 Multi-hop Evidence Recall; Import vergleichbarer Vendor-Artefakte; SQLite/Postgres Adapter; Dashboard Result Browser; Connector Packages für Claude Code, Codex, Copilot und Cursor.

Bewertung:
Die Roadmap selbst erkennt die richtigen Gaps. Der neue Plan muss diese Gaps nicht neu erfinden, sondern sie in eine Engineering-Memory-OS-Strategie übersetzen.

⸻

2. Marktanalyse: Wo cognibrain gewinnen kann

2.1 Mem0

Mem0 ist sichtbar stark bei Benchmarks und Distribution. Der Mem0-Report nennt LoCoMo, LongMemEval und BEAM als Standardbenchmarks, berichtet 92.5 auf LoCoMo und 94.4 auf LongMemEval bei ungefähr 6.9k Tokens pro Query, und verweist auf 21 Frameworks sowie 20 Vector Stores.

Mem0 beschreibt außerdem sechs produktionsrelevante Features: async mode, reranking, metadata filtering, timestamp-on-update, memory depth/use-case config und structured exceptions. Und Mem0 nennt offene Probleme: temporal abstraction, cross-session structure, application-level evaluation, privacy/consent architecture, cross-session identity und memory staleness.

Schlussfolgerung:
Mem0 ist stark als allgemeiner Memory Layer. cognibrain sollte nicht versuchen, “Mem0 plus ein paar Features” zu sein. Stattdessen muss cognibrain stärker in Engineering-spezifischer Memory werden: Codebase Rules, Review Corrections, Tool Outcomes, Procedures, Agent Actions und Evidence Packs.

⸻

2.2 GBrain

GBrain wird als gutes markdown-first personal brain beschrieben, insbesondere für OpenClaw/Hermes-Nutzer. Es punktet mit compounding loops, zero-LLM extraction, hybrid retrieval aus pgvector + Postgres keyword search + RRF + 4-layer dedup + backlink boost + optional query expansion.

GBrain hat aber laut Review klare Grenzen: Integration breadth nur 2/5, multi-tenant readiness 1/5, kein Multi-Hop Graph oder Temporal Retrieval als primäre Strategie, kein Managed Cloud, schmale Integrationen und single-operator design.

Schlussfolgerung:
cognibrain kann GBrain nicht über “Personal Brain” schlagen. Das wäre GBrains Heimvorteil. cognibrain sollte GBrain über Teamfähigkeit, Harness-Distribution, Engineering Memory, Evidence Packs und Policy Governance schlagen.

⸻

2.3 Hindsight, Zep, Cognee

Hindsight wird im Viervergleich als Agent Memory Infrastructure beschrieben, mit automatischer Struktur-Synthese und 25+ Integrationen. Zep ist conversational-first temporal memory. Mem0 ist etablierter Commercial Managed Service.

Cognee positioniert sich als graph-based Memory Engine für Cross-Session Persistence, mit durable storage, graph-based reasoning, self-host/cloud options, multi-tenancy und feedback-driven improvement.

Schlussfolgerung:
Der generische Memory-Markt ist voll. Ein generisches “best memory” ist schwer. Ein spezifisches Engineering Memory OS for Coding Agents ist deutlich greifbarer und kann eigene Benchmarks schaffen.

⸻

3. Zentrale neue Einsicht: eigener Benchmark ist Pflicht

Deine Beobachtung ist richtig: Wenn cognibrain bereits gut mit offenen Benchmarks umgeht, ist der nächste große Hebel nicht nur “noch bessere LoCoMo/BEAM-Scores”. Es ist ein eigener Benchmark für euren realen Usecase:

Codebase → Änderung → Korrektur → Knowledge Base → nächste Änderung → richtig/falsch.

Die offenen Benchmarks messen viel allgemeine Long-term-Memory-Fähigkeit. Sie messen aber kaum, ob ein Coding Agent aus Review-Korrekturen, Tool-Fehlern, Codebase-Policies und Architecture Decisions lernt.

Das ist die wichtigste Produktchance.

⸻

4. Neuer Zielbenchmark: CogniCodeBench

Definition

CogniCodeBench ist ein Benchmark für agentische Software-Engineering-Memory.

Er misst:

* ob ein Agent repo-spezifische Regeln erinnert,
* ob er frühere User-/Reviewer-Korrekturen anwendet,
* ob er Tool-Fehler nicht wiederholt,
* ob er Architecture Decisions berücksichtigt,
* ob er alte/stale Memory unterdrückt,
* ob er passende Procedures vor Actions retrieved,
* ob er nächste Codeänderungen dadurch korrekt ausführt.

Beispiel-Szenario

1. Synthetisches Repo wird generiert:
    * TypeScript,
    * npm statt pnpm,
    * Validation nur in src/validation,
    * generated files dürfen nicht editiert werden,
    * Tests über npm run test:unit.
2. Task 1:
    * Agent soll Validation hinzufügen.
    * Agent macht absichtlich/zufällig Fehler: nutzt pnpm, editiert Controller, touchiert generated file.
3. Correction:
    * User/Reviewer sagt: “Falsch: hier nur npm. Validation gehört in src/validation. Generated files niemals direkt editieren.”
4. Memory:
    * repo_policy: npm verwenden.
    * architecture_decision: validation in src/validation.
    * forbidden_action: generated files nicht editieren.
    * tool_outcome: pnpm command failed.
    * procedure: vor Tests npm run test:unit.
5. Task 2:
    * Ähnliche Änderung.
    * Agent soll diesmal richtig handeln.
6. Bewertung:
    * richtige Dateien geändert?
    * korrektes Command genutzt?
    * vorherige Korrektur angewendet?
    * falsche alte Memory unterdrückt?
    * Evidence korrekt zitiert?
    * Context Pack klein genug?

Warum das stark ist

Das macht aus cognibrain nicht “noch eine Memory Engine”, sondern eine Plattform, die messbar zeigt:

Mit cognibrain macht ein Coding Agent denselben Fehler nicht zweimal.

Das ist ein extrem starker USP.

⸻

5. Neue strategische Positionierung

Neuer Claim

cognibrain is the Engineering Memory OS for Coding Agents.

Neuer Untertitel

It captures corrections, review feedback, codebase rules and tool outcomes as evidence-grade memory, then injects the right context before the next change.

Deutscher Claim

cognibrain ist das Engineering Memory OS, mit dem Coding Agents aus jeder Korrektur, jedem Review, jedem Tool-Ergebnis und jeder Codebase-Änderung lernen.

Warum dieser Claim besser ist

* Er ist konkreter als “best memory”.
* Er ist verständlich für Entwickler.
* Er trifft einen echten Schmerz: wiederholte Agentenfehler.
* Er ist benchmarkbar.
* Er ist differenzierter als Mem0/GBrain/Hindsight/Zep.

⸻

6. Neuer Implementierungsplan mit Workpackages

EPIC 1 — Repo-State Verification & Product Truth

WP 1.1 — Implementation Status Matrix

Ziel:
Doku darf nur claimen, was Code, API, CLI, MCP, Dashboard und Tests wirklich abdecken.

Beschreibung:
Eine Matrix im Repo zeigt pro Feature:

* Code implemented,
* API exposed,
* CLI exposed,
* MCP exposed,
* Dashboard exposed,
* tests exist,
* docs exist,
* production-ready status.

Akzeptanzkriterien:

* Matrix ist im Repo.
* npm run verify:status erzeugt/prüft Matrix.
* README verlinkt auf Matrix.
* Kein Feature wird als production-ready markiert, wenn API/Tests fehlen.

⸻

WP 1.2 — Claim-to-Test Mapping

Ziel:
Jeder README-/Produktclaim braucht Test- oder Benchmark-Beweis.

Beschreibung:
Claims wie “graph path explanation”, “policy enforcement”, “behavioural retrieval” oder “connector sync” bekommen eine Claim-ID und Verweis auf Tests.

Akzeptanzkriterien:

* docs/claims.md listet Claim → Evidence.
* CI warnt bei verwaisten Claims.
* Marketing-Claims sind nachvollziehbar.

⸻

EPIC 2 — CogniCodeBench

WP 2.1 — Benchmark Specification

Ziel:
CogniCodeBench als formale Benchmark-Spezifikation.

Inhalte:

* Scenario Schema,
* Repo Schema,
* Task Schema,
* Correction Schema,
* Memory Expectation Schema,
* Tool Call Schema,
* Patch Evaluation Schema,
* Context Pack Schema,
* Metrics.

Akzeptanzkriterien:

* docs/benchmarks/cognicodebench.md.
* JSON Schema für Szenarien.
* 5 vollständige Beispiel-Szenarien.

⸻

WP 2.2 — Synthetic Repo Generator

Ziel:
Viele synthetische Codebases erzeugen.

Repo-Typen:

* TypeScript API,
* React App,
* Python FastAPI,
* Go Service,
* Monorepo,
* Legacy Repo.

Konfigurierbare Fallen:

* falscher Package Manager,
* falsche Testkommandos,
* generated files,
* falsche Architekturordner,
* alte APIs,
* branch-spezifische Regeln,
* deprecated libs.

Akzeptanzkriterien:

* npm run benchmark:cognicode:generate.
* deterministische Seeds.
* Schwierigkeitsgrade: easy, medium, hard, evil.
* mindestens 100 generierbare Szenarien.

⸻

WP 2.3 — Correction & Review Simulator

Ziel:
User- und Reviewer-Korrekturen realistisch simulieren.

Korrekturtypen:

* command correction,
* architecture correction,
* forbidden file correction,
* library/API correction,
* style correction,
* test strategy correction,
* migration correction.

Akzeptanzkriterien:

* Simulator erzeugt Korrektur-Events.
* Korrekturen werden in cognibrain eingespeist.
* Expected Memories werden automatisch erzeugt.

⸻

WP 2.4 — Next-Change Evaluator

Ziel:
Bewerten, ob der Agent beim nächsten Change gelernt hat.

Bewertung:

* richtige Dateien geändert,
* verbotene Dateien vermieden,
* korrektes Tool Command,
* vorherige Korrektur angewendet,
* stale/falsche Memory nicht benutzt,
* Evidence korrekt im Context Pack,
* Tests passend ausgeführt.

Akzeptanzkriterien:

* Evaluator kann Diffs und Tool Calls auswerten.
* Ergebnis enthält Score und Fehleranalyse.
* Benchmark kann no-memory/vector-only/cognibrain-full vergleichen.

⸻

WP 2.5 — Ablation Suite

Ziel:
Beweisen, welche cognibrain-Komponenten wirklich helfen.

Vergleichsmodi:

* no memory,
* raw history,
* keyword only,
* semantic only,
* graph only,
* temporal only,
* procedure only,
* cognibrain full.

Akzeptanzkriterien:

* Ablation Results als JSON.
* Dashboard Chart.
* README kann saubere Claims ableiten.

⸻

EPIC 3 — Engineering Memory Model

WP 3.1 — Engineering Memory Types

Ziel:
Coding-spezifische Memories first-class machen.

Neue Typen:

* repo_policy,
* architecture_decision,
* review_correction,
* tool_outcome,
* procedure,
* forbidden_action,
* migration_note,
* test_strategy,
* dependency_rule,
* generated_file_rule.

Akzeptanzkriterien:

* Types sind in MemoryInput/Memory Schema.
* Retrieval kann Types gewichten.
* Dashboard kann Types filtern.
* CogniCodeBench nutzt diese Types.

⸻

WP 3.2 — Codebase Scope Model

Ziel:
Memory muss repo-, branch-, commit-, package- und file-scope kennen.

Scopes:

* repo,
* branch,
* commit range,
* workspace/package,
* directory,
* file pattern,
* language,
* framework,
* harness.

Akzeptanzkriterien:

* Memory kann auf Branch oder Directory begrenzt werden.
* Retrieval berücksichtigt Current Working Directory.
* Branch mismatch erzeugt Warnung.

⸻

WP 3.3 — Correction Memory Pipeline

Ziel:
Korrekturen zuverlässig in nutzbare Regeln verwandeln.

Pipeline:

1. Correction erkennen.
2. Falsche frühere Aktion linken.
3. Richtige Regel extrahieren.
4. Scope setzen.
5. Procedure oder policy aktualisieren.
6. Falsche Annahme superseden.

Akzeptanzkriterien:

* “Use npm, not pnpm” wird repo_policy.
* “Don’t edit generated files” wird forbidden_action.
* “Validation belongs in schemas” wird architecture_decision.
* Nächste ähnliche Task retrieved diese Memories.

⸻

WP 3.4 — Action Outcome Memory

Ziel:
Tool Calls und Ergebnisse als Memory speichern.

Speichern:

* command,
* cwd,
* env,
* exit code,
* duration,
* output summary,
* failure reason,
* success reason,
* files changed.

Akzeptanzkriterien:

* Failed Commands werden nicht wiederholt.
* Success Commands werden Procedure Candidates.
* Benchmark kann Tool Outcome Learning messen.

⸻

EPIC 4 — Retrieval for Coding Agents

WP 4.1 — Code Query Planner

Ziel:
Coding Queries richtig routen.

Intent-Klassen:

* “what command should I run”,
* “where should this change go”,
* “what did reviewer correct”,
* “what failed last time”,
* “what architecture applies”,
* “what files are dangerous”,
* “what changed in this repo”.

Akzeptanzkriterien:

* Planner gibt Strategy Plan zurück.
* EvidencePack enthält Planner Decision.
* Tests für mindestens 50 coding query intents.

⸻

WP 4.2 — Procedure Recall Before Action

Ziel:
Vor Tool Calls passende Procedures abrufen.

Beispiele:

* vor Testausführung,
* vor Dependency Install,
* vor Migration,
* vor Editieren bestimmter Files,
* vor Release.

Akzeptanzkriterien:

* Harness Hook fragt memory_procedure_recall.
* Agent bekommt klare Do/Don’t Instructions.
* Tool Outcome fließt zurück in Memory.

⸻

WP 4.3 — Forbidden Action Guard

Ziel:
Bekannte Fehler verhindern.

Beispiele:

* “never edit generated files”,
* “do not run e2e locally”,
* “do not use pnpm”,
* “do not change legacy billing”.

Akzeptanzkriterien:

* Guard kann vor Action warnen.
* Agent bekommt Alternative.
* Benchmark misst repeated mistake rate.

⸻

WP 4.4 — Architecture Decision Retrieval

Ziel:
Architekturwissen vor Codeänderungen abrufen.

Akzeptanzkriterien:

* “Add validation” retrieved validation-location rule.
* “Add API endpoint” retrieved route/controller/service conventions.
* “Change auth” retrieved middleware/session rules.
* Evidence enthält Quelle der Entscheidung.

⸻

EPIC 5 — Evidence-grade Context Packs

WP 5.1 — Coding Context Pack Template

Ziel:
Spezialisierte Context Packs für Coding Agents.

Sections:

* repo policies,
* relevant procedures,
* previous corrections,
* known pitfalls,
* architecture decisions,
* tool commands,
* forbidden actions,
* temporal warnings.

Akzeptanzkriterien:

* Context Pack ist kurz, strukturiert und source-cited.
* Jede Section hat Memory IDs.
* Token Budget wird respektiert.

⸻

WP 5.2 — Patch Evidence Trail

Ziel:
Nach einer Änderung zeigen, welche Memories genutzt wurden.

Output:

* context pack id,
* memories used,
* procedures used,
* corrections applied,
* commands run,
* graph paths,
* excluded stale memories.

Akzeptanzkriterien:

* Agentenlauf ist auditierbar.
* User kann “wrong memory” markieren.
* CogniCodeBench nutzt Evidence Trail.

⸻

WP 5.3 — Wrong-Memory Suppression

Ziel:
Falsche oder überholte Memories nicht injizieren.

Akzeptanzkriterien:

* superseded Memory wird nicht injected,
* contradicted Memory nur mit Warnung,
* branch-mismatched Memory wird markiert,
* false-context-injection wird im Benchmark gemessen.

⸻

EPIC 6 — Temporal Belief & Codebase Evolution

WP 6.1 — Repo-State Timeline

Ziel:
Codebase-Regeln ändern sich über Zeit.

Beispiele:

* Jest → Vitest Migration,
* npm → pnpm Migration,
* old API deprecated,
* new folder convention,
* generated file workflow changed.

Akzeptanzkriterien:

* Alte und neue Wahrheit bleiben historisch abrufbar.
* Current truth wird korrekt abgeleitet.
* Retrieval nutzt branch/time context.

⸻

WP 6.2 — Supersession Engine

Ziel:
Korrekturen überschreiben nicht, sondern erzeugen eine nachvollziehbare Journey.

Akzeptanzkriterien:

* Wrong belief wird superseded.
* New belief wird active.
* Evidence zeigt Ursache.
* Historical query findet alte Regel.

⸻

WP 6.3 — Verification Queue

Ziel:
High-impact Memories regelmäßig revalidieren.

Trigger:

* package.json geändert,
* CI config geändert,
* test framework geändert,
* dependency upgraded,
* directory moved,
* repeated failure.

Akzeptanzkriterien:

* Memory bekommt verificationDueAt.
* Dashboard zeigt Queue.
* Agent wird vor unverified Memory gewarnt.

⸻

EPIC 7 — Harness Distribution

WP 7.1 — Claude Code Golden Path

Ziel:
Erster Referenz-Connector für den Benchmark und reale Nutzung.

Features:

* session start context,
* pre-tool procedure recall,
* post-tool outcome record,
* user correction capture,
* patch evidence trail.

Akzeptanzkriterien:

* Ein Install-Befehl.
* Demo Repo funktioniert.
* CogniCodeBench kann über Claude Code laufen oder simulieren.

⸻

WP 7.2 — Codex Connector

Ziel:
OpenAI Codex CLI/Hooks Integration.

Akzeptanzkriterien:

* Context Pack vor Task.
* Tool Outcomes zurück.
* Corrections gespeichert.
* Evidence Pack erzeugt.

⸻

WP 7.3 — GitHub Connector

Ziel:
PR Reviews und CI Results als Memory.

Events:

* PR comments,
* review requested changes,
* CI failed/passed,
* commits,
* release notes,
* labels.

Akzeptanzkriterien:

* Review Feedback wird review_correction.
* CI failure wird tool_outcome.
* Next Change nutzt die Memory.

⸻

WP 7.4 — Cursor / VS Code Connector

Ziel:
Workspace-nahe Memory.

Akzeptanzkriterien:

* Current workspace/repo erkannt.
* File changes werden Events.
* Inline Memory Feedback möglich.

⸻

EPIC 8 — Production Platform Hardening

WP 8.1 — SQLite Backend

Ziel:
Real local production.

Umsetzung:

* SQLite Store Adapter.
* FTS5 für Keyword Search.
* Migrations.
* Backup/Restore.
* Concurrency Tests.

Akzeptanzkriterien:

* MEMORY_STORAGE_BACKEND=sqlite.
* 100k Memory Test.
* Migration Tests.

⸻

WP 8.2 — Postgres Backend

Ziel:
Team/Enterprise Backend.

Umsetzung:

* Postgres Adapter.
* Transactions.
* Connection Pool.
* tsvector.
* optional pgvector.

Akzeptanzkriterien:

* Multi-user tests.
* Rollback tests.
* Load test.

⸻

WP 8.3 — Auth & Policy Enforcement

Ziel:
Production API absichern.

Umsetzung:

* API key auth,
* optional OIDC/JWT,
* actor context,
* tenant policy,
* policy enforcement in search/graph/context/dream/export.

Akzeptanzkriterien:

* Unauthorized Tests.
* Cross-tenant leak tests.
* Policy denials in audit log.

⸻

WP 8.4 — Observability

Ziel:
Betrieb sichtbar machen.

Metriken:

* retrieval latency,
* context pack size,
* dream duration,
* connector sync lag,
* policy denials,
* benchmark drift,
* failed tool repeats.

Akzeptanzkriterien:

* /metrics.
* structured logs.
* request ids.
* error classes.

⸻

EPIC 9 — API, SDK, Doku

WP 9.1 — OpenAPI aus Code

Ziel:
Doku und API synchron halten.

Akzeptanzkriterien:

* /openapi.json.
* Zod-to-OpenAPI oder ähnliche Generierung.
* API Version /v1.
* CI validiert Spec.

⸻

WP 9.2 — TypeScript SDK v1

Scope:

* auth,
* retries,
* typed errors,
* memories,
* search,
* graph,
* evidence,
* policy,
* connectors,
* benchmark client.

Akzeptanzkriterien:

* SDK Integration Tests.
* Examples.
* SemVer.

⸻

WP 9.3 — Python SDK v1

Ziel:
Agent Frameworks erreichen.

Akzeptanzkriterien:

* PyPI Package.
* LangGraph/CrewAI examples.
* Search/Evidence/Graph/Policy support.

⸻

WP 9.4 — Production Docs

Docs:

* local install,
* team install,
* production install,
* storage backends,
* auth/security,
* policies,
* connectors,
* CogniCodeBench,
* backup/restore,
* migrations,
* troubleshooting.

Akzeptanzkriterien:

* Nutzer können local in 5 Minuten starten.
* Team kann Postgres Setup folgen.
* Dev vs Production klar getrennt.

⸻

EPIC 10 — Benchmark Proof & Market Positioning

WP 10.1 — CogniCodeBench Public Results

Ziel:
Euer Benchmark wird zur Produktstory.

Akzeptanzkriterien:

* Public artifacts.
* Baselines:
    * no memory,
    * raw history,
    * vector only,
    * keyword only,
    * cognibrain full.
* Chart im README.

⸻

WP 10.2 — USP Benchmark Suite

Misst:

* correction carryover,
* repeated mistake avoidance,
* procedure recall,
* architecture decision adherence,
* tool outcome learning,
* stale memory suppression,
* evidence correctness.

Akzeptanzkriterien:

* CI Benchmark optional.
* Dashboard zeigt Scores.
* Claims im README referenzieren Artifacts.

⸻

WP 10.3 — Market Pages

Seiten:

* cognibrain vs Mem0,
* cognibrain vs GBrain,
* cognibrain vs Hindsight,
* cognibrain vs Zep,
* why Engineering Memory OS.

Akzeptanzkriterien:

* fair, faktenbasiert,
* keine übertriebenen Claims,
* Fokus auf Usecase und USP.

⸻

7. Priorisierung

P0 — Benchmark & USP zuerst

1. CogniCodeBench Spec
2. Synthetic Repo Generator
3. Correction Simulator
4. Engineering Memory Types
5. Coding Context Pack Template
6. Patch Evidence Trail

Warum:
Das erzeugt die klare Marktstory: “Agenten machen denselben Fehler nicht zweimal.”

⸻

P1 — Coding Agent Loop

1. Procedure Recall Before Action
2. Forbidden Action Guard
3. Action Outcome Memory
4. Correction Memory Pipeline
5. Claude Code Connector
6. GitHub Connector

Warum:
Das macht die Benchmark-Idee zu realem Produktwert.

⸻

P2 — Production Foundation

1. SQLite Backend
2. Auth + Policy
3. EvidencePack First-Class
4. OpenAPI
5. TypeScript SDK
6. Production Docs

Warum:
Das macht aus dem Kernel eine Plattform.

⸻

P3 — Enterprise & Marktführerschaft

1. Postgres Backend
2. Observability
3. Tenant Isolation Tests
4. Full End-to-End Benchmarks
5. Market Pages
6. Python SDK

⸻

8. Endgültige Einschätzung

cognibrain hat aktuell genug Substanz, um nicht mehr nur “eine Idee” zu sein. Es gibt Core Engine, API, CLI, Dashboard, MCP, Tests, Benchmark-Scripts, Graph Reasoning und viele fortgeschrittene Memory-Konzepte im Repo. Gleichzeitig zeigen Package-Stand, Store-Architektur und Roadmap, dass es noch kein production-ready Memory OS ist: SQLite/Postgres Adapter, Connector Packages, Full Answer Benchmarks und stärkere Vendor-Comparable Artifacts stehen sogar explizit noch auf der Roadmap.

Der richtige nächste Schritt ist nicht, generisch “besser als Mem0” zu werden. Der richtige nächste Schritt ist:

CogniCodeBench + Engineering Memory Types + Coding Agent Loop.

Damit bekommt cognibrain einen klaren, offensichtlichen USP:

cognibrain ist das Engineering Memory OS, das Coding Agents aus Korrekturen, Reviews, Tool-Ergebnissen und Codebase-Änderungen lernen lässt.

Wenn ihr diesen Benchmark baut und die Plattform danach härtet, habt ihr eine sehr gute Chance, eine eigene Kategorie zu definieren statt im generischen Memory-Markt unterzugehen.