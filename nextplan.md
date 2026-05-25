Hier eine Marktanalyse & Implementierungsplan für cognibrain

Kurzfazit

cognibrain ist inzwischen kein frühes MVP mehr. Das Repo beschreibt aktuell eine lokale TypeScript-Memory-Plattform mit Memory Engine, HTTP API, CLI, MCP Connector, Harness Hook, Operator Dashboard, Benchmark Suite und einem dream-Wartungsloop. Besonders stark ist, dass cognibrain nicht nur Erinnerungen speichert, sondern bereits source quality, trust, citations, lifecycle state, retrieval evidence, graph paths, brain/source scope, audit events und pluggable persistence im Datenmodell und in der Plattformpositionierung erwähnt.

Der Markt ist aber inzwischen sehr schnell und sehr aggressiv. Mem0 besetzt “drop-in memory infrastructure”, GBrain besetzt “personal markdown brain”, Hindsight besetzt “production memory with observations + integrations”, Zep besetzt “temporal knowledge graph”, Cognee besetzt “graph/vector memory control plane”. Gleichzeitig tauchen Forschungsprojekte wie MemMachine, SAGE, Kumiho und WorldDB auf, die mit Ground-Truth-Preservation, selbst-evolvierenden Graph-Memories, formaler Belief Revision und rekursiven World-Graphs in Richtung “Memory als echtes Wissensbetriebssystem” gehen.

Meine Empfehlung: cognibrain sollte nicht als “noch ein Memory Layer” positioniert werden. Der klare USP sollte sein:

cognibrain ist das erste inspectable Memory Operating System für Agenten: jede Erinnerung ist beweisbar, zeitlich gültig, graph-basiert erklärbar, widerspruchsbewusst, teamfähig und über alle Harnesses hinweg nutzbar.

Oder kürzer als Claim:

Memory you can prove, route, govern, and reuse across every agent.

Das ist stärker als “wir haben bessere Retrieval Scores”. Scores sind wichtig, aber austauschbar. Der Markt braucht vor allem Vertrauen, Governance, Tool-übergreifende Wiederverwendbarkeit und erklärbare Erinnerungen.

⸻

1. Aktueller Stand von cognibrain

Was bereits stark ist

cognibrain hat inzwischen eine beachtliche Feature-Tiefe. Das Repo beschreibt die Plattform als local-first TypeScript Memory Platform für Agenten, inklusive Engine, HTTP API, CLI, Connector Manifests, Provider Adapters, MCP Connector, Harness Hook, Dashboard, Benchmarks und dream Maintenance Loop. Das ist schon deutlich mehr als “ein Vektorstore mit Search”.

Besonders wichtig: Das README positioniert cognibrain als inspectable memory infrastructure. Es erwähnt explizit graph-native path explanation, rule-based inferred relations, brain/source/agent/persona primitives, official connector manifests, provider adapters, pluggable storage, audit/webhook/marketplace/compliance surfaces und lifecycle maintenance. Diese Kombination zeigt, dass cognibrain schon in Richtung “Memory OS” geht, nicht nur “Memory API”.

Die Roadmap zeigt, dass sehr viele fundamentale Bausteine bereits als “Done” geführt werden: TypeScript Core Engine, HTTP API, CLI, React Dashboard, Harness Hook, stdio MCP, LoCoMo/LongMemEval/BEAM Runner, Provider Adapter, Retrieval Profiles, Canonical Entity Registry, Typed Graph Report, encrypted sensitive-memory mode, dashboard tuning controls, streamable HTTP MCP, pluggable persistence, graph path search, spreading activation, temporal interval queries, behavioural retrieval scoring, recurring behavioural pattern mining, brain/source/agent/persona primitives, webhook queues, marketplace modules und verify:nextgen.

Auch die Konfigurationsdokumentation ist bereits recht weit: Retrieval kombiniert semantic token overlap, keyword coverage, entity match, temporal decay, behavioural cadence, approved pattern fit, trust/importance, graph boost, typed relationship hints, access frequency und evidence gating. Außerdem existieren konfigurierbare Gewichte, JSON-command Provider Tasks für rerank, verify, contradiction, summarize und extract, Privacy/Retention Regeln, AES-GCM Encryption Labels, Identity Links, MCP Streamable HTTP und Offline Sync.

Was noch nicht “marktführend” ist

Die aktuelle Schwäche ist nicht, dass Features fehlen. Die Schwäche ist, dass das Produkt noch kein glasklares Markt-Narrativ und keine unwiderlegbare Proof-Story hat.

Aktuell wirkt cognibrain sehr breit: Memory Engine, Graph, Dream, Provider, Marketplace, Compliance, Benchmarks, Connectors, Personas. Das ist technisch beeindruckend, kann aber für Außenstehende unklar wirken. Der Markt versteht schnelle Kategorien: “Mem0 = managed memory API”, “GBrain = markdown personal brain”, “Zep = temporal graph”, “Hindsight = production memory infrastructure”. cognibrain braucht eine ähnlich einfache Kategorie.

