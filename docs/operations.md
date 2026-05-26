# Operations And Production Boundary

Cognibrain is packaged for self-hosted operation first. Managed SaaS is a future product track and is not claimed by this repository.

## Release Check

```bash
npm run release:check
```

The release check writes a local report under `artifacts/` and runs:

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

Current storage uses DB-primary row persistence for SQLite and Postgres-compatible adapters. Memories, relations, entities, audit events, context packs, retrieval profiles and retention rules are written through granular row-level paths, with `memory.created`, `memory.updated`, `memory.deleted` and `snapshot.compacted` events recorded in the journal. Snapshots are retained only as backup/compaction artifacts. Postgres proof writes a local ignored report under `artifacts/`; rerun it in the target environment before making deployment-specific production claims.

`artifacts/` is ignored by git and excluded from npm packages. Treat it as CI/build output, not source documentation.

## Auth And Secrets

Cognibrain supports local-only operation, API-key deployment and an optional JWT/OIDC verifier. Configure issuer, audience and a HS256 or RS256 verification key with `MEMORY_JWT_ISSUER`, `MEMORY_JWT_AUDIENCE`, `MEMORY_JWT_HS256_SECRET`, `MEMORY_JWT_PUBLIC_KEY` or `MEMORY_JWT_PUBLIC_KEY_BASE64`. The route-level RBAC layer maps validated scopes to `memory:read`, `memory:write` and `memory:admin`; actor-bound scopes prevent a validated user from spoofing another `userId`, `orgId` or `projectId` unless an admin/memory-all scope is present. Connector and adapter configs store `env:` references rather than token values.

Production policy mode default-denies when no rule matches. Set `MEMORY_SECURITY_MODE=production`, `MEMORY_PRODUCTION_MODE=true` or `MEMORY_POLICY_MODE=production` to fail closed. DB-level row isolation is still deployment-specific; use the target database's RLS or tenant policy if that deployment requires database-enforced isolation.

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

- not claimed: managed SaaS uptime,
- not claimed: billing readiness,
- not claimed: hosted support,
- not claimed: autoscaling behavior,
- not claimed: managed SSO rollout for a specific identity provider,
- not claimed: DB-level row isolation,
- not claimed: tenant live connector certification,
- not claimed: production-certified connector rows,
- not claimed: real Graphiti/Zep or Cognee runs without LLM/vendor credentials,
- not claimed: vendor-certified competitor benchmark results.

Those claims require a deployment-specific control-plane run or vendor-hosted benchmark certification.
