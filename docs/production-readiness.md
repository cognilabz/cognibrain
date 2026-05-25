# Production Readiness

cognibrain is ready to present as an open-source, self-hosted Engineering Memory OS when the gates below pass in the target environment. The honest status is **self-hosted production candidate**, not a managed SaaS certification. Local development works with no keys or database; team and networked deployments must turn on auth, durable storage, backup, and transport controls.

## What Is Ready

| Area | Ready today | Required gate |
| --- | --- | --- |
| Local install | React/Ink CLI home, guided setup, memory workbench, connections/config surfaces, API, native service automation, optional dashboard, MCP, harness package generation, connector config, adapter config and skill lifecycle | `npx cognibrain`, `npx cognibrain init`, `npx cognibrain service plan`, `./bootstrap.sh --self-hosted`, or `./bin/cognibrain.mjs setup --self-hosted` plus `./bin/cognibrain.mjs doctor --publish` |
| Team API | API-key auth, actor ids, policy rules, scoped retrieval, audit events | `MEMORY_REQUIRE_AUTH=true` and `MEMORY_API_KEYS` set before exposing the server |
| Durable storage | JSON/JSONL, SQLite FTS5, Postgres-compatible CI mode, psql-backed Postgres/Cockroach remote driver | `npm run verify:postgres` against the target Postgres path |
| Evidence and governance | MemoryRecordV2, EvidencePack, why-used explanations, Engineering Memory types, coding context packs, action guards, patch evidence trails, policy checks, graph paths, retention review, audit chain | `npm run verify:nextgen`, `npm run benchmark:cognicode`, `npm run verify:status`, and `npm run audit:plan1_3` |
| Connectors and adapters | Official manifests, OAuth hash/revoke lifecycle, list/poll/sync/writeback HTTP contract, 19 native vendor drivers, Platform SDK scaffold for private systems, HTTP adapter verifier, vendor driver verifier, provider/storage/media/benchmark/MCP adapter configs | `npm run verify:connectors`, `npm run verify:vendor-connectors`, `npx cognibrain connections doctor`, and deployment-specific vendor credential smoke tests |
| Benchmarks | CogniCodeBench, LoCoMo, LongMemEval, BEAM, nextgen, answer-generation, market gate, load artifacts | `npm run benchmark:cognicode`, `npm run benchmark:certified`, `npm run benchmark:market`, and the selected `benchmark:load` profile |
| Open-source packaging | MIT license, contribution guide, security policy, Docker, Kubernetes, npm package dry-run, Python PyPI-style SDK package | `./bin/cognibrain.mjs doctor --publish`, `npm pack --dry-run`, and Python SDK tests |

## Production Claim Boundary

You can honestly say:

- "cognibrain is a local-first, self-hostable Engineering Memory OS with a CLI-first operator surface, inspectable evidence packs, policy-aware retrieval, durable storage options, connectors, MCP tools, optional dashboard operations, and reproducible verification gates."
- "CogniCodeBench proves the synthetic coding-agent loop where corrections, review feedback, commands, tool outcomes and codebase changes carry into the next patch."
- "A team can run it behind its own API key, Postgres/Cockroach storage, TLS ingress, backup process, and connector credentials for built-in GitHub, GitLab, Azure DevOps, Slack, Discord, Teams, Jira, Confluence, Notion, Linear, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog drivers."
- "The public benchmark claims are generated from repo-local artifacts and distinguish synthetic/public gates from vendor-signed external reruns."

Do not claim:

- managed SaaS uptime, autoscaling, SSO, billing, or hosted support without a deployment-specific control-plane run;
- vendor connector certification without running the connector against real deployment credentials for that tenant;
- benchmark leadership against a competitor unless the comparison imports comparable artifacts with the same dataset, top-K, metric, and budget.

## Production Docs

This page is the production-docs hub for local install, team install, storage backends, auth/security, policies, connectors, CogniCodeBench, backup/restore, migrations, observability, release checks, and troubleshooting. Keep it aligned with `docs/implementation-status.md` and `docs/claims.md` before changing public readiness language.

Detailed production pages:

- [`production/overview.md`](production/overview.md)
- [`production/storage.md`](production/storage.md)
- [`production/auth.md`](production/auth.md)
- [`production/policy.md`](production/policy.md)
- [`production/backup-restore.md`](production/backup-restore.md)
- [`production/observability.md`](production/observability.md)
- [`production/migrations.md`](production/migrations.md)
- [`production/security.md`](production/security.md)
- [`production/release-checklist.md`](production/release-checklist.md)
- [`production/badges.md`](production/badges.md)

## Setup Paths

### Five-Minute Local Demo

```bash
npm install
npx cognibrain init --profile solo-dev --yes
npx cognibrain
npx cognibrain config show --json
npx cognibrain connections
npx cognibrain connections connectors list
npx cognibrain connections adapters list
npx cognibrain skill status
./bin/cognibrain.mjs memory add "Atlas releases require npm test before publish."
./bin/cognibrain.mjs memory evidence-pack "What should Atlas do before release?"
./bin/cognibrain.mjs doctor
```

