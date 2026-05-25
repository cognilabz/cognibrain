Neuer Report: cognibrain, Synthetic Benchmark, Markt-Gap und Implementierungsplan

Vorweg transparent: Ich habe in diesem Durchlauf versucht, das GitHub-Repo und Raw-Dateien live erneut abzurufen. Der Zugriff auf GitHub/Raw ist in der aktuellen Umgebung aber mehrfach fehlgeschlagen. Deshalb kann ich nicht ehrlich behaupten, dass ich jede neueste Zeile nach deiner letzten Änderung frisch aus dem Repo gelesen habe. Die Analyse baut auf dem zuletzt von mir im Code geprüften Stand von cognibrain auf und ergänzt ihn mit einer neuen Markt-/Benchmark-Analyse. Der erste Workpackage-Block unten ist deshalb bewusst ein Repo-State-Verifikationspaket, damit ihr den Plan direkt gegen den aktuellen Code automatisiert absichern könnt.

Der wichtigste neue Punkt aus deiner Beobachtung ist absolut richtig:

Ein eigener synthetischer Benchmark für euren Kern-Usecase ist nicht nur sinnvoll, sondern wahrscheinlich der stärkste Hebel, um cognibrain als beste Memory/Brain-Plattform zu positionieren.

Die bestehenden Open Benchmarks testen viel, aber nicht präzise euren eigentlichen Sweet Spot:

Codebase → Änderung → Fehler/Korrektur → Knowledge Base → nächste Änderung → richtig/falsch → Bezug auf frühere Nutzer-/Reviewer-Aussagen.

Das ist nicht einfach “Memory Recall”. Das ist agentische Software-Engineering-Erfahrung über Zeit. Genau dort kann cognibrain einen eigenen USP schaffen.

⸻

1. Neue Kernthese

cognibrain sollte nicht primär gegen Mem0, GBrain, Hindsight, Zep oder Cognee über generische Memory-Benchmarks gewinnen.

cognibrain sollte eine eigene Kategorie definieren:

Evidence-grade Engineering Memory OS

Oder kürzer:

Engineering Memory OS for AI Agents

Der USP:

cognibrain merkt sich nicht nur Fakten, sondern bewahrt technische Entscheidungen, Korrekturen, Review-Feedback, Tool-Ergebnisse und Codebase-Kontext so, dass der nächste Agentenlauf daraus korrekt handelt.

Das ist viel konkreter und marktstärker als “wir haben Graph Memory”.

Für Coding-Agenten ist der wahre Wert:

* Der Agent macht denselben Fehler nicht zweimal.
* Der Agent erinnert sich an Review-Kommentare.
* Der Agent kennt repo-spezifische Regeln.
* Der Agent weiß, welche Tests/Commands zuvor funktioniert haben.
* Der Agent weiß, welche Architekturentscheidung früher getroffen wurde.
* Der Agent kann erklären, warum er eine Änderung so macht.
* Der Agent kann alte falsche Annahmen korrigieren.
* Der Agent weiß, wann Knowledge veraltet ist.

Das ist ein klarer Pain in Codex, Claude Code, Cursor, Copilot, OpenCode, OpenClaw, Windsurf und Co.

⸻

2. Marktanalyse mit Fokus auf eure Chance

2.1 GBrain

GBrain ist stark als Personal Brain. Es besitzt starke Konzepte wie Tiered Enrichment, Fail-Improve Loop, Backlink-Boosting, zero-LLM entity extraction, Hybrid Search, Markdown Ownership und “compiled truth + timeline”. Das ist für Einzelpersonen stark, die langfristig ein persönliches Wissenssystem pflegen wollen.

GBrain hat aber klare Grenzen: Es ist single-operator-zentriert, self-host-only, schmal integriert, skill-authoring-lastig und hat laut Review keine primäre Multi-Hop-Graph- oder Temporal-Retrieval-Strategie.

