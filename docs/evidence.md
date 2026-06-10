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
| Arena | `artifacts/arena/run.json` | Current checked result: Cognibrain 1.000 on 300 scenarios; comparison rows carry proof levels and API-shape rows remain claim-blocked diagnostics. |
| Market readiness | `README.md`, `docs/benchmarks.md`, `artifacts/product-truth-audit.json`, `artifacts/realworld-blackbox.json`, `artifacts/operator-memory-benchmark.json` | Current posture: strong engineering-agent diagnostics and proof discipline; market-superiority claims remain blocked until judged original competitor runs, public hashes and independent replication exist. |
| Storage boundary | `src/api/persistence/`, `src/api/repositories/`, `tests/core.test.ts` | Re-run storage checks on the target database. |
| Packaging | `package.json`, `.gitignore`, `operator-ui/LICENSE.md` | Generated outputs and local runtime state are excluded from package contents. |
| Memory OS comparison follow-up | `README.md`, `docs/reference.md`, `templates/codex/cognibrain-skill/SKILL.md`, `bin/lib/harnessRuntime.mjs`, `tests/core.test.ts` | Implemented: stronger factual README, context lifecycle, injection feedback visibility, anti-rediscovery guidance, and evidence-pack truth suppression details. Deferred: optional Qdrant retrieval backend, self-curating wiki pipeline, and a native `memory-os` benchmark runner. |