This proves setup, memory write, evidence export, API startup, terminal operator health, connector/adapter visibility, Codex Skill generation, and local health. Use [`getting-started/setup-cli.md`](getting-started/setup-cli.md) for the interactive setup flow and connector examples. The browser dashboard remains opt-in through `npx cognibrain dashboard`.

Native service automation is also CLI-controlled:

```bash
npx cognibrain service plan --platform linux --json
npx cognibrain service plan --platform macos --json
npx cognibrain service plan --platform windows --json
npx cognibrain service install --activate
```

The generated service runs the foreground runtime under systemd, launchd, or Windows Task Scheduler and keeps the dashboard off unless `--dashboard` is set.

### Self-Hosted Compose

```bash
export MEMORY_API_KEYS="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 32)"
docker compose -f docker/docker-compose.yml up --build
```

If your local Docker CLI ships Compose as the standalone binary, use the same command through `docker-compose`. To validate the rendered config before startup:

```bash
MEMORY_API_KEYS=dummy-key POSTGRES_PASSWORD=dummy-password docker-compose -f docker/docker-compose.yml config
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
| Provider credentials for enabled connectors | Set only the `MEMORY_*` variables for providers you enable through `npx cognibrain connections add <provider>`; the CLI stores non-secret IDs and env-var references, while tokens stay in your deployment secret manager |

For high-concurrency Postgres deployments, point `MEMORY_POSTGRES_URL` at the deployment pooler such as PgBouncer or a managed Postgres pool endpoint. `npm run verify:postgres` proves the schema, transaction rollback, tenant indexes, and indexed `tsvector` retrieval through the configured URL.

## Verification Loop

Run these before tagging a release or calling a deployment production-ready:

```bash
npm run release:check
npm run verify:nextgen
npm run verify:status
npm run audit:plan1_3
npm run audit:plan1_4
npm run benchmark:cognicode
npm run verify:postgres
npm run verify:compatibility
npm run verify:connectors
npm run verify:vendor-connectors
npm run verify:vendor-live
npm run verify:selfhosted:claims
npm run benchmark:load -- --memories 10000 --concurrent-writes 50 --concurrent-searches 20 --connector-events 20 --out artifacts/load-benchmark-10k-dream.json
./bin/cognibrain.mjs doctor --publish
npm pack --dry-run
python3 -m unittest discover -s sdk/python/tests
```

`npm run release:check` is the single command release gate. It writes `artifacts/release-check.json` and then calls the same underlying checks with actionable step names.

`npm run verify:vendor-live` is safe by default: it writes `artifacts/vendor-live-smoke.json` and skips network calls unless `MEMORY_VENDOR_LIVE_SMOKE=true` or `--live` is supplied. Self-hosted teams can opt into live checks for any built-in driver by setting the corresponding `MEMORY_*` credentials from [`connectors.md`](connectors.md). Real writeback remains dry-run unless `MEMORY_VENDOR_LIVE_WRITE=true` or `--writeback` is supplied.

For larger deployments, repeat the load benchmark at 100k or 1M memories using the commands in `docs/benchmarking.md`, then keep the generated artifacts with the release notes.

## Release Checklist

- README explains the Engineering Memory OS claim, benefits, setup, usage, CogniCodeBench proof, production boundary, and status matrix.
- `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `PRODUCT.md`, Docker, Kubernetes, and `.env.example` are present.
- `docs/implementation-status.md` matches the current code and does not list closed work as open.
- `npm run verify:status`, `npm run audit:plan1_1`, `npm run audit:plan1_2`, `npm run audit:plan1_3`, `npm run audit:plan1_4`, and `npm run release:check` pass after checking product and production readiness text.
- GitHub issues for the plan pass are closed only after the related verifier output is fresh.
- Python SDK remains PyPI-style packageable from `sdk/python`; publish to PyPI only from a release workflow with a real token.

## Troubleshooting

- If Compose fails during config interpolation, export `MEMORY_API_KEYS` and `POSTGRES_PASSWORD` first; the file intentionally fails closed without them.
- If `docker compose` is unavailable but `docker-compose` exists, use the standalone binary with the same flags.
- If `/health` is reachable but non-health routes return `401`, confirm that callers send `x-api-key` when `MEMORY_REQUIRE_AUTH=true`.
- If vendor connector checks pass locally but production sync fails, rerun `npm run verify:vendor-live -- --live` with tenant credentials and inspect `/connectors/health` before claiming vendor certification.
- If `npm run audit:plan1_2` or `npm run audit:plan1_3` fails, open `artifacts/plan1_2-audit.json` or `artifacts/plan1_3-audit.json`; it reports the exact Epic/WP check and failed assertion index.
