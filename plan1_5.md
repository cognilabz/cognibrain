# Neuer Report: aktueller Stand, Gaps und nächster Plan für cognibrain

## Executive Summary

Der aktuelle Repo-Stand ist deutlich weiter als die letzte große Analyse. **cognibrain hat inzwischen viele der vorher vorgeschlagenen Produkt-, Benchmark-, Connector- und Produktions-Claims schon in Code, Scripts und Doku abgebildet.** Das ist sehr gut.

Aber du hast recht: Die nächsten Gaps liegen nicht mehr primär bei “wir brauchen noch irgendein Memory-Feature”, sondern bei:

1. **echte Connector-Breite**: Jira, Confluence, Notion, Linear, Google Workspace, GitLab, Azure DevOps usw. nicht nur als Manifest-Idee, sondern als echte Vendor Driver mit Live-Smoke und Auth-Flows.
2. **echte One-Command-/Guided-Install-Experience**: aktuell gibt es Commands, aber noch nicht die “cool CLI wizard / Q&A guided setup / diagnose-and-fix” Experience.
3. **Benchmark-Arena statt Textvergleich**: nicht nur “wir vergleichen uns textlich mit Mem0/GBrain/Hindsight/Zep/Cognee”, sondern **wir führen unseren Benchmark gegen Wettbewerber selbst aus**, auf denselben Szenarien, denselben Metrics, denselben Budgets.
4. **aggressivere, aber wahre Marketingform**: weniger defensiv “claim boundary”, mehr offensiv “we test what others only claim” — aber immer mit Artifact-Link und Proof-Level.

Der zentrale Claim sollte jetzt werden:

> **Stop comparing memory claims. Run the same coding-agent benchmark.**

Oder als Produktclaim:

> **cognibrain is the Engineering Memory OS that proves whether coding agents actually learn from corrections, reviews, commands and codebase changes.**

Das ist aggressiv, aber sauber, wenn ihr die Benchmark-Arena wirklich baut.

---

# 1. Aktueller Repo-Stand: Was jetzt wirklich da ist

## 1.1 README und Positionierung sind viel besser geworden

Das README positioniert cognibrain inzwischen als **Engineering Memory OS for coding agents** und erklärt klar: cognibrain speichert Corrections, Repo Policies, Architecture Decisions, Review Feedback und Tool Outcomes als evidence-grade memory und injiziert passenden Kontext vor der nächsten Codeänderung. Das ist bereits sehr nah an der richtigen Story. 

Sehr gut ist auch, dass README direkt auf Status Matrix, Claims und Production Readiness verweist. Dadurch ist die Doku nicht mehr nur Marketing, sondern claims-aware. 

## 1.2 Package-Surface ist stark gewachsen

`package.json` zeigt, dass inzwischen sehr viele Scripts existieren:

* `benchmark:cognicode:generate`
* `benchmark:cognicode`
* `benchmark:answer-generation`
* `benchmark:load`
* `verify:postgres`
* `verify:connectors`
* `verify:vendor-connectors`
* `verify:vendor-live`
* `verify:compatibility`
* `verify:selfhosted`
* `verify:status`
* mehrere Plan-Audits
* `cognibrain-connect` als eigenes Binary

Das ist ein deutlicher Fortschritt Richtung realer Plattform-Verification. 

Aber: Das Package ist weiterhin `0.1.0`. Das bedeutet: Für öffentliche Marktkommunikation ist “production candidate / self-hosted candidate” glaubwürdig, aber “mature stable platform” noch nicht.

## 1.3 Status Matrix ist sehr stark

Die `docs/implementation-status.md` ist inzwischen ein echter Vorteil. Sie listet Features mit Code/API/CLI/MCP/Dashboard/Tests/Docs/Production-Ready-Status. Sie claimt unter anderem:

* MemoryRecordV2
* SQLite storage schema
* Postgres-compatible storage
* Event-sourced audit journal
* API key auth
* Policy engine / tenant isolation
* Evidence Pack
* Engineering Memory object model
* coding context packs/action guards
* Query Planner
* Graph path explanation
* FTS/BM25
* Vector interface
* Connector SDK
* GitHub/Slack/Discord connectors
* MCP v2 graph/policy/procedure tools
* Python SDK
* TypeScript SDK
* OpenAPI
* CogniCodeBench
* production load benchmarks

