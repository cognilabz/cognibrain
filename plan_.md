Live-Code-Check: Benchmarks, Harness-Kompatibilität, Connectoren und nächster WP-Plan

Ich habe den aktuellen Code live über das GitHub-Tool geprüft. Zusätzlich habe ich versucht, das Repo lokal zu klonen, um die Benchmarks selbst auszuführen. Der lokale Run ist in dieser Umgebung nicht möglich, weil git clone https://github.com/cognilabz/cognibrain.git mit Could not resolve host: github.com scheitert. Ich kann also den Code, die committeten Benchmark-Artefakte und die Scripts prüfen, aber keinen frischen lokalen Benchmark-Lauf ausführen.

Wichtig: Der aktuelle Stand ist deutlich weiter als in der letzten Analyse. Viele Dinge, die wir vorher als Roadmap/Gaps beschrieben haben, sind inzwischen im Code vorhanden. Trotzdem bleiben genau bei deinen vier Punkten noch klare Gaps.

⸻

1. Executive Summary

Aktueller Stand

cognibrain hat jetzt:

* benchmark:cognicode, benchmark:arena, benchmark:arena:run, benchmark:arena:publish, benchmark:load, benchmark:answer-generation, verify:connectors, verify:vendor-connectors, verify:vendor-api-specs, verify:vendor-live, connectors:maturity, release:check und viele weitere Scripts im package.json.  ￼
* ink ist jetzt wirklich als Dependency vorhanden. Das frühere TUI-Dependency-Gap ist also behoben.  ￼
* Der Benchmark-Stand ist stark, aber noch zu synthetisch/einfach: CogniCodeBench hat aktuell 100 Szenarien und perfekte Scores, aber die Szenarien werden aus wenigen Archetypen per Variantenbildung erzeugt.
* Die Benchmark Arena existiert und kann mehrere Systeme abbilden: cognibrain, mem0, graphiti, zep, cognee, langmem, gbrain. Sie unterscheidet Proof-Level wie same-run-full, same-run-native, same-run-api-shape, artifact-import, credential-blocked usw.  ￼
* Connector-Code ist jetzt wirklich breit: GitHub, Slack, Discord, Jira, Confluence, Notion, Linear, GitLab, Azure DevOps, Teams, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty und PostHog sind im Vendor-Connector-Code als Provider abgebildet.  ￼
* Für Jira, Confluence, Notion, Linear, GitLab und Azure DevOps sind echte list/poll/writeback-Funktionen im Code sichtbar, nicht nur Manifeste.  ￼
* Harness-Setup ist breit: setup, init, cognibrain-connect, Profile, Harness-Targets, Connector-Definitions, Adapter-Definitions, doctor --fix, Service-Kommandos und TUI-Oberflächen sind sichtbar im CLI-Code.

Haupt-Gaps

1. Benchmark ist noch nicht hart genug.
    Aktuell sind es 100 synthetische Szenarien, aber aus wenigen Archetypen generiert. Das ist gut für Proof-of-Concept, aber nicht hart genug für Marktführerschaft.
2. Benchmark Arena ist gut, aber noch nicht konsequent “same-with-same” für alle Competitors.
    Die Arena hat echte Mechanik, aber viele externe Systeme laufen über Profile/API-shape oder benötigen Runner/Artifacts. Für echten “wow effect” brauchen wir massive Same-Run-Runs mit echten OSS/SDK/Cloud-Adaptern.
3. Harness-Kompatibilität ist breit, aber braucht eine beweisbare Matrix und Golden-Path-E2E pro Harness.
    Es gibt Setup- und Config-Flows, aber für “all common harnesses” braucht jedes Harness einen install → configure → pre-context → post-tool telemetry → correction capture → evidence trail Test.
4. Connectoren sind code-seitig viel weiter, aber “fully implemented” heißt mehr als list/poll/writeback.
    Für echte Plattformreife braucht jeder Connector: hermetic fixture, live smoke, credential wizard, pagination/rate limit, webhook/support where possible, semantic mapping, sourceRef, review queue, TUI setup, docs und maturity proof.

⸻

2. Fokus 1: Benchmark Improvement — massive, harte Daten

Aktueller Benchmark-Stand

package.json hat:

benchmark:cognicode:generate
benchmark:cognicode
benchmark:arena
benchmark:arena:run
benchmark:arena:publish
benchmark:competitors:native

benchmark:cognicode läuft aktuell mit --count 100.  ￼

Das committete Artefakt artifacts/cognicodebench/run.json zeigt:

* scenarioCount: 100
* passed: true
* correctionCarryoverRate: 1
* repeatedMistakeRate: 0
* procedureRecallRate: 1
* patchCorrectness: 1
* evidenceCompleteness: 1
* wrongMemorySuppression: 1  ￼

Das klingt stark, ist aber gleichzeitig ein Warnsignal: 100 % auf allen Metriken bedeutet wahrscheinlich, dass der Benchmark für cognibrain aktuell zu leicht oder zu eng auf die eigene Pipeline zugeschnitten ist.

Code-Gap: zu wenige Archetypen

In src/eval/cognicodeBench.ts wird generateCogniCodeScenarios() aus ARCHETYPES generiert. Der Code nimmt pro Scenario:

const archetype = ARCHETYPES[index % ARCHETYPES.length];
const difficulty = difficulties[index % difficulties.length];
const variant = Math.floor(random() * 10_000).toString(36);

Dann wird im Wesentlichen Repo-Name, Branch und eine Seed-Regel variiert.  ￼

Das ist gut für deterministische Varianten, aber für einen wirklich harten Benchmark nicht genug. Die Benchmark-Daten müssen massiv breiter werden:

* mehr Repos,
* mehr Languages,
* mehr Frameworks,
* mehr Multi-Step-Sessions,
* mehr echte Code-Diffs,
* mehr konkurrierende Memory-Fallen,
* mehr stale/contradictory memories,
* mehr Branch-/Version-Konflikte,
* mehr negative examples,
* mehr noisy context,
* mehr long-horizon tasks.

Neuer Zielstandard für CogniCodeBench v2

CogniCodeBench v2 sollte nicht 100 einfache synthetische Szenarien sein, sondern ein mehrstufiger, massiver Agentic Software Engineering Memory Benchmark.

Zielgröße

Für glaubwürdige Marktführerschaft:

* 10.000+ Memory Events
* 1.000+ Scenarios
* 100+ Synthetic Repos
* 10+ Repo-Archetypen
* 20+ Correction-Typen
* 5–10 Sessions pro Scenario
* stale + contradicted + superseded facts
* Tool outcome + review + issue + docs + chat events
* Noise Ratio: 20–80 % irrelevanter Kontext
* Long-horizon recall über 3–30 Sessions
* Multi-connector scenarios: GitHub + Jira + Confluence + Slack/Notion

Neue Benchmark-Kategorien

A. Single Correction Carryover

Ein User korrigiert den Agenten, nächster Task muss korrekt sein.

B. Repeated Mistake Avoidance

Agent darf denselben falschen Command/File/API nicht wiederholen.

C. Multi-source Engineering Memory

Korrektur kommt aus Jira, Architekturregel aus Confluence, Tool Failure aus GitHub Actions, Entscheidung aus Slack.

D. Long-horizon Repo Memory

Korrektur passiert in Session 2, relevant wird sie in Session 17.

E. Contradictory / Superseded Engineering Truth

Früher Jest, später Vitest. Früher npm, später pnpm. Früher REST, später GraphQL.

F. Branch-specific Truth

In main gilt Regel A, in legacy-support gilt Regel B.

G. Generated-file / Forbidden-action Guard

Agent darf bestimmte Dateien nie anfassen, außer mit expliziter Regeneration.

H. Procedure-before-action

Agent muss vor Tool-Call Memory abrufen: “Welchen Test command soll ich laufen lassen?”

I. Wrong-memory Injection Resistance

Benchmark enthält absichtlich plausible, aber falsche Memories.

J. Evidence Quality

Nicht nur richtige Aktion, sondern Begründung mit SourceRef, Memory IDs und EvidencePack.

⸻

Workpackages: Benchmark v2

WP-B1 — Expand CogniCodeBench Scenario Generator to 1k–10k scale

Ziel:
Von 100 Varianten aus wenigen Archetypen zu einem massiven Benchmark mit vielen Repos, Tasks, Sessions und Memory-Fallen.

Umsetzung:

* Neue Datei: src/eval/cognicode/scenarioFactory.ts
* Trennung in:
    * repo generator
    * task generator
    * correction generator
    * stale-memory generator
    * connector-event generator
    * tool-outcome generator
    * evaluator
* Parameter:
    * --repos
    * --scenarios
    * --sessions
    * --noise-ratio
    * --stale-ratio
    * --connector-mix
    * --difficulty
    * --seed

Akzeptanzkriterien:

* npm run benchmark:cognicode -- --count 1000 funktioniert.
* Mindestens 100 Repo-Templates möglich.
* Mindestens 20 Correction-Typen.
* Szenarien enthalten mehrere Sessions.
* Report enthält Difficulty-Verteilung.

⸻

WP-B2 — Add massive noisy memory corpus

Ziel:
Der Benchmark muss Retrieval unter Noise testen.

Umsetzung:

* Pro Scenario zusätzliche Memory Events:
    * irrelevant user preferences
    * old repo rules
    * conflicting commands
    * adjacent project facts
    * similar but wrong package rules
    * outdated Confluence docs
    * stale Jira comments
* Noise Ratio konfigurierbar.

Akzeptanzkriterien:

* noiseRatio im Report.
* Retrieval muss relevante Memories trotz Noise finden.
* Wrong-memory suppression wird härter.

⸻

WP-B3 — Add connector-backed benchmark events

Ziel:
Benchmark soll externe Systeme simulieren.

Events:

* GitHub PR review correction
* GitHub Actions failure
* Jira issue comment
* Confluence ADR
* Notion product spec
* Slack/Discord decision
* Linear issue comment
* GitLab MR review
* Azure DevOps pipeline failure

Akzeptanzkriterien:

* Scenario enthält sourceRef.connectorId.
* Evaluator prüft SourceRef correctness.
* EvidencePack muss externe Quelle referenzieren.

⸻

WP-B4 — Add real patch/diff evaluator

Ziel:
Nicht nur expected files/commands prüfen, sondern Patchqualität.

Umsetzung:

* Synthetic repo files generieren.
* Agent patch als diff modellieren.
* Evaluator prüft:
    * richtige Datei geändert
    * verbotene Datei nicht geändert
    * imports korrekt
    * API pattern korrekt
    * test file korrekt
    * generated file handling korrekt

Akzeptanzkriterien:

* patchCorrectness wird granular.
* Nicht nur String-Matching.
* Fehlerdiagnose pro Patch.

⸻

WP-B5 — Add long-horizon multi-session evaluator

Ziel:
Memory muss über viele Sessions funktionieren.

Umsetzung:

* Scenario Lifecycle:
    * session 1: seed repo
    * session 2: wrong action
    * session 3: correction
    * session 4–10: noise
    * session 11: related task
    * session 12: migration
    * session 13–20: delayed reuse
* Metriken:
    * long-horizon recall
    * stale suppression
    * repeated mistake avoidance
    * evidence trace survival

Akzeptanzkriterien:

* Report enthält horizonLength.
* Scores getrennt für short/mid/long horizon.

⸻

WP-B6 — Add hard competitor benchmark mode

Ziel:
Benchmark Arena soll denselben massiven Datensatz gegen Wettbewerber laufen.

Umsetzung:

* benchmark:arena -- --count 1000 --difficulty hard --noise-ratio 0.6
* Jeder Adapter bekommt gleiche Event-Sequenz.
* Alle Systeme müssen:
    * ingest
    * retrieve
    * optional record action
    * optional record correction
    * evidence export where possible

Akzeptanzkriterien:

* Report markiert unsupported features.
* Keine unfairen Annahmen.
* Proof-Level wird klar getrennt.

⸻

WP-B7 — Re-run benchmark after benchmark-hardening

Ziel:
Nach Implementierung von B1–B6 müssen Benchmarks wirklich neu laufen.

Commands:

npm run benchmark:cognicode -- --count 1000 --difficulty hard --noise-ratio 0.5
npm run benchmark:arena:run -- --count 300 --systems cognibrain,mem0,graphiti,cognee,langmem,gbrain
npm run benchmark:arena:publish
npm run benchmark:answer-generation -- --reports artifacts/cognicodebench/run.json,artifacts/arena/run.json
npm run leaderboard

Akzeptanzkriterien:

* Neue Artefakte mit Timestamp.
* Alte Artefakte werden nicht als neue Claims recycelt.
* README/Docs zeigen neue harte Scores.

⸻

3. Fokus 2: Harness-Kompatibilität

Aktueller Stand

Das Package hat cognibrain-connect als Binary und setup, setup:selfhosted, connect, install:codex-skill.  ￼

Der CLI-Code enthält Harness Targets:

codex, claude, copilot, cursor, vscode, opencode, openclaw, langgraph, crewai

und setup kann --all-harnesses, --codex, --claude, --copilot, --cursor, --vscode, --opencode, --openclaw, --langgraph, --crewai.

