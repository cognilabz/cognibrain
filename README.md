<p align="center">
  <img src="docs/assets/cognilabz-logo.png" alt="Cognilabz logo" width="96" height="96">
</p>

<h1 align="center">cognibrain</h1>

<p align="center">
  <strong>Inspectable Agent Memory OS.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#proof">Proof</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#documentation">Documentation</a>
</p>

cognibrain is a local-first TypeScript Agent Memory OS for teams that need durable context without opaque recall. It remembers across agent harnesses, proves every memory with source and retrieval evidence, explains why context was selected, respects scope and consent boundaries, and keeps memory valid over time through graph, temporal, contradiction and dream-maintenance surfaces.

The project includes the memory engine, HTTP API, CLI, official connector manifests, provider adapters, MCP connector, harness hook, operator dashboard, benchmark suite, and a self-maintenance loop called `dream`.

**Claim:** memory you can prove, route, govern, and reuse across every agent.

![cognibrain desktop dashboard](docs/assets/dashboard-desktop.png)

![cognibrain mobile dashboard](docs/assets/dashboard-mobile.png)

## Interface Tour

| Memory workbench | Recall QA |
| --- | --- |
| ![cognibrain memory workbench](docs/assets/dashboard-workbench.png) | ![cognibrain recall QA](docs/assets/dashboard-recall.png) |

| Temporal patterns | Marketplace setup |
| --- | --- |
| ![cognibrain temporal pattern explorer](docs/assets/dashboard-timeline.png) | ![cognibrain marketplace setup](docs/assets/dashboard-marketplace.png) |

| Dream cycle | Benchmark proof |
| --- | --- |
| ![cognibrain dream cycle](docs/assets/dashboard-lifecycle.png) | ![cognibrain benchmark proof](docs/assets/dashboard-benchmarks.png) |

## Why Agent Memory OS

Agent memory often fails in one of two ways: it is either a simple vector search that misses time, trust, consent and contradictions, or a vague long-term summary that cannot be audited. cognibrain is built as a memory operating system: compact enough to use, structured enough to inspect, governed enough for teams, and measurable enough to improve.

The core question is not just “can the agent remember?” It is:

- What is known, who owns it, and where did it come from?
- Is it still valid now, or stale, contradicted, private, or superseded?
- Why was this memory retrieved for this task?
- Which graph path, temporal signal, trust score, source citation, consent rule, and retrieval profile allowed it into context?
- Can the same memory be reused safely across Codex, Claude Code, Cursor, Copilot, MCP and HTTP workflows?

That makes cognibrain different from narrower memory products:

| Product category | Main promise | cognibrain position |
| --- | --- | --- |
| Drop-in memory API | Store and recall user facts quickly | Adds inspectable context packs, governance, graph paths, lifecycle state, local ownership and harness routing |
| Personal markdown brain | User-owned notes and backlinks | Adds API-first multi-agent/team scopes, consent enforcement, benchmarks, connectors and dashboard operations |
| Temporal graph memory | Conversation graph over time | Adds source-quality gates, evidence export, marketplace modules, compliance surfaces and local-first packaging |
| Graph/vector control plane | Hybrid retrieval over knowledge | Adds “why-used” proof, dream maintenance, policy-aware context injection and cross-harness reuse |

The short version: **cognibrain remembers across agents, proves every memory, explains every retrieval, respects every boundary, and learns from every run.**

## Dashboard

The dashboard is a working inspection surface, not a decorative demo. It presents cognibrain as a platform runtime plus an operator gate:

| Section | Why it exists |
| --- | --- |
| Operator gate | Shows whether context is ready before an agent can use it. |
| Platform runtime | Shows that CLI, HTTP, dashboard, MCP, and templates run from one local package. |
| Memory advantage | Explains the current USP: entity-linked hybrid recall plus dream maintenance. |
| Health metrics | Shows whether the memory store is fresh, trusted, and active. |
| Recall QA | Lets a user test the exact context an agent would receive. |
| Knowledge graph | Shows entity paths, source filters, activation, and graph clusters. |
| Temporal patterns | Lets operators zoom timelines, filter events, approve inferred patterns, and stage annotations. |
| Dream cycle | Proves memory hygiene by summarizing, fading, reflecting, and reorganizing facts. |
| Ranked evidence | Exposes score, citation, and trust for each retrieved memory. |
| Marketplace setup | Previews connectors, personas, domain modules, and retrieval profiles before install. |
| Benchmark evidence | Keeps local and public market proof visible. |
| Artifact inspector | Lets benchmark JSON be checked without leaving the UI. |

