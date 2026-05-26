# Connectors, Adapters And SDK

Cognibrain can run as a local agent memory layer, a connector-backed memory hub, or a source-system integration SDK.

## Native Connectors

![Cognibrain connections CLI](assets/cli-connections.svg)

Native drivers are implemented for the systems below. Driver status is not the same as production certification; see the generated [Connector Maturity Matrix](integrations/connector-maturity.md) for fixture, live-smoke, writeback and certification status.

Current checked connector state: 19 hermetic drivers, 19 API/spec-verified drivers, 19 live-smoke-ready drivers, 0 tenant-verified live smokes and 0 production certifications. That means the code has first-party driver paths, fixture proof, API-contract checks for method/path/auth/writeback shape and live-smoke harness support. This checkout has not proven a customer tenant for Jira, Confluence, Notion, Linear or the other vendors.

| Category | Connectors |
| --- | --- |
| Code | GitHub, GitLab, Azure DevOps |
| Chat | Slack, Discord, Microsoft Teams |
| Planning and docs | Jira, Confluence, Notion, Linear |
| Google workspace | Gmail, Google Drive, Google Calendar |
| Work tracking | Asana, ClickUp |
| Operations and product | Sentry, Datadog, PagerDuty and PostHog |

Configure connectors from the CLI:

```bash
npx cognibrain connections add github --set repo=cognilabz/cognibrain
npx cognibrain connections add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connections add slack --set channelId=C123 --token-env MEMORY_SLACK_TOKEN
npx cognibrain connections doctor
```

Configs store non-secret fields and `env:` references. Token values stay in environment variables or deployment secret tooling.

## Adapters

Runtime adapters cover storage, provider intelligence, embeddings, media extraction, benchmark comparison and remote MCP transport.

```bash
npx cognibrain connections add storage-sqlite --set path=.cognibrain/memory.sqlite
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
npx cognibrain connections add intelligence-json-command --command-env MEMORY_INTELLIGENCE_COMMAND
npx cognibrain connections add embedding-openai-compatible --set baseUrl=http://localhost:11434/v1 --set model=text-embedding-3-small
npx cognibrain connections add media-json-command --command-env MEMORY_MEDIA_COMMAND
npx cognibrain connections add mcp-remote --set url=https://memory.example.com/mcp --token-env MEMORY_MCP_REMOTE_TOKEN
```

## Platform SDK

![Cognibrain SDK CLI](assets/cli-sdk.svg)

Use the Platform SDK when the source system is not built in yet:

```bash
npx cognibrain sdk platform acme --kind project_management --out integrations/acme
npx cognibrain memory connector-register "$(cat integrations/acme/acme.connector.json)"
npx tsx integrations/acme/acme.integration.ts
npx cognibrain memory connector-health acme
```

The scaffold includes:

- TypeScript integration code,
- connector manifest,
- `.env.example`,
- local README,
- poll and writeback placeholders,
- normalized event mapping helpers.

## Agent Harnesses

```bash
npx cognibrain config codex
npx cognibrain config all
npx cognibrain skill install
npx cognibrain mcp
```

Supported harness outputs cover Codex, Claude Code, GitHub Copilot, Cursor, VS Code, OpenCode, OpenClaw, LangGraph and CrewAI.

## Verification

```bash
npm run verify:connectors
npm run verify:vendor-connectors
npm run verify:vendor-api-specs
npm run verify:vendor-live
npm run verify:compatibility
npm run connectors:maturity
```

Real live-system proof is opt-in:

```bash
MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live
MEMORY_VENDOR_LIVE_SMOKE=true MEMORY_VENDOR_LIVE_WRITE=true npm run verify:vendor-live
```

The first command lists, polls and dry-runs writeback with tenant credentials. The second can write to real systems and should only run against a controlled test target.

Artifacts:

```text
artifacts/connectors-live.json
artifacts/vendor-connectors-live.json
artifacts/vendor-api-specs.json
artifacts/vendor-live-smoke.json
artifacts/connector-maturity.json
docs/integrations/connector-maturity.md
```
