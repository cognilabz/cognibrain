# Claims And Evidence

Public claims must stay tied to a command, source file or generated local report. Generated reports live under `artifacts/` and are internal CI/build outputs, not committed product files.

| Claim ID | Claim | Evidence gate | Evidence | Boundary |
| --- | --- | --- | --- | --- |
| CB-CLI-INK | The CLI is the primary operator surface. | `npm test -- tests/cli.test.ts`, `npm run docs:cli-screenshots` | `bin/cognibrain.mjs`, `docs/assets/cli-*.svg` | JSON mode remains for scripts. |
| CB-MCP | MCP is the preferred agent integration surface. | `npm test`, `npm run mcp` | `src/connectors/mcpServer.ts`, `src/connectors/mcpHandlers.ts` | CLI is fallback/operator path. |
| CB-SDK-HTTP | SDK/HTTP supports custom product integrations. | `npm test`, `/openapi.json` | `src/sdk/client.ts`, `sdk/python/README.md`, `src/api/server.ts` | Not the default path for MCP-capable agents. |
| CB-SELF-HOSTED | Cognibrain is self-hostable from npm or checkout. | `npm run verify:selfhosted:claims`, `npm run release:check` | `bootstrap.sh`, `bin/cognibrain.mjs` | Target deployments must rerun gates with their own storage and secrets. |
| CB-CONNECTORS | Native drivers exist for the listed source systems. | `npm run verify:compatibility` | `src/connectors/vendorConnectors.ts` | Credential smoke requires tenant credentials and is environment-specific. |
| CB-COGNICODE | CogniCodeBench verifies correction carry-over across hard synthetic coding-agent scenarios. | `npm run benchmark:cognicode` | Generated local report under `artifacts/` | Synthetic scenarios are not a customer-repo guarantee. |
| CB-ARENA | Benchmark Arena compares systems on the same local scenario stream. | `npm run benchmark:arena` | Generated local report under `artifacts/` | API-shape rows are compatibility models until a stronger proof level is recorded. |
| CB-TRUTH-GATE | Product readiness is audited from code and generated reports before claims are accepted. | `npm run audit:truth`, `cognibrain proof` | `scripts/audit-product-truth.mjs`, generated local reports | The gate passes when claims are honest; reports are internal outputs. |
| CB-PRODUCTION-STATUS | Current production readiness is explicit. | `npm run audit:truth` | `docs/status.md` | Cognibrain is a self-hosted production candidate, not a managed/enterprise SaaS. |
| CB-STORAGE-BOUNDARY | DB-primary row persistence exists with snapshots retained as backup/compaction artifacts. | `npm run verify:postgres`, `npm test -- tests/core.test.ts` | `src/api/persistence.ts` | Target deployments must rerun storage verification on their own database. |
| CB-AUTHZ | API keys, optional JWT/OIDC verifier, route-level RBAC and actor-bound scopes are implemented. | `npm test -- tests/api.test.ts` | `src/api/server.ts`, `tests/api.test.ts` | Deployments own issuer, audience, keys, TLS and managed SSO rollout. |
| CB-DOCKER-OPTIONAL | Docker files are optional deployment packaging. | `npm run audit:truth` | `docker/`, `docs/install.md`, `README.md` | The CLI remains the primary control plane. |
| CB-RELEASE | The repo has a single release gate. | `npm run release:check` | `scripts/release-check.mjs` | Passing locally does not equal a managed SaaS SLA. |

## Explicit Non-Claims

Cognibrain does not currently claim Managed SaaS uptime, billing readiness, hosted support, autoscaling behavior, deployment-specific SSO rollout, DB-level row isolation, tenant live connector certification, production-certified connector rows, vendor-certified competitor benchmark results, native/cloud/CLI proof for API-shape competitor rows, Mem0 cloud results without a Mem0 key, or Graphiti/Zep and Cognee native results without LLM credentials.
