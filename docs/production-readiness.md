# Production Readiness

cognibrain is ready to present as an open-source, self-hosted Agent Memory OS when the gates below pass in the target environment. The honest status is **self-hosted production candidate**, not a managed SaaS certification. Local development works with no keys or database; team and networked deployments must turn on auth, durable storage, backup, and transport controls.

## What Is Ready

| Area | Ready today | Required gate |
| --- | --- | --- |
| Local install | One-command setup, CLI, API, dashboard, MCP, harness package generation | `./bootstrap.sh --all` or `./bin/cognibrain.mjs setup --all-harnesses` plus `./bin/cognibrain.mjs doctor` |
| Team API | API-key auth, actor ids, policy rules, scoped retrieval, audit events | `MEMORY_REQUIRE_AUTH=true` and `MEMORY_API_KEYS` set before exposing the server |
| Durable storage | JSON/JSONL, SQLite FTS5, Postgres-compatible CI mode, psql-backed Postgres/Cockroach remote driver | `npm run verify:postgres` against the target Postgres path |
| Evidence and governance | MemoryRecordV2, EvidencePack, why-used explanations, policy checks, graph paths, retention review, audit chain | `npm run verify:nextgen` and `npm run audit:plan1_1` |
| Connectors | Official manifests, OAuth hash/revoke lifecycle, list/poll/sync/writeback HTTP contract, GitHub/Slack/Discord live verifier | `npm run verify:connectors` and deployment-specific vendor credential smoke tests |
| Benchmarks | LoCoMo, LongMemEval, BEAM, nextgen, answer-generation, market gate, load artifacts | `npm run benchmark:certified`, `npm run benchmark:market`, and the selected `benchmark:load` profile |
| Open-source packaging | MIT license, contribution guide, security policy, Docker, Kubernetes, npm package dry-run, Python PyPI-style SDK package | `./bin/cognibrain.mjs doctor --publish`, `npm pack --dry-run`, and Python SDK tests |

## Production Claim Boundary

You can honestly say:

- "cognibrain is a local-first, self-hostable Agent Memory OS with inspectable evidence packs, policy-aware retrieval, durable storage options, connectors, MCP tools, dashboard operations, and reproducible verification gates."
- "A team can run it behind its own API key, Postgres/Cockroach storage, TLS ingress, backup process, and connector credentials."
- "The public benchmark claims are generated from repo-local artifacts and distinguish synthetic/public gates from vendor-signed external reruns."

Do not claim:

- managed SaaS uptime, autoscaling, SSO, billing, or hosted support without a deployment-specific control-plane run;
- vendor connector certification without running the connector against real GitHub, Slack, Discord, Jira, Linear, Notion, Google, or other tenant credentials;
- benchmark leadership against a competitor unless the comparison imports comparable artifacts with the same dataset, top-K, metric, and budget.

## Setup Paths

### Five-Minute Local Demo

```bash
npm install
./bin/cognibrain.mjs setup --all-harnesses
./bin/cognibrain.mjs memory add "Atlas releases require npm test before publish."
./bin/cognibrain.mjs memory evidence-pack "What should Atlas do before release?"
./bin/cognibrain.mjs doctor
```

This proves setup, memory write, evidence export, API/dashboard startup, Codex Skill generation, and local health.

### Self-Hosted Compose

```bash
export MEMORY_API_KEYS="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up --build
```

The compose file runs the API against Postgres 16, requires API-key auth, installs the `psql` client inside the container, and keeps Postgres data in a named volume. Put TLS in front of compose or set `MEMORY_TLS_TERMINATED_BY` when an ingress or reverse proxy handles encryption.

### Kubernetes

`deploy/kubernetes/cognibrain.yaml` is a self-hosted API manifest that expects an external Postgres-compatible database and a secret manager or sealed-secret workflow for `MEMORY_API_KEYS`, `MEMORY_POSTGRES_URL`, and encryption key material. It uses `postgres-remote` instead of multi-replica SQLite so horizontal API replicas do not share a single local file.

## Required Production Environment

Set these before exposing a networked deployment:

| Variable | Why it matters |
| --- | --- |
| `MEMORY_REQUIRE_AUTH=true` | Fails closed when no API key is supplied |
| `MEMORY_API_KEYS` | Comma-separated API keys for HTTP callers |
| `MEMORY_STORAGE_BACKEND=postgres-remote` or `cockroach-remote` | Durable shared team storage |
| `MEMORY_POSTGRES_URL` | Target database or pooler URL |
| `MEMORY_PUBLIC_URL=https://...` plus TLS ingress | Prevents publishing a plain HTTP production endpoint |
| `MEMORY_ENCRYPTION_KEY`, `MEMORY_ENCRYPTION_KEY_ID`, `MEMORY_ENCRYPTION_KEY_VERSION` | Encrypts secret-shaped memories and documents key rotation |
| `MEMORY_BACKUP_REF` | Gives `migration-export` and `backup-verify` a recovery anchor |
| `MEMORY_SECRET_MANAGER` | Records where deploy secrets are owned |

For high-concurrency Postgres deployments, point `MEMORY_POSTGRES_URL` at the deployment pooler such as PgBouncer or a managed Postgres pool endpoint. `npm run verify:postgres` proves the schema, transaction rollback, tenant indexes, and indexed `tsvector` retrieval through the configured URL.

## Verification Loop

Run these before tagging a release or calling a deployment production-ready:

```bash
npm run verify:nextgen
npm run verify:postgres
npm run verify:connectors
npm run benchmark:load -- --memories 10000 --concurrent-writes 50 --concurrent-searches 20 --connector-events 20 --out artifacts/load-benchmark-10k-dream.json
./bin/cognibrain.mjs doctor --publish
npm pack --dry-run
python3 -m unittest discover -s sdk/python/tests
```

For larger deployments, repeat the load benchmark at 100k or 1M memories using the commands in `docs/benchmarking.md`, then keep the generated artifacts with the release notes.

## Release Checklist

- README explains the Memory OS claim, benefits, setup, usage, proof, production boundary, and status matrix.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `PRODUCT.md`, Docker, Kubernetes, and `.env.example` are present.
- `docs/implementation-status.md` matches the current code and does not list closed work as open.
- `npm run audit:plan1_1` passes after checking product and production readiness text.
- GitHub issues for the plan pass are closed only after the related verifier output is fresh.
- Python SDK remains PyPI-style packageable from `sdk/python`; publish to PyPI only from a release workflow with a real token.
