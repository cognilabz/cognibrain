# Cognibrain

Self-hosted engineering memory for coding agents.

Cognibrain stores durable engineering context such as repo rules, reviewer corrections, failed commands, connector events and patch evidence, then returns compact context before the next agent action. The practical goal is simple: Stop fixing the same agent mistake twice.

```bash
npm i @cognilabz/cognibrain
npx cognibrain
```

<p align="center">
  <img src="docs/assets/cli-home.svg" alt="Cognibrain CLI home" width="900">
</p>

## Public Surface

| Surface | Role |
| --- | --- |
| CLI | Human and automation control plane: setup, status, service, connectors, config, proof and fallback memory commands. |
| MCP | Default integration path for agents: context packs, coding context, action guards, durable writes, corrections, patch evidence and maintenance. |
| SDK/HTTP | Custom product integrations: source-system connectors, polling/writeback, dashboards and non-MCP runtimes. |

MCP is the default integration path for agents. CLI is the operator surface. SDK/HTTP is for custom integrations, not a second primary agent path.

## Install

```bash
npm i @cognilabz/cognibrain
npx cognibrain init
npx cognibrain doctor --fix
```

Checkout path:

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
./bin/cognibrain.mjs init --profile solo-dev --yes
./bin/cognibrain.mjs doctor --fix
```

Dashboard is optional:

```bash
npx cognibrain dashboard
npx cognibrain start --dashboard
```

More setup detail: [docs/install.md](docs/install.md).

## Daily Usage

```bash
npx cognibrain status
npx cognibrain memories
npx cognibrain memories add "This repo uses npm test, not pnpm."
npx cognibrain memories coding-context "prepare the release patch"
npx cognibrain connections
npx cognibrain connections add github --set repo=cognilabz/cognibrain
npx cognibrain proof
```

For agents, use MCP tools first. Use `npx cognibrain memories coding-context "<task>"` only when MCP is unavailable.

## Connectors

Native connector drivers exist for GitHub, GitLab, Azure DevOps, Slack, Discord, Teams, Jira, Confluence, Notion, Linear, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog.

```bash
npx cognibrain connections add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connections add slack --set channelId=C123 --token-env MEMORY_SLACK_TOKEN
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
```

Connector configs store non-secret values and `env:` references. Token values stay outside the repo.

## Benchmarks And Proof

Generated proof outputs are internal build artifacts. Commands write ignored local reports under `artifacts/`; they are useful for CI and release review, but they are not committed or shipped in the npm package.

```bash
npm run benchmark:cognicode
npm run benchmark:arena
npm run verify:compatibility
npm run audit:truth
```

Benchmark claims are bounded by proof level. `same-run-full` means Cognibrain executed locally. `same-run-native`, `same-run-cloud-api` and `same-run-cli` require configured external runners. `same-run-api-shape` is only a compatibility model.

## Production Boundary

Cognibrain is a self-hosted production candidate, not a managed SaaS product.

Current implemented boundaries:

- DB-primary row persistence with snapshots retained only as backup/compaction artifacts.
- API-key/Bearer auth plus optional JWT/OIDC verifier, route-level RBAC and actor-bound scopes.
- Production policy mode default-denies when no rule matches.
- Connector rows are native driver paths and implementation-ready certification rows, not tenant production certifications.

This repository does not claim managed SaaS uptime, billing, hosted support, autoscaling, deployment-specific SSO rollout, tenant-verified connector live smokes or production-certified connector rows. See [docs/status.md](docs/status.md), [docs/operations.md](docs/operations.md) and [docs/claims.md](docs/claims.md).

## Development

```bash
npm test
npm run build
npm run verify:status
npm run audit:docs
npm run audit:truth
npm run release:check
```

Generated outputs stay local:

- `artifacts/`
- `.cognibrain/`

## Repository Map

| Path | Purpose |
| --- | --- |
| `bin/` | CLI entrypoints. |
| `src/api/` | Service, HTTP server and persistence adapters. |
| `src/connectors/` | MCP server, connector registry and SDK scaffold. |
| `src/core/` | Memory model, retrieval, graph and policy logic. |
| `src/cli/` | Ink TUI and memory command implementation. |
| `src/eval/` | Internal benchmarks and verification generators. |
| `sdk/python/` | Dependency-free Python client. |
| `docs/` | Handwritten public documentation. |
| `templates/` | Harness and integration templates. |

## Documentation

- [Documentation home](docs/README.md)
- [Install and self-hosting](docs/install.md)
- [Connectors and integration surfaces](docs/integrations.md)
- [Operations and production boundary](docs/operations.md)
- [CLI, MCP, API and SDK reference](docs/reference.md)
- [Benchmarks](docs/benchmarks.md)
- [Claims and evidence map](docs/claims.md)
