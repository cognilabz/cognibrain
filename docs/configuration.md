# Configuration

cognibrain is intentionally local-first. The current implementation runs without API keys, databases, or hosted vector stores.

## Runtime

```bash
npm install
./bin/cognibrain.mjs setup --all-harnesses
```

The local launcher starts both the API and dashboard, chooses the next open port if a default port is busy, and writes runtime state under `.cognibrain/` in the launch directory. Set `COGNIBRAIN_RUNTIME_ROOT` or pass `--runtime-root <path>` to pin the memory/state directory somewhere else.

Run a publish readiness check:

```bash
./bin/cognibrain.mjs doctor --publish
```

Environment variables:

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `8787` | API server port |
| `VITE_PORT` | `5173` | Dashboard start port for the local launcher |
| `VITE_API_URL` | `http://localhost:<PORT>` | API URL shown by the dashboard |
| `NODE_ENV` | unset | Set to `production` in Docker |
| `COGNIBRAIN_RUNTIME_ROOT` | launch directory | Directory for `.cognibrain/` runtime state and default memory JSON |
| `MEMORY_DB_PATH` | `.memory-harness.json` | Local API and CLI persistence file |
| `MEMORY_STORAGE_BACKEND` | `json` | Persistence backend: `json`, `jsonl`/`append-only`, `sqlite`, `postgres`/`postgres-compatible`, or `cockroach` |
| `MEMORY_EVENT_LOG_PATH` | `.memory-harness.jsonl` | Append-only persistence log when `MEMORY_STORAGE_BACKEND=jsonl` |
| `MEMORY_SQLITE_PATH` | `.memory-harness.sqlite` | SQLite database path when `MEMORY_STORAGE_BACKEND=sqlite` |
| `MEMORY_POSTGRES_COMPAT_PATH` | `.memory-harness.postgres.json` | Local Postgres-compatible SQL emulator path for CI/offline tests |
| `MEMORY_STORAGE_REPLICATION_MODE` | `logical` | Replication mode reported by the Postgres-compatible adapter |
| `MEMORY_STORAGE_SHARDS` | `1` | Shard count used in storage capability reports |
| `MEMORY_AUTO_DREAM` | `true` | Set to `false` to disable automatic dream-cycle maintenance |
| `MEMORY_DREAM_INTERVAL_HOURS` | `6` | Interval for due background dream checks after new writes |
| `MEMORY_DREAM_WRITE_THRESHOLD` | `12` | Number of writes for a user before automatic dream runs |
| `MEMORY_DREAM_CHECK_INTERVAL_MINUTES` | `15` | API server interval for scanning due dream cycles |
| `MEMORY_REDACTION_MODE` | `redact` | `redact`, `reject`, `archive`, `encrypt`, or `off` for sensitive-memory handling |
| `MEMORY_ENCRYPTION_KEY` | unset | Local AES-GCM key material used only when `MEMORY_REDACTION_MODE=encrypt` |
| `MEMORY_ENCRYPTION_KEY_ID` | `local` | Non-secret key id stored in encrypted-memory metadata |
| `MEMORY_ENCRYPTION_KEY_VERSION` | `1` | Non-secret key version stored in encrypted-memory metadata |
| `MEMORY_DEFAULT_TOKEN_BUDGET` | `900` | Suggested context budget for harness connectors |
| `MEMORY_NEVER_STORE_SECRETS` | `true` | Policy flag host connectors should honor before writing memories |
| `MEMORY_WEBHOOK_TIMEOUT_MS` | `10000` | Timeout for real HTTP webhook delivery |
| `MEMORY_CONNECTOR_TIMEOUT_MS` | `10000` | Timeout for connector writeback HTTP delivery |

## Memory Input Fields

Required:

- `userId`
- `content`

Recommended:

- `agentId`
- `type`: `user`, `feedback`, `project`, `reference`, `episodic`, `procedural`
- `layer`: `working`, `episodic`, `long_term`, `procedural`, `reflection`
- `source.kind`: `human`, `reviewed_code`, `tool`, `agent`, `transcript`, `import`
- `source.confidence`: number from `0` to `1`
- scope: `sessionId`, `appId`, `orgId`, `projectId`, `deviceId`, `runId`
- `consent.visibility`: `private`, `user`, `org`, or `public`
- `relations`: typed links such as `calls`, `imports`, `depends_on`, `supersedes`
- `temporal`: `eventAt`, `validFrom`, `validUntil`, `lastConfirmedAt`, `verificationDueAt`
- `tags`
- `entities`
- `metadata`