## Quick Start

Requirements:

- Node.js 20 or newer
- npm

One command from this checkout:

```bash
./bootstrap.sh --all
```

Or use the CLI directly:

```bash
npm install
./bin/cognibrain.mjs setup --all-harnesses
```

After publishing the package, the same one-click path is:

```bash
npx cognibrain setup --all-harnesses
npx cognibrain-connect claude-code
npx cognibrain-connect codex --no-start
npx cognibrain-connect all
```

`setup` installs the Codex Skill, optionally writes MCP configs for Codex, Claude, Cursor, and VS Code, starts the API plus dashboard, and runs `doctor`.
`cognibrain-connect` is the dedicated package-style connector installer: it writes the same reviewable harness package manifest, starts the local API/dashboard unless disabled, and prints the publish doctor command so teams can verify connector health after installation.

Then open the printed dashboard URL. Runtime and publish helpers:

```bash
./bin/cognibrain.mjs status
./bin/cognibrain.mjs doctor --publish
./bin/cognibrain.mjs stop
./bin/cognibrain.mjs skill install
./bin/cognibrain.mjs clean
```

Managed/export checks:

```bash
MEMORY_BACKUP_REF=local-backup://2026-05 MEMORY_SSO_PROVIDER=oidc MEMORY_SECRET_MANAGER=vault ./bin/cognibrain.mjs memory migration-export managed > managed-bundle.json
./bin/cognibrain.mjs memory backup-verify managed-bundle.json
MEMORY_DEPLOYMENT_MODE=managed MEMORY_PUBLIC_URL=http://memory.example.com ./bin/cognibrain.mjs doctor --publish
```

## Usage

Add a memory:

```bash
./bin/cognibrain.mjs memory add "Project Atlas uses TypeScript for all harness components."
```

Search memory:

```bash
./bin/cognibrain.mjs memory search "What language does Atlas use?"
./bin/cognibrain.mjs memory inspect <memory-id>
./bin/cognibrain.mjs memory route "Which release memory should Codex use?"
./bin/cognibrain.mjs memory intent "How are Atlas and Redis connected?"
```

Explain why memories were used and export the same evidence an agent would receive:

```bash
./bin/cognibrain.mjs memory why-used "Why should Atlas run tests before release?"
./bin/cognibrain.mjs memory evidence-pack "Why should Atlas run tests before release?"
```

The returned evidence pack is the first-five-minutes proof surface: it contains the compact context block plus per-memory source citation, consent boundary, scope, validity window, stale/decision state, retrieval signals, graph paths and reason phrases. The same artifact is available through `POST /evidence-pack` and MCP `memory_context_pack`, so CLI, dashboard and harness integrations can all answer: “why was this memory used?”

Extract add-only memories from an event or conversation:

```bash
./bin/cognibrain.mjs memory extract "Atlas now uses Redis for cache. Verified npm test passed."
./bin/cognibrain.mjs memory action "npm run test"
./bin/cognibrain.mjs memory episodes
```

Give retrieval feedback:

```bash
./bin/cognibrain.mjs memory feedback <memory-id> helpful
./bin/cognibrain.mjs memory feedback-injection "release graph proof" accepted <good-id>,<bad-id> '{"graph":0.9,"trust":0.8}' <good-id> <bad-id>
./bin/cognibrain.mjs memory metrics
```

Run the maintenance cycle:

```bash
./bin/cognibrain.mjs memory dream
./bin/cognibrain.mjs memory verify
./bin/cognibrain.mjs memory confirm <memory-id>
./bin/cognibrain.mjs memory retract <memory-id> "Superseded by confirmed source"
./bin/cognibrain.mjs memory dream-policy
MEMORY_PERSIST_OBSERVATIONS=true ./bin/cognibrain.mjs memory observations
./bin/cognibrain.mjs memory predictions "Friday release review"
```

Inspect connectors and ingest a connector event:

```bash
./bin/cognibrain.mjs memory connectors
./bin/cognibrain.mjs memory connector-sync official-chat "Support confirmed the release note owner."
```

Translate or ingest a media transcript with language metadata:

```bash
MEMORY_LANGUAGE=de ./bin/cognibrain.mjs memory translate "Speicher soll nicht fehler"
MEMORY_MEDIA_TYPE=audio MEMORY_LANGUAGE=de ./bin/cognibrain.mjs memory media-ingest "Speicher soll release notes erfassen."
OCR_TEXT=$(tr '\n' ' ' < fixtures/media/operator-dashboard.ocr.txt)
MEMORY_MEDIA_TYPE=image MEMORY_SOURCE_URI=file://$PWD/fixtures/media/operator-dashboard.png MEMORY_MIME_TYPE=image/png MEMORY_METADATA_JSON="{\"ocrText\":\"$OCR_TEXT\",\"imageLabels\":[\"dashboard\",\"connector health\"]}" ./bin/cognibrain.mjs memory media-ingest "fixtures/media/operator-dashboard.png"

PDF_OCR_TEXT=$(tr '\n' ' ' < fixtures/media/operator-brief.ocr.txt)
MEMORY_MEDIA_TYPE=document MEMORY_SOURCE_URI=file://$PWD/fixtures/media/operator-brief.pdf MEMORY_MIME_TYPE=application/pdf MEMORY_METADATA_JSON="{\"ocrText\":\"$PDF_OCR_TEXT\"}" ./bin/cognibrain.mjs memory media-ingest "fixtures/media/operator-brief.pdf"
```

Check health:

```bash
./bin/cognibrain.mjs memory health
```

Check automatic maintenance:

```bash
./bin/cognibrain.mjs memory maintenance
```

## API

Create a memory:

```bash
curl -X POST http://localhost:8787/memories \
  -H "content-type: application/json" \
  -d '{
    "userId": "dev",
    "content": "Project Atlas uses TypeScript for all harness components.",
    "source": {"kind": "human", "confidence": 0.96},
    "tags": ["project", "typescript"]
  }'
```

Search:

```bash
curl -X POST http://localhost:8787/search \
  -H "content-type: application/json" \
  -d '{"userId": "dev", "appId": "codex", "query": "What language should Atlas use?", "limit": 5}'
```

Dream:

```bash
curl -X POST http://localhost:8787/dream \
  -H "content-type: application/json" \
  -d '{"userId": "dev"}'
```

Inspect connector/provider status and sync connector events:

```bash
curl http://localhost:8787/connectors
curl "http://localhost:8787/connectors/health"
curl http://localhost:8787/providers
curl "http://localhost:8787/connectors/list?connectorId=official-chat"
curl -X POST http://localhost:8787/connectors/sync \
  -H "content-type: application/json" \
  -d '{"connectorId":"official-chat","userId":"dev","events":[{"role":"user","content":"Support confirmed the release note owner.","externalId":"msg-1"}]}'
curl -X POST http://localhost:8787/connectors/writeback \
  -H "content-type: application/json" \
  -d '{"connectorId":"official-code","operation":"comment","target":{"repo":"cognilabz/cognibrain","path":"README.md","pullRequest":99},"content":"Memory-backed release decision summary.","dryRun":true}'
```

## Memory Lifecycle

The `dream` cycle is the self-maintenance loop for the memory store:

- Rethink repeated or contradictory memories.
- Reevaluate source confidence, usage, and remaining issues.
- Summarize repeated themes into auditable reflection memories.
- Fade stale low-utility memories.
- Reflect on contradictions and demote weaker claims.
- Reorganize procedures, transcripts, and stable facts into better layers.

Pinned memories are never faded or archived.

The current runtime also supports configurable and scoped learned retrieval profiles, injection-feedback learning from accepted/rejected context packs, adaptive dream-policy previews, generated observations with citation provenance, behavioral prediction and prefetch reports, deterministic answer-generation/multi-hop/temporal/pattern benchmark suites, scoped retention rules with search/dream enforcement, encrypted-memory key id/version metadata, key-provider reporting, encrypted backup recovery verification, transport-security readiness checks, managed import/export deployment bundles, differentially private aggregate insights with k-anonymity suppression, validated marketplace install plans, TypeScript/Python/Go/Rust client surfaces, packaged domain modules, JSON/JSONL/SQLite persistence adapters, `hybrid`/`rrf`/`graph`/`path` retrieval modes, deterministic or provider-backed query expansion, behavioural retrieval scoring, contradiction-aware context selection, graph path/activation/export reasoning, JSON-command intelligence adapters, deterministic fallback reranking, verifier/summarizer/classifier/extractor/translator providers, official connector manifests, connector sync records, webhook delivery/retry inspection, scoped memory (`sessionId`, `appId`, `orgId`, `projectId`), multi-tenant brains/sources with explicit shared-brain federation, agent subscriptions, shared-memory review/revoke workflows, persona defaults, consent mutation, audit history and revert, offline operation queues, explicit identity links, privacy consent flags, secret redaction/encryption, canonical entity records with merge/split suggestions, typed relations, staged add-only extraction with media/language envelopes, translated media ingestion, enrichment candidates, hour/day/week/month temporal timelines, persisted timeline summaries, multilingual contradiction checks, behavioral-pattern review, feedback-based trust/importance updates, domain evaluations, local metrics, lifecycle preview, and export/delete APIs.

