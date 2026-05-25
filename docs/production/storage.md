# Storage

## Local

JSON and JSONL storage are suitable for local demos and single-user development.

## SQLite

SQLite is suitable for a single-node local team install when the Node runtime has `node:sqlite` available.

## Postgres-Compatible

Use `MEMORY_STORAGE_BACKEND=postgres-remote` or `cockroach-remote` for shared self-hosted deployments. Point `MEMORY_POSTGRES_URL` at the deployment database or pooler.

## Verify

```bash
npm run verify:postgres
```

The verifier checks migrations, tenant isolation, indexed lexical search, rollback and backup-related readiness fields.

Claim ID: `CB-CLAIM-STORAGE`.
