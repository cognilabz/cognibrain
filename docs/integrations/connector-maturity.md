# Connector Maturity Matrix

Generated from the CLI connector registry and verification artifacts at 2026-05-26T09:07:42.928Z.

Proof levels are ordered as: `manifest-only` -> `cli-config` -> `driver-code` -> `hermetic-tested` -> `live-smoke-ready` -> `tenant-verified` -> `production-certified`.

Native connector means there is a first-party connector manifest and driver path. It does not mean customer production certification unless the production-certified column is true. Marketing can make strong live-system claims only for `tenant-verified` or `production-certified` rows.

Current checked connector state: 19 hermetic drivers, 19 API/spec-verified drivers, 19 live-smoke-ready drivers, 0 tenant-verified live smokes, 0 production certifications, average quality score 100%. Live-system proof requires tenant credentials plus `MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live`.

| Connector | Category | Proof level | Quality | Driver | Fixture | API/spec | Live-smoke ready | Tenant verified | TUI setup | List | Poll | Writeback | Production-certified |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| github | code | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| slack | chat | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| discord | chat | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| jira | planning-docs | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| confluence | planning-docs | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| notion | planning-docs | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| linear | planning-docs | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| gitlab | code | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| azure-devops | code | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| teams | chat | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| gmail | google-workspace | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| google-drive | google-workspace | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| google-calendar | google-workspace | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| asana | work-tracking | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| clickup | work-tracking | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| sentry | operations-product | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| datadog | operations-product | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| pagerduty | operations-product | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |
| posthog | operations-product | live-smoke-ready | 100% | yes | yes | yes | yes | no | yes | yes | yes | yes | no |

Evidence:

- `artifacts/vendor-connectors-live.json` proves hermetic driver/list/poll/writeback paths.
- `artifacts/vendor-api-specs.json` checks method, path shape, auth scheme and writeback calls against codified vendor API contracts.
- `artifacts/vendor-live-smoke.json` records whether tenant credentials were configured, whether live smoke was opted in, and whether token material was retained.
- `npm run connectors:maturity` regenerates this page and `artifacts/connector-maturity.json`.