Das ist eine sehr gute Trust-Oberfläche. 

Aber: Status Matrix und Claims müssen jetzt zu einem **produktiven Proof Dashboard / Benchmark Arena** werden, nicht nur Markdown.

## 1.4 Claims Map ist ein echter Differenzierungsanker

`docs/claims.md` ist sehr wichtig. Es mapped öffentliche Claims auf Evidence Gates und definiert Non-Claims, z. B. keine Managed-SaaS-Readiness, keine real customer repo performance aus CogniCodeBench allein, keine Competitor Leadership ohne comparable artifacts. 

Das ist professionell. Jetzt darf es aber nicht zu defensiv bleiben. Die richtige Weiterentwicklung ist:

> **Aggressive claim, hard proof boundary.**

Beispiel:

> “We do not compare memory slogans. We run coding-agent memory systems on the same scenarios.”

Das ist stark und trotzdem wahr, wenn ihr den Runner baut.

## 1.5 Production Readiness ist ehrlicher geworden

`docs/production-readiness.md` sagt klar: cognibrain ist ein **open-source, self-hosted Engineering Memory OS candidate**, nicht Managed-SaaS-zertifiziert. Es listet Setup-Pfade, Required Production Environment, Verification Loop und Release Checklist. 

Das ist genau richtig. Jetzt fehlen noch stärker:

* “production hardening recipes”,
* “deployment reference architecture”,
* “security model as diagram”,
* “operator runbook”,
* “upgrade path”,
* “connector credential runbooks”.

---

# 2. Aktuelle Gaps

## Gap A — Connectoren: Manifest-Breite ist da, echte Vendor-Breite noch nicht

Die Connectors-Doku listet viele offizielle Manifest-Typen:

* email
* chat
* project management
* docs
* code
* calendar
* cloud storage
* GitHub
* Jira
* Linear
* Slack
* Discord
* Notion
* Google Drive
* Gmail
* Google Calendar

Das klingt breit. 

Aber in der Doku steht auch klar: **GitHub, Slack und Discord sind first-class external connectors** mit Required Environment, Reads und Writes. Die Connector Maturity Matrix enthält echte Vendor-Smoke-Zeilen nur für GitHub, Slack und Discord. 

Ich habe außerdem im Repo nach `jira confluence notion` gesucht und keine Treffer über die GitHub-Suche bekommen. Gleichzeitig erwähnt die Connector-Doku Jira/Notion als Manifest-Kategorien, aber nicht als first-class vendor driver. Das ist der Gap: **Jira/Notion/Google Drive/Gmail/Calendar/Confluence sind eher Produktversprechen/Manifest-Fläche, nicht auf demselben Reifegrad wie GitHub/Slack/Discord.**

### Bewertung

**Aktuell:** GitHub/Slack/Discord sind am weitesten.
**Nächster Schritt:** Jira, Confluence, Notion, Linear, GitLab, Google Workspace als echte Drivers.

---

## Gap B — Install ist vorhanden, aber noch nicht “wow”

Es gibt inzwischen `cognibrain-connect` und `setup --self-hosted`. Die Doku beschreibt:

```bash
./bin/cognibrain.mjs setup --self-hosted
npx cognibrain-connect claude-code
npx cognibrain-connect all --no-start
```

und `cognibrain-connect` kann Targets wie Codex, Claude Code, Cursor, GitHub Copilot, VS Code, OpenCode, OpenClaw, LangGraph und CrewAI installieren. 

Das ist gut, aber noch nicht “wow”.

Was fehlt:

* interaktiver Wizard
* Q&A Flow
* guided connector setup
* credential detection
* choose local/team/prod
* choose harness
* choose storage
* choose benchmark/demo
* validate environment
* fix suggestions
* “copy this command into Claude/Codex”
* `doctor --fix`
* onboarding progress
* “run first demo now?”
* “import existing repo rules?”
* “install GitHub/Jira/Notion connector now?”

