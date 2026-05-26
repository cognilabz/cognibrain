# Aktueller Code-Check: Fokus externe Connectoren + echtes TUI

Ich habe den aktuellen Stand erneut geprüft, diesmal gezielt auf zwei Dinge:

1. **Echte Connectoren/Adapter zu externen Systemen**, nicht nur Manifest/Shell.
2. **TUI/CLI als vollwertige Operator-Oberfläche**, also wirklich alles per Terminal bedienen können: Analyse, Config, Start/Stop, Memory-Management, Connector-Setup, Benchmarks, Service, Proof, etc.

## Executive Summary

Der Stand ist deutlich weiter als in den letzten Analysen. **Es gibt inzwischen nicht nur Connector-Manifeste, sondern tatsächlichen Code für externe Vendor-Provider**. In `src/connectors/vendorConnectors.ts` sind echte Provider-Typen für GitHub, Slack, Discord, Jira, Confluence, Notion, Linear, GitLab, Azure DevOps, Teams, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty und PostHog definiert. Die Datei enthält `listExternalVendorItems`, `pollExternalVendorConnector` und `writebackExternalVendorConnector`, die je nach Provider auf echte `list*`, `poll*`, `write*` Funktionen dispatchen. Das ist mehr als nur Shell/Manifest. 

Auch im CLI-Binary sind Connector-Definitionen für viele dieser Systeme vorhanden, inklusive Required Env Vars, Setup-Felder, Status, Sample Events und Verification Commands. Jira, Confluence, Notion, Linear, GitLab, Azure DevOps, Teams, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty und PostHog sind dort als `vendor-driver` geführt.

**Aber:** Die Connector-Doku und Status-Matrix wirken noch nicht vollständig synchron mit dem Code. Die Doku beschreibt GitHub, Slack und Discord als “first-class external connectors” und die sichtbare Connector-Maturity-Matrix führt vor allem diese drei als reale Vendor-Smoke-Connectoren. 
Das heißt: **Der Code ist weiter als die Produkt-/Status-Kommunikation**, aber es ist noch unklar, ob alle neuen Vendor-Driver dieselbe Test-, Live-Smoke-, UI- und Dokumentationsreife haben wie GitHub/Slack/Discord.

Beim TUI ist es ähnlich: Es gibt inzwischen eine CLI-Home-App, ein `init`-Wizard, Profile, Connector-Setup-Fragen, `doctor --fix`, Service-/Connection-/Memory-/Proof-Oberflächen und ein Ink-basiertes `inkApp.mjs`. Das ist stark.
Aber: **Das TUI ist noch eher ein Workbench-/Dashboard-Viewer mit Command Palette, nicht vollständig ein interaktives Operator-OS.** Das Ink-App-Handling unterstützt Navigation (`up/down`, `1-9`, `q`, `r`) und eine Action Palette, aber in dem sichtbaren Code sehe ich keinen echten “Enter executes selected action”-Flow. 
Außerdem importiert `inkApp.mjs` dynamisch `ink`, aber `package.json` listet `ink` nicht als dependency. Dadurch kann die Ink-Oberfläche bei normaler Package-Installation fehlschlagen und in den Fallback gehen, sofern Ink nicht anderweitig vorhanden ist.

**Neue Zielrichtung:**
Nicht nur “mehr Connectoren” und “mehr CLI-Kommandos”. Das Ziel sollte sein:

> **cognibrain wird ein echtes Terminal-first Memory Operating System.**
> Alles, was im Dashboard möglich ist, muss im TUI möglich sein. Alles, was als Connector claimbar ist, muss echten list/poll/writeback/live-smoke/status/provenance support haben.

---

# 1. Aktueller Connector-Stand

## 1.1 Was bereits wirklich im Code existiert

In `src/connectors/vendorConnectors.ts` existiert ein `ExternalVendorProvider` Type mit folgenden Providern:

* `github`
* `slack`
* `discord`
* `jira`
* `confluence`
* `notion`
* `linear`
* `gitlab`
* `azure-devops`
* `teams`
* `gmail`
* `google-drive`
* `google-calendar`
* `asana`
* `clickup`
* `sentry`
* `datadog`
* `pagerduty`
* `posthog`

Die Datei mapped `official-*` Connector IDs auf diese Provider, z. B. `official-jira` → `jira`, `official-confluence` → `confluence`, `official-notion` → `notion`, `official-linear` → `linear`, `official-gitlab` → `gitlab`, `official-azure-devops` → `azure-devops`, etc. 

