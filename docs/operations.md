# Operations And Production Boundary

Cognibrain is packaged for self-hosted operation first. Managed SaaS is a future product track and is not claimed by this repository.

## Release Check

```bash
npm run release:check
```

The release check writes `artifacts/release-check.json` and runs:

- unit tests,
- dashboard build,
- status verification,
- CogniCodeBench,
- Benchmark Arena,
- first-win demo,
- docs audit,
- product truth audit,
- Postgres verifier,
- connector compatibility,
- local runtime start,
- publish doctor,
- npm pack dry-run,
- Python SDK tests.

## Runtime

```bash
npx cognibrain start
npx cognibrain status
npx cognibrain stop
```

Service startup:

```bash
npx cognibrain service plan
npx cognibrain service install --activate
npx cognibrain service logs
```

The service runs the API in the foreground so systemd, launchd or Task Scheduler owns the process.

## Storage

| Mode | Use it for | Verification |
| --- | --- | --- |
| JSON/JSONL | Small local demos and package smoke tests. | `npm test` |
| SQLite | Local self-hosted durable storage. | `npm test` |
| Postgres | Team or production-like deployment. | `npm run verify:postgres` |

Postgres proof writes `artifacts/postgres-live.json`. Rerun it in the target environment before making deployment-specific production claims.

## Auth And Secrets

Cognibrain supports local-only operation, API-key deployment and OIDC or reverse-proxy boundaries depending on environment. Connector and adapter configs store `env:` references rather than token values.

Operational rules:

- keep connector tokens in environment variables or a secret manager,
- do not commit generated `.cognibrain/` runtime state,
- run `npx cognibrain doctor --publish` before publishing,
- run `npx cognibrain proof` before public claims or release notes,
- use HTTPS or a documented TLS terminator for non-local deployments,
- keep the dashboard opt-in unless a team explicitly wants a browser inspection view.

## Backup And Migration

Use the API and CLI export paths for portable bundles, and validate restore in the target storage backend. For self-hosted production, pair Cognibrain with host-level backups for Postgres or the selected storage adapter.

## Current Non-Claims

This repo does not claim:

- managed SaaS uptime,
- billing readiness,
- hosted support,
- autoscaling behavior,
- deployment-specific SSO readiness,
- tenant live connector certification,
- production-certified connector rows,
- real Graphiti/Zep or Cognee runs without LLM/vendor credentials,
- vendor-certified competitor benchmark results.

Those claims require a deployment-specific control-plane run or vendor-hosted benchmark certification.