Mein Vorschlag:

cognibrain = Inspectable Memory OS for AI Agents.

Nicht “Memory Layer”, nicht “Brain”, nicht “RAG”, nicht “Graph DB”. Sondern ein Memory Operating System, das Agenten sagt:

“Was darf ich wissen? Was ist bewiesen? Seit wann gilt es? Wem gehört es? Warum wurde es retrieved? Darf ich es verwenden? Was widerspricht dem?”

⸻

2. Marktanalyse

2.1 Mem0

Mem0 ist aktuell einer der sichtbarsten kommerziellen Memory Player. Der eigene State-of-AI-Agent-Memory-Report nennt LoCoMo, LongMemEval und BEAM als Standardbenchmarks und berichtet für den neuen Algorithmus 92.5 auf LoCoMo, 94.4 auf LongMemEval und ca. 6.9k Tokens pro Query. Mem0 nennt als größte Verbesserungen Temporal Reasoning und Multi-Hop, basierend auf Single-Pass ADD-only Extraction und Multi-Signal Retrieval.

Die Stärken von Mem0 sind:

* sehr starke Distribution,
* breite Framework- und Vector-Store-Abdeckung,
* klare Managed-Service-Story,
* einfache API,
* gute Benchmarks,
* viele Integrationen.

Die Schwächen von Mem0 sind zugleich Chancen für cognibrain: Mem0 selbst beschreibt, dass der neue Algorithmus Entity Linking nutzt, aber keine direkt traversierbare Graph-API mehr bietet; Beziehungen beeinflussen das Ranking, können aber nicht direkt als Graph abgefragt werden. Außerdem nennt Mem0 selbst offene Probleme: temporal abstraction at scale, cross-session structure, application-level evaluation, privacy/consent architecture, cross-session identity resolution und memory staleness.

Chance für cognibrain:
Nicht Mem0 kopieren. Stattdessen: explorable, auditable, temporally valid graph memory. Mem0 sagt “we remember”. cognibrain sollte sagen: “we can prove why this memory is valid and usable now.”

2.2 GBrain

GBrain ist stark als “personal brain”. Laut Review hat GBrain drei starke Loops: Tiered Enrichment, Fail-Improve Loop und backlink-boosted ranking. Es extrahiert typed entity references per Regex ohne LLM Calls und nutzt Hybrid Retrieval aus HNSW/pgvector, Postgres tsvector, RRF, Dedup, Backlinks und optionaler Query Expansion.

GBrains größter Vorteil ist Plain-Text Ownership: Markdown in Git, diffbar, versionierbar, auditierbar. Das ist emotional und praktisch stark. Der “compiled truth + timeline” Page-Pattern löst das Problem, dass Memory entweder stale oder unendlich lang wird.

Aber GBrain ist bewusst ein anderes Produkt: single-operator, self-host only, enge OpenClaw/Hermes-Integration, operator-authored skills, keine breite Integration, kein Managed Cloud, keine primäre Multi-Hop-Graph-Traversal- oder Temporal-Retrieval-Strategie.

Chance für cognibrain:
GBrain zeigt, wie wertvoll “Brain als Eigentum” ist. cognibrain kann das stärker machen, indem es git/markdown/artifact ownership optional anbietet, aber gleichzeitig teamfähig, multi-agent, API-first, graph-traversable und compliance-ready bleibt.

2.3 Hindsight

Hindsight wird im Vergleich als Production Agent Memory Platform beschrieben, mit retain, recall, reflect, Observations, Mental Models, automatischer Konsolidierung, Multi-Strategy Retrieval aus semantic, BM25, graph traversal und temporal reasoning, plus RRF und Cross-Encoder Reranking.

Die starke Marktposition von Hindsight ist “Production Memory Infrastructure” mit vielen Integrationen. Im Vergleich wird Hindsight als Option genannt, wenn man automatische Struktur-Synthese, Managed Cloud und 25+ Integrationen braucht.

Chance für cognibrain:
Hindsight ist sehr stark. cognibrain kann nur gewinnen, wenn es nicht “Hindsight in klein” wird, sondern inspectability + governance + local-first ownership + universal agent brain routing als Kategorie besetzt. Hindsight wirkt eher “memory infrastructure that learns”. cognibrain sollte “memory OS you can inspect, govern, and prove” sein.

2.4 Zep / Graphiti

Zep positioniert sich über Temporal Knowledge Graphs. Der arXiv-Abstract beschreibt Graphiti als temporally-aware knowledge graph engine, die unstrukturierte Konversationen und strukturierte Business-Daten dynamisch integriert und historische Beziehungen erhält. In LongMemEval berichtet Zep Verbesserungen bei temporal reasoning und enterprise-kritischen Aufgaben wie cross-session synthesis und long-term context maintenance.

