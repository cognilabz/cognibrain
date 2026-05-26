# Integrations

Cognibrain has three public integration surfaces. Keep them separate; that makes the product easier to understand and easier to operate.

## Surface Contract

| Surface | Use it for | Do not use it for |
| --- | --- | --- |
| MCP | MCP first for agents: context packs, coding context, action guards, durable writes, corrections, patch evidence and maintenance. | Human setup flows or source-system adapter code. |
| CLI | CLI for humans and automation: install, status, config, connectors, service, proof and fallback memory commands. | Long-lived app integrations when SDK/HTTP is available. |
| SDK/HTTP | SDK/HTTP only for app and connector integrations: polling, writeback, dashboards and non-MCP runtimes. | Primary coding-agent memory calls when MCP is available. |

Recommended agent flow:

1. Call `memory_context_pack` or `memory_coding_context_pack`.
2. Call `memory_action_guard` before durable shell or file operations.
3. Write durable corrections and patch evidence after non-trivial work.
4. Use CLI fallback only when MCP is unavailable.

## Native Connectors

Native connector drivers exist for:

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
npx cognibrain connections add mcp-remote --set url=https://memory.example.com/mcp --token-env MEMORY_MCP_REMOTE_TOKEN
```

## Platform SDK

Use the Platform SDK when the source system is not built in yet:

```bash
npx cognibrain sdk platform acme --kind project_management --out integrations/acme
npx cognibrain memory connector-register "$(cat integrations/acme/acme.connector.json)"
npx tsx integrations/acme/acme.integration.ts
npx cognibrain memory connector-health acme
```

The scaffold includes TypeScript integration code, a connector manifest, `.env.example`, local README, poll/writeback placeholders and normalized event mapping helpers.

## Verification

Generated verification reports are local outputs under `artifacts/`.

```bash
npm run verify:compatibility
npm run connectors:maturity
npm run harness:maturity
```

Real live-system proof is opt-in:

```bash
MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live
MEMORY_VENDOR_LIVE_SMOKE=true MEMORY_VENDOR_LIVE_WRITE=true npm run verify:vendor-live
```

The first command lists, polls and dry-runs writeback with tenant credentials. The second can write to real systems and should only run against a controlled test target.
