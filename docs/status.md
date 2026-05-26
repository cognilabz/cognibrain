# Production Readiness Status

This matrix is the current truth boundary for Cognibrain. It separates implemented self-hosted product capability from production certification. Generated artifacts are internal CI/build outputs under `artifacts/`; they are ignored by git and excluded from npm packages.

| Feature | Current state | Verification | Claim boundary |
| --- | --- | --- | --- |
| CLI | Stable operator CLI covers setup, status, service, config, connectors and proof without animated TUI rendering. | `npm test`, `npm run audit:structure` | Dashboard remains optional. |
| MCP | MCP server exposes context, coding context, action guard, durable writes, patch evidence and maintenance. | `npm test`, `npm run mcp` | MCP is the primary agent path. |
| SDK/HTTP | HTTP API and typed clients support custom integrations and non-MCP runtimes. | `npm test`, `/openapi.json` | SDK/HTTP is not the recommended primary agent path when MCP exists. |
| Storage | DB-primary row persistence with granular memory writes, SQL rows and append-only events. | `npm test`, `npm run verify:postgres` | Snapshots are retained only as backup/compaction artifacts. |
| Security/Auth | API-key/Bearer auth plus optional JWT/OIDC verifier, route-level RBAC and actor-bound scopes. | `npm test -- tests/api.test.ts` | Deployments own issuer, audience, TLS and identity-provider configuration. |
| Policy | Policy rules exist and Production policy mode default-denies when no rule matches. | `npm test` | DB-level row isolation is still deployment-specific. |
| Connectors | First-party connector drivers are implementation-ready and live-smoke-ready. | `npm run verify:compatibility` | 0 tenant-verified live smokes and 0 production certifications without real credentials and owner certification. |
| Benchmarks | CogniCodeBench, Arena and public benchmark commands exist. | `npm run benchmark:cognicode`, `npm run benchmark:arena` | Synthetic/API-shape rows are not vendor certification or real-customer field proof. |
| Operations | Release check, doctor, service plans and optional Docker packaging exist. | `npm run release:check` | Managed SaaS, autoscaling, billing and hosted support are not claimed. |

## Remaining External Boundaries

- Tenant-verified connector live smokes require real provider credentials and `MEMORY_VENDOR_LIVE_SMOKE=true`.
- Production-certified connector rows require an owner-approved deployment certification artifact.
- Managed SaaS uptime, billing, autoscaling and hosted support are not claimed by this repository.
