# Self-Hosted Install

Self-hosted mode is for a team or networked deployment. Configure auth, durable storage, TLS and backup before exposing the API.

## Docker Compose

```bash
export MEMORY_API_KEYS="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up --build
```

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
./bin/cognibrain.mjs doctor --publish
npm run release:check
```

Claim IDs: `CB-CLAIM-STORAGE`, `CB-CLAIM-CONNECTORS`, `CB-CLAIM-PRODUCTION`, `CB-CLAIM-RELEASE`.