### Bewertung

**Aktuell:** CLI-first setup und connect commands.
**Ziel:** “Linear/Vercel/Supabase-like onboarding CLI”.

---

## Gap C — Benchmarks: Ihr habt CogniCodeBench, aber noch keine echte Competitor Arena

`package.json` zeigt, dass CogniCodeBench existiert:

* `benchmark:cognicode:generate`
* `benchmark:cognicode`

Außerdem gibt es Market Gate, answer generation, leaderboard und competitor import logic. 

Die Market Comparison Doku ist schon ziemlich gut: Sie trennt öffentliche Claims, Import-Artefakte, direct gates und Proof Boundaries. Sie sagt, dass Competitor Results nur direkt genutzt werden, wenn dataset, metric, top-K/token budget, answer leakage und per-run metadata vergleichbar sind. 

Aber du hast recht: **Textvergleich ist schwach.**
Der nächste Schritt muss sein:

> Wir führen denselben Benchmark selbst gegen Wettbewerber aus.

Nicht nur importierte Public Claims. Nicht nur “Mem0 says X”. Nicht nur “GBrain is Y”. Sondern:

```text
cognibrain benchmark arena run --systems cognibrain,mem0,gbrain,graphiti,cognee,langmem --benchmark cognicodebench
```

### Bewertung

**Aktuell:** Eigener Benchmark + public claim import + market docs.
**Ziel:** Same-run Benchmark Arena mit Adaptern für Competitors.

---

## Gap D — Marktvergleich ist noch zu brav

Die aktuelle `docs/market-comparison.md` ist korrekt und vorsichtig. Sie erklärt Proof Boundaries und listet Seiten. 

Die einzelne Mem0-Marktseite ist sehr sachlich:

> Mem0 is strong general-purpose memory; cognibrain differs by Engineering Memory types, CogniCodeBench, Evidence Packs, Action Guards, Patch Evidence Trails. 

Das ist faktisch gut, aber nicht “wow”. Für Marketing ist das zu weich.

Ihr braucht zwei Ebenen:

1. **Legal/Proof-safe docs:** sachlich, boundary-aware.
2. **Aggressive landing copy:** klar, provokant, aber mit Fußnoten/Artifacts.

Beispiel:

> **Most memory benchmarks ask: “Can the agent remember?” CogniCodeBench asks: “Did the agent stop making the same engineering mistake?”**

Das ist aggressiv und wahr.

---

# 3. Markt- und Forschungskontext

Der Markt bewegt sich genau in die Richtung, die cognibrain besetzen kann.

* **Zep/Graphiti** zeigt, dass temporale Knowledge Graphs wichtig sind; Zep berichtet in seinem Paper Verbesserungen bei temporal reasoning und long-term context maintenance.
* **MemMachine** zeigt, dass Ground-Truth-Preservation, Episoden-Speicherung und Retrieval-Stage-Optimierung immer wichtiger werden; es berichtet starke LoCoMo/LongMemEvalS-Ergebnisse und deutlich weniger Input-Tokens gegenüber Mem0 unter matched conditions.
* **APEX-MEM** zeigt eine Richtung mit Property Graph, append-only storage und retrieval-time conflict resolution, also sehr ähnlich dem, was cognibrain als Evidence-grade Memory OS anstreben sollte.
* **SocialMemBench** zeigt, dass aktuelle Memory-Systeme in komplexeren sozialen Gruppen-Settings noch sehr schwach sind; das beweist, dass generische Memory-Benchmarks noch nicht alles abdecken und eigene spezialisierte Benchmarks legitim und nötig sind.
* **MemX** zeigt die Stärke von local-first, explainable retrieval, FTS5 und low-confidence rejection; das passt zur cognibrain-Richtung, zeigt aber auch, dass “local-first + explainable” bald kein Alleinstellungsmerkmal mehr ist.

Konsequenz:

> Euer USP darf nicht nur “local-first, explainable, graph, memory” sein. Das wird Commodity.
> Der USP muss **Engineering-Agent-Verhalten messbar verbessern**.