Die Kernfunktionen:

* `externalVendorConfigured(provider)`
* `listExternalVendorItems(manifest)`
* `pollExternalVendorConnector(manifest)`
* `writebackExternalVendorConnector(manifest, record, ...)`

dispatchen auf echte Provider-Funktionen wie `listJira`, `pollJira`, `writeJira`, `listConfluence`, `pollConfluence`, `writeConfluence`, `listNotion`, `pollNotion`, `writeNotion`, `listLinear`, `pollLinear`, `writeLinear`, `listGitLab`, `writeGitLab`, `listAzureDevOps`, `writeAzureDevOps` usw.

Das ist der wichtigste Befund: **Die Architektur für echte externe Connectoren existiert im Code.** Es ist nicht nur eine Shell.

## 1.2 Jira ist tatsächlich als echter Adapter erkennbar

Für Jira gibt es echte Atlassian Basic Auth Headers, Required Env Vars, List/Poll/Writeback:

* `MEMORY_JIRA_BASE_URL`
* `MEMORY_JIRA_EMAIL`
* `MEMORY_JIRA_API_TOKEN`
* `MEMORY_JIRA_PROJECT`

`listJira` ruft `/rest/api/3/search` mit JQL auf. `pollJira` mapped die Issues zu Events. `writeJira` schreibt einen Kommentar über `/rest/api/3/issue/{issueKey}/comment` mit ADF body.

Das ist ein echter Connector-Driver, nicht nur Manifest.

## 1.3 Confluence ist tatsächlich als echter Adapter erkennbar

Confluence nutzt Atlassian Headers, Required Env Vars und ruft `/wiki/rest/api/content` mit Space Key, Version, Labels und Body Storage Expansion ab. Writeback geht auf `/wiki/rest/api/content/{pageId}/child/comment`. 

Auch das ist echter Vendor-Code.

## 1.4 Notion ist tatsächlich als echter Adapter erkennbar

Notion verwendet `MEMORY_NOTION_TOKEN` und `MEMORY_NOTION_DATABASE_ID`, ruft `/v1/databases/{databaseId}/query` auf und kann über `/v1/blocks/{blockId}/children` einen Absatz anhängen. 

Auch das ist echter Vendor-Code.

## 1.5 Linear, GitLab, Azure DevOps sind ebenfalls sichtbar implementiert

Linear nutzt GraphQL für Issues und `commentCreate` für Writeback. GitLab nutzt Merge Requests und Notes. Azure DevOps nutzt Pull Requests und Threads. 

## 1.6 Connector SDK ist vorhanden

`src/connectors/sdk.ts` definiert eine generische Connector SDK-Schicht mit `ConnectorAdapter`, `PlatformIntegration`, `createPlatformIntegration`, `normalizeConnectorEvent`, `runConnectorPoll`, `createWritebackPlan`, Mapping von Platform Records zu Connector Events, Auth Headers, etc. Das ist wichtig, weil neue Connectoren nicht ad hoc gebaut werden müssen. 

## 1.7 Service-Layer nutzt Vendor Connectors

`src/api/service.ts` importiert `externalVendorConfigured`, `externalVendorProvider`, `listExternalVendorItems`, `pollExternalVendorConnector`, `shouldUseExternalVendor`, `writebackExternalVendorConnector` aus `../connectors/vendorConnectors`. Das heißt, die Vendor Connector-Schicht ist nicht nur isolierter Code, sondern in den Service integriert. 

---

# 2. Connector-Gaps

## Gap 1 — Status-Matrix und Connector-Doku sind nicht mehr scharf genug

Die Connector-Doku listet zwar viele offizielle Manifeste und erwähnt Jira, Linear, Notion, Google Drive, Gmail, etc. Aber der Abschnitt “External Vendor Connectors” stellt nur GitHub, Slack und Discord als first-class external connectors heraus. Die Connector Maturity Matrix in der sichtbaren Doku führt ebenfalls hauptsächlich Harnesses plus GitHub/Slack/Discord als Vendor-Zeilen. 

Gleichzeitig ist im Code sichtbar, dass inzwischen viel mehr Provider reale `list/poll/writeback` Implementierungen haben.

**Problem:** Der Code ist weiter als die Doku. Das erzeugt Unsicherheit.

