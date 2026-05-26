# Terminal Memory OS Plan Coverage

This page tracks the connector and TUI plan from `plan.md` as repository documentation. It is the source readers should use to understand what is complete, what is intentionally still open, and which GitHub issue owns each remaining workpackage.

## Current Status

The P0 accuracy loop is implemented and checked:

- connector docs now match the 19 native vendor drivers in `src/connectors/vendorConnectors.ts`,
- `npm run connectors:maturity` generates `artifacts/connector-maturity.json` and `docs/integrations/connector-maturity.md`,
- connector proof levels are explicit: `manifest-only`, `cli-config`, `driver-code`, `hermetic-tested`, `live-smoke-ready`, `tenant-verified`, `production-certified`,
- current checked connector state is 19 hermetic drivers, 19 API/spec-verified drivers, 19 live-smoke-ready drivers, 10 webhook-verified priority drivers, 0 tenant-verified live smokes and 0 production certifications,
- Ink is a real dependency and `cognibrain tui`, `cognibrain ui`, `cognibrain home` are stable entrypoints,
- the Ink action palette executes static commands with an output panel, blocks placeholder commands and requires confirmation for service or destructive actions,
- the connector setup wizard and Memory Ops workbench expose credential-safe previews, validation, review queue, inspect, confirm, retract, evidence, graph and dream commands.

Live tenant proof and production certification remain open until operator credentials and customer-environment evidence exist. Marketing and docs can make strong live-system claims only for `tenant-verified` or `production-certified` connector rows.

## Issue Coverage

| Plan item | Issue | Status | Current repo evidence |
| --- | --- | --- | --- |
| Reconcile connector maturity docs with actual vendorConnectors.ts providers | [#367](https://github.com/cognilabz/cognibrain/issues/367) | Closed | `docs/integrations.md`, `docs/integrations/connector-maturity.md`, `artifacts/connector-maturity.json` |
| Generate connector maturity matrix from code, tests and docs | [#368](https://github.com/cognilabz/cognibrain/issues/368) | Closed | `src/eval/connectorMaturity.ts`, `npm run connectors:maturity` |
| Add connector proof levels: manifest-only to production-certified | [#369](https://github.com/cognilabz/cognibrain/issues/369) | Closed | `src/eval/connectorMaturity.ts`, `bin/cognibrain.mjs doctor --publish`, `docs/integrations/connector-maturity.md` |
| Harden Jira connector: fixtures, live smoke, mappings, TUI setup | [#370](https://github.com/cognilabz/cognibrain/issues/370) | Open | Driver and live-smoke-ready harness exist; production hardening, richer mappings and tenant proof remain. |
| Harden Confluence connector: versioned pages, ADR/runbook extraction, revalidation | [#371](https://github.com/cognilabz/cognibrain/issues/371) | Open | Driver and live-smoke-ready harness exist; versioned extraction and dependent-memory revalidation remain. |
| Harden Notion connector: database mapping, page blocks, writeback, TUI setup | [#372](https://github.com/cognilabz/cognibrain/issues/372) | Open | Driver and live-smoke-ready harness exist; richer database mapping and end-to-end TUI setup remain. |
| Harden Linear connector: issues/comments/projects/cycles and live smoke | [#373](https://github.com/cognilabz/cognibrain/issues/373) | Open | Driver and live-smoke-ready harness exist; cycle/project mapping and tenant proof remain. |
| Harden GitLab and Azure DevOps connectors for MR/PR review feedback and CI outcomes | [#374](https://github.com/cognilabz/cognibrain/issues/374) | Open | Drivers and live-smoke-ready harnesses exist; CI outcome mapping and tenant proof remain. |
| Make Ink TUI a real dependency and stable entrypoint | [#375](https://github.com/cognilabz/cognibrain/issues/375) | Closed | `package.json` includes `ink`; help exposes `cognibrain tui\|ui\|home`; JSON mode remains script-safe. |
| Implement executable TUI action palette | [#376](https://github.com/cognilabz/cognibrain/issues/376) | Closed | `src/cli/inkApp.mjs` executes selected static actions and tests guard placeholder and confirmation behavior. |
| Build full Memory Management TUI | [#377](https://github.com/cognilabz/cognibrain/issues/377) | Implemented foundation | Memory Ops workbench exposes add, search, inspect, confirm, retract, evidence, graph and dream command surfaces; richer form editing can still be a future refinement. |
| Build Connector Setup Wizard in TUI | [#378](https://github.com/cognilabz/cognibrain/issues/378) | Implemented foundation | `connector wizard` / `connector preview` provide validation, credential-safe diff, write command and review queue command; TUI surfaces wizard targets and actions. |
| Build Runtime/Service/Config TUI | [#379](https://github.com/cognilabz/cognibrain/issues/379) | Open | Service/config workbenches exist; full in-TUI config editing and lifecycle control remain. |
| Build Benchmark Arena TUI | [#380](https://github.com/cognilabz/cognibrain/issues/380) | Open | Reports workbench links benchmark commands; background jobs, progress and compare views remain. |
| Add connector event review queue in TUI | [#381](https://github.com/cognilabz/cognibrain/issues/381) | Implemented foundation | Dashboard data exposes pending connector-candidate review items plus inspect, confirm and retract commands; richer edit flows can build on this model. |
| Add connector quality benchmark and score | [#382](https://github.com/cognilabz/cognibrain/issues/382) | Open | Connector rows now expose `qualityScore`; standalone quality benchmark gates remain. |
| Create cross-system Engineering Memory demo: Jira + Confluence + GitHub + Slack/Notion | [#383](https://github.com/cognilabz/cognibrain/issues/383) | Open | Individual connector proof exists; synthetic multi-system demo and live-mode orchestration remain. |

## Verification Loop

Run these when this plan changes:

```bash
npm run connectors:maturity
npm run audit:docs
npm run audit:truth
npm run doctor -- --no-start --no-skill --publish --json
npm run test -- tests/cli.test.ts tests/evaluation.test.ts
```

Run the broader release loop before claiming product completion:

```bash
npm test
npm run build
npm run release:check
npm run verify:nextgen
```