cognibrain-Chance:
Nicht “Personal Brain”, sondern Engineering Team Memory OS. GBrain merkt sich Wissen. cognibrain sollte beweisen, dass Agenten dadurch besser coden.

2.2 Neural-Memory / Spreading Activation

Ein anderes interessantes Projekt beschreibt Retrieval nicht als klassische RAG-Suche, sondern als neural graph with spreading activation. Der Vorteil: Es findet nicht nur Text, sondern aktivierte Kausalketten, z. B. Alice → Meeting → Rate-Limit-Outage → JWT-Decision. Außerdem hat es Habit Tracking und Connection Explainer.

cognibrain-Chance:
cognibrain hat bereits Graph-/Activation-Bausteine. Für euren Usecase sollte das aber nicht abstrakt bleiben, sondern konkret auf Software Engineering angewandt werden:

* Bug → Fix → Test → Review → Architecture Decision
* Package → API → Migration → Breaking Change
* Command → Failure → Correct Command
* User Correction → Future Patch Constraint

2.3 Hindsight

Hindsight wird im Marktvergleich als Production Memory Infrastructure beschrieben, mit Multi-Strategy Retrieval: semantic, BM25, graph traversal, temporal reasoning, RRF und Cross-Encoder-Reranking.

cognibrain-Chance:
Hindsight ist stark bei generischer Memory-Infrastruktur. cognibrain kann sich klarer spezialisieren:

“The memory layer for coding agents that learns from corrections, reviews, commands and codebase evolution.”

2.4 Mem0

Mem0 gewinnt über einfache API, Managed Service, viele Integrationen und starke öffentliche Benchmarks. Eure Chance ist nicht, Mem0 allgemein zu kopieren, sondern einen Benchmark zu schaffen, wo generisches Memory nicht reicht:

* Codebase-Zustand ändert sich.
* Alte Memory kann falsch werden.
* Reviewer korrigiert Agenten.
* Agent muss beim nächsten Task die Korrektur anwenden.
* Retrieval muss pro Repo/Branch/Commit/Package/Toolchain scoped sein.
* Es braucht “was galt wann?” und “was wurde später korrigiert?”

Das ist euer Feld.

2.5 Fazit Markt

Der Markt ist voll mit:

* “store facts”
* “semantic memory”
* “graph memory”
* “temporal graph”
* “personal brain”
* “managed memory API”

Aber kaum jemand besitzt klar:

Agentic Software Engineering Memory

Genauer:

Memory that makes coding agents improve across changes, corrections, tests and reviews.

Das sollte euer offensichtlicher USP werden.

⸻

3. Aktueller Stand von cognibrain gegen Zielbild

Basierend auf dem zuletzt geprüften Codezustand:

Was cognibrain bereits gut kann

3.1 Local-first Memory Kernel

cognibrain hat bereits einen TypeScript-Kern mit MemoryStore, RetrievalEngine, Reflection/Dream, API, MCP, CLI, Dashboard und Benchmark-Skripten. Das ist ein solider Kernel.

3.2 Multi-Signal Retrieval

Die RetrievalEngine kombiniert mehrere Signale wie Semantic/Keyword/Entity/Temporal/Behavioral/Trust/Graph/Access. Das ist deutlich mehr als simpler Vector Search.

3.3 Graph Reasoning ist teilweise da

Es gab Code für Graph Paths, Activation, Query und Inference. Das ist wertvoll, aber noch nicht als vollwertiger Engineering-Reasoning-Layer sichtbar.

3.4 Add-only Extraction ist da

Es gibt eine Add-only Extraction, aber eher als Satz-/Fact-Splitting. Für Codebase-Korrekturen braucht ihr strukturierte Claim-/Decision-/Procedure-Extraction.

3.5 Reflection/Dream ist da

Dream existiert als Maintenance-Schicht. Für euren Usecase muss Dream aber stärker werden: von “Memory Hygiene” zu “Engineering Learning Loop”.

⸻

4. Hauptgap: eure Plattform muss lernen, ob der nächste Code-Change richtig war