Der init-Wizard kann Profile, Goal, Primary Agent, Harnesses, Storage, Auth, Connectors, Adapters und Demo abfragen.  ￼

Gap

Harness-Kompatibilität ist breit angelegt, aber für “all common harnesses” müssen wir zwischen Config geschrieben und echter E2E-Kompatibilität unterscheiden.

Aktuell sichtbar:

* Config generation exists.
* Skill install exists.
* Harness package manifest exists.
* Doctor checks exist.
* Golden path für Claude Code wird in Docs/Status erwähnt, aber jedes Harness braucht eigenen E2E-Beweis.

Workpackages: Harness v2

WP-H1 — Harness Compatibility Matrix

Ziel:
Jedes Harness bekommt messbaren Reifegrad.

Harnesses:

* OpenAI Codex CLI
* Claude Code
* Cursor
* GitHub Copilot
* VS Code MCP
* OpenCode
* OpenClaw
* LangGraph
* CrewAI
* Windsurf
* Continue.dev
* Aider
* Roo Code / Cline
* Sourcegraph Amp
* Devin-style external agent mode

Matrix-Spalten:

* Config generated
* Skill/rules generated
* MCP supported
* pre-LLM context hook
* pre-tool guard
* post-tool telemetry
* correction capture
* patch evidence trail
* install wizard
* doctor check
* E2E demo
* status

Akzeptanzkriterien:

* docs/integrations/harness-maturity.md
* artifacts/harness-maturity.json
* npm run harness:maturity

⸻

WP-H2 — Harness E2E Golden Paths

Ziel:
Nicht nur Config erzeugen, sondern echten Loop testen.

Golden Path pro Harness:

1. install config
2. start cognibrain
3. request coding context
4. run pre-tool action guard
5. record tool outcome
6. record correction
7. produce patch evidence trail
8. verify memory reuse

Akzeptanzkriterien:

* verify:harnesses läuft alle verfügbaren Harness-Simulationen.
* Jeder Harness hat eigenes Fixture.
* Unsupported parts klar markiert.

⸻

WP-H3 — Add missing common harnesses

Ziel:
Breite Marktabdeckung.

Neue Targets:

* Windsurf
* Continue.dev
* Aider
* Roo Code / Cline
* Sourcegraph Amp
* Goose
* aider-compatible generic CLI mode

Akzeptanzkriterien:

* Config writer pro Target.
* Docs pro Target.
* Doctor check pro Target.
* At least one simulation per Target.

⸻

WP-H4 — Skill/Rules Package Standard

Ziel:
Jeder Harness bekommt konsistente Memory-Instructions.

Inhalt:

* when to call memory
* how to request context pack
* how to call action guard
* how to record corrections
* how to produce patch evidence
* what not to store
* how to handle secrets

Akzeptanzkriterien:

* Templates versioniert.
* Generated configs include version and checksum.
* doctor erkennt stale harness config.

⸻

WP-H5 — Guided Harness Setup TUI

Ziel:
Harness Setup nicht nur via Flags.

Flow:

* Select harnesses
* Detect existing configs
* Preview changes
* Avoid overwriting
* Install sidecar
* Run health check
* Simulate first memory call

Akzeptanzkriterien:

* Works from TUI.
* Supports multiple harnesses.
* Shows exact config diff.

⸻

4. Fokus 3: Connectoren — sind sie fully implemented?

Kurze Antwort

Code-seitig: erstaunlich weit. Produkt-/Reifegrad-seitig: noch nicht “fully implemented” für alle.

Echte Implementierung sichtbar

vendorConnectors.ts enthält echte Provider und echte Driver-Funktionen. Jira, Confluence, Notion, Linear, GitLab, Azure DevOps usw. sind nicht nur Manifest-Namen.

Noch nicht vollständig als Produkt

Ein Connector ist erst fully implemented, wenn er mindestens hat:

* Driver code
* Hermetic fixture
* Live smoke
* Credential wizard
* Pagination/rate-limit handling
* Webhook support where vendor supports it
* Semantic mapping
* SourceRef correctness
* Review queue support
* TUI setup
* TUI preview
* Docs
* Maturity row
* Production boundary

Ich sehe viel Driver-Code, aber die vollständige Reife muss pro Connector über connectors:maturity, verify:vendor-connectors, verify:vendor-live und Docs belegt werden.

Workpackages: Connector Completion

WP-C1 — Connector maturity must be source-of-truth

Ziel:
Die Frage “fully implemented?” darf nicht manuell beantwortet werden.

Umsetzung:

