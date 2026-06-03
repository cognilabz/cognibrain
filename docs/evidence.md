# Evidence Register

This register maps repository surfaces to code and artifact anchors. It is not a product narrative.

| Area | Evidence anchor | Notes |
| --- | --- | --- |
| CLI | `bin/cognibrain.mjs`, `bin/lib/`, `tests/cli.test.ts` | Text-first operator path and JSON mode live in source and tests. |
| Harness CLI | `bin/lib/lifecycleCli.mjs`, `src/cli/lifecycleLocalDirect.ts`, `tests/cli.test.ts` | Daemon-backed mode and local-direct fallback are separate paths. |
| MCP | `src/connectors/mcpServer.ts`, `src/connectors/mcpHandlers.ts`, `src/connectors/mcpTools.ts` | Native agent surface for MCP-capable hosts. |
| SDK/HTTP | `sdk/typescript/`, `sdk/python/`, `src/api/server.ts` | Product and custom runtime integration surface. |
| Self-host install | `bootstrap.sh`, `bin/cognibrain.mjs`, service commands | Target deployments need their own storage and secret configuration. |
| Connectors | `src/connectors/vendorConnectors.ts`, `src/connectors/vendor/`, `artifacts/connector-*.json` | Credentialed live checks depend on tenant credentials. |
| CogniCodeBench | `artifacts/cognicodebench/run.json`, `artifacts/cognicodebench/scenarios.json` | Current checked result: 1000 scenarios, `proof=local-diagnostic`, `qualityClaimAllowed=false`; quality claims require `MEMORY_COGNICODEBENCH_QUALITY_JUDGE_COMMAND` and market claims require independent same-run competitor proof. |
| Arena | `artifacts/arena/run.json` | Current checked result: Cognibrain 0.955 on 300 scenarios; comparison rows carry proof levels and API-shape rows remain claim-blocked diagnostics. |
| Storage boundary | `src/api/persistence/`, `src/api/repositories/`, `tests/core.test.ts` | Re-run storage checks on the target database. |
| Packaging | `package.json`, `.gitignore`, `operator-ui/LICENSE.md` | Generated outputs and local runtime state are excluded from package contents. |
