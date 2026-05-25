# Product Overview

cognibrain is a self-hosted memory layer for coding agents. It remembers corrections, repo rules, architecture decisions, review feedback, tool outcomes and runbooks, then gives the next agent the relevant context before it changes code.

The product is useful when a team keeps seeing the same agent mistake:

- the wrong package manager or test command,
- edits to generated files,
- stale migration advice,
- ignored review corrections,
- missing repo-specific architecture rules,
- scattered knowledge across GitHub, Slack, Jira, Confluence, Notion or Linear.

## What You Get

| Surface | What it does |
| --- | --- |
| Setup CLI | React/Ink guided setup, self-hosted profiles, connector stubs, harness config and `doctor --fix`. |
| Memory runtime | Local API, dashboard, MCP tools and durable storage options. |
| Agent integrations | Codex, Claude Code, Cursor, Copilot, VS Code, OpenCode, OpenClaw, LangGraph and CrewAI config generation. |
| Connectors | First-class GitHub, Slack, Discord, Jira, Confluence, Notion and Linear drivers; planned contracts for GitLab, Azure DevOps, Teams and Google apps. |
| Proof | Evidence packs, patch evidence trails, CogniCodeBench, Benchmark Arena and release checks. |

## Fast Path

```bash
npm install
npx cognibrain init
npx cognibrain connector add github
npx cognibrain doctor --fix
npm run demo:first-win
```

For a team profile:

```bash
npx cognibrain init --profile team
npx cognibrain connector add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connector add confluence --set baseUrl=https://example.atlassian.net --set space=ENG
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
