# Product Overview

cognibrain is a self-hosted memory layer for coding agents. It remembers corrections, repo rules, architecture decisions, review feedback, tool outcomes and runbooks, then gives the next agent the relevant context before it changes code.

The product is useful when a team keeps seeing the same agent mistake:

- the wrong package manager or test command,
- edits to generated files,
- stale migration advice,
- ignored review corrections,
- missing repo-specific architecture rules,
- scattered knowledge across GitHub, Slack, Jira, Confluence, Notion, Linear, incident tools or product systems.

## What You Get

| Surface | What it does |
| --- | --- |
| CLI product surface | React/Ink `cognibrain` home, self-hosted profiles, memory workbench, connections workbench, service automation, config, harness config, skill lifecycle and `doctor --fix`. |
| Memory runtime | Local API by default, optional dashboard, MCP tools and durable storage options. |
| Agent integrations | Codex, Claude Code, Cursor, Copilot, VS Code, OpenCode, OpenClaw, LangGraph and CrewAI config generation. |
| Connectors | Native drivers for GitHub, Slack, Discord, Jira, Confluence, Notion, Linear, GitLab, Azure DevOps, Teams, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog. |
| Adapters | CLI-configured storage, provider intelligence, embedding, media, benchmark and remote MCP adapter contracts. |
| Proof | Evidence packs, patch evidence trails, CogniCodeBench, Benchmark Arena and release checks. |

## Fast Path

```bash
npm install
npm i @cognilabz/cognibrain
npx cognibrain
npx cognibrain init
npx cognibrain config show --json
npx cognibrain connections add github
npx cognibrain connections add gitlab --set project=group/project
npx cognibrain connections add storage-sqlite
npx cognibrain service plan
npx cognibrain skill status
npx cognibrain doctor --fix
npm run demo:first-win
```

For a team profile:

```bash
npx cognibrain init --profile team
npx cognibrain connections add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connections add confluence --set baseUrl=https://example.atlassian.net --set space=ENG
npx cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
npx cognibrain connections doctor
npm run verify:compatibility
```

## Proof Commands

```bash
npm run verify:nextgen
npm run release:check
npm run benchmark:arena
npm run audit:plan1_5
```

## Claim Boundary

cognibrain is ready to present as a self-hosted production candidate after the target environment passes its gates. Managed SaaS uptime, billing, hosted SSO, autoscaling and tenant-specific vendor certification are deployment-specific claims.