**Ziel:** Eine generierte Connector-Maturity-Matrix muss pro Connector zeigen:

* Manifest vorhanden
* CLI setup vorhanden
* Required Env Vars
* list implemented
* poll implemented
* writeback implemented
* hermetic fixture test
* live smoke test
* docs
* dashboard/TUI setup
* production-certified status

## Gap 2 — “Vendor Driver” reicht nicht: wir brauchen Live-Smoke-Reife pro System

Ein echter Connector ist erst “real” im Produkt, wenn er folgende Gates hat:

1. Driver-Code
2. Hermetic fixture tests
3. Credential validation
4. Dry-run poll
5. Dry-run writeback
6. Live smoke with tenant credentials
7. SourceRef provenance
8. Delete/update revalidation
9. Rate limit handling
10. Docs and TUI flow

Für GitHub/Slack/Discord ist das laut Doku weiter. Für Jira/Confluence/Notion/Linear/etc. muss die Reife explizit belegt werden.

## Gap 3 — Connectoren brauchen nicht nur list/poll/writeback, sondern semantische Mappings

Für den Memory-Usecase sind Rohdaten nicht genug.

Jira sollte nicht nur Issues importieren, sondern klassifizieren:

* Review Correction
* Engineering Decision
* Acceptance Criteria
* Blocker
* Test Strategy
* Incident Follow-up
* Migration Note

Confluence sollte nicht nur Pages importieren, sondern erkennen:

* ADR
* Runbook
* Service Ownership
* Deployment Procedure
* Known Pitfall
* Security Constraint

Notion sollte unterscheiden:

* Product Spec
* Meeting Decision
* Engineering Convention
* Task Rule
* Roadmap Decision

Linear/GitLab/Azure sollten Reviews, CI failures, MR comments, labels und status transitions als Engineering Memory mappen.

## Gap 4 — Connector Auth ist aktuell env-orientiert, nicht “Operator-grade”

Der CLI-Flow fragt zwar Connector-Felder ab, aber primär als Env-/Config-Werte. Für echte Nutzerfreundlichkeit braucht es:

* Guided OAuth where possible
* API-token validation
* “test credentials now”
* “show sample events”
* “choose project/space/database”
* “dry-run before storing”
* “select retention policy”
* “select visibility”
* “enable writeback?”

---

# 3. Aktueller TUI/CLI-Stand

## 3.1 Es gibt bereits einen CLI-Home-Modus und interaktive Ansätze

`bin/cognibrain.mjs` hat Commands wie:

* `ui`
* `home`
* `init`
* `setup`
* `doctor`
* `start`
* `dashboard`
* `status`
* `proof`
* `service`
* `connector`
* `connections`
* `adapter`
* `sdk`
* `memory`
* `memories`
* `mcp`

Das ist bereits eine sehr breite CLI-Oberfläche. 

## 3.2 `init` ist bereits ein Wizard

Der `init` Flow kann interaktiv fragen:

* Profile: solo-dev, team, enterprise, benchmark
* Goal
* Primary agent
* Harnesses
* Storage
* Auth
* Connectors
* Adapters
* Run first-win demo?

Das ist sehr gut und entspricht bereits teilweise deiner Idee eines Q&A-Flows. 

## 3.3 Connector-Setup hat interaktive Fragen

`connector add` kann interaktiv Provider auswählen und pro Connector Fields abfragen. `promptConnectorSettings` nutzt die Felder aus `connectorDefinitions()`.

## 3.4 Es gibt ein Ink-basiertes TUI-Konzept

`src/cli/inkApp.mjs` definiert eine TUI-artige App mit Header, Sidebar, MainPanel, MetricTiles, Sections, Footer, Views und Action Palette. Es gibt Workbenches wie Home, Memories, Connections, Reports, etc. Die UI zeigt Runtime-Status, Connector-Status, Adapter-Status, Proof-Status und Commands. 

## 3.5 TUI-Gap: noch kein echtes “alles bedienbar” Operator-TUI

Das TUI ist aktuell eher “read-only workbench + command hints”. Sichtbar implementiert sind Tastaturaktionen:

* `q` quit
* `r` refresh/exit
* up/down / j/k navigation
* left/right/tab action selection
* number keys for view selection

Aber im sichtbaren Ausschnitt gibt es keinen echten “Enter executes selected action” oder Formular-/Dialog-System für das Ausführen von Add/Edit/Delete/Run/Start/Stop/Config. 

