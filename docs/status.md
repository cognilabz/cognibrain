# Runtime Status

This page summarizes repository surfaces and their current evidence anchors.

| Surface | Current state | Evidence anchor |
| --- | --- | --- |
| CLI | Text-first operator commands for setup, status, service, config, connectors and proof. | `bin/cognibrain.mjs`, `bin/lib/`, `tests/cli.test.ts` |
| Harness CLI | JSON lifecycle commands for context, guard, outcome, correction, patch evidence, handoff, source revalidation, conflicts and health. | `bin/lib/lifecycleCli.mjs`, `src/cli/lifecycleLocalDirect.ts`, `tests/cli.test.ts` |
| MCP | Agent-facing tools for context packs, coding context, action guards, durable writes, corrections, patch evidence and maintenance. | `src/connectors/mcpServer.ts`, `src/connectors/mcpHandlers.ts`, `src/connectors/mcpTools.ts` |
| Storage | MemoryRepository paths for SQLite and Postgres memory rows with service-state mirrors and backup snapshots. | `src/api/persistence/`, `src/api/repositories/`, `tests/core.test.ts` |
| Auth | API-key/Bearer auth, optional JWT/OIDC verifier, route-level RBAC and actor scopes. | `src/api/server.ts`, `src/api/server/helpers.ts`, `tests/api.test.ts` |
| Connectors | First-party connector definitions and drivers for code, planning, docs, chat, calendar and observability systems. | `src/connectors/vendorConnectors.ts`, `src/connectors/vendor/`, connector reports under `artifacts/` |
| Packaging | npm package excludes generated artifacts, local runtime state and the commercial Operator UI add-on. | `package.json`, `.gitignore`, `operator-ui/LICENSE.md` |

Generated artifacts are local review outputs under `artifacts/` and are not
part of the source documentation package.