---

# 4. Neuer Zielzustand

## Produktkategorie

```text
Engineering Memory OS for AI Coding Agents
```

## Hauptclaim

```text
Stop fixing the same agent mistake twice.
```

## Benchmarkclaim

```text
We benchmark whether agents apply corrections on the next code change, not whether they can repeat a fact.
```

## Competitive claim

```text
We do not compare memory slogans. We run memory systems on the same coding-agent scenarios.
```

## Proof claim

```text
Every claim links to an artifact, a test, or a boundary.
```

---

# 5. Neuer Implementierungsplan

## EPIC 1 — Connector Expansion: Jira, Confluence, Notion & Work Systems

### WP 1.1 — Jira Connector Driver

**Ziel:**
Jira muss first-class werden, nicht nur Manifest.

**Scope:**

* Auth: API token / OAuth
* Reads:

  * issues
  * comments
  * status transitions
  * labels/components
  * links
  * assignees
  * sprint/epic metadata
* Writes:

  * comment
  * label/tag
  * memory summary comment
* Memory mapping:

  * `review_correction`
  * `repo_policy`
  * `architecture_decision`
  * `tool_outcome`
  * `procedure`
  * `project_decision`

**Akzeptanzkriterien:**

* `official-jira` is real vendor driver, not only manifest.
* `verify:vendor-connectors` covers Jira via hermetic fixture.
* `verify:vendor-live` supports Jira with `MEMORY_JIRA_*`.
* Jira connector appears in maturity matrix as vendor-smoke required.
* SourceRef links back to Jira issue/comment.

---

### WP 1.2 — Confluence Connector Driver

**Ziel:**
Confluence ist für Engineering Knowledge Base extrem wichtig.

**Scope:**

* Reads:

  * pages
  * spaces
  * labels
  * page versions
  * comments
* Writes:

  * memory summary page/comment optional
* Extraction:

  * architecture decisions
  * runbooks
  * repo policies
  * service ownership
  * incident learnings

**Akzeptanzkriterien:**

* `official-confluence` manifest + driver.
* Versioned pages become memory with source version.
* Page deletion/update triggers revalidation.
* Confluence appears in connector maturity matrix.

---

### WP 1.3 — Notion Connector Driver

**Ziel:**
Notion ist für Startups/Teams zentral.

**Scope:**

* Reads:

  * pages
  * databases
  * comments
  * properties
* Writes:

  * memory summary block/comment optional
* Mapping:

  * decision docs
  * task rules
  * meeting notes
  * product specs
  * engineering conventions

**Akzeptanzkriterien:**

* `official-notion` driver with hermetic fixture.
* Notion database row maps to memory event.
* Properties map into scope/tags.
* Notion appears in maturity matrix.

---

### WP 1.4 — Linear Connector Driver

**Ziel:**
Linear ist für moderne Dev-Teams wichtig und leichter als Jira.

**Scope:**

* issues
* comments
* labels
* projects
* cycles
* status changes

**Akzeptanzkriterien:**

* `official-linear` vendor driver.
* Linear review/correction comments become Engineering Memory.
* Live-smoke support via `MEMORY_LINEAR_*`.

---

### WP 1.5 — GitLab / Azure DevOps Backlog

**Ziel:**
Enterprise-Code-Connectoren einplanen.

**Scope:**

* GitLab Issues/MRs/Pipelines
* Azure Boards/Repos/Pipelines

**Akzeptanzkriterien:**

* Manifests + TODO driver contracts.
* Maturity status `planned`.
* Not marketed as certified until driver exists.

---

## EPIC 2 — Real One-Command Guided CLI

### WP 2.1 — Interactive Setup Wizard

**Ziel:**
Aus `setup --self-hosted` wird ein geführter Setup-Flow.

**Command:**

```bash
npx cognibrain setup
```

**Wizard-Fragen:**

1. Local, Team, Production?
2. Which coding agent/harness?

   * Claude Code
   * Codex
   * Cursor
   * Copilot
   * VS Code
   * LangGraph
   * CrewAI
3. Storage?

   * JSON dev
   * SQLite local
   * Postgres team
4. Enable auth?
5. Install connectors?

   * GitHub
   * Slack
   * Discord
   * Jira
   * Confluence
   * Notion
6. Run CogniCodeBench demo?
7. Open dashboard?

**Akzeptanzkriterien:**

* `npx cognibrain setup` starts interactive wizard.
* `--yes`, `--profile local`, `--profile team`, `--profile production` for CI.
* Wizard writes `.cognibrain/setup-state.json`.
* User gets next-step commands.

---

### WP 2.2 — Guided Connector Setup

**Ziel:**
Connector Setup darf nicht aus ENV-Doku bestehen.

**Command:**

```bash
npx cognibrain connector add jira
npx cognibrain connector add notion
npx cognibrain connector add confluence
```

**Flow:**

* ask base URL
* ask auth method
* validate token
* select project/space/database/channel
* dry-run poll
* show sample memory events
* confirm storage policy

**Akzeptanzkriterien:**

* Connector validates credentials.
* Shows preview before writing memory.
* Writes config securely.
* Runs connector health.

---

### WP 2.3 — `doctor --fix`

**Ziel:**
CLI soll nicht nur Fehler zeigen, sondern beheben.

**Checks:**

* Node version
* missing config
* missing API key
* storage not initialized
* dashboard not running
* MCP config missing
* connector credentials invalid
* benchmark artifacts stale

**Akzeptanzkriterien:**

* `cognibrain doctor --fix` resolves simple issues.
* Dangerous fixes ask confirmation.
* Output is human-friendly.

---

### WP 2.4 — Beautiful CLI Output

**Ziel:**
“Cool CLI” mit klaren Flows.

**Features:**

* progress steps
* grouped output
* colored statuses
* “copy this into Claude/Codex”
* QR/local dashboard URL optional
* final summary:

  * installed harnesses
  * enabled connectors
  * storage backend
  * auth status
  * next benchmark command

**Akzeptanzkriterien:**

* CLI feels like a product, not script logs.
* Works in non-TTY CI mode.
* Screenshots/docs updated.

---

## EPIC 3 — Benchmark Arena: Same Runner, Same Scenarios

### WP 3.1 — Benchmark Arena Architecture

**Ziel:**
Alle Competitor-Systeme sollen denselben Benchmark auf denselben Szenarien laufen.

**Command:**

```bash
npm run benchmark:arena -- --systems cognibrain,mem0,graphiti,cognee,langmem --benchmark cognicode
```

**System Adapter Types:**

* `native`: cognibrain
* `oss-docker`: open-source competitor in Docker
* `sdk-api`: competitor via official SDK/API
* `blackbox`: user-provided endpoint
* `artifact-only`: imported published artifact

**Akzeptanzkriterien:**

* Common input schema.
* Common output schema.
* Same scenario set.
* Same top-K/token budget where applicable.
* Same answerer/judge where applicable.
* Report distinguishes real run vs imported artifact.

---

### WP 3.2 — Competitor Adapter Contract

**Ziel:**
Jedes System muss denselben Vertrag erfüllen.

**Adapter Interface:**

```ts
interface MemorySystemAdapter {
  setup(): Promise<void>;
  ingest(event: BenchmarkEvent): Promise<void>;
  retrieve(query: BenchmarkQuery): Promise<RetrievedContext>;
  recordOutcome?(outcome: ToolOutcome): Promise<void>;
  exportEvidence?(): Promise<unknown>;
  teardown(): Promise<void>;
}
```

**Akzeptanzkriterien:**

* Adapter output normalisiert auf:

  * retrieved memories
  * context text
  * evidence links if available
  * token count
  * latency
  * errors
* Missing capabilities are explicit, not silently ignored.

---

### WP 3.3 — Mem0 Adapter

**Ziel:**
Mem0 auf CogniCodeBench ausführen.

**Modes:**

* OSS/self-host if possible
* Cloud API if API key provided
* artifact-only fallback

**Akzeptanzkriterien:**

