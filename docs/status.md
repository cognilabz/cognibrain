# Production Readiness Status

This page summarizes the current self-hosted repository boundary.

| Area | Current status | Evidence gate | Boundary |
| --- | --- | --- | --- |
| CLI | Stable operator CLI covers setup, status, service, config, connectors and proof without animated TUI rendering. | `npm test`, `npm run internal -- audit:structure` | Dashboard remains optional. |
| MCP | Agent-facing tools cover context, coding context, action guard, durable writes, corrections, patch evidence and maintenance. | `npm test`, MCP server source | CLI remains operator/fallback path. |
| Storage | DB-primary row persistence with SQLite/Postgres repositories and backup snapshots. | `npm run internal -- verify:postgres`, tests | Rerun on target database. |
| Auth | API-key/Bearer auth, optional JWT/OIDC verifier, route-level RBAC and actor scopes. | Server source, release contract | Deployment identity configuration is operator-owned. |
| Policy | Production policy mode default-denies when no rule matches. | Core tests, product truth gate | Local/dev modes can be more permissive. |
| Connectors | First-party connector drivers are implementation-ready and live-smoke-ready. | `npm run internal -- verify:compatibility` | 0 tenant-verified live smokes and 0 production certifications without real credentials and owner certification. |
| Benchmarks | CogniCodeBench, Arena and proof gates exist behind the internal runner. | `npm run internal -- benchmark:cognicode`, `npm run internal -- benchmark:arena` | `same-run-api-shape` rows are not vendor certification. |
| Packaging | npm package excludes generated artifacts and local runtime state. | `npm pack --dry-run`, release check | Docker is optional packaging. |

Generated artifacts are internal CI/build outputs under `artifacts/`. They help maintainers review changes but are not packaged as source documentation.

Current non-claims: managed SaaS uptime, hosted support, billing, autoscaling, deployment-specific SSO rollout, tenant-verified connector live smokes and production-certified connector rows.