## Retrieval Tuning

The current ranker combines:

- semantic token overlap,
- keyword coverage,
- entity match,
- temporal decay,
- behavioural cadence and approved pattern fit,
- trust and importance,
- graph boost through shared entities,
- typed relationship hints,
- access frequency,
- evidence gating so trust alone cannot retrieve unrelated memories.

The default benchmarked profile is semantic `0.26`, keyword `0.24`, entity `0.16`, temporal `0.08`, behavioural `0.05`, trust `0.18`, graph `0.06`, and access `0.02`; values are normalized before scoring. API search requests, service constructors, and `MEMORY_CONFIG_PATH` can pass weight overrides.

Search can also receive optional reranker and verifier implementations in the TypeScript API. The built-in reranker is deterministic and favors candidates with stronger post-retrieval query coverage before the verifier marks stale or contradiction-tagged results for warning or review. For production adapters, set `MEMORY_INTELLIGENCE_COMMAND` to a JSON-command provider. The command receives stdin JSON with a `task` of `rerank`, `verify`, `contradiction`, `summarize`, or `extract` and returns JSON decisions. Timeouts fail closed to the deterministic fallback.

Retrieval profiles are stored with normalized weights, optional user/project/app/org/agent scope, provenance, training sample count, and update timestamp. Use `memctl profiles`, `memctl profile-set`, `PUT /profiles`, or `profileId` on search requests to select a policy without editing source code.

The learned-weight path starts from feedback events and optional labeled training samples. Use `memory feedback <id> helpful`, `wrong`, `always_include`, or `never_include` to change bounded trust and importance, `POST /profiles/training-samples` to add scored retrieval outcomes, then `memctl profile-learn` or `POST /profiles/learn` to save a bounded learned profile with loss metadata.

## Privacy And Retention

The default redaction layer catches common API keys, tokens, private keys, credentials, high-entropy tokens, and email addresses. `redact` preserves useful context while replacing sensitive spans. `reject` blocks the write. `archive` stores the redacted memory and archives it immediately. `encrypt` stores an AES-GCM encrypted payload marker and audit metadata; set `MEMORY_ENCRYPTION_KEY` before using it. `MEMORY_ENCRYPTION_KEY_ID` and `MEMORY_ENCRYPTION_KEY_VERSION` are non-secret labels used for compliance reports and rotation metadata.

Consent metadata controls retrieval visibility. Private memories are excluded unless a caller explicitly asks for private memory; org-visible memories remain scoped to the matching organization. Retention dates are respected by search and can be paired with export/delete APIs. Additional retention rules can be managed with `memctl retention-rule`, `/retention/rules`, and `/retention/enforce`; rules can target users, brains, sources, source kinds, consent visibility, entities, relation types, or tags.

Identity links are opt-in. `POST /identity-links` stores only a hash of a consent token and lets callers use `includeLinkedIdentities` during retrieval. Revoked links are ignored.

## Continuous Benchmarking

The default CI workflow runs `npm run verify` for each push and pull request, then uploads the synthetic evaluation artifact when available. Weekly and manually triggered workflow runs execute `npm run benchmark:certified` and upload the certified LoCoMo, LongMemEval, BEAM, and market-gate JSON artifacts.

## Dream Cycle Policy

Run the maintenance cycle with one of these surfaces:

```bash
./bin/cognibrain.mjs memory dream
curl -X POST http://localhost:8787/dream -H "content-type: application/json" -d '{"userId":"dev"}'
curl http://localhost:8787/maintenance
curl -X POST http://localhost:8787/maintenance/dream-due
```

Automatic dream runs when a user's write counter reaches `MEMORY_DREAM_WRITE_THRESHOLD`. After a manual or automatic dream has run once, the backend also treats the user as due when the interval has elapsed and there are new writes. Recommended manual triggers:

- after a long agent session,
- before handing a project to another agent,
- after importing many memories,
- after user corrections or contradiction-heavy work,
- every 6 to 24 hours for always-on local assistants.

The cycle never archives pinned memories or memories protected by lifecycle policy. It fades stale low-utility memories, archives very stale low-utility memories, creates auditable reflection summaries, revalidates behavioral patterns, and reorganizes procedural/transcript memories into more appropriate layers. `POST /lifecycle/preview` reports keep/fade/archive/protect decisions without mutating state.