* connectors:maturity prüft:
    * provider in ExternalVendorProvider
    * CLI definition
    * required env vars
    * list/poll/writeback functions
    * fixture test present
    * live smoke supported
    * docs present
    * TUI setup present
* Ausgabe:
    * manifest-only
    * driver-code
    * hermetic-tested
    * live-smoke-ready
    * tenant-verified
    * production-ready

Akzeptanzkriterien:

* Jeder Connector bekommt Status.
* README/Marketing nutzt nur Status aus dieser Matrix.
* doctor --publish warnt bei nicht verifizierten Connector-Claims.

⸻

WP-C2 — Hermetic fixture suite for every vendor driver

Ziel:
Alle Vendor Driver testbar ohne echte Credentials.

Provider:

* GitHub
* Slack
* Discord
* Jira
* Confluence
* Notion
* Linear
* GitLab
* Azure DevOps
* Teams
* Gmail
* Google Drive
* Google Calendar
* Asana
* ClickUp
* Sentry
* Datadog
* PagerDuty
* PostHog

Akzeptanzkriterien:

* Jeder Driver hat fake API fixture.
* list/poll/writeback dry-run getestet.
* Secret redaction getestet.
* SourceRef getestet.

⸻

WP-C3 — Live smoke support for every vendor

Ziel:
Jeder Connector kann mit echten Tenant Credentials geprüft werden.

Command:

npm run verify:vendor-live -- --provider jira
npm run verify:vendor-live -- --provider notion

Akzeptanzkriterien:

* Keine Writes ohne explizites --writeback.
* Dry-run default.
* Artefakt pro Provider.
* TUI zeigt live-smoke status.

⸻

WP-C4 — Semantic Engineering Memory Mapping per Connector

Ziel:
Rohdaten zu Engineering Memories machen.

Beispiele:

* Jira comment → review_correction / project_decision
* Confluence ADR → architecture_decision
* Notion spec → product_spec / repo_policy
* GitHub Action failure → tool_outcome
* GitLab MR review → review_correction
* Sentry issue → incident_learning
* Datadog monitor → observability_rule
* PagerDuty incident → runbook_update

Akzeptanzkriterien:

* Mapping-Regeln pro Connector.
* TUI Preview zeigt Memory Types.
* User kann Mapping vor Ingest ändern.

⸻

WP-C5 — Connector webhooks

Ziel:
Nicht nur poll, sondern live Updates.

Priorität:

1. GitHub
2. Jira
3. Confluence
4. Notion
5. Linear
6. GitLab
7. Slack
8. Teams
9. Sentry/PagerDuty

Akzeptanzkriterien:

* Webhook endpoint.
* Signature validation.
* Replay protection.
* Event normalization.
* Review queue.

⸻

5. Fokus 4: Benchmark live erneut ausführen

Was ich live prüfen konnte

Ich konnte die aktuellen committeten Artefakte prüfen:

CogniCodeBench aktueller Artefaktstand

artifacts/cognicodebench/run.json:

* generatedAt: 2026-05-26T09:05:29.317Z
* scenarioCount: 100
* passed: true
* all main metrics: 1 except repeated mistake rate 0  ￼

Benchmark Arena aktueller Artefaktstand

artifacts/arena/run.json:

* generatedAt: 2026-05-26T09:07:35.776Z
* benchmarkInput: cognicode
* cognibrain: same-run-full
* cognibrain scenarioCount: 30
* cognibrain score: 0.9722
* repeatedMistakeRate: 0
* wrongMemorySuppression: 0.8333  ￼

Die Arena enthält auch echte Mem0 OSS Runner-Evidence in den Szenarien, inklusive mem0ai==2.0.2, local Qdrant/FastEmbed und Capability-Gaps wie “no typed pre-tool action guard” und “no Patch Evidence Trail”.  ￼

Was ich nicht ausführen konnte

Ich konnte keinen neuen lokalen Benchmark-Lauf durchführen, weil die Umgebung keinen GitHub-DNS-Zugriff für git clone hat. Deshalb kann ich nicht behaupten, dass ich nach Änderungen live neu gebenchmarkt habe.

Was nach Codeänderungen laufen sollte

Nach Benchmark-Hardening:

npm run benchmark:cognicode -- --count 1000 --difficulty hard --noise-ratio 0.5
npm run benchmark:arena:run -- --count 300 --systems cognibrain,mem0,graphiti,zep,cognee,langmem,gbrain
npm run benchmark:arena:publish
npm run benchmark:answer-generation -- --reports artifacts/cognicodebench/run.json,artifacts/arena/run.json
npm run leaderboard
npm run verify:status
npm run audit:truth