Chance für cognibrain:
Zep ist stark bei Zeit. cognibrain muss Zeit nicht nur als “timestamped facts” bauen, sondern als validity-aware truth state: gültig ab, gültig bis, zuletzt bestätigt, widersprochen durch, superseded by, verification due, retrieval allowed now.

2.5 Cognee

Cognee positioniert sich als graph-based memory engine für cross-session persistence. Die Quelle nennt Knowledge Graphs oder Vector Databases als durable storage und hebt graph-based relationships, semantic embeddings, multi-hop reasoning, self-host/cloud, multi-tenancy und feedback-driven improvement als Kernkriterien hervor.

Chance für cognibrain:
Cognee ist stark in “Graph + Vector”. cognibrain sollte sich davon absetzen über Memory Governance + Evidence + Tool/Harness Universality + Inspectability.

2.6 Neue Forschungsrichtung: Memory wird graph-nativ, evolutiv und beweisorientiert

Die neueren Forschungsarbeiten zeigen klar, wohin der Markt geht:

* MemMachine setzt auf Ground-Truth-Preservation, episodische Speicherung, Profil-Memory und retrieval-stage Optimierungen. Das adressiert das Problem, dass reine Extraktion und Summarisierung Information verlieren kann.
* SAGE beschreibt einen self-evolving graph-memory engine mit writer/reader feedback loop, um evidence recovery, answer grounding und retrieval efficiency zu verbessern.
* Kumiho verbindet graph-native cognitive memory mit formaler Belief Revision, versionierten Erinnerungen, typed dependency edges und Retrieval über Fulltext + Vector; besonders relevant ist die Idee, Memory als Versionierungs- und Belief-Revision-System zu behandeln.
* WorldDB beschreibt “Worlds” als rekursive Graph-Container, content-addressed immutable nodes und edge types mit Verhalten wie on_insert, on_delete und on_query_rewrite. Das geht in Richtung eines programmierbaren Memory Graphs, nicht nur eines Graph Stores.

Interpretation:
Der Markt bewegt sich weg von “memory = vector search” und hin zu memory = evolving, governed, temporal belief graph. Genau hier kann cognibrain gewinnen.

⸻

3. Wie weit ist cognibrain wirklich?

Aktueller Reifegrad

Ich würde cognibrain aktuell so einstufen:

Technische Tiefe: hoch
Produktklarheit: mittel
Markt-Trust: niedrig bis mittel
Benchmark-Proof: mittel
Distribution/Integrationen: mittel
USP-Schärfe: noch nicht ausreichend eindeutig

Die Codebasis und Dokumentation zeigen viele richtige Bausteine: lokale Installation, API, CLI, Dashboard, MCP, Provider Adapter, Retrieval Profiles, Privacy/Retention, Identity Links, Dream Cycle, Streamable HTTP, Offline Queue, Storage Boundary, Graph/Relations, Behavioural Patterns und Benchmarks.

Was fehlt, um “beste Plattform” glaubwürdig zu behaupten, ist vor allem:

1. Eine messerscharfe Kategorie.
    “Inspectable memory infrastructure” ist gut, aber noch zu technisch. “Memory OS for Agents” ist stärker.
2. End-to-end Proof.
    Das Repo selbst sagt, dass breite Marktführerschaft erst behauptet werden sollte, wenn vergleichbare Benchmark-Methodik vorliegt: gleicher Datensatz, gleiche Questions, gleicher Answerer/Judge oder klar getrennte Retrieval-Metrik, gleiche Top-K/Token-Budget, veröffentlichte Per-Question-Resultate.
3. Offizielle Connector Packages.
    Die Roadmap nennt Connector Packages für Claude Code, Codex, Copilot und Cursor als “Next”. Das ist entscheidend, weil Distribution in diesem Markt mindestens so wichtig ist wie Algorithmik.
4. SQL/Postgres Adapters.
    Das Repo ist local-first und läuft ohne Datenbanken, was gut für Adoption ist; für Teams und Enterprise braucht es aber SQLite/Postgres und später Cloud/managed paths. Die Roadmap nennt SQLite/Postgres hinter der Persistence Boundary explizit als nächsten Schritt.
5. UX, die den USP sofort zeigt.
    Der Nutzer muss beim ersten Öffnen sehen: “Ah, das ist nicht nur Memory Search. Ich sehe Beweise, Zeit, Graphpfad, Widersprüche, Consent, Ownership.”

⸻

4. Eindeutiger USP: meine Empfehlung

Produktkategorie

cognibrain sollte nicht als “Memory Layer” auftreten, sondern als:

Agent Memory OS