Außerdem importiert `inkApp.mjs` dynamisch `ink`, aber `package.json` listet `ink` nicht als dependency. Das heißt: In einer normalen Installation kann die Ink-TUI nicht zuverlässig funktionieren, außer Ink ist anderweitig installiert. Der `cliHome` Flow fängt Fehler ab und fällt auf `renderCliSurface` zurück, was gut ist, aber nicht “wirklich großartige TUI”.

---

# 4. Zielbild: Connectoren + TUI als Produktkern

## Connector-Zielbild

Ein Connector ist erst dann “real”, wenn er diese Lifecycle-Stufen hat:

1. **Discover**: Connector erscheint im TUI-Katalog.
2. **Configure**: TUI fragt Credentials und Scope ab.
3. **Validate**: Credentials werden live geprüft.
4. **Preview**: sample data wird gezeigt.
5. **Map**: Benutzer sieht, welche Events zu welchen Memory Types werden.
6. **Policy**: Sichtbarkeit/Retention wird gewählt.
7. **Dry-run**: Poll und Writeback ohne Persistenz.
8. **Enable**: Connector wird aktiviert.
9. **Sync**: Connector läuft.
10. **Review**: Memory Candidates können akzeptiert/abgelehnt werden.
11. **Writeback**: optional zurück ins System.
12. **Monitor**: Lag, Errors, Rate Limits, Last Sync.
13. **Revoke**: Token/Connector sauber entfernen.

## TUI-Zielbild

Das TUI soll das Dashboard nicht nur spiegeln, sondern für Devs die **primäre Operator-Oberfläche** werden.

Alles muss im TUI möglich sein:

* Setup / Init
* Config ansehen/ändern
* Start/Stop/Restart
* Service installieren/deinstallieren
* Dashboard öffnen
* Memory search/list/inspect/add/edit/delete/archive/pin
* Evidence Pack anzeigen
* Context Pack bauen
* Graph Path anzeigen
* Dream/Reflect laufen lassen
* Benchmark starten
* Benchmark Result anzeigen
* Connector hinzufügen/prüfen/syncen
* Connector Events previewen
* Credentials testen
* Policies setzen
* Retention Review
* Export/Import/Backup
* Logs/Metrics ansehen
* Doctor/Fix ausführen
* SDK/OpenAPI anzeigen
* MCP Tools testen

Das ist der “wow effect”: ein lokales Terminal-OS für Agent Memory.

---

# 5. Neuer Workpackage-Plan

## EPIC 1 — Connector Reality & Maturity

### WP 1.1 — Generated Connector Maturity Matrix

**Ziel:**
Die Doku muss automatisch zeigen, welche Connectoren wirklich welchen Reifegrad haben.

**Umsetzung:**

* Script `npm run connectors:maturity` erzeugt `artifacts/connector-maturity.json`.
* Matrix generiert Markdown in `docs/connectors/maturity.md`.
* Pro Provider:

  * manifest
  * CLI definition
  * vendor provider mapping
  * required env
  * list implementation
  * poll implementation
  * writeback implementation
  * hermetic fixture test
  * live smoke support
  * docs
  * TUI setup
  * production status

**Akzeptanzkriterien:**

* Matrix enthält alle Provider aus `ExternalVendorProvider`.
* README/Connector-Doku nutzt diese Matrix.
* Kein Connector darf als “first-class” marketed werden, wenn Matrix nicht passt.

---

### WP 1.2 — Connector Proof Levels

**Ziel:**
Einheitliche Reifestufen für Connectoren.

**Stufen:**

1. `manifest-only`
2. `cli-config`
3. `driver-code`
4. `hermetic-tested`
5. `live-smoke-ready`
6. `tenant-verified`
7. `production-certified`

**Akzeptanzkriterien:**

* Jede Connector-Seite zeigt Proof Level.
* `doctor --publish` warnt bei Connectoren unter definiertem Level.
* Marketing nutzt nur `tenant-verified` oder `production-certified` für starke Claims.

---

### WP 1.3 — Jira Connector Hardening

**Ist-Stand:**
Code für Jira list/poll/writeback existiert. 

**Ziel:**
Jira als wirklich produktionsfähiger Engineering Memory Connector.

**Work items:**