## MCP Configuration

The local MCP server runs over stdio by default:

```bash
./bin/cognibrain.mjs mcp
```

For remote/shared clients that support MCP Streamable HTTP:

```bash
MCP_PORT=8788 ./bin/cognibrain.mjs mcp --http
```

The Streamable HTTP endpoint is `/mcp` and runs stateless by default so it can sit behind simple local process managers.

For an MCP client that accepts command-based servers, use:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/cognibrain/bin/cognibrain.mjs", "--runtime-root", "/absolute/path/to/project", "mcp"]
}
```

Templates live under `templates/` for Codex, Claude, Copilot, and Cursor.

## Data Storage

The local API and CLI persist through a pluggable storage boundary. Test runs stay in memory unless a test passes an explicit persistence adapter or path.

Default mode uses `MEMORY_DB_PATH` with atomic JSON snapshot writes:

```bash
MEMORY_DB_PATH=.memory-harness.json npm run start:local
```

Durable audit mode appends each saved snapshot to JSONL and reloads the latest valid snapshot. This avoids rewriting the only copy of the store and gives operators a simple recovery trail:

```bash
MEMORY_STORAGE_BACKEND=jsonl MEMORY_EVENT_LOG_PATH=.memory-harness.jsonl npm run start:local
```

SQLite mode stores snapshots transactionally and records each saved payload in an append-only SQL event table:

```bash
MEMORY_STORAGE_BACKEND=sqlite MEMORY_SQLITE_PATH=.memory-harness.sqlite npm run start:local
```

Postgres-compatible mode stores SQL-shaped tables in a local file for CI, offline migration, and teams that need the PostgreSQL contract before connecting a production driver. It reports transactionality, append-only events, logical replication and shard metadata:

```bash
MEMORY_STORAGE_BACKEND=postgres MEMORY_POSTGRES_COMPAT_PATH=.memory-harness.postgres.json npm run start:local
```

CockroachDB can use the same PostgreSQL-compatible contract through `MEMORY_STORAGE_BACKEND=cockroach`; production deployments should set a real PostgreSQL/Cockroach connection driver when one is installed. Cassandra-class storage is reported as a strategy-only target: it is suitable for planning and export/import boundaries, but not selectable as a runtime adapter until a dedicated wide-column adapter exists.

`GET /storage` and `memctl storage` expose the active backend plus adapter capabilities, including durability, transactionality, append-only support, SQL support, replication, sharding and migration safety. JSON, JSONL, SQLite and Postgres-compatible migration paths are covered by tests; Cassandra-class deployments remain an explicitly scoped strategy, not a completed adapter.

## Security And Managed Deployment

Sensitive-memory encryption can be enabled with an explicit key id/version. The key provider report never exposes key material; it only reports scope, key ids, versions, rotation policy and backup refs:

```bash
MEMORY_REDACTION_MODE=encrypt \
MEMORY_ENCRYPTION_KEY="replace-with-secret-manager-value" \
MEMORY_ENCRYPTION_KEY_ID=org-default \
MEMORY_ENCRYPTION_KEY_VERSION=1 \
MEMORY_KEY_SCOPE=org \
npm run cli -- key-provider
```

Before moving a local brain to a hosted or self-hosted runtime, export a bundle and verify encrypted recovery:

```bash
MEMORY_BACKUP_REF=local-backup://2026-05 MEMORY_SSO_PROVIDER=oidc MEMORY_SECRET_MANAGER=vault npm run cli -- migration-export managed > managed-bundle.json
npm run cli -- backup-verify managed-bundle.json
npm run cli -- migration-import managed-bundle.json
```

`doctor --publish` emits a warning when `MEMORY_DEPLOYMENT_MODE=managed`, `self_hosted`, or `production` uses a non-HTTPS `MEMORY_PUBLIC_URL` without `MEMORY_TLS_TERMINATED_BY`. Set `MEMORY_TLS_TERMINATED_BY=ingress` or expose an `https://` public URL before claiming production transport security. Concrete deployment artifacts live in `docker/` and `deploy/kubernetes/cognibrain.yaml`.

Offline clients can queue operations while disconnected and replay them later:

```bash
MEMORY_USER_ID=dev npm run cli -- offline-add "Captured while offline"
MEMORY_USER_ID=dev npm run cli -- sync
```

The sync engine applies add-only writes, uses last-write-wins only when the server copy has not changed since the offline timestamp, and returns manual-review conflicts for stale updates.