## Connectors

cognibrain exposes four integration surfaces. The CLI is the primary install and runtime surface; MCP is available for compatible agent clients without making MCP the only way to operate the platform.

- HTTP API for apps and services,
- CLI for local scripts,
- TypeScript harness hook for direct agent runtimes,
- stdio MCP server for MCP-compatible tools.

Start MCP:

```bash
./bin/cognibrain.mjs mcp
MCP_PORT=8788 ./bin/cognibrain.mjs mcp --http
```

Available MCP tools:

- `memory_add`
- `memory_search`
- `memory_context_pack`
- `memory_list`
- `memory_reflect`
- `memory_dream`
- `memory_health`
- `memory_maintenance_status`

Connector templates are included for Claude Code, Codex, GitHub Copilot, and Cursor under `templates/`.

## Proof

Local verification:

```bash
npm run verify
```

Next-generation feature verification:

```bash
npm run verify:nextgen
```

Certified benchmark gate:

```bash
npm run benchmark:certified
```

Public market-claim gate:

```bash
npm run benchmark:market -- --competitors docs/public-market-claims.json --out artifacts/market-gate-public.json
```

Latest checked evidence:

<!-- benchmark-claims:start -->
| Dataset | cognibrain | Result |
| --- | ---: | --- |
| LoCoMo | `34/40`, `85.00%` | Beats keyword-only `67.50%` |
| LongMemEval-S | `40/40`, `100.00%` | Saturates with keyword-only `100.00%` |
<!-- benchmark-claims:end -->

The public market gate is a public-claim comparison, not a vendor-signed rerun. Stronger commercial proof should import vendor artifacts with the same dataset, metric, top-K, and budget.

## Architecture

```text
src/core/          Memory model, store, graph reasoning, retrieval, reflection, health
src/api/           Node HTTP API and service facade
src/cli/           memctl command line interface
src/connectors/    Harness hook, MCP handlers, MCP server
src/dashboard/     React dashboard
src/eval/          Benchmark runners, fixtures, baselines, market gate, leaderboard artifacts
tests/             Vitest tests for core behavior and evaluation proof
templates/         Connector starter templates
docs/              Setup, API, lifecycle, connector, and benchmark docs
docker/            Container and compose files
```

## Documentation

- [API Reference](docs/api-reference.md)
- [Agent Memory OS](docs/agent-memory-os.md)
- [Configuration](docs/configuration.md)
- [Integration Guide](docs/integration-guide.md)
- [Memory Lifecycle](docs/lifecycle.md)
- [Connectors](docs/connectors.md)
- [Benchmarking](docs/benchmarking.md)
- [Open Benchmark Leaderboard](docs/leaderboard.md)
- [Community And Adoption](docs/community.md)
- [Partner Integration Playbook](docs/partners.md)
- [One-Click Local Tutorial](docs/tutorials/one-click-local.md)
- [Connector Authoring Tutorial](docs/tutorials/connector-authoring.md)
- [Graph, Time, And Pattern Tutorial](docs/tutorials/graph-temporal-patterns.md)
- [Privacy And Retention Tutorial](docs/tutorials/privacy-retention.md)
- [Domain Module Tutorial](docs/tutorials/domain-module.md)
- [Market Comparison](docs/market-comparison.md)
- [Advanced Features](docs/advanced-features.md)
- [Roadmap](docs/roadmap.md)

## Open-Source Readiness

This repository is prepared as a public Cognilabz project:

- MIT license,
- reproducible install and verification commands,
- CI workflow,
- Docker starter files,
- contribution guide,
- security policy,
- dashboard screenshots,
- generated benchmark artifacts kept out of source control under `artifacts/`.

## Contributing

Start with:

```bash
npm install
npm run verify
```

Before opening a change, run:

```bash
npm run test
npm run build
```

For benchmark-related changes, run the relevant benchmark command and update documentation only from generated artifacts.

CI runs the synthetic evaluation artifact and public-safe leaderboard artifact on every push and pull request. Weekly or manually triggered CI runs execute the certified benchmark gate and upload the generated proof artifacts.

## Safety

Do not store secrets, private keys, raw credentials, medical records, or sensitive transcripts unless your project has an explicit retention policy. Connectors should default to project-local scope and explicit user consent for durable storage.