* Hermetic Jira fixture erweitern:

  * issues
  * comments
  * status transitions
  * labels/components
  * linked issues
  * epics
* Mapping:

  * issue description → task context
  * comments → review_correction / decision
  * status changes → temporal project state
  * labels/components → scope/tags
* Writeback:

  * comment
  * memory summary
  * link to EvidencePack
* TUI:

  * select Jira site
  * select project
  * dry-run preview
  * choose memory mapping
  * choose retention/visibility

**Akzeptanzkriterien:**

* `npm run verify:vendor-connectors -- --provider jira` passes.
* `npm run verify:vendor-live -- --provider jira` supports real tenant smoke.
* TUI can configure Jira end-to-end.
* Jira docs include screenshots/terminal flow.
* Jira row reaches at least `live-smoke-ready`.

---

### WP 1.4 — Confluence Connector Hardening

**Ist-Stand:**
Code for list/poll/writeback exists. 

**Ziel:**
Confluence als Knowledge Base Connector für ADRs, Runbooks, Policies.

**Work items:**

* Fetch spaces/pages/version/body/labels/comments.
* Detect page types:

  * ADR
  * runbook
  * repo policy
  * deployment procedure
  * incident retrospective
* Version updates trigger revalidation of dependent memories.
* Writeback creates page comment with memory link.
* TUI lets user select space and page label filters.

**Akzeptanzkriterien:**

* Confluence pages become structured Engineering Memories.
* Updated/deleted pages move dependent memories to `needs_verification`.
* TUI preview shows sample pages before ingestion.

---

### WP 1.5 — Notion Connector Hardening

**Ist-Stand:**
Code for database query and block writeback exists. 

**Ziel:**
Notion as startup/team knowledge connector.

**Work items:**

* Select workspace/database/page.
* Map database properties to:

  * tags
  * owner
  * status
  * project
  * visibility
* Detect:

  * product spec
  * engineering convention
  * meeting decision
  * task rule
* Writeback:

  * append memory summary block
  * link EvidencePack

**Akzeptanzkriterien:**

* Notion database row maps to MemoryRecord with SourceRef.
* Notion page update triggers revalidation.
* TUI supports credential validation and database selection.

---

### WP 1.6 — Linear / GitLab / Azure DevOps parity

**Ziel:**
Modern dev systems müssen denselben lifecycle haben.

**Scope:**

* Linear issues/comments/projects/cycles
* GitLab merge requests/issues/pipelines
* Azure DevOps PRs/work items/pipelines

**Akzeptanzkriterien:**

* Each has hermetic fixture.
* Each has live-smoke option.
* Each maps review/correction/tool outcome.
* Each has docs/TUI flow.

---

## EPIC 2 — Connector Operator UX in TUI

### WP 2.1 — Connector Catalog TUI

**Ziel:**
`cognibrain connections` wird eine echte Connector-Verwaltung.

**Views:**

* All connectors
* Installed
* Not configured
* Needs credentials
* Error
* Live-smoke ready
* Production certified

**Actions:**

* Add
* Configure
* Test
* Preview
* Poll
* Sync
* Writeback dry-run
* Enable/disable
* Remove
* View logs
* View source events

**Akzeptanzkriterien:**

* Alles ohne Web-Dashboard möglich.
* TUI zeigt Proof Level.
* TUI zeigt Missing Env Vars und Fix-Hinweise.

---

### WP 2.2 — Connector Setup Wizard in TUI

**Ziel:**
Jira/Confluence/Notion/etc. nicht über ENV-Doku konfigurieren müssen.

**Flow:**

1. Choose connector.
2. Enter base URL/token/email/project.
3. Validate credentials.
4. Select resources.
5. Preview first 5 events.
6. Select mapping.
7. Select policy/retention.
8. Enable connector.
9. Run first poll.
10. Show generated memories.

**Akzeptanzkriterien:**

* Works for Jira, Confluence, Notion, GitHub first.
* No memory is stored before preview/confirm.
* Secrets are not printed.
* Config is persisted with token refs, not raw tokens where possible.

---

### WP 2.3 — Connector Event Review Queue

**Ziel:**
Externes Systemwissen darf nicht blind in Memory.

**TUI should allow:**

* view candidates
* approve
* reject
* edit before store
* assign type
* assign scope
* mark sensitive
* set retention
* create procedure/policy/correction

**Akzeptanzkriterien:**