Oder ausführlicher:

Inspectable Memory OS for AI Agents

Kernversprechen

cognibrain ist die Memory-Plattform, die Agenten nicht nur erinnert, sondern jede Erinnerung beweist, zeitlich einordnet, über Graphpfade erklärt, gegen Widersprüche prüft und über alle Harnesses nutzbar macht.

Warum das stark ist

Mem0 verkauft “drop-in memory”.
GBrain verkauft “personal markdown brain”.
Hindsight verkauft “production memory that learns”.
Zep verkauft “temporal graph memory”.
Cognee verkauft “graph-based memory engine”.

cognibrain sollte verkaufen:

The Memory OS that makes agent context inspectable, governable, and reusable.

Das ist offensichtlich und relevant für alle ernsthaften Teams, weil es das echte Problem trifft: Nicht “kann mein Agent irgendwas erinnern?”, sondern:

* Darf er das erinnern?
* Stimmt es noch?
* Woher kommt es?
* Warum wurde es retrieved?
* Für wen gilt es?
* Seit wann gilt es?
* Was widerspricht dem?
* Welcher Agent darf es verwenden?
* Kann ich es löschen, exportieren, auditieren?

Das ist ein besserer USP als “wir haben auch Graph + RAG”.

⸻

5. Strategische Zielarchitektur

Die Zielarchitektur sollte fünf Ebenen haben:

5.1 Evidence Memory Store

Jede Memory ist kein Text-Snippet, sondern ein Evidence Object:

* Inhalt
* Quelle
* Scope
* Eigentümer
* Consent
* Trust
* Importance
* Validity Window
* Relations
* Contradictions
* Supersession
* Retrieval Evidence
* Audit History

Das ist bereits teilweise da. Es muss zur Kernabstraktion werden.

5.2 Temporal Belief Graph

Der Graph ist nicht nur Entity-Linking. Er ist ein zeitlicher Belief Graph:

* Nodes: Personen, Projekte, Repos, Tools, Entscheidungen, Präferenzen, Workflows
* Edges: uses, depends_on, confirmed_by, supersedes, contradicts, owned_by, works_on, prefers, blocked_by
* Zeit: valid from/until, last confirmed, verification due
* Belief Revision: neue Fakten überschreiben nicht, sondern erzeugen Zustandsübergänge

Hier kann cognibrain deutlich besser werden als Mem0 und GBrain.

5.3 Memory Router

Ein Agent fragt nicht “search memory”, sondern der Memory Router entscheidet:

* Session Memory
* Project Memory
* User Memory
* Team Memory
* Org Memory
* Procedural Memory
* Evidence Graph
* Timeline
* Pattern Memory

Das ist besonders wichtig für CLIs/Harnesses. Der Agent soll nicht überlegen müssen, ob etwas in CLAUDE.md, MCP, GBrain, project docs oder context gehört.

5.4 Inspectable Context Pack

Jedes Context Pack, das an einen Agenten geht, muss erklärbar sein:

* warum enthalten,
* Score pro Signal,
* Graphpfad,
* Zeitstatus,
* Consent/Scope,
* mögliche Widersprüche,
* “unsafe to use” Flag,
* “needs verification” Flag.

Das ist ein extrem starker Markt-USP, weil es Vertrauen schafft.

5.5 Operator + Marketplace Layer

Operator Dashboard plus Module Marketplace:

* Connector installieren
* Domain Pack installieren
* Persona wählen
* Retrieval Profile wählen
* Retention Policy setzen
* Benchmark vergleichen
* Graph ansehen
* Pattern genehmigen
* Memory löschen/exportieren

Das macht aus der Engine ein Produkt.

⸻

6. Workpackages für die Implementierung

Die Workpackages sind so formuliert, dass du sie direkt als GitHub Issues anlegen kannst.

⸻

EPIC 1 — Product Positioning & UX Narrative

WP 1.1 — Repositionierung zu “Agent Memory OS”

Ziel:
Aus cognibrain eine klar verständliche Produktkategorie machen: Inspectable Memory OS for AI Agents.

Scope:

* README Hero aktualisieren.
* Produktclaim schärfen.
* “Why cognibrain” auf 5 klare Differenzierungsargumente reduzieren.
* Vergleichsseite “cognibrain vs Mem0 vs GBrain vs Hindsight vs Zep” erstellen.
* Visuelles Diagramm: Agent → Memory Router → Evidence Graph → Context Pack.
* “First 5 minutes” Demo definieren.

Akzeptanzkriterien:

* Ein neuer Besucher versteht innerhalb von 30 Sekunden, warum cognibrain anders ist.
* README erklärt nicht nur Features, sondern die Kategorie.
* Eine Vergleichstabelle zeigt klar: cognibrain = inspectable/governed/cross-agent Memory OS.

⸻