* `MEM0_API_KEY` mode optional.
* Same scenario ingest.
* Same retrieval query.
* Same metrics.
* If feature unsupported, report `unsupported`.

---

### WP 3.4 — Graphiti/Zep Adapter

**Ziel:**
Temporal graph competitor ausführen.

**Mode:**

* Graphiti OSS local if possible
* API mode if provided
* artifact-only fallback

**Akzeptanzkriterien:**

* Temporal scenarios supported.
* Graph retrieval logged.
* Unsupported patch/action loop marked clearly.

---

### WP 3.5 — Cognee Adapter

**Ziel:**
Graph/vector memory competitor ausführen.

**Akzeptanzkriterien:**

* Ingest docs/events.
* Retrieve for next-change.
* Compare correction carryover.
* Record latency/tokens.

---

### WP 3.6 — LangMem/LangGraph Adapter

**Ziel:**
LangChain ecosystem competitor baseline.

**Akzeptanzkriterien:**

* Store semantic/procedural memory.
* Run same retrieve calls.
* Evaluate same scenario results.

---

### WP 3.7 — GBrain Adapter

**Ziel:**
GBrain kann als personal-brain competitor getestet werden, soweit möglich.

**Akzeptanzkriterien:**

* Markdown/page import mode.
* Search/query mode.
* If no action loop support, mark partial.
* Fair note: personal brain vs engineering memory.

---

### WP 3.8 — Arena Report UI

**Ziel:**
Textvergleich durch harte Tabellen ersetzen.

**Report Sections:**

* Systems run
* Systems skipped
* Proof level:

  * same-run
  * same-run-partial
  * vendor-api
  * artifact-import
  * public-claim-only
* Metrics:

  * correction carryover
  * repeated mistake rate
  * procedure recall
  * patch correctness
  * evidence completeness
  * wrong memory suppression
  * token budget
  * latency
* Capability gaps:

  * no action memory
  * no evidence export
  * no policy
  * no temporal scope

**Akzeptanzkriterien:**

* JSON artifact.
* HTML/Markdown report.
* Dashboard renders arena chart.
* README can embed latest same-run table.

---

## EPIC 4 — Public Benchmark Page: Aggressive but True

### WP 4.1 — “We run the same benchmark” Page

**File:**

```text
docs/market/same-benchmark.md
```

**Hero copy:**

```text
Memory comparisons are full of slogans. We run the same coding-agent scenarios.
```

**Sections:**

* Why generic memory benchmarks are not enough.
* What CogniCodeBench tests.
* How we run competitors.
* Proof levels.
* Latest results.
* Reproduce locally.

**Akzeptanzkriterien:**

* Page uses aggressive but bounded language.
* Every result links to artifact.
* If competitor was not same-run, clearly marked.

---

### WP 4.2 — Public Results Table

**Format:**

| System | Proof level | Correction carryover | Repeated mistakes | Evidence | Procedures | Latency | Notes |
| ------ | ----------- | -------------------: | ----------------: | -------: | ---------: | ------: | ----- |

**Akzeptanzkriterien:**

* No text-only comparison as primary.
* Table generated from artifact.
* Competitor limitations are factual.

---

### WP 4.3 — Benchmark Repro Command

**Command:**

```bash
npx cognibrain benchmark arena --systems cognibrain,mem0,graphiti,cognee --count 100
```

**Akzeptanzkriterien:**

* One copy-paste command for local arena.
* Missing credentials produce graceful skipped rows.
* Artifact saved to `artifacts/arena`.

---

## EPIC 5 — Broader Benchmark Landscape Page

### WP 5.1 — Benchmark Landscape Index

**Ziel:**
Open Benchmarks plus eigene Benchmarks sauber erklären.

**Benchmarks:**

* LoCoMo
* LongMemEval
* BEAM
* CogniCodeBench
* SocialMemBench
* HotpotQA-style multi-hop if relevant
* internal nextgen/USP suites

**Each benchmark explains:**

* what it measures
* what it does not measure
* relevance to engineering memory
* cognibrain command
* competitor comparability

**Akzeptanzkriterien:**

* `docs/benchmarks/landscape.md`.
* Avoids cherry-picking.
* Explains why CogniCodeBench exists.

---

### WP 5.2 — Benchmark Proof Levels

**Proof levels:**

1. `local-baseline`
2. `public-claim`
3. `artifact-import`
4. `same-run-partial`
5. `same-run-full`
6. `vendor-signed`
7. `real-customer-field`

**Akzeptanzkriterien:**

* Used in all benchmark pages.
* Used in claims.
* Used in dashboard.

---

## EPIC 6 — Connector Expansion Prioritization

### WP 6.1 — Connector Roadmap Matrix

**Columns:**

* Manifest
* Driver
* Hermetic fixture
* Live-smoke
* OAuth wizard
* Poll
* Webhook
* Writeback
* Evidence mapping
* Status

**Rows:**

* GitHub
* Slack
* Discord
* Jira
* Confluence
* Notion
* Linear
* GitLab
* Azure DevOps
* Gmail
* Google Drive
* Google Calendar
* Microsoft Teams

**Akzeptanzkriterien:**

* Matrix is generated/verified.
* README links to it.
* Marketing uses only mature statuses.

---

### WP 6.2 — Jira + Confluence First

**Warum zuerst:**
Jira/Confluence sind der stärkste Enterprise Engineering Knowledge Loop.

**Deliverables:**

* Jira driver
* Confluence driver
* Atlassian OAuth/API token support
* Hermetic fixtures
* Live-smoke command
* Docs
* Demo scenario:

  * Jira ticket correction
  * Confluence architecture decision
  * next code change uses both

---

### WP 6.3 — Notion + Linear Second

**Warum:**
Modern startups and product teams.

**Deliverables:**

* Notion driver
* Linear driver
* database/issue mapping
* decision extraction
* docs/demo

---

## EPIC 7 — Installation Wow Effect

### WP 7.1 — `cognibrain init` Product Wizard

**Command:**

```bash
npx cognibrain init
```

**Experience:**

```text
Welcome to cognibrain.
What do you want to remember?

[1] Coding agent corrections
[2] Repo rules and tool commands
[3] Team docs and tickets
[4] Everything, guide me
```

**Akzeptanzkriterien:**

* Fully guided setup.
* Works for first-time users.
* Outputs exact next actions.
* Can launch dashboard.

---

### WP 7.2 — Setup Profiles

**Profiles:**

```bash
npx cognibrain init --profile solo-dev
npx cognibrain init --profile team
npx cognibrain init --profile enterprise
npx cognibrain init --profile benchmark
```

**Akzeptanzkriterien:**

* solo-dev: local SQLite + Claude/Codex
* team: Postgres + GitHub/Jira
* enterprise: auth + policy + docs
* benchmark: CogniCodeBench + arena

---

### WP 7.3 — “First Win” Flow

**Goal:**
User sees value in 5 minutes.

**Flow:**

1. Install.
2. Choose harness.
3. Add a repo rule.
4. Simulate correction.
5. Run next-change demo.
6. See EvidencePack.

**Akzeptanzkriterien:**

* Demo passes without external credentials.
* Uses synthetic repo.
* Shows repeated mistake avoided.

---

## EPIC 8 — Aggressive but True Marketing Copy

### WP 8.1 — Replace soft comparison copy

Current compare pages are too cautious. Keep boundaries, but sharpen language.

**Example new copy for Mem0:**

```text
Mem0 is great when you need general user memory quickly.
cognibrain is built for a harder question: did the coding agent apply the previous correction on the next patch?
```

**Example new copy for GBrain:**

```text
GBrain gives an operator a personal markdown brain.
cognibrain gives coding agents a shared, evidence-checked engineering memory loop.
```

**Akzeptanzkriterien:**

* More assertive tone.
* Still factual.
* Every aggressive claim has proof link.

---

### WP 8.2 — “No Slogan Benchmarks” Campaign

**Taglines:**

* “Don’t compare memory slogans. Compare next-change correctness.”
* “Recall is cheap. Correct future action is the benchmark.”
* “A memory system that can’t prevent repeated mistakes is just searchable history.”
* “If it learned, the next patch should prove it.”