* Slack/Discord/Jira/Notion candidates can be reviewed in TUI.
* Actions update MemoryService.
* EvidencePack shows review decision.

---

## EPIC 3 — Real TUI / Terminal Memory OS

### WP 3.1 — Make Ink/TUI a real dependency and stable entrypoint

**Problem:**
`src/cli/inkApp.mjs` imports `ink`, but `package.json` does not list `ink`.

**Ziel:**
TUI must work reliably after install.

**Work items:**

* Add `ink` dependency.
* Add any needed terminal deps.
* Add `cognibrain tui` explicit command.
* Keep `cognibrain` default to TUI when interactive.
* Keep `--json`, `--no-interactive`, CI-safe output.

**Akzeptanzkriterien:**

* Fresh `npm install` supports TUI.
* `npx cognibrain` opens TUI.
* CI mode never hangs.
* Tests cover non-interactive fallback.

---

### WP 3.2 — Action Execution in TUI

**Problem:**
Current Ink app has Action Palette and selection, but visible code shows no real Enter-to-execute action. 

**Ziel:**
Action Palette must execute commands, not just show them.

**Work items:**

* Enter executes selected action.
* Confirmation for destructive actions.
* Command output panel.
* Background jobs.
* Error display.
* Command history.
* Copy command shortcut.

**Akzeptanzkriterien:**

* User can start/stop service from TUI.
* User can run doctor from TUI.
* User can run benchmark from TUI.
* User can add/search/edit memories from TUI.
* User can configure connector from TUI.

---

### WP 3.3 — Memory Management TUI

**Ziel:**
Alle Memory-Operationen in TUI.

**Functions:**

* list memories
* search
* inspect
* edit content
* edit tags/entities/type/scope
* pin/unpin
* archive/retract/delete
* add memory
* add correction
* approve pattern
* run dream
* evidence pack
* graph path
* procedure recall
* action guard

**Akzeptanzkriterien:**

* TUI can manage memory without raw CLI command typing.
* Edits create audit events.
* Dangerous actions require confirmation.
* Evidence preview is readable.

---

### WP 3.4 — Config & Runtime TUI

**Ziel:**
Operator can configure the system from TUI.

**Functions:**

* choose storage backend
* configure auth mode
* set API key
* start/stop/restart API
* open dashboard
* service install/uninstall
* set runtime root
* configure MCP
* export/import config
* run `doctor --fix`

**Akzeptanzkriterien:**

* TUI can bootstrap local install.
* TUI can switch profile solo/team/enterprise/benchmark.
* TUI writes setup-state/config.

---

### WP 3.5 — Benchmark TUI

**Ziel:**
Benchmarks and competitor arena must be runnable from TUI.

**Functions:**

* run CogniCodeBench
* run benchmark arena
* select systems
* select count/difficulty
* show progress
* show result table
* open artifact
* publish latest report
* compare past runs

**Akzeptanzkriterien:**

* User can run full benchmark without command memorization.
* TUI shows proof levels and skipped systems.
* Artifact paths clickable/copyable.

---

### WP 3.6 — Connector Logs & Observability TUI

**Ziel:**
Connector operation must be transparent.

**Views:**

* last sync
* next sync
* events pulled
* memories written
* writeback queue
* errors
* rate limits
* credential status
* live smoke status

**Akzeptanzkriterien:**

* Operator can troubleshoot connector from terminal.
* TUI suggests fix commands.
* Logs can be exported.

---

## EPIC 4 — Connector Benchmark + Data Quality

### WP 4.1 — Connector Quality Benchmark

**Ziel:**
Nicht nur “Connector works”, sondern “Connector produces useful memory”.

**Metrics:**

* event extraction correctness
* sourceRef completeness
* memory type classification
* scope correctness
* sensitive-data handling
* duplicate suppression
* update/revalidation correctness
* writeback dry-run correctness

**Akzeptanzkriterien:**

* Each connector has quality score.
* TUI displays connector quality.
* Docs list quality gates.

---

### WP 4.2 — Cross-System Engineering Memory Scenario

**Ziel:**
Wow-Demo: Jira + Confluence + GitHub + Slack/Notion together.

**Scenario:**

1. Confluence has architecture decision.
2. Jira issue requests change.
3. Slack/Notion contains correction/decision.
4. GitHub PR review has feedback.
5. Agent next patch uses all relevant memory.
6. EvidencePack shows sources.