Das ist der zentrale neue Punkt.

Aktuell ist eine Memory-Plattform meistens gut, wenn sie eine Frage beantwortet:

“Was hat der Nutzer gesagt?”

Für Coding-Agenten muss die Plattform aber viel mehr können:

“Hat der Agent beim nächsten ähnlichen Change die frühere Korrektur angewandt?”

Das ist ein anderer Qualitätsmaßstab.

Beispiel

Session 1:

* User: “Bitte nutze in diesem Repo niemals pnpm, wir verwenden npm.”
* Agent führt pnpm test aus.
* User korrigiert: “Falsch, nimm npm test.”
* cognibrain speichert:
    * repo policy
    * correction
    * failed action
    * correct procedure
    * scope: repo/project
    * evidence: user correction + tool result

Session 2:

* User: “Ändere die Validation und teste danach.”
* Agent muss:
    * relevante repo policy finden,
    * npm test statt pnpm test ausführen,
    * im Context Pack erklären: “wegen früherer User-Korrektur”.

Benchmark bewertet:

* Hat der Agent korrekt gehandelt?
* Hat er nicht nur retrieved, sondern die Aktion angepasst?
* Hat er alte falsche Memory unterdrückt?
* Hat er Source/Evidence korrekt genutzt?

Das ist ein super starker Benchmark.

⸻

5. Neuer Benchmark-Vorschlag: CogniCodeBench

Ich würde einen eigenen Benchmark bauen:

CogniCodeBench

Untertitel:

A benchmark for evaluating whether coding agents learn from codebase changes, corrections, reviews and tool outcomes.

5.1 Was CogniCodeBench messen soll

Nicht nur Memory Recall, sondern:

1. Repo-specific policy recall
2. Correction application
3. Procedure recall before action
4. Avoid repeating past mistakes
5. Temporal validity of engineering facts
6. Branch/commit scoped memory
7. Review feedback retention
8. Tool outcome learning
9. Architecture decision recall
10. Source-cited context injection
11. Wrong-memory suppression
12. Cross-session improvement

5.2 Benchmark-Struktur

Jede Benchmark-Instanz besteht aus mehreren Phasen.

Phase A — Codebase Seed

Ein synthetisches Repo wird generiert:

* package manager
* framework
* test commands
* lint commands
* architecture constraints
* coding style
* folder structure
* domain logic
* hidden traps
* old deprecated APIs
* migration notes

Beispiel:

repo: atlas-api
language: TypeScript
test command: npm test
forbidden: pnpm
validation library: zod v4
auth middleware: src/auth/requireSession.ts
do not touch: src/legacy/billing/*

Phase B — Task 1

Agent erhält Änderung:
Add validation for webhook payloads.

Es gibt Fallen:

* falscher Testcommand
* falsches Verzeichnis
* alte API
* bestehende Architekturregel

Phase C — Correction

Der Benchmark simuliert User/Reviewer Feedback:

You used pnpm, but this repo only uses npm.

Also do not put validation in controllers; use src/validation/*.schema.ts.

cognibrain soll daraus Memories erzeugen:

* procedure: use npm test
* architecture_decision: validation lives in src/validation
* correction: previous controller placement was wrong
* scope: repo atlas-api
* source: reviewer/user correction

Phase D — Task 2

Ähnliche, aber nicht identische Änderung:

Add validation for customer import payloads.

Agent muss jetzt korrekt handeln:

* Validation Schema in src/validation
* nicht im Controller
* npm test
* evtl. alte falsche Memory nicht verwenden

Phase E — Evaluation

Gemessen wird:

* Code patch correctness
* Test command correctness
* Memory usage
* Evidence usage
* Wrong-action avoidance
* Explanation quality
* Minimal context token usage
* Whether old wrong action was suppressed

5.3 Benchmark-Kategorien

Category 1 — User Correction Carryover

Misst: Wird eine direkte Korrektur später angewandt?

Beispiele:

* “use npm not pnpm”
* “write tests in __tests__, not tests”
* “don’t use axios, use internal fetch wrapper”
* “do not modify generated files”

Category 2 — Review Feedback Learning

Misst: Lernt der Agent aus Review-Kommentaren?

Beispiele:

* “This should be behind feature flag”
* “Use existing helper instead of new util”
* “This repo uses dependency injection”
* “We log with pino, not console.log”

Category 3 — Tool Outcome Learning

Misst: Lernt er aus Tool-Ergebnissen?

Beispiele:

* npm run test:unit passes, npm test is too slow
* lint fails because import order
* migration command needs env var
* test DB must be started first

Category 4 — Architecture Decision Recall

Misst: Werden Architekturentscheidungen richtig genutzt?

Beispiele:

* auth in middleware
* validation in schema
* data access in repository
* UI state in Zustand, not Redux

Category 5 — Temporal Supersession

Misst: Alte Wahrheit wird durch neue ersetzt.

Beispiel:

* Früher: “use Jest”
* später: “migrated to Vitest”
* nächste Änderung: Agent muss Vitest nutzen.

Category 6 — Branch/Commit Scoped Memory

Misst: Memory ist nicht global falsch.

Beispiel:

* branch legacy-support: old API valid
* branch main: new API valid

Category 7 — Cross-file Causal Memory

Misst: Agent erkennt Graphpfad:

Changing auth schema affects middleware tests and generated OpenAPI fixtures.

Category 8 — Negative Memory / Never Again

Misst: Agent vermeidet wiederholte Fehler.

Beispiel:

* “Never edit schema.generated.ts directly.”
* “Do not run e2e locally unless asked.”

5.4 Metrics

Retrieval Metrics

* Recall@K for relevant memories
* Precision@K
* Evidence citation correctness
* Wrong memory suppression
* Scope correctness
* Temporal validity correctness

Action Metrics

* Correct file touched
* Forbidden file avoided
* Correct command executed
* Correct library/API used
* Tests passed
* Reviewer correction applied

Agent Learning Metrics

* Repeated mistake rate
* Correction carryover rate
* Procedure recall rate
* Architecture decision adherence
* Stale memory avoidance
* Context token efficiency

Product Metrics

* Time to usable context
* Context pack size
* Evidence explainability score
* Policy violation rate
* User review burden

5.5 Benchmark Outputs

Jede Benchmark-Run erzeugt:
{
  "scenarioId": "...",
  "repoId": "...",
  "phase": "task_2",
  "expectedMemories": [],
  "retrievedMemories": [],
  "contextPack": {},
  "agentPatch": {},
  "toolCalls": [],
  "evaluation": {
    "patchCorrect": true,
    "usedCorrectProcedure": true,
    "avoidedPreviousMistake": true,
    "memoryEvidenceCorrect": true,
    "scopeCorrect": true
  }
}
5.6 Warum das euer bester Benchmark ist

Weil er euren echten Usecase misst:

Wird der Agent mit cognibrain beim nächsten Code-Change besser?

Das ist für den Markt viel überzeugender als “wir haben 94% auf irgendeinem allgemeinen Memory Benchmark”.

⸻

6. Neuer Gesamtplan mit Workpackages

EPIC 0 — Repo-State Verification

WP 0.1 — Code-vs-Docs Feature Matrix

Ziel:
Doku darf nicht mehr claimen als Code beweist.

Beschreibung:
Eine automatisch gepflegte Matrix zeigt:

* Feature
* Implemented in code
* API exposed
* CLI exposed
* MCP exposed
* Dashboard exposed
* Tests exist
* Production ready
* Docs exist

Akzeptanzkriterien:

* Matrix liegt im Repo.
* CI schlägt fehl, wenn ein Feature als production-ready markiert ist, aber Tests fehlen.
* README verlinkt auf Matrix.

⸻

WP 0.2 — Current Implementation Audit Script

Ziel:
Automatisiert prüfen, was wirklich implementiert ist.

Scope:

* scan routes
* scan MCP tools
* scan CLI commands
* scan tests
* scan exported SDK methods
* scan docs claims

Output:
{
  "feature": "evidence_pack",
  "api": true,
  "cli": false,
  "mcp": false,
  "tests": true,
  "docs": true,
  "status": "partial"
}

Akzeptanzkriterien:

* Script läuft in CI.
* Report wird als Artifact hochgeladen.
* Doku basiert auf Report.

⸻

EPIC 1 — CogniCodeBench

WP 1.1 — Benchmark Specification

Ziel:
Formale Spezifikation für Codebase-Memory-Benchmark.

Inhalt:

* Scenario Schema
* Repo Seed Schema
* Correction Schema
* Memory Expectation Schema
* Patch Evaluation Schema
* Tool Call Evaluation Schema
* Metrics

Akzeptanzkriterien:

* docs/benchmarks/cognicodebench.md
* JSON Schema für Szenarien
* Beispiel mit 3 vollständigen Szenarien

⸻

WP 1.2 — Synthetic Repo Generator

Ziel:
Viele synthetische Codebases generieren.

Features:

* TypeScript/Node
* Python/FastAPI
* Go service
* React frontend
* Monorepo
* Test commands
* package managers
* generated files
* repo-specific rules
* hidden traps

Akzeptanzkriterien:

* npm run benchmark:cognicode:generate
* 100 Szenarien generierbar
* Seeds reproduzierbar
* Schwierigkeitsgrade: easy/medium/hard/evil

⸻

WP 1.3 — Correction & Review Simulator

Ziel:
User-/Reviewer-Korrekturen realistisch simulieren.

Korrekturtypen:

* command correction
* library correction
* architecture correction
* style correction
* test correction
* forbidden file correction
* temporal migration correction

Akzeptanzkriterien:

* Simulator erzeugt Correction Events.
* Corrections werden in Memory eingespeist.
* Ground Truth wird gespeichert.

⸻

WP 1.4 — Next-Change Evaluator

Ziel:
Bewerten, ob Agent die nächste Änderung richtig macht.

Bewertung:

* patch correctness
* files touched
* commands run
* wrong action repeated?
* correct memory referenced?
* stale memory suppressed?
* source/evidence correct?

Akzeptanzkriterien:

* Evaluator kann Agent Output prüfen.
* Unterstützt File Diff + Tool Calls.
* Gibt Score + Fehleranalyse aus.

⸻

WP 1.5 — Memory Ablation Tests

Ziel:
Beweisen, dass cognibrain wirklich hilft.

Vergleiche:

* no memory
* raw chat history
* vector only
* keyword only
* graph only
* cognibrain full
* cognibrain without temporal
* cognibrain without corrections

Akzeptanzkriterien:

* Benchmark zeigt Verbesserungen pro Komponente.
* Dashboard zeigt Ablation Chart.
* README kann ehrliche Claims machen.

⸻

WP 1.6 — Public Leaderboard

Ziel:
CogniCodeBench als Marktbenchmark etablieren.

Features:

* Run artifacts
* Per-scenario results
* Baseline systems
* Methodology
* Submission format

Akzeptanzkriterien:

* artifacts/cognicodebench/*.json
* Public docs
* Repro instructions
* Baselines enthalten simple vector/keyword/no-memory

⸻

EPIC 2 — Engineering Memory Object Model

WP 2.1 — EngineeringMemory Types

Ziel:
Coding-spezifische Memory-Typen first-class machen.

Neue Typen:

* repo_policy
* architecture_decision
* review_correction
* tool_outcome
* procedure
* forbidden_action
* migration_note
* test_strategy
* dependency_rule
* generated_file_rule

Akzeptanzkriterien:

* Types sind im Schema.
* Extraction kann Types erzeugen.
* Retrieval kann nach Type gewichten.
* Dashboard zeigt Type-spezifische Views.

⸻

WP 2.2 — Codebase Scope Model

Ziel:
Memory muss repo/branch/commit/package-spezifisch sein.

Scopes:

* org
* repo
* branch
* commit range
* package/workspace
* directory
* file pattern
* language/framework
* harness

Akzeptanzkriterien:

* Memory kann auf Branch begrenzt werden.
* Retrieval berücksichtigt current repo path.
* Stale warning bei branch mismatch.

⸻

WP 2.3 — Correction Memory Pipeline

Ziel:
User-/Review-Korrekturen zuverlässig speichern.

Pipeline:

* correction detected
* previous wrong action linked
* correct rule extracted
* scope assigned
* future procedure updated
* old wrong belief marked superseded

Akzeptanzkriterien:

* “Don’t use pnpm” wird repo_policy.
* Falscher Tool Call wird linked.
* Nächste Query retrieved correction.

⸻

WP 2.4 — Action Outcome Memory

Ziel:
Tool Calls und Ergebnisse werden Memory.

Speichern:

* command
* cwd
* env requirements
* exit code
* failure reason
* success pattern
* files changed
* test output summary

Akzeptanzkriterien:

* Failed command wird nicht einfach vergessen.
* Success command wird Procedure-Kandidat.
* Benchmark kann Tool-Learning bewerten.

⸻

EPIC 3 — Retrieval for Coding Agents

WP 3.1 — Code Query Planner

Ziel:
Queries von Coding-Agenten richtig routen.

Intent-Klassen:

* “what command should I run”
* “where should this change go”
* “what did reviewer correct”
* “what files are dangerous”
* “what architecture applies”
* “what failed last time”
* “what changed in this repo”

Akzeptanzkriterien:

* Query Planner gibt Strategy Plan zurück.
* Planner wählt repo_policy/procedure/tool_outcome bevorzugt.
* EvidencePack speichert Planner Decision.

⸻

WP 3.2 — Procedure Recall Before Action

Ziel:
Agent ruft vor Tool Calls passende Prozeduren ab.

Beispiele:

* before running tests
* before editing generated file
* before adding dependency
* before changing API route
* before migration

Akzeptanzkriterien:

* Harness Hook fragt memory_procedure_recall.
* Agent erhält “do/don’t” Context.
* Tool Call wird nach Outcome gespeichert.

⸻

WP 3.3 — Forbidden Action Guard

Ziel:
Memory verhindert bekannte Fehler.

Beispiele:

* do not edit generated files
* do not run e2e locally
* do not use pnpm
* do not change legacy billing

Akzeptanzkriterien:

* Policy/Memory Guard warnt vor Tool Call.
* Agent bekommt Alternative.
* Benchmark misst repeated mistake rate.

⸻

WP 3.4 — Architecture Decision Retrieval

Ziel:
Agent nutzt Architekturentscheidungen vor Codeänderung.

Scope:

* ADRs
* previous corrections
* existing patterns
* directory conventions
* dependency rules

Akzeptanzkriterien:

* Query “add validation” retrieved validation architecture rule.
* Patch landet im richtigen Folder.
* Evidence zeigt Source.

⸻

EPIC 4 — Temporal & Belief Revision for Codebases

WP 4.1 — Repo-State Timeline

Ziel:
Codebase-Knowledge verändert sich über Zeit.

Speichern:

* dependency migration
* test command change
* architecture migration
* deprecated API
* new convention
* branch-specific rule

Akzeptanzkriterien:

* “Vor Migration war Jest gültig, jetzt Vitest” ist modelliert.
* Retrieval nutzt current time/branch.
* Alte Regeln bleiben historisch auffindbar.

⸻

WP 4.2 — Supersession Engine for Corrections

Ziel:
Korrekturen überschreiben nicht, sondern superseden.

Akzeptanzkriterien:

* Old wrong belief wird superseded.
* New correction wird active.
* EvidencePack zeigt journey.

⸻

WP 4.3 — Revalidation of High-Impact Memories

Ziel:
Wichtige repo rules müssen regelmäßig geprüft werden.

Trigger:

* package.json changed
* CI config changed
* test framework changed
* folder moved
* dependency upgraded

Akzeptanzkriterien:

* Memory bekommt verificationDueAt.
* Connector kann Source erneut prüfen.
* Stale rule wird nicht blind injected.

⸻

EPIC 5 — Evidence-grade Context Packs

WP 5.1 — Coding Context Pack Template

Ziel:
Spezialisierte Context Packs für Coding-Agenten.

Sections:

* relevant repo policies
* procedures before action
* previous corrections
* known pitfalls
* architecture decisions
* tool commands
* forbidden actions
* graph/temporal notes

Akzeptanzkriterien:

* Context Pack ist kurz und strukturiert.
* Jede Section hat Evidence.
* Token Budget wird eingehalten.

⸻

WP 5.2 — Evidence Trail for Patch

Ziel:
Nach einer Änderung zeigt cognibrain, welche Memories genutzt wurden.

Output:

* memory IDs
* correction IDs
* procedure IDs
* tool outcomes
* graph paths
* excluded stale rules

Akzeptanzkriterien:

* Agentenlauf ist auditierbar.
* Benchmark nutzt Evidence Trail.
* User kann “wrong memory” markieren.

⸻

WP 5.3 — Wrong-Memory Suppression

Ziel:
Falsche oder überholte Memories nicht injizieren.

Akzeptanzkriterien:

* Contradicted/superseded Memory wird nicht injected.
* Wenn unsicher, Warnung statt Kontext.
* Benchmark misst false context injection.

⸻

EPIC 6 — Harness Integration for Coding Agents

WP 6.1 — Claude Code Connector

Ziel:
Erster “golden path” Connector.

Features:

* session start context
* pre-tool procedure recall
* post-tool outcome memory
* user correction capture
* patch evidence trail

Akzeptanzkriterien:

* Ein Befehl installiert.
* Demo-Repo läuft durch Benchmark.
* Dashboard zeigt Claude Code Runs.

⸻

WP 6.2 — Codex Connector

Ziel:
OpenAI Codex CLI / Hooks Integration.

Akzeptanzkriterien:

* Context Pack vor Task.
* Tool outcomes zurück.
* Corrections gespeichert.
* Evidence Pack erzeugt.

⸻

WP 6.3 — Cursor / VS Code Connector

Ziel:
IDE-basierter Memory Loop.

Akzeptanzkriterien:

* Workspace Scope erkannt.
* File changes werden Memory Events.
* Review/correction UI vorhanden.

⸻

WP 6.4 — GitHub Connector

Ziel:
PR Reviews und CI Results als Memory.

Events:

* PR comment
* review requested changes
* CI failed/passed
* label applied
* release/migration

Akzeptanzkriterien:

* Review correction wird review_correction.
* CI failure wird tool_outcome.
* Next patch nutzt Memory.

⸻

EPIC 7 — Production Platform Hardening

WP 7.1 — Real Storage Backends

Ziel:
SQLite und Postgres produktionsreif.

Akzeptanzkriterien:

* Migrations
* transactions
* indices
* backup/restore
* load tests
* concurrency tests

⸻

WP 7.2 — Auth & Policy Enforcement

Ziel:
Production API absichern.

Akzeptanzkriterien:

* API keys/OIDC
* tenant isolation
* policy checks in search/graph/context/dream/export
* audit on deny

⸻

WP 7.3 — Observability

Ziel:
Betrieb sichtbar machen.

Metriken:

* retrieval latency
* context pack size
* memory writes
* dream duration
* connector sync lag
* policy denials
* benchmark drift

Akzeptanzkriterien:

* /metrics
* structured logs
* request IDs
* error classes

⸻

WP 7.4 — OpenAPI & SDKs

Ziel:
Echte Plattform-API.

Akzeptanzkriterien:

* OpenAPI generated from code.
* TypeScript SDK.
* Python SDK.
* Integration tests.
* Versioned API.

⸻

EPIC 8 — Documentation & Product Proof

WP 8.1 — Production Docs

Docs:

* Local setup
* Team setup
* Production setup
* Storage
* Auth
* Policies
* Connectors
* Benchmarks
* Backup/restore
* Troubleshooting

Akzeptanzkriterien:

* Neuer User kann local in 5 Minuten starten.
* Team kann Postgres Setup folgen.
* Doku sagt klar, was production-ready ist und was preview ist.

⸻

WP 8.2 — Benchmark Docs

Docs:

* CogniCodeBench methodology
* Scenario format
* Evaluation criteria
* Baselines
* Repro steps
* Results interpretation

Akzeptanzkriterien:

* Externe können Benchmark laufen lassen.
* Results sind vergleichbar.
* Claims sind methodisch sauber.

⸻

WP 8.3 — Market Positioning Docs

Seiten:

* cognibrain vs Mem0
* cognibrain vs GBrain
* cognibrain vs Hindsight
* cognibrain vs Zep
* Why Engineering Memory OS?

Akzeptanzkriterien:

* Fair, nicht arrogant.
* Code/Benchmarks belegen Claims.
* USP ist sofort verständlich.

⸻

7. Priorisierung

Priorität A — Eigener Benchmark zuerst

1. CogniCodeBench Spec
2. Synthetic Repo Generator
3. Correction Simulator
4. Next-Change Evaluator
5. Ablation Tests

Warum:
Das ist euer stärkster Marktbeweis und passt exakt zum Usecase.

Priorität B — Coding Memory Types

1. EngineeringMemory Types
2. Correction Pipeline
3. Action Outcome Memory
4. Procedure Recall Before Action
5. Forbidden Action Guard

Warum:
Ohne coding-spezifisches Memory bleibt es generisch.

Priorität C — Harness Golden Path

1. Claude Code Connector
2. Codex Connector
3. GitHub Connector
4. Evidence Trail for Patch

Warum:
Der Benchmark braucht echte Agentenläufe oder mindestens realistische Harness-Simulation.

Priorität D — Production Hardening

1. SQLite Backend
2. Auth/Policy
3. OpenAPI/SDK
4. Observability
5. Production Docs

Warum:
Damit wird daraus eine echte Plattform.

⸻

8. Neue USP-Formulierung nach Benchmark-Idee

Ich würde den USP noch stärker schärfen:

cognibrain is the Engineering Memory OS that lets coding agents learn from every correction, review, command and codebase change.

Deutsch:

cognibrain ist das Engineering Memory OS, mit dem Coding Agents aus jeder Korrektur, jedem Review, jedem Tool-Ergebnis und jeder Codebase-Änderung lernen.

Oder als README-Hero:

Stop fixing the same agent mistake twice.

Untertitel:

cognibrain captures corrections, codebase rules, review feedback and tool outcomes as evidence-grade memory, then injects the right context before the next change.

Das ist sofort verständlich.

⸻

9. Gesamtfazit

Deine Benchmark-Idee ist sehr stark. Ich würde sie nicht als Nebenprojekt behandeln, sondern als zentralen Produkt- und Markt-Hebel.

Die beste Strategie ist jetzt:

1. CogniCodeBench bauen, weil es euren realen Usecase misst.
2. EngineeringMemory Types einführen, damit cognibrain nicht generisch bleibt.
3. Corrections, Tool Outcomes und Procedures first-class machen.
4. Harness-Connectoren daran ausrichten.
5. Benchmark + Evidence Trail als Demo zeigen.
6. Production hardening nachziehen, damit aus dem Kernel eine Plattform wird.

Wenn ihr das macht, habt ihr nicht nur “noch eine Memory-Plattform”, sondern eine neue Kategorie:

Engineering Memory OS for Coding Agents

Das ist ein offensichtlicher, nachvollziehbarer USP, den Entwickler sofort verstehen:

Der Agent macht denselben Fehler nicht zweimal.