**Akzeptanzkriterien:**

* New market page.
* README section.
* Social snippets.
* Claim IDs linked.

---

# Priorisierte Roadmap

## P0 — Benchmark Arena and Aggressive Proof

1. Benchmark Arena architecture
2. Competitor adapter contract
3. Mem0 adapter
4. Graphiti/Zep adapter
5. Cognee/LangMem adapters
6. Arena report UI
7. Same-benchmark market page

**Warum:**
Das ersetzt schwache Textvergleiche durch harte, reproduzierbare Ergebnisse.

---

## P1 — Connector Expansion

1. Connector roadmap matrix
2. Jira driver
3. Confluence driver
4. Notion driver
5. Linear driver
6. Live-smoke and docs

**Warum:**
Engineering Memory braucht Ticket-, Docs- und Knowledge-Base-Systeme.

---

## P2 — Guided Install / Wow CLI

1. `npx cognibrain init`
2. interactive wizard
3. setup profiles
4. connector wizard
5. `doctor --fix`
6. first-win demo

**Warum:**
Wenn die Installation nicht “wow” ist, verlieren wir trotz guter Technik.

---

## P3 — Marketing/Doku Aggressiver + True

1. Market pages rewrite
2. same benchmark page
3. no slogan benchmarks campaign
4. benchmark landscape page
5. public results table
6. launch copy

**Warum:**
Der Markt braucht eine einfache Story.

---

# Konkrete GitHub Issues, die ich anlegen würde

Da das Tool hier weiterhin keine Issue-Erstellung anbietet, hier die Issue-Titel direkt:

1. `Benchmark Arena: run CogniCodeBench against competitors with same-run adapters`
2. `Competitor adapter contract for Mem0, Graphiti/Zep, Cognee, LangMem and GBrain`
3. `Public same-benchmark results page with proof levels and generated tables`
4. `Add first-class Jira connector driver with hermetic and live smoke verification`
5. `Add first-class Confluence connector driver for architecture decisions and runbooks`
6. `Add first-class Notion connector driver for docs, decisions and product specs`
7. `Add first-class Linear connector driver for issue/review memory`
8. `Build interactive npx cognibrain init wizard with Q&A guided setup`
9. `Add setup profiles: solo-dev, team, enterprise, benchmark`
10. `Add connector setup wizard for GitHub/Jira/Confluence/Notion/Linear`
11. `Add doctor --fix with guided remediation`
12. `Rewrite market comparison pages with aggressive but proof-bound positioning`
13. `Add benchmark landscape page covering LoCoMo, LongMemEval, BEAM, CogniCodeBench and proof levels`
14. `Add generated connector maturity matrix`
15. `Create first-win demo: correction -> memory -> next patch -> evidence pack`

---

# Endfazit

Der aktuelle Stand ist viel besser als vorher: README, Claims, Status Matrix, CogniCodeBench, Connector-Surface und Production-Readiness-Doku sind schon stark. Aber jetzt kommt der nächste Reifegrad.

Die größten offenen Produkt-Gaps sind:

1. **Jira/Confluence/Notion/Linear als echte Connectors**
2. **interaktive “wow” Installation**
3. **Benchmark Arena für Same-with-Same Competitor-Vergleich**
4. **aggressivere Marktseiten mit harten Tabellen statt Textvergleich**
5. **Proof-Level-System überall sichtbar**

Die neue Marktposition sollte lauten:

> **cognibrain does not ask whether an agent can remember. It tests whether the next patch is better.**

Oder noch direkter:

> **Recall is not enough. The next code change has to prove the memory worked.**


BTW für das CLI da gibts doch so ein react framework, das interaktive CLIs ermöglicht, oder? Das könnte die “wow” Experience deutlich verbessern. Und für die Benchmark Arena ist es wirklich wichtig, dass die Adapter nicht nur “irgendwie” laufen, sondern wirklich vergleichbare Bedingungen schaffen. Das wird ein echter Differenzierungsfaktor, wenn ihr das sauber hinbekommt.