**Akzeptanzkriterien:**

* Synthetic/harnessed demo works without real credentials.
* Live-mode works with credentials.
* TUI can run demo.

---

## EPIC 5 — TUI Design System & Developer Experience

### WP 5.1 — Terminal UI Information Architecture

**Top-level tabs:**

* Home
* Memories
* Search
* Evidence
* Connectors
* Config
* Runtime
* Benchmarks
* Service
* Logs
* Docs/Help

**Akzeptanzkriterien:**

* Consistent keybindings.
* Consistent status colors.
* Help overlay.
* Breadcrumbs/context.

---

### WP 5.2 — Forms and validation framework

**Need:**

* text input
* secret input
* select menu
* multi-select
* confirmation
* validation errors
* preview before apply

**Akzeptanzkriterien:**

* Connector setup uses form framework.
* Memory edit uses form framework.
* Config edit uses form framework.

---

### WP 5.3 — Job runner inside TUI

**Need:**

* background command execution
* progress
* cancel
* logs
* success/fail status
* artifact links

**Akzeptanzkriterien:**

* Benchmarks can run in background.
* Connector sync can run in background.
* Start/stop service displays live status.

---

### WP 5.4 — TUI test suite

**Need:**

* snapshot tests
* keybinding tests
* non-interactive fallback
* no TTY fallback
* command execution mocks

**Akzeptanzkriterien:**

* CI covers TUI.
* TUI dependency included.
* No hang in CI.

---

# 6. Updated Priorities

## P0 — Make current claims accurate

1. Generated Connector Maturity Matrix
2. Reconcile docs with actual vendorConnectors.ts
3. Add proof levels per connector
4. Fix/declare TUI dependency status

## P1 — TUI must become real product interface

1. Add Ink dependency or choose final TUI stack
2. Execute action palette actions
3. Memory management TUI
4. Connector setup wizard
5. Runtime/service TUI
6. Benchmark TUI

## P2 — Harden real external connectors

1. Jira hardening
2. Confluence hardening
3. Notion hardening
4. Linear hardening
5. GitLab/Azure DevOps hardening
6. Gmail/Drive/Calendar hardening

## P3 — Connector quality and proof

1. Hermetic fixture per connector
2. Live smoke per connector
3. Quality score per connector
4. SourceRef/provenance checks
5. TUI connector logs

---

# 7. Concrete Issue Titles

If we create GitHub issues from this, I would create these:

1. `Reconcile connector maturity docs with actual vendorConnectors.ts providers`
2. `Generate connector maturity matrix from code, tests and docs`
3. `Add connector proof levels: manifest-only to production-certified`
4. `Harden Jira connector: fixtures, live smoke, mappings, TUI setup`
5. `Harden Confluence connector: versioned pages, ADR/runbook extraction, revalidation`
6. `Harden Notion connector: database mapping, page blocks, writeback, TUI setup`
7. `Harden Linear connector: issues/comments/projects/cycles and live smoke`
8. `Harden GitLab and Azure DevOps connectors for MR/PR review feedback and CI outcomes`
9. `Make Ink TUI a real dependency and stable entrypoint`
10. `Implement executable TUI action palette`
11. `Build full Memory Management TUI`
12. `Build Connector Setup Wizard in TUI`
13. `Build Runtime/Service/Config TUI`
14. `Build Benchmark Arena TUI`
15. `Add connector event review queue in TUI`
16. `Add connector quality benchmark and score`
17. `Create cross-system Engineering Memory demo: Jira + Confluence + GitHub + Slack/Notion`

---

# 8. My Final Assessment

Your instinct is correct: the next “wow” layer is not another backend feature. It is **real external system connectors + a real terminal product experience**.

The good news: the code is much further than before. There are real provider implementations for many systems, not just shells. The CLI already has an init wizard, connector configuration, profiles, doctor-fix and an Ink-based workbench direction.

The problem: The product needs to catch up to the code and turn this into a polished experience.

The next product goal should be:

> **Everything possible from one terminal UI. Every external connector real, testable, previewable, and auditable.**

That is a strong path to a real platform:

* connectors bring real enterprise data,
* TUI makes it feel like a serious local-first operating system,
* benchmark arena proves the memory works,
* evidence packs make it trustworthy.

If done well, cognibrain becomes not just “a memory engine”, but a **terminal-first Engineering Memory OS** for serious AI coding workflows.
