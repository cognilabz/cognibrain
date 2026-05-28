# Cognibrain

Self-hosted engineering memory for coding agents.

Cognibrain stores durable engineering context such as repo rules, reviewer corrections, failed commands, connector events and patch evidence, then returns compact context before the next agent action. The practical promise is simple: Stop fixing the same agent mistake twice.

```bash
npm i @cognilabz/cognibrain
npx cognibrain init
npx cognibrain status
```

The default command shows a stable operator CLI snapshot with runtime state, memory health, connections and next actions. It is intentionally text-first, so it works in small panes, CI logs and remote shells.

## Public Surface

| Surface | Use it for |
| --- | --- |
| CLI | Setup, status, service management, connectors, config, proof and operator automation. |
| Harness CLI | Universal shell-hook integration for coding agents: context, guard, outcome, correction, patch evidence, session handoff, release prep, source revalidation, conflicts and health. |
| MCP | Native MCP agent integration: context packs, coding context, action guards, corrections, patch evidence and memory maintenance. |
| SDK/HTTP | Product integrations, custom connectors, dashboards and non-MCP runtimes. |

Use MCP for MCP-native agents. Use `cognibrain harness ...` or the top-level lifecycle commands for any agent or CI runner that can call shell hooks. Use SDK/HTTP for product integrations and custom runtimes. These surfaces should point at the same local daemon when daemon mode is available.

## Quick Start

From npm:

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --profile solo-dev --yes
npx cognibrain doctor --fix
npx cognibrain status
```

From a checkout:

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
./bin/cognibrain.mjs init --profile solo-dev --yes
./bin/cognibrain.mjs doctor --fix
```

The browser Operator UI is an optional commercial add-on. It is not included in
the MIT npm package; licensed checkouts can start it with:

```bash
npx cognibrain dashboard
```

More detail: [docs/install.md](docs/install.md).

## Daily Usage

```bash
npx cognibrain memories add "This repo uses npm test before release."
npx cognibrain memories coding-context "prepare the release patch"
npx cognibrain guard --action "edit src/api/server.ts" --json
npx cognibrain patch-evidence --task "release patch" --json
npx cognibrain proof
```

For MCP-capable agents, use MCP tools first. Use the CLI memory commands as an operator path or fallback.

For shell-hook capable agents and CI jobs, use the JSON-first harness lifecycle:

```bash
npx cognibrain harness context --task "prepare the release patch" --json
npx cognibrain harness guard --action "npm test" --json
npx cognibrain harness outcome --command "npm test" --exit-code 0 --json
npx cognibrain harness patch-evidence --task "release patch" --json
npx cognibrain harness health --json
```

## Connectors

Cognibrain includes first-party connector definitions and drivers for common code, planning, docs, chat, calendar and observability systems, including GitHub, GitLab, Azure DevOps, Slack, Jira, Confluence, Notion, Linear, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog.

```bash
npx cognibrain connections add github --set repo=cognilabz/cognibrain
npx cognibrain connections add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
```

Connector configs store non-secret values and `env:` references. Token values stay outside the repo.

Community adapters can be scaffolded from the CLI:

```bash
npx cognibrain sdk platform acme-tracker --kind issue_tracker --out integrations/acme-tracker
npx cognibrain sdk harness custom-agent --out integrations/custom-agent
```

## SDKs

TypeScript:

```ts
import { CognibrainClient } from "@cognilabz/cognibrain/sdk/typescript/client";
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";
import { CognibrainHarnessSdk } from "@cognilabz/cognibrain/sdk/typescript/harness";
```

Python:

```bash
cd sdk/python
python3 -m pip install .
python3 -m unittest discover -s tests
```

See [docs/integrations.md](docs/integrations.md) and [sdk/python/README.md](sdk/python/README.md).

## Benchmarks And Proof

Generated proof outputs are internal build artifacts. They are written under `artifacts/`, ignored by git and excluded from the npm package.

Maintainers can run the internal gates through the compact runner:

```bash
npm run internal -- benchmark:cognicode
npm run internal -- benchmark:arena
npm run internal -- verify:compatibility
npm run proof
```

Benchmark claims are bounded by proof level. `same-run-full` means Cognibrain executed locally. `same-run-native`, `same-run-cloud-api` and `same-run-cli` require configured external runners. `same-run-api-shape` is compatibility modeling, not vendor certification.

## Production Boundary

Cognibrain is a self-hosted production candidate, not a managed SaaS product.

Implemented boundaries include DB-primary MemoryRepository paths for SQLite/Postgres memory rows, row mirrors for service state, backup/compaction snapshots, API-key/Bearer auth, optional JWT/OIDC verifier, route-level RBAC, actor scopes and production policy mode that default-denies when no rule matches. The remaining storage hardening boundary is a fully async event-journal-first runtime across every service domain.

This repository does not claim managed SaaS uptime, billing, hosted support, autoscaling, deployment-specific SSO rollout, tenant-verified connector live smokes or production-certified connector rows. See [docs/status.md](docs/status.md) and [docs/claims.md](docs/claims.md).

## Development

```bash
npm test
npm run build
npm run verify
npm run release:check
```

`package.json` keeps the public script surface small. Specialized benchmark, connector and audit jobs live behind:

```bash
npm run internal -- <task>
```

## Repository Map

| Path | Purpose |
| --- | --- |
| `bin/` | Public CLI entrypoints. |
| `src/` | Product source: API, MCP/connectors, core memory logic, CLI commands and eval code. |
| `operator-ui/` | Separately licensed commercial Operator UI add-on; excluded from the OSS npm package. |
| `src/api/` | HTTP server, service runtime and persistence adapters. |
| `src/connectors/` | MCP server, connector registry and connector tooling. |
| `src/core/` | Memory model, retrieval, graph, policy and storage logic. |
| `src/cli/` | Script-safe memory command implementation. |
| `src/eval/` | Internal benchmark and verification generators. |
| `sdk/typescript/` | TypeScript HTTP and integration SDK. |
| `sdk/python/` | Dependency-free Python HTTP client. |
| `scripts/` | Grouped runtime, release, benchmark, demo, internal and local-dev automation. |
| `fixtures/` | Deterministic fixtures for tests, demos and connector examples. |
| `templates/` | Harness and integration templates. |
| `docker/` | Optional self-host packaging. |
| `deploy/` | Optional deployment manifests. |
| `data/benchmarks/` | Large local benchmark corpora; ignored and not shipped. |

## Documentation

- [Documentation home](docs/README.md)
- [Install and setup](docs/install.md)
- [Usage and reference](docs/reference.md)
- [Connectors, SDKs and community adapters](docs/integrations.md)
- [Operations guide](docs/operations.md)
- [Benchmarks](docs/benchmarks.md)
- [Production status](docs/status.md)
- [Claims and evidence](docs/claims.md)
