# Claims And Evidence

Public claims must stay tied to a command, artifact or source file. This page is the short evidence map.

| Claim ID | Claim | Evidence gate | Artifact or source | Boundary |
| --- | --- | --- | --- | --- |
| CB-CLI-INK | The CLI is the primary graphical operator surface. | `npm test -- tests/cli.test.ts`, `npm run docs:cli-screenshots` | `bin/cognibrain.mjs`, `docs/assets/cli-*.svg` | Ink renders in TTY or with `COGNIBRAIN_FORCE_INK=true`; JSON mode remains for scripts. |
| CB-SELF-HOSTED | Cognibrain is self-hostable from npm or checkout. | `npm run verify:selfhosted:claims`, `npm run release:check` | `bootstrap.sh`, `bin/cognibrain.mjs`, `artifacts/release-check.json` | Target deployments must rerun gates with their own storage and secret setup. |
| CB-SERVICE | Native service startup is available for Linux, macOS and Windows. | `npm test -- tests/cli.test.ts` | `cognibrain service plan --platform linux|macos|windows --json` | Service activation is local OS behavior, not hosted orchestration. |
| CB-CONNECTORS | Native drivers exist for the listed source systems. | `npm run verify:vendor-connectors`, `npm run verify:vendor-api-specs` | `src/connectors/vendorConnectors.ts`, `artifacts/vendor-connectors-live.json`, `artifacts/vendor-api-specs.json` | Credential smoke requires tenant credentials and is environment-specific. |
| CB-CONNECTOR-MATURITY | Connector maturity is generated from registry and verification artifacts. | `npm run connectors:maturity` | `artifacts/connector-maturity.json`, `docs/integrations/connector-maturity.md` | Production certification is false unless explicitly proven for a deployment. |
| CB-PLATFORM-SDK | Custom systems can be integrated through an SDK scaffold. | `npm test -- tests/cli.test.ts` | `src/connectors/sdk.ts`, `cognibrain sdk platform` | Generated code still needs platform-specific endpoint mapping. |
| CB-COGNICODE | CogniCodeBench verifies correction carry-over in 100 synthetic coding-agent scenarios. | `npm run benchmark:cognicode` | `artifacts/cognicodebench/run.json` | Synthetic scenarios are not a customer-repo guarantee. |
| CB-ARENA | Benchmark Arena compares Cognibrain with Mem0, Graphiti/Zep, Cognee, LangMem and GBrain on the same local scenario stream. | `npm run benchmark:arena`, `npm run benchmark:competitors:native` | `artifacts/arena/run.json`, `artifacts/arena/native-competitors.json`, `public/benchmark-arena/results.json`, `docs/benchmarks/latest-arena.md` | Mem0, Graphiti/Zep, Cognee and LangMem are same-run-native in the checked artifact, GBrain is same-run-cli, and cloud/vendor certification still needs vendor-specific credentials or signatures. |
| CB-PUBLIC-BENCH | Public benchmark gate runs LoCoMo, LongMemEval-S and BEAM 100K/500K against local baselines. | `npm run benchmark:certified`, `npm run benchmark:market` | `artifacts/locomo-report.json`, `artifacts/longmemeval-report.json`, `artifacts/beam-report.json`, `artifacts/beam-500k-report.json`, `artifacts/market-gate.json` | This proves public-dataset baseline superiority in this checkout, not direct hosted-vendor superiority. |
| CB-TRUTH-GATE | Product readiness is audited from code artifacts before claims are accepted. | `npm run audit:truth`, `cognibrain proof` | `scripts/audit-product-truth.mjs`, `artifacts/product-truth-audit.json`, `bin/cognibrain.mjs` | The gate passes when claims are honest; open implementation gaps can remain visible. |
| CB-DOCKER-OPTIONAL | Docker files are optional deployment packaging, not the required install path. | `npm run audit:truth` | `docker/`, `docs/install.md`, `README.md` | The CLI remains the primary control plane. |
| CB-POSTGRES | Postgres-backed operation has a verifier. | `npm run verify:postgres` | `artifacts/postgres-live.json` | Rerun on the target database before production claims. |
| CB-RELEASE | The repo has a single release gate. | `npm run release:check` | `artifacts/release-check.json` | Passing locally does not equal a managed SaaS SLA. |

## Explicit Non-Claims

Cognibrain does not currently claim Managed SaaS uptime, billing readiness, hosted support, autoscaling behavior, deployment-specific SSO readiness, tenant live connector certification, production-certified connector rows, vendor-certified competitor benchmark results, Mem0 cloud results without a Mem0 key, or Graphiti/Zep and Cognee native results without LLM credentials.

Mem0, Graphiti/Zep, Cognee and LangMem are now checked through real same-run-native package runners. GBrain is checked as a real same-run-cli competitor row. Graphiti/Zep and Cognee used operator-supplied LLM credentials in the checked artifact; no credential value is stored in repo artifacts. Current checked connector state: 19 hermetic drivers, 19 API/spec-verified drivers, 19 live-smoke-ready drivers, 0 tenant-verified live smokes and 0 production certifications.
