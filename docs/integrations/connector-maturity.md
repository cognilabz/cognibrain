# Connector Maturity Matrix

Generated from the CLI connector registry and verification artifacts at 2026-05-26T05:27:38.189Z.

Native connector means there is a first-party connector manifest and driver path. It does not mean customer production certification unless the production-certified column is true.

Current checked connector state: 19 hermetic drivers, 19 API/spec-verified drivers, 0 tenant live smokes, 0 production certifications. Live-system proof requires tenant credentials plus `MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live`.

| Connector | Category | Proof level | Driver | Fixture | API/spec | Live smoke | Setup wizard | Poll/list | Writeback | Production-certified |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| github | code | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| slack | chat | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| discord | chat | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| jira | planning-docs | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| confluence | planning-docs | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| notion | planning-docs | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| linear | planning-docs | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| gitlab | code | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| azure-devops | code | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| teams | chat | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| gmail | google-workspace | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| google-drive | google-workspace | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| google-calendar | google-workspace | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| asana | work-tracking | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| clickup | work-tracking | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| sentry | operations-product | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| datadog | operations-product | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| pagerduty | operations-product | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |
| posthog | operations-product | hermetic-driver | yes | yes | yes | no | yes | yes | yes | no |

Evidence:

- `artifacts/vendor-connectors-live.json` proves hermetic driver/list/poll/writeback paths.
- `artifacts/vendor-api-specs.json` checks method, path shape, auth scheme and writeback calls against codified vendor API contracts.
- `artifacts/vendor-live-smoke.json` records whether tenant credentials were configured and live smoke was opted in.
- `npm run connectors:maturity` regenerates this page and `artifacts/connector-maturity.json`.