Für Connector/Harness:

npm run verify:connectors
npm run verify:vendor-connectors
npm run verify:vendor-live
npm run connectors:maturity
npm run verify:compatibility

⸻

6. Gesamtempfehlung: nächste Entwicklungsphase

P0 — Benchmark massiv härten

1. CogniCodeBench v2 mit 1k–10k Szenarien
2. Multi-session long-horizon memory
3. massive noisy corpus
4. connector-backed scenarios
5. real diff/patch evaluator
6. harder Arena mode

Warum:
Aktuell ist der Benchmark stark, aber zu leicht. Perfekte Scores auf 100 synthetischen Szenarien sind gut, aber nicht glaubwürdig genug als “best on market”.

⸻

P1 — Harness-Kompatibilität beweisbar machen

1. Harness maturity matrix
2. E2E golden path pro Harness
3. Add Windsurf, Continue, Aider, Roo/Cline, Goose, Amp
4. Skill/rules package standard
5. Guided TUI setup per Harness

Warum:
Setup-Flags sind nicht genug. Der Markt glaubt “kompatibel” erst, wenn es installierbar, testbar und dokumentiert ist.

⸻

P2 — Connectoren vollständig produktisieren

1. Connector maturity source-of-truth
2. Hermetic fixture pro Connector
3. Live smoke pro Connector
4. Semantic mapping pro Connector
5. Webhook support
6. TUI connector setup + preview + review queue

Warum:
Der Code ist erstaunlich weit, aber “fully implemented” heißt: driver + proof + UX + docs + live verification.

⸻

P3 — Benchmarks live nach Änderungen neu laufen lassen

1. current benchmark artifact löschen oder versionieren
2. new hard benchmark run
3. arena run with real competitor runners
4. publish public/benchmark-arena
5. update README/market pages

Warum:
Die neue harte Benchmark-Version darf nicht nur Code sein; sie muss als Artefakt sichtbar sein.

⸻

7. Konkrete neue Issues

Ich würde diese Issues anlegen:

1. CogniCodeBench v2: scale to 1k–10k hard multi-session scenarios
2. CogniCodeBench v2: add massive noisy memory corpus and stale contradiction traps
3. CogniCodeBench v2: add connector-backed events from GitHub/Jira/Confluence/Notion/Slack
4. CogniCodeBench v2: add real patch/diff evaluator
5. Benchmark Arena: run hard CogniCodeBench against all competitor adapters
6. Harness maturity matrix for Codex, Claude Code, Cursor, Copilot, VS Code, OpenCode, OpenClaw, LangGraph, CrewAI, Windsurf, Continue, Aider, Roo/Cline
7. Harness E2E golden path: install -> context -> action guard -> telemetry -> correction -> evidence
8. Add missing harness targets: Windsurf, Continue.dev, Aider, Roo/Cline, Goose, Sourcegraph Amp
9. Connector maturity source-of-truth generated from code/tests/docs
10. Hermetic fixture tests for every external vendor connector
11. Live smoke support for every vendor connector
12. Semantic Engineering Memory mapping per connector
13. Connector webhooks with signature verification and replay protection
14. TUI connector setup wizard with credential validation and preview
15. TUI memory management: add/edit/delete/archive/pin/search/evidence/graph/dream
16. Run new hard benchmarks and publish updated artifacts

⸻

8. Final Assessment

Benchmarks

Good foundation, but too easy.
Current CogniCodeBench: 100 scenarios, perfect results. The generator mainly rotates through a small set of archetypes with variants.  ￼
Next: 1k–10k scenarios, multi-session, noise, connectors, real patch diff.

Harnesses

Broad setup support exists.
CLI/setup supports many harnesses already.
Next: maturity matrix + real E2E golden path per harness + add missing common harnesses.

Connectors

Much more real than before.
Vendor code exists for many systems, including Jira, Confluence, Notion, Linear, GitLab and Azure DevOps.
Next: prove full maturity per connector: fixture, live smoke, semantic mapping, webhook, TUI, docs.

Running benchmarks live

Current repo artifacts show recent benchmark runs from 2026-05-26.
I could not execute a fresh run in this environment because the local container cannot resolve github.com for cloning. The correct next step in your dev environment is to implement benchmark v2 and run the commands above.

The strategic focus is clear:

Build the hardest Engineering Memory benchmark, make every harness provably compatible, and turn every connector into a real, testable, previewable, auditable external-system adapter.