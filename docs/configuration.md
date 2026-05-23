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
| `MEMORY_AUTO_DREAM` | `true` | Set to `false` to disable automatic dream-cycle maintenance |
| `MEMORY_DREAM_INTERVAL_HOURS` | `6` | Interval for due background dream checks after new writes |
| `MEMORY_DREAM_WRITE_THRESHOLD` | `12` | Number of writes for a user before automatic dream runs |
| `MEMORY_DREAM_CHECK_INTERVAL_MINUTES` | `15` | API server interval for scanning due dream cycles |
| `MEMORY_REDACTION_MODE` | `redact` | `redact`, `reject`, `archive`, or `off` for sensitive-memory handling |
| `MEMORY_DEFAULT_TOKEN_BUDGET` | `900` | Suggested context budget for harness connectors |
| `MEMORY_NEVER_STORE_SECRETS` | `true` | Policy flag host connectors should honor before writing memories |

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
- trust and importance,
- graph boost through shared entities,
- typed relationship hints,
- access frequency,
- evidence gating so trust alone cannot retrieve unrelated memories.

The default benchmarked profile is semantic `0.26`, keyword `0.24`, entity `0.16`, temporal `0.08`, trust `0.18`, graph `0.06`, and access `0.02`. API search requests and service constructors can pass weight overrides; values are normalized before scoring.

Search can also receive optional reranker and verifier implementations in the TypeScript API. The built-in reranker is deterministic and favors candidates with stronger post-retrieval query coverage before the verifier marks stale or contradiction-tagged results for warning or review. External cross-encoder, LLM, or NLI components can plug into the same interfaces.

The learned-weight path starts from feedback events. Use `memory feedback <id> helpful`, `wrong`, `always_include`, or `never_include` to change bounded trust and importance. Future learned profiles can use the same event stream to tune per-user or per-organization weights.

## Privacy And Retention

The default redaction layer catches common API keys, tokens, private keys, credentials, high-entropy tokens, and email addresses. `redact` preserves useful context while replacing sensitive spans. `reject` blocks the write. `archive` stores the redacted memory and archives it immediately.

Consent metadata controls retrieval visibility. Private memories are excluded unless a caller explicitly asks for private memory; org-visible memories remain scoped to the matching organization. Retention dates are respected by search and can be paired with export/delete APIs.

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

The cycle never archives pinned memories. It fades stale low-utility memories, archives very stale low-utility memories, creates auditable reflection summaries, and reorganizes procedural/transcript memories into more appropriate layers.

## MCP Configuration

The local MCP server runs over stdio:

```bash
./bin/cognibrain.mjs mcp
```

For an MCP client that accepts command-based servers, use:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/cognibrain/bin/cognibrain.mjs", "--runtime-root", "/absolute/path/to/project", "mcp"]
}
```

Templates live under `templates/` for Codex, Claude, Copilot, and Cursor.

## Data Storage

The local API and CLI persist to `MEMORY_DB_PATH` using an atomic JSON write. Test runs stay in memory unless a test passes an explicit persistence path.

Production storage options to add next:

- SQLite for a single-user local daemon,
- Postgres for team deployment,
- optional vector index for embeddings,
- append-only event log for auditability.
