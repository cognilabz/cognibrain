export function connectorDefinitions() {
  return {
    github: {
      connectorId: "official-github",
      requiredEnv: ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "repo", label: "GitHub repo owner/name", env: "MEMORY_GITHUB_REPO", default: process.env.MEMORY_GITHUB_REPO ?? "cognilabz/cognibrain" },
        { name: "tokenEnv", label: "GitHub token", env: "MEMORY_GITHUB_TOKEN", secret: true, default: "MEMORY_GITHUB_TOKEN" }
      ],
      sampleEvents: ["pull-request review correction", "failed GitHub Actions run", "issue or PR memory comment"]
    },
    slack: {
      connectorId: "official-slack",
      requiredEnv: ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "channelId", label: "Slack channel id", env: "MEMORY_SLACK_CHANNEL_ID", default: process.env.MEMORY_SLACK_CHANNEL_ID ?? "C123" },
        { name: "tokenEnv", label: "Slack token", env: "MEMORY_SLACK_TOKEN", secret: true, default: "MEMORY_SLACK_TOKEN" }
      ],
      sampleEvents: ["decision thread", "channel runbook correction", "summary writeback"]
    },
    discord: {
      connectorId: "official-discord",
      requiredEnv: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "channelId", label: "Discord channel id", env: "MEMORY_DISCORD_CHANNEL_ID", default: process.env.MEMORY_DISCORD_CHANNEL_ID ?? "D123" },
        { name: "tokenEnv", label: "Discord bot token", env: "MEMORY_DISCORD_BOT_TOKEN", secret: true, default: "MEMORY_DISCORD_BOT_TOKEN" }
      ],
      sampleEvents: ["support decision", "channel correction", "safe mention-free writeback"]
    },
    jira: {
      connectorId: "official-jira",
      requiredEnv: ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "baseUrl", label: "Jira base URL", env: "MEMORY_JIRA_BASE_URL", default: process.env.MEMORY_JIRA_BASE_URL ?? "https://example.atlassian.net" },
        { name: "project", label: "Jira project key", env: "MEMORY_JIRA_PROJECT", default: process.env.MEMORY_JIRA_PROJECT ?? "ENG" },
        { name: "emailEnv", label: "Jira email", env: "MEMORY_JIRA_EMAIL", secret: true, default: "MEMORY_JIRA_EMAIL" },
        { name: "tokenEnv", label: "Jira API token", env: "MEMORY_JIRA_API_TOKEN", secret: true, default: "MEMORY_JIRA_API_TOKEN" }
      ],
      sampleEvents: ["issue correction", "status/label metadata", "memory summary comment"]
    },
    confluence: {
      connectorId: "official-confluence",
      requiredEnv: ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "baseUrl", label: "Confluence base URL", env: "MEMORY_CONFLUENCE_BASE_URL", default: process.env.MEMORY_CONFLUENCE_BASE_URL ?? "https://example.atlassian.net" },
        { name: "space", label: "Confluence space key", env: "MEMORY_CONFLUENCE_SPACE", default: process.env.MEMORY_CONFLUENCE_SPACE ?? "ENG" },
        { name: "emailEnv", label: "Confluence email", env: "MEMORY_CONFLUENCE_EMAIL", secret: true, default: "MEMORY_CONFLUENCE_EMAIL" },
        { name: "tokenEnv", label: "Confluence API token", env: "MEMORY_CONFLUENCE_API_TOKEN", secret: true, default: "MEMORY_CONFLUENCE_API_TOKEN" }
      ],
      sampleEvents: ["architecture decision page", "runbook page", "versioned page comment"]
    },
    notion: {
      connectorId: "official-notion",
      requiredEnv: ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "databaseId", label: "Notion database id", env: "MEMORY_NOTION_DATABASE_ID", default: process.env.MEMORY_NOTION_DATABASE_ID ?? "notion_database_id" },
        { name: "tokenEnv", label: "Notion token", env: "MEMORY_NOTION_TOKEN", secret: true, default: "MEMORY_NOTION_TOKEN" }
      ],
      sampleEvents: ["decision row", "product spec", "meeting note block"]
    },
    linear: {
      connectorId: "official-linear",
      requiredEnv: ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "teamId", label: "Linear team id", env: "MEMORY_LINEAR_TEAM_ID", default: process.env.MEMORY_LINEAR_TEAM_ID ?? "team_id" },
        { name: "tokenEnv", label: "Linear API key", env: "MEMORY_LINEAR_API_KEY", secret: true, default: "MEMORY_LINEAR_API_KEY" }
      ],
      sampleEvents: ["issue correction", "cycle/project metadata", "commentCreate writeback"]
    },
    gitlab: {
      connectorId: "official-gitlab",
      requiredEnv: ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "project", label: "GitLab project path", env: "MEMORY_GITLAB_PROJECT", default: "group/project" },
        { name: "tokenEnv", label: "GitLab token", env: "MEMORY_GITLAB_TOKEN", secret: true, default: "MEMORY_GITLAB_TOKEN" }
      ],
      sampleEvents: ["merge request correction", "pipeline failure", "issue comment"]
    },
    "azure-devops": {
      connectorId: "official-azure-devops",
      requiredEnv: ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "organization", label: "Azure DevOps org", env: "MEMORY_AZURE_DEVOPS_ORG", default: "organization" },
        { name: "project", label: "Azure DevOps project", env: "MEMORY_AZURE_DEVOPS_PROJECT", default: "project" },
        { name: "tokenEnv", label: "Azure DevOps PAT", env: "MEMORY_AZURE_DEVOPS_TOKEN", secret: true, default: "MEMORY_AZURE_DEVOPS_TOKEN" }
      ],
      sampleEvents: ["work item correction", "pull request review", "pipeline failure"]
    },
    teams: {
      connectorId: "official-microsoft-teams",
      requiredEnv: ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "teamId", label: "Microsoft Teams team id", env: "MEMORY_TEAMS_TEAM_ID", default: "team_id" },
        { name: "channelId", label: "Teams channel id", env: "MEMORY_TEAMS_CHANNEL_ID", default: "channel_id" },
        { name: "tokenEnv", label: "Teams token", env: "MEMORY_TEAMS_TOKEN", secret: true, default: "MEMORY_TEAMS_TOKEN" }
      ],
      sampleEvents: ["channel decision", "incident learning", "message writeback"]
    },
    gmail: {
      connectorId: "official-gmail",
      requiredEnv: ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "account", label: "Gmail account", env: "MEMORY_GMAIL_ACCOUNT", default: "engineering@example.com" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["email thread decision", "support correction", "label summary"]
    },
    "google-drive": {
      connectorId: "official-google-drive",
      requiredEnv: ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "root", label: "Drive folder/root id", env: "MEMORY_GOOGLE_DRIVE_ROOT", default: "drive_root_id" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["design doc", "runbook file", "policy document"]
    },
    "google-calendar": {
      connectorId: "official-google-calendar",
      requiredEnv: ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "calendarId", label: "Calendar id", env: "MEMORY_GOOGLE_CALENDAR_ID", default: "primary" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["release meeting", "incident review", "architecture council note"]
    },
    asana: {
      connectorId: "official-asana",
      requiredEnv: ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "workspace", label: "Asana workspace", env: "MEMORY_ASANA_WORKSPACE", default: "workspace_gid" },
        { name: "project", label: "Asana project", env: "MEMORY_ASANA_PROJECT", default: "project_gid" },
        { name: "tokenEnv", label: "Asana token", env: "MEMORY_ASANA_TOKEN", secret: true, default: "MEMORY_ASANA_TOKEN" }
      ],
      sampleEvents: ["project task correction", "goal status update", "handoff comment"]
    },
    clickup: {
      connectorId: "official-clickup",
      requiredEnv: ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "listId", label: "ClickUp list id", env: "MEMORY_CLICKUP_LIST_ID", default: "list_id" },
        { name: "tokenEnv", label: "ClickUp token", env: "MEMORY_CLICKUP_TOKEN", secret: true, default: "MEMORY_CLICKUP_TOKEN" }
      ],
      sampleEvents: ["task correction", "sprint status", "implementation checklist"]
    },
    sentry: {
      connectorId: "official-sentry",
      requiredEnv: ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "organization", label: "Sentry organization", env: "MEMORY_SENTRY_ORG", default: "organization" },
        { name: "project", label: "Sentry project", env: "MEMORY_SENTRY_PROJECT", default: "project" },
        { name: "tokenEnv", label: "Sentry token", env: "MEMORY_SENTRY_TOKEN", secret: true, default: "MEMORY_SENTRY_TOKEN" }
      ],
      sampleEvents: ["release regression", "issue triage note", "root-cause correction"]
    },
    datadog: {
      connectorId: "official-datadog",
      requiredEnv: ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "site", label: "Datadog site", env: "MEMORY_DATADOG_SITE", default: "datadoghq.com" },
        { name: "apiKeyEnv", label: "Datadog API key", env: "MEMORY_DATADOG_API_KEY", secret: true, default: "MEMORY_DATADOG_API_KEY" },
        { name: "appKeyEnv", label: "Datadog app key", env: "MEMORY_DATADOG_APP_KEY", secret: true, default: "MEMORY_DATADOG_APP_KEY" }
      ],
      sampleEvents: ["incident metric link", "monitor change", "runbook correction"]
    },
    pagerduty: {
      connectorId: "official-pagerduty",
      requiredEnv: ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "account", label: "PagerDuty account/subdomain", env: "MEMORY_PAGERDUTY_ACCOUNT", default: "team" },
        { name: "service", label: "PagerDuty service id", env: "MEMORY_PAGERDUTY_SERVICE_ID", default: "service_id" },
        { name: "tokenEnv", label: "PagerDuty token", env: "MEMORY_PAGERDUTY_TOKEN", secret: true, default: "MEMORY_PAGERDUTY_TOKEN" }
      ],
      sampleEvents: ["incident postmortem", "escalation policy correction", "service ownership note"]
    },
    posthog: {
      connectorId: "official-posthog",
      requiredEnv: ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/guides/connectors.md#first-party-connectors",
      status: "vendor-driver",
      fields: [
        { name: "project", label: "PostHog project id", env: "MEMORY_POSTHOG_PROJECT", default: "project_id" },
        { name: "baseUrl", label: "PostHog base URL", env: "MEMORY_POSTHOG_BASE_URL", default: "https://app.posthog.com" },
        { name: "tokenEnv", label: "PostHog token", env: "MEMORY_POSTHOG_TOKEN", secret: true, default: "MEMORY_POSTHOG_TOKEN" }
      ],
      sampleEvents: ["feature flag decision", "product analytics finding", "experiment follow-up"]
    }
  };
}

export function adapterDefinitions() {
  return {
    "intelligence-json-command": {
      adapterId: "intelligence-json-command",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_INTELLIGENCE_COMMAND"],
      verification: "cognibrain connections adapters doctor intelligence-json-command",
      docs: "docs/integrations.md#adapters",
      fields: [
        { name: "commandEnv", label: "JSON command env var", env: "MEMORY_INTELLIGENCE_COMMAND", secret: true, default: "MEMORY_INTELLIGENCE_COMMAND" },
        { name: "tasks", label: "Tasks", env: "MEMORY_INTELLIGENCE_TASKS", default: "extract,translate,expand,rerank,verify,contradiction,summarize" }
      ],
      sampleEvents: ["rerank candidate memories", "verify contradiction warnings", "summarize timeline window"]
    },
    "embedding-openai-compatible": {
      adapterId: "embedding-openai-compatible",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_EMBEDDING_BASE_URL", "MEMORY_EMBEDDING_MODEL", "MEMORY_EMBEDDING_API_KEY"],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/integrations.md#adapters",
      fields: [
        { name: "baseUrl", label: "Embedding base URL", env: "MEMORY_EMBEDDING_BASE_URL", default: "http://localhost:11434/v1" },
        { name: "model", label: "Embedding model", env: "MEMORY_EMBEDDING_MODEL", default: "text-embedding-3-small" },
        { name: "apiKeyEnv", label: "Embedding API key", env: "MEMORY_EMBEDDING_API_KEY", secret: true, default: "MEMORY_EMBEDDING_API_KEY" }
      ],
      sampleEvents: ["semantic recall", "hybrid ranking", "privacy-disabled fallback"]
    },
    "media-json-command": {
      adapterId: "media-json-command",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_MEDIA_COMMAND"],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/integrations.md#adapters",
      fields: [
        { name: "commandEnv", label: "Media command env var", env: "MEMORY_MEDIA_COMMAND", secret: true, default: "MEMORY_MEDIA_COMMAND" },
        { name: "tasks", label: "Tasks", env: "MEMORY_MEDIA_TASKS", default: "asr,ocr,pdf,video-frames,translate" }
      ],
      sampleEvents: ["audio transcript memory", "image OCR decision", "video-frame evidence"]
    },
    "storage-sqlite": {
      adapterId: "storage-sqlite",
      kind: "storage",
      status: "built-in",
      requiredEnv: [],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/operations.md#storage",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "sqlite" },
        { name: "path", label: "SQLite path", env: "MEMORY_DB_PATH", default: ".cognibrain/memory.sqlite" }
      ],
      sampleEvents: ["transactional local memory", "FTS5 lexical search", "desktop self-hosted store"]
    },
    "storage-postgres": {
      adapterId: "storage-postgres",
      kind: "storage",
      status: "remote-driver",
      requiredEnv: ["MEMORY_POSTGRES_URL"],
      verification: "npm run verify:postgres",
      docs: "docs/operations.md#storage",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "postgres-db-primary" },
        { name: "urlEnv", label: "Postgres URL", env: "MEMORY_POSTGRES_URL", secret: true, default: "MEMORY_POSTGRES_URL" }
      ],
      sampleEvents: ["team shared memory", "remote tsvector search", "backup-ready production store"]
    },
    "storage-cassandra": {
      adapterId: "storage-cassandra",
      kind: "storage",
      status: "remote-driver",
      requiredEnv: [],
      verification: "cognibrain connections adapters doctor storage-cassandra",
      docs: "docs/operations.md#storage",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "cassandra-remote" },
        { name: "contactPoints", label: "Cassandra contact points", env: "MEMORY_CASSANDRA_CONTACT_POINTS", default: "127.0.0.1:9042" },
        { name: "keyspace", label: "Cassandra keyspace", env: "MEMORY_CASSANDRA_KEYSPACE", default: "cognibrain" }
      ],
      sampleEvents: ["wide-column memory snapshot", "multi-region partition", "distributed audit log"]
    },
    "benchmark-arena": {
      adapterId: "benchmark-arena",
      kind: "benchmark",
      status: "built-in",
      requiredEnv: [],
      verification: "npm run benchmark:arena",
      docs: "docs/benchmarks.md#benchmark-arena",
      fields: [
        { name: "systems", label: "Systems", env: "MEMORY_ARENA_SYSTEMS", default: "mem0,graphiti,zep,cognee,langmem,gbrain" },
        { name: "proofLevel", label: "Proof level", env: "MEMORY_ARENA_PROOF_LEVEL", default: "same-run-api-shape" }
      ],
      sampleEvents: ["same-run adapter comparison", "declared gap row", "public proof artifact"]
    },
    "mcp-remote": {
      adapterId: "mcp-remote",
      kind: "transport",
      status: "available-contract",
      requiredEnv: ["MEMORY_MCP_REMOTE_URL"],
      verification: "cognibrain connections adapters doctor mcp-remote",
      docs: "docs/integrations.md#agent-harnesses",
      fields: [
        { name: "url", label: "Remote MCP URL", env: "MEMORY_MCP_REMOTE_URL", default: "https://memory.example.com/mcp" },
        { name: "tokenEnv", label: "Remote MCP token", env: "MEMORY_MCP_REMOTE_TOKEN", secret: true, default: "MEMORY_MCP_REMOTE_TOKEN" }
      ],
      sampleEvents: ["remote agent context pack", "shared MCP tool call", "browser-client session"]
    }
  };
}
