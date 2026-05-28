# Claims And Evidence

| Claim ID | Claim | Evidence gate | Evidence | Boundary |
| --- | --- | --- | --- | --- |
| CB-CLI | The CLI is the primary operator surface. | `npm test -- tests/cli.test.ts`, `npm run internal -- audit:structure` | `bin/cognibrain.mjs`, `bin/lib/`, `tests/cli.test.ts` | JSON mode remains for scripts; no animated TUI is claimed. |
| CB-HARNESS-CLI | The harness lifecycle CLI is a universal shell-hook integration path for coding agents. | `npm test -- tests/cli.test.ts`, `npm run internal -- harness:maturity` | `bin/lib/lifecycleCli.mjs`, `src/cli/lifecycleLocalDirect.ts`, `tests/cli.test.ts` | Daemon-backed mode is preferred; local-direct is an explicit fallback/dev path. |
| CB-MCP | MCP is the preferred native integration surface for MCP-capable agents. | `npm test`, MCP server smoke | `src/connectors/mcpServer.ts`, `src/connectors/mcpHandlers.ts`, `src/connectors/mcpTools.ts` | Harness CLI is the portable shell-hook path. |
| CB-SDK-HTTP | SDK/HTTP supports custom product integrations. | `npm test`, SDK tests, `/openapi.json` | `sdk/typescript/`, `sdk/python/`, `src/api/server.ts` | Not the default path for MCP-capable agents. |
| CB-SELF-HOSTED | Cognibrain is self-hostable from npm or checkout. | `npm run verify:selfhosted`, `npm run release:check` | `bootstrap.sh`, `bin/cognibrain.mjs`, service commands | Target deployments must rerun gates with their own storage and secrets. |
| CB-CONNECTORS | Native drivers exist for the listed source systems. | `npm run internal -- verify:compatibility` | `src/connectors/vendorConnectors.ts`, connector eval reports | Credential smoke requires tenant credentials and is environment-specific. |
| CB-COGNICODE | CogniCodeBench verifies correction carry-over across hard synthetic coding-agent scenarios. | `npm run internal -- benchmark:cognicode` | Generated local report under `artifacts/` | Synthetic scenarios are not a customer-repo guarantee. |
| CB-ARENA | Benchmark Arena compares systems on the same local scenario stream. | `npm run internal -- benchmark:arena` | Generated local report under `artifacts/` | API-shape rows are compatibility models until a stronger proof level is recorded. |
| CB-TRUTH-GATE | Product readiness is audited from code and generated reports before claims are accepted. | `npm run internal -- audit:truth`, `cognibrain proof` | `scripts/release/audit-product-truth.mjs`, generated local reports | The gate passes when claims are honest; reports are internal outputs. |
| CB-PRODUCTION-STATUS | Current production readiness is explicit. | `npm run internal -- audit:truth` | `docs/status.md`, release scripts, server source | Cognibrain is a self-hosted production candidate, not a managed/enterprise SaaS. |
| CB-STORAGE-BOUNDARY | DB-primary MemoryRepository paths exist for SQLite/Postgres memory rows with service-state row mirrors and snapshots retained as backup/compaction artifacts. | `npm run internal -- verify:postgres`, `npm test -- tests/core.test.ts` | `src/api/persistence/`, `src/api/repositories/` | Fully async event-journal-first runtime across every service domain remains a hardening boundary. Rerun on the target database before production claims. |
| CB-PACKAGING | Generated artifacts and local runtime state are not packaged. | `npm pack --dry-run`, `npm run internal -- audit:docs` | `package.json`, `.gitignore`, release audits | Generated outputs remain local/internal. |
| CB-OPERATOR-UI-COMMERCIAL | The browser Operator UI is a separately licensed opt-in add-on, not part of the MIT package. | `npm pack --dry-run`, `npm run internal -- audit:docs` | `operator-ui/LICENSE.md`, `package.json`, `scripts/operator-ui/start-commercial-ui.mjs` | The open-source CLI remains the default operator surface. |
| CB-DOCKER-OPTIONAL | Docker files are optional deployment packaging. | `npm run internal -- audit:truth` | `docker/`, `deploy/`, `docs/operations.md` | The CLI remains the primary control plane. |

## Explicit Non-Claims

Cognibrain does not currently claim Managed SaaS uptime, hosted support, billing, autoscaling, deployment-specific SSO rollout, tenant-verified connector live smokes, production-certified connector rows, vendor-certified competitor benchmark results or guaranteed performance on every customer repository.
