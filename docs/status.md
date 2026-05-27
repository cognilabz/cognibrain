# Production Readiness Status

This page summarizes the current self-hosted repository boundary.

| Feature | Current state | Verification | Claim boundary |
| --- | --- | --- | --- |
| CLI | Stable operator CLI covers setup, status, service, config, connectors and proof without animated TUI rendering. | `npm test`, `npm run internal -- audit:structure` | Dashboard remains optional. |
| Harness CLI | JSON-first lifecycle commands cover context, guard, outcome, correction, patch evidence, dream/session/release, source revalidation, conflicts and health for shell-hook capable agents. | `npm test -- tests/cli.test.ts`, `npm run internal -- harness:maturity` | Daemon-backed mode is preferred; local-direct is explicit fallback/dev mode. |
| MCP | Agent-facing tools cover context, coding context, action guard, durable writes, corrections, patch evidence and maintenance. | `npm test`, MCP server source | Harness CLI remains the portable shell-hook path. |
| Storage | DB-primary MemoryRepository paths for SQLite/Postgres memory rows with service-state row mirrors and backup snapshots. | `npm run internal -- verify:postgres`, tests | Fully async event-journal-first runtime across every service domain remains the hardening boundary; rerun on target database. |
| Auth | API-key/Bearer auth, optional JWT/OIDC verifier, route-level RBAC and actor scopes. | Server source, release contract | Deployment identity configuration is operator-owned. |
| Policy | Production policy mode default-denies when no rule matches. | Core tests, product truth gate | Local/dev modes can be more permissive. |
| Connectors | Native connector drivers exist and first-party connector drivers are implementation-ready and live-smoke-ready. | `npm run internal -- verify:compatibility` | 0 tenant-verified live smokes and 0 production certifications without real credentials and owner certification. |
| Benchmarks | CogniCodeBench, Arena and proof gates exist behind the internal runner. | `npm run internal -- benchmark:cognicode`, `npm run internal -- benchmark:arena` | `same-run-api-shape` rows are not vendor certification. |
| Packaging | npm package excludes generated artifacts and local runtime state. | `npm pack --dry-run`, release check | Docker is optional packaging. |

Generated artifacts are internal CI/build outputs under `artifacts/`. They help maintainers review changes but are not packaged as source documentation.

Current non-claims: managed SaaS uptime, hosted support, billing, autoscaling, deployment-specific SSO rollout, tenant-verified connector live smokes and production-certified connector rows. DB-level row isolation is still deployment-specific and must be verified in the operator's target database and tenancy model.
