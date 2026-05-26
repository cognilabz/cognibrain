# Benchmark, Harness And Connector Hardening Plan Coverage

This page tracks the `plan_.md` workpackages against issues #384 through #399 and the checked artifacts in this repo.

## Checked State

| Area | Current artifact | Checked result |
| --- | --- | --- |
| CogniCodeBench v2 | `artifacts/cognicodebench/run.json` | 1,000 hard scenarios, 22,000 generated memory events, 100 selected repo templates, 768 available repo templates, 20 correction types, 12 sessions per scenario, `noiseRatio=0.5`, `staleRatio=0.25`, connector-backed source refs, granular patch models, passed. |
| Benchmark Arena | `artifacts/arena/run.json` | 300 hard scenarios, Cognibrain `same-run-full`, LangMem `same-run-native`, remaining competitor rows `same-run-api-shape`, winner Cognibrain, passed. |
| Harness maturity | `artifacts/harness-maturity.json`, `docs/integrations/harness-maturity.md` | 16 rows, 16 generated harness packages, 10 MCP-capable targets, 13 pre-tool guard targets, 15 correction-capture targets, 15 patch-evidence targets, 16 golden-path demos, 0 planned rows, passed. |
| Connector maturity | `artifacts/connector-maturity.json`, `docs/integrations/connector-maturity.md` | 19 hermetic drivers, 19 API/spec-verified drivers, 19 live-smoke-ready drivers, 10 webhook-verified priority drivers, 0 tenant-verified live smokes, 0 production certifications. |

## Issue Map

| Issue | Workpackage | Status in this checkout |
| --- | --- | --- |
| [#384](https://github.com/cognilabz/cognibrain/issues/384) | CogniCodeBench v2 scale to 1k-10k hard multi-session scenarios | Implemented foundation: `src/eval/cognicode/scenarioFactory.ts`, `--count`, `--scenarios`, `--repos`, `--sessions`, `--difficulty`, 1,000-scenario checked run. 10k is supported by generator shape but not committed as a checked artifact. |
| [#385](https://github.com/cognilabz/cognibrain/issues/385) | Massive noisy memory corpus and stale contradiction traps | Implemented configurable `noiseRatio` and `staleRatio`; hard artifact includes 22,000 generated events. |
| [#386](https://github.com/cognilabz/cognibrain/issues/386) | Connector-backed events | Implemented source refs and connector events for GitHub, Jira, Confluence, Notion, Slack and adjacent connector ids. |
| [#387](https://github.com/cognilabz/cognibrain/issues/387) | Real patch/diff evaluator | Implemented synthetic repo files and granular patch checks for expected files, forbidden files, required patterns and test files. |
| [#388](https://github.com/cognilabz/cognibrain/issues/388) | Hard Arena against competitor adapters | Implemented hard Arena CLI plumbing and 300-scenario artifact. LangMem now records `same-run-native`; remaining competitor rows remain API-shape compatibility models until a stronger proof level is recorded. |
| [#389](https://github.com/cognilabz/cognibrain/issues/389) | Harness maturity matrix | Implemented `npm run harness:maturity`, JSON artifact and generated docs. |
| [#390](https://github.com/cognilabz/cognibrain/issues/390) | Harness E2E golden path | Implemented simulator covering install, context, action guard, telemetry, correction and patch evidence for generated harness rows. |
| [#391](https://github.com/cognilabz/cognibrain/issues/391) | Missing harness targets | Added generated package targets for Windsurf, Continue.dev, Aider, Roo/Cline, Goose, Sourcegraph Amp and Devin-style external-agent JSON-command mode. |
| [#392](https://github.com/cognilabz/cognibrain/issues/392) | Connector maturity source-of-truth | Existing generated connector maturity remains the source of truth and is linked from docs/audits. |
| [#393](https://github.com/cognilabz/cognibrain/issues/393) | Hermetic connector fixtures | Existing `verify:vendor-connectors` artifact covers 19 vendor rows; maturity docs keep fixture proof explicit. |
| [#394](https://github.com/cognilabz/cognibrain/issues/394) | Live smoke support | Existing `verify:vendor-live` artifact keeps tenant proof opt-in and avoids certification claims without credentials. |
| [#395](https://github.com/cognilabz/cognibrain/issues/395) | Semantic engineering memory mapping | Existing maturity quality rows track sourceRef completeness, memory type classification, scope mapping and revalidation. |
| [#396](https://github.com/cognilabz/cognibrain/issues/396) | Connector webhooks | Implemented hermetic webhook proof for 10 priority providers with signature validation, replay protection, normalization, source refs and review-queue paths. |
| [#397](https://github.com/cognilabz/cognibrain/issues/397) | TUI connector setup wizard | Implemented `connector wizard` / `connector preview` JSON preview, safe diff, validation and TUI setup workbench actions. |
| [#398](https://github.com/cognilabz/cognibrain/issues/398) | TUI memory management | Implemented Memory Ops workbench and review-queue model in dashboard data/TUI, with inspect, confirm, retract, evidence, graph and dream command surfaces. |
| [#399](https://github.com/cognilabz/cognibrain/issues/399) | Run hard benchmarks and publish artifacts | Completed for CogniCodeBench, Arena, Arena publish, answer-generation artifact and leaderboard. Answer-generation has 0 questions for these two reports because they do not contain QA-style datasets. |

## Reproduce

```bash
npm run benchmark:cognicode -- --count 1000 --difficulty hard --noise-ratio 0.5 --sessions 12 --repos 100 --stale-ratio 0.25 --connector-mix github,jira,confluence,notion,slack
MEMORY_ARENA_AUTO_NATIVE=false \
MEMORY_ARENA_LANGMEM_COMMAND="$(command -v node) scripts/competitors/native-python-runner.mjs --system langmem" \
MEMORY_ARENA_LANGMEM_PROOF_LEVEL=same-run-native \
npm run benchmark:arena:run -- --count 300 --systems cognibrain,mem0,graphiti,zep,cognee,langmem,gbrain --difficulty hard --noise-ratio 0.5 --sessions 12 --repos 100 --stale-ratio 0.25
npm run benchmark:arena:publish
npm run benchmark:answer-generation -- --reports artifacts/cognicodebench/run.json,artifacts/arena/run.json
npm run leaderboard
npm run connectors:webhooks
npm run connectors:maturity
npm run harness:maturity
```

The native competitor runner path remains available through `npm run benchmark:competitors:native`, but a row should only be described as native, cloud or CLI proof when the checked Arena artifact records that stronger proof level.