WP 1.2 — “Why was this memory used?” als Hauptdemo

Ziel:
Die erste Demo soll nicht “memory search” sein, sondern explainable recall.

Scope:

* Demo Seed Dataset erstellen.
* Query ausführen.
* Context Pack anzeigen.
* Pro Memory anzeigen:
    * Source
    * Trust
    * Validity
    * Graph Path
    * Contradiction Status
    * Consent
    * Retrieval Signals
* Screenshot/GIF in README.

Akzeptanzkriterien:

* Demo zeigt sichtbar, dass cognibrain mehr ist als Vector Search.
* Jede Memory im Context Pack ist erklärbar.
* Dashboard und CLI zeigen dieselbe Evidence.

⸻

EPIC 2 — Evidence Object Model

WP 2.1 — MemoryRecord v2 als canonical schema

Ziel:
Ein klares, stabil versioniertes Datenmodell für beweisbare Memories.

Scope:

* MemoryRecordV2 definieren.
* Pflichtfelder:
    * id
    * content
    * source
    * scope
    * createdAt
    * validFrom
    * validUntil
    * trust
    * confidence
    * importance
    * consent
    * relations
    * provenance
    * audit
* Migration von bestehenden Records.
* JSON Schema veröffentlichen.
* TypeScript Types exportieren.

Akzeptanzkriterien:

* Alle APIs liefern MemoryRecordV2.
* CLI memory inspect <id> zeigt alle Felder.
* Tests validieren Schema und Migration.

⸻

WP 2.2 — Validity & Belief State

Ziel:
Memory soll nicht nur “alt/neu” kennen, sondern “gültig”, “veraltet”, “widersprochen”, “ersetzt”, “unsicher”.

Scope:

* Belief States einführen:
    * active
    * stale
    * superseded
    * contradicted
    * needs_verification
    * retracted
* State Transition Rules definieren.
* Dream Cycle nutzt diese States.
* Retrieval filtert oder warnt anhand dieser States.

Akzeptanzkriterien:

* Eine neue Memory kann eine alte superseden, ohne sie zu löschen.
* Widersprüche erzeugen State Change statt Blind Retrieval.
* Context Pack markiert unsichere Memories.

⸻

EPIC 3 — Temporal Belief Graph

WP 3.1 — Temporal Graph Core

Ziel:
Der Graph soll zeitliche Wahrheit modellieren: was galt wann, warum und bis wann.

Scope:

* Graph Edge Model erweitern:
    * type
    * from
    * to
    * validFrom
    * validUntil
    * confidence
    * evidenceIds
    * createdBy
* Query-Funktionen:
    * “gültig jetzt”
    * “gültig am Datum”
    * “geändert seit”
    * “widersprochen durch”
* CLI:
    * graph query
    * graph path
    * graph changes

Akzeptanzkriterien:

* Query “Was war letzte Woche wahr?” funktioniert.
* Query “Was hat sich seit X geändert?” funktioniert.
* Graphpfade enthalten Zeitfenster.

⸻

WP 3.2 — Multi-Hop Retrieval als primäre Strategie

Ziel:
Graph Traversal darf nicht nur Ranking-Boost sein. Es muss eine echte Retrieval-Strategie sein.

Scope:

* Retrieval Strategy graph_path.
* Max Depth konfigurierbar.
* Path Scoring:
    * edge confidence
    * trust
    * recency
    * path length penalty
    * source quality
* Ausgabe enthält Reasoning Path.

Akzeptanzkriterien:

* Multi-Hop Query findet Memories, die keine direkten Keyword-Hits haben.
* Result zeigt den Pfad.
* Benchmark für Multi-Hop Recall existiert.

⸻

WP 3.3 — Connection Explainer

Ziel:
Nutzer und Agenten können fragen: “Wie hängen A und B zusammen?”

Scope:

* API GET /graph/explain?from=A&to=B.
* CLI memory explain A B.
* Dashboard Path View.
* Mehrere Pfadtypen:
    * shortest
    * strongest
    * most recent
    * highest trust

Akzeptanzkriterien:

* Explainer liefert Pfad plus Evidenz.
* Explainer funktioniert für Personen, Projekte, Repos, Tools, Entscheidungen.
* UI zeigt Pfad verständlich.

⸻

EPIC 4 — Memory Router & Scopes

WP 4.1 — Brain/Source/Agent/Persona Router

Ziel:
cognibrain entscheidet automatisch, welcher Memory Scope relevant ist.

Scope:

* Router Inputs:
    * query
    * current repo
    * agent id
    * user id
    * project id
    * org id
    * persona
* Router Output:
    * selected scopes
    * excluded scopes
    * reasoning
* CLI memory route "<query>".
* Dashboard Route Preview.

Akzeptanzkriterien:

* Query in einem Repo bevorzugt Project Memory.
* Team Query kann Shared Memory einbeziehen.
* Private Memory wird nicht ohne Consent gerouted.

⸻

WP 4.2 — Shared Team Memory Workflow

Ziel:
Team Memory darf nicht einfach ein globaler Dump sein. Es braucht Review und Governance.

Scope:

* Personal → Team Promotion Flow.
* Review States:
    * pending
    * approved
    * rejected
    * revoked
* Team-visible Memories mit Owner.
* Audit Trail.
* CLI:
    * memory promote
    * memory review
    * memory revoke

Akzeptanzkriterien:

* Private Memory wird nie automatisch Team Memory.
* Team Memory hat Reviewer und Approval.
* Revoked Memories verschwinden aus Team Retrieval.

⸻

EPIC 5 — Retrieval Engine vNext

WP 5.1 — Multi-Strategy Retrieval Fusion

Ziel:
Retrieval kombiniert alle relevanten Signale: semantic, keyword, graph, temporal, behavioural, procedural, trust.

Scope:

* Strategien:
    * semantic
    * BM25/keyword
    * entity
    * graph path
    * temporal
    * behavioural pattern
    * procedural
* RRF Fusion.
* Cross-Encoder optional.
* Context Verifier nach Fusion.

Akzeptanzkriterien:

* Jede Strategie kann isoliert getestet werden.
* Fusion erzeugt erklärbare Scores.
* Query kann Retrieval Profile wählen.

⸻

WP 5.2 — Query Intent Classifier

Ziel:
Vor Retrieval erkennen, welche Art Query vorliegt.

Query-Typen:

* fact lookup
* temporal question
* multi-hop question
* preference/procedural question
* contradiction check
* project context
* personal context
* team context
* “why/how connected” question

Scope:

* Deterministischer Classifier.
* Optional Provider Classifier.
* Retrieval Strategy je Intent anpassen.

Akzeptanzkriterien:

* Temporal Queries triggern Timeline Strategy.
* Multi-Hop Queries triggern Graph Path Strategy.
* Procedural Queries triggern procedural memory.

⸻

WP 5.3 — Retrieval Learning mit Accepted/Rejected Context Packs

Ziel:
cognibrain soll aus echten Agentenläufen lernen, welche Memories hilfreich waren.

Scope:

* Context Pack ID speichern.
* Agent/User Feedback:
    * accepted
    * rejected
    * partially useful
    * harmful
* Labeled Samples erzeugen.
* Weight Optimizer erweitern.
* Regression Tests gegen Overfitting.

Akzeptanzkriterien:

* Retrieval Profile verbessert sich mit Feedback.
* Schlechte Memories verlieren Gewicht.
* Always/Never Include bleibt explainable.

⸻

EPIC 6 — Ground Truth Preservation

WP 6.1 — Episode Store

Ziel:
Neben extrahierten Facts sollen vollständige Episoden erhalten bleiben, damit keine Ground Truth verloren geht.

Scope:

* Episode Record:
    * raw conversation
    * tool calls
    * files touched
    * timestamps
    * source
    * hash
* Facts referenzieren Episode IDs.
* Retrieval kann Episode Context nachladen.
* Datenschutzregeln beachten.

Akzeptanzkriterien:

* Jede extrahierte Memory ist auf Episode zurückführbar.
* User kann Originalkontext sehen.
* Export enthält Episode + Facts + Graph.

⸻

WP 6.2 — Evidence Pack Export

Ziel:
Für jede Antwort kann ein beweisbares Paket erzeugt werden.

Scope:

* Context Pack
* Memory IDs
* Source citations
* Graph paths
* Validity windows
* Contradiction states
* Token budget
* Retrieval profile
* Answer output optional

Akzeptanzkriterien:

* memory evidence <contextPackId> erzeugt JSON.
* Dashboard Export möglich.
* Benchmark-Artefakte nutzen dasselbe Format.

⸻

EPIC 7 — Dream / Reflection vNext

WP 7.1 — Dream Cycle als Belief Revision Engine

Ziel:
Dream ist nicht nur Cleanup, sondern aktives Belief Management.

Scope:

* Tasks:
    * contradiction resolution
    * supersession
    * timeline summary
    * pattern promotion
    * stale verification scheduling
    * procedural extraction
    * team promotion suggestions
* Jeder Task erzeugt Audit Events.

Akzeptanzkriterien:

* Dream Report erklärt alle Änderungen.
* Keine Memory wird still gelöscht.
* Supersession wird als Journey modelliert.

⸻

WP 7.2 — Verification Queue

Ziel:
Wichtige, aber unsichere Memories sollen verifiziert werden.

Scope:

* Verification Due Date.
* Queue im Dashboard.
* CLI:
    * memory verify
    * memory confirm
    * memory retract
* Connector-basierte Revalidation möglich.

Akzeptanzkriterien:

* High-impact stale facts werden nicht blind retrieved.
* Nutzer kann Fakten bestätigen oder zurückziehen.
* Agent erhält “needs verification” Warnung.

⸻

EPIC 8 — Procedural Memory

WP 8.1 — Procedural Memory First-Class

Ziel:
Workflow-Wissen separat und stärker behandeln.

Beispiele:

* “Vor Release immer npm test ausführen”
* “PRs brauchen Changelog”
* “Bei diesem Repo keine pnpm verwenden”
* “Deploy erst staging, dann prod”

Scope:

* Eigener Memory Type procedure.
* Trigger Conditions.
* Applicability Scope.
* Confidence.
* Last success/failure.
* Feedback Loop.

Akzeptanzkriterien:

* Agent kann passende Prozedur vor Tool Call abrufen.
* Prozeduren haben Erfolgshistorie.
* Fehlgeschlagene Prozeduren werden überprüft.

⸻

WP 8.2 — Harness Action Memory

Ziel:
Agentenaktionen selbst werden Memory.

Scope:

* Speichern:
    * command executed
    * file changed
    * tests passed/failed
    * PR created
    * error fixed
* Agent-generated facts bekommen eigenen Source Kind.
* Tool Result wird Evidence.

Akzeptanzkriterien:

* Agent merkt, was er getan hat.
* Wiederholte Fehler werden als Pattern erkannt.
* Retrieval kann “what fixed this last time?” beantworten.

⸻

EPIC 9 — Connectors & Distribution

WP 9.1 — Official Connector Packages

Ziel:
Nicht nur Templates, sondern installierbare Packages.

Priorität:

1. Claude Code
2. OpenAI Codex
3. Cursor
4. GitHub Copilot
5. VS Code
6. OpenCode / OpenClaw
7. LangGraph / CrewAI

Scope:

* npm packages.
* One-command setup.
* Health check.
* Example repo.
* Context Pack integration.
* Feedback integration.

Akzeptanzkriterien:

* npx cognibrain-connect claude-code funktioniert.
* Connector zeigt Status im Dashboard.
* Connector sendet Feedback zurück.

⸻

WP 9.2 — Two-Way System Connectors

Ziel:
cognibrain lernt nicht nur aus Chat, sondern aus echten Arbeitssystemen.

Connectors:

* GitHub
* Jira
* Linear
* Slack
* Notion
* Google Drive
* Gmail
* Calendar

Scope:

* Ingest Events.
* Respect Permissions.
* Map Entities.
* Source Links.
* Optional write-back.

Akzeptanzkriterien:

* GitHub Issue wird Memory Event.
* Slack Decision wird Memory mit Source.
* Jira Statuswechsel aktualisiert Timeline.

⸻

EPIC 10 — Privacy, Security, Compliance

WP 10.1 — Consent & Policy Engine

Ziel:
Memory darf nur genutzt werden, wenn Policy es erlaubt.

Scope:

* Policy Rules:
    * by user
    * by org
    * by source
    * by tag
    * by memory type
    * by connector
* Retrieval Enforcement.
* Dream Enforcement.
* Export/Delete Enforcement.

Akzeptanzkriterien:

* Private Memory bleibt privat.
* Org Memory nur in org scope.
* Policy Violations werden geloggt.

⸻

WP 10.2 — Encrypted Memory Vault

Ziel:
Sensible Memories sicher speichern und kontrolliert verwenden.

Scope:

* Per-memory encryption.
* Key IDs.
* Rotation.
* Decrypt only on authorized retrieval.
* Vault Audit.

Akzeptanzkriterien:

* Encrypted Memory ist im Store nicht lesbar.
* Retrieval benötigt Berechtigung.
* Key Rotation wird dokumentiert.

⸻

EPIC 11 — Benchmarks & Proof

WP 11.1 — Full Answer Benchmarks

Ziel:
Nicht nur Evidence Recall, sondern echte Antwortqualität messen.

Benchmarks:

* LoCoMo
* LongMemEval
* BEAM
* Custom temporal graph
* Custom coding agent benchmark

Scope:

* Same question set.
* Same answerer.
* Same judge.
* Same top-K.
* Same token budget.
* Per-question artifacts.

Akzeptanzkriterien:

* Ergebnisse sind reproduzierbar.
* README claim hängt an Benchmark Level.
* Vendor comparisons sind methodisch getrennt.

⸻

WP 11.2 — USP Benchmarks

Ziel:
Benchmarks bauen, die genau cognibrains USP messen.

Benchmark-Kategorien:

* “Why was this memory retrieved?”
* Multi-hop graph path accuracy
* Temporal validity accuracy
* Contradiction suppression
* Consent enforcement
* Procedure recall before action
* Cross-agent memory reuse
* Source citation correctness

Akzeptanzkriterien:

* cognibrain zeigt klare Stärken, die andere Systeme kaum messen.
* Benchmarks sind öffentlich.
* Tests laufen in CI.

⸻

EPIC 12 — Marketplace & Extensibility

WP 12.1 — Domain Modules

Ziel:
cognibrain wird erweiterbar für Branchen und Workflows.

Module:

* Coding
* Research
* Legal
* Sales
* Support
* Finance
* Healthcare

Jedes Modul enthält:

* entity types
* relation types
* extraction rules
* retrieval profile
* retention policy
* benchmark fixtures
* dashboard views

Akzeptanzkriterien:

* Module können installiert/deinstalliert werden.
* Module beeinflussen Extraction und Retrieval.
* Module sind versioniert.

⸻

WP 12.2 — Marketplace Governance

Ziel:
Marketplace darf nicht unsicher oder chaotisch werden.

Scope:

* Module manifest.
* Signature.
* Security scan.
* Permissions requested.
* Version compatibility.
* Ratings.

Akzeptanzkriterien:

* User sieht, was ein Modul darf.
* Unsichere Module werden blockiert.
* Marketplace ist auditierbar.

⸻

7. Priorisierung

Sofortige Top-Prioritäten

Priorität 1 — USP sichtbar machen

* WP 1.1 Repositionierung
* WP 1.2 Why-used Demo
* WP 6.2 Evidence Pack Export
* WP 11.2 USP Benchmarks

Ohne das versteht der Markt nicht, warum cognibrain anders ist.

Priorität 2 — Retrieval/Graph beweisbar besser machen

* WP 3.2 Multi-Hop Retrieval
* WP 3.3 Connection Explainer
* WP 5.1 Multi-Strategy Retrieval Fusion
* WP 5.2 Query Intent Classifier

Das ist die technische Kern-Differenzierung.

Priorität 3 — Distribution

* WP 9.1 Official Connector Packages
* WP 9.2 System Connectors
* Setup Demo für Claude Code / Codex / Cursor

Ohne Distribution gewinnt das technisch beste Produkt nicht.

Priorität 4 — Enterprise Trust

* WP 10.1 Policy Engine
* WP 10.2 Encrypted Vault
* WP 11.1 Full Answer Benchmarks
* WP 11.2 USP Benchmarks

Das macht cognibrain “serious” für Teams.

⸻

8. Empfohlene neue GitHub Epics

Ich würde folgende Epics direkt im Repo anlegen:

1. Epic: Product Positioning — Agent Memory OS
2. Epic: Evidence Object Model v2
3. Epic: Temporal Belief Graph
4. Epic: Memory Router & Scopes
5. Epic: Retrieval Engine vNext
6. Epic: Ground Truth Preservation
7. Epic: Dream as Belief Revision
8. Epic: Procedural & Action Memory
9. Epic: Official Connectors
10. Epic: Privacy & Policy Engine
11. Epic: USP Benchmark Suite
12. Epic: Domain Module Marketplace

⸻

9. Was cognibrain vermeiden sollte

Nicht einfach Mem0 nachbauen

Mem0 hat Distribution, Cloud, SDKs und Benchmarks. Ein “Mem0, aber lokal” reicht nicht.

Nicht einfach GBrain nachbauen

GBrain hat Markdown, persönliche Brain-DNA, Celebrity Momentum. Ein “GBrain, aber TypeScript” reicht nicht.

Nicht nur Benchmarks jagen

Benchmark-Führung ohne Produktvertrauen ist kurzlebig. Besser: Benchmarks + Inspectability + Governance.

Nicht zu viele Features ohne Story

cognibrain hat schon viele Features. Jetzt braucht es eine Produktstory, die alle Features bündelt:

“Every agent memory must be explainable, valid, governed, and reusable.”

⸻

10. Endgültige Empfehlung

Der Markt ist offen für eine Plattform, die die Lücke zwischen persönlichem Brain, kommerzieller Memory API und Enterprise Knowledge Graph schließt.

cognibrain sollte diese Kategorie besetzen:

Inspectable Agent Memory OS

Mit diesem Kernversprechen:

cognibrain remembers across agents, proves every memory, explains every retrieval, respects every boundary, and learns from every run.

Das ist der offensichtlichste USP:

* Für Entwickler: ein Memory für alle CLIs/Harnesses.
* Für Teams: shared memory mit Governance.
* Für Enterprises: auditierbare, consent-aware, verschlüsselte Memory.
* Für Agenten: context packs mit Beweisen, Zeit, Graphpfad und Verlässlichkeit.
* Für den Markt: nicht nur Retrieval, sondern ein echtes Memory Operating System.

Wenn ihr das konsequent baut, kann cognibrain eine eigene Kategorie definieren statt nur gegen Mem0, GBrain oder Hindsight verglichen zu werden