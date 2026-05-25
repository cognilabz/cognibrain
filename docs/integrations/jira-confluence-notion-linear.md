# Jira, Confluence, Notion And Linear

cognibrain ships first-class self-hosted vendor drivers for engineering planning and docs systems.

## Setup

```bash
npx cognibrain connector add jira
npx cognibrain connector add confluence
npx cognibrain connector add notion
npx cognibrain connector add linear
npm run verify:vendor-connectors
```

## Environment

| Provider | Required env |
| --- | --- |
| Jira | `MEMORY_JIRA_BASE_URL`, `MEMORY_JIRA_EMAIL`, `MEMORY_JIRA_API_TOKEN`, `MEMORY_JIRA_PROJECT` |
| Confluence | `MEMORY_CONFLUENCE_BASE_URL`, `MEMORY_CONFLUENCE_EMAIL`, `MEMORY_CONFLUENCE_API_TOKEN`, `MEMORY_CONFLUENCE_SPACE` |
| Notion | `MEMORY_NOTION_TOKEN`, `MEMORY_NOTION_DATABASE_ID` |
| Linear | `MEMORY_LINEAR_API_KEY`, `MEMORY_LINEAR_TEAM_ID` |

## What Gets Captured

- Jira and Linear issues become engineering memories with status, assignee, labels and latest-comment context.
- Jira and Linear correction language is tagged as `engineering-correction` and `connector-correction`.
- Confluence and Notion docs become architecture/runbook memories when they include ADR, runbook or architecture-decision language.
- Writeback stays dry-run by default unless `dryRun:false` is passed through the API/CLI flow.

## Live Certification Boundary

`npm run verify:vendor-connectors` proves the driver contract against hermetic fixtures. A tenant may claim live certification only after `npm run verify:vendor-live -- --live` passes with approved target credentials. Do not store credential values in `.cognibrain/connectors/`; the generated files store only `env:` references.

Claim IDs: `CB-CLAIM-CONNECTORS`, `CB-CLAIM-CONNECTOR-MATURITY`.
