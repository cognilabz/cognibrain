# Self-Hosted Install

Self-hosted mode is for a team or networked deployment. Configure auth, durable storage, TLS and backup before exposing the API.

## Docker Compose

```bash
export MEMORY_API_KEYS="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up --build
```

## Guided CLI

```bash
npx cognibrain init --profile team
npx cognibrain connector add github --set repo=cognilabz/cognibrain
npx cognibrain connector add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain doctor --fix
```

`init` renders a React/Ink terminal flow in an interactive terminal and writes `.cognibrain/setup-state.json`, native connector configs under `.cognibrain/connectors/`, harness configs, and first-run next steps. Connector configs store selected non-secret settings plus `env:` references, never credential values.

## Required Environment

- `MEMORY_REQUIRE_AUTH=true`
- `MEMORY_API_KEYS`
- `MEMORY_STORAGE_BACKEND=postgres-remote`
- `MEMORY_POSTGRES_URL`
- `MEMORY_PUBLIC_URL=https://...` or `MEMORY_TLS_TERMINATED_BY`
- `MEMORY_BACKUP_REF`
- connector credentials only for vendors you enable

## Verify

```bash
npm run verify:postgres
npm run verify:compatibility
npm run benchmark:arena
npm run audit:plan1_5
./bin/cognibrain.mjs doctor --publish
npm run release:check
```

More setup examples: [`setup-cli.md`](setup-cli.md). Product overview: [`overview.md`](overview.md).

Claim IDs: `CB-CLAIM-STORAGE`, `CB-CLAIM-CONNECTORS`, `CB-CLAIM-PRODUCTION`, `CB-CLAIM-RELEASE`.
