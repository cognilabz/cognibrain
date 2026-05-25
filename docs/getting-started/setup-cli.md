# Setup CLI

The setup CLI is the first-run product path. It uses a React/Ink terminal UI when a real terminal is available and falls back to deterministic text output in CI.

## Guided Install

```bash
npx cognibrain init
```

The wizard asks for:

- install profile: `solo-dev`, `team`, `enterprise` or `benchmark`,
- agent harnesses,
- storage mode,
- auth mode,
- connectors,
- whether to run the first-win demo.

It writes:

- `.cognibrain/setup-state.json`,
- `.cognibrain/connectors/*.json`,
- `.cognibrain/adapters/*.json`,
- MCP or instruction files for selected harnesses,
- `.cognibrain-harness-package.json`.

## Non-Interactive Profiles

```bash
npx cognibrain init --profile solo-dev --yes
npx cognibrain init --profile team --yes
npx cognibrain init --profile enterprise --yes
npx cognibrain init --profile benchmark --yes
```

Aliases also work through `setup`:

```bash
npx cognibrain setup --profile local --yes
npx cognibrain setup --profile production --yes
```

## Connector Setup

Connector configs are credential-safe. They point the built-in native drivers at the right workspace, project, channel or account, store `env:` references for secrets, and never store token values.

```bash
npx cognibrain connector add github --set repo=cognilabz/cognibrain
npx cognibrain connector add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connector add confluence --set baseUrl=https://example.atlassian.net --set space=ENG
npx cognibrain connector add notion --set databaseId=notion_database_id
npx cognibrain connector add linear --set teamId=linear_team_id
npx cognibrain connector add slack --set channelId=C123
npx cognibrain connector add discord --set channelId=D123
npx cognibrain connector list
npx cognibrain connector show github
npx cognibrain connector doctor
```

The same CLI configures the rest of the native vendor drivers:

```bash
npx cognibrain connector add gitlab --set project=group/project
npx cognibrain connector add azure-devops --set organization=my-org --set project=my-project
npx cognibrain connector add teams --set teamId=team --set channelId=channel
npx cognibrain connector add gmail --set account=engineering@example.com
npx cognibrain connector add google-drive --set root=drive_root_id
npx cognibrain connector add google-calendar --set calendarId=primary
npx cognibrain connector add sentry --set organization=my-org --set project=web
npx cognibrain connector add datadog --set site=datadoghq.com --set apiKeyEnv=MEMORY_DATADOG_API_KEY --set appKeyEnv=MEMORY_DATADOG_APP_KEY
npx cognibrain connector add pagerduty --set account=my-team --set service=service_id
npx cognibrain connector add asana --set workspace=workspace_gid --set project=project_gid
npx cognibrain connector add clickup --set listId=list_id
npx cognibrain connector add posthog --set project=project_id
```

Run `npm run verify:vendor-connectors` for hermetic proof that these drivers call the expected vendor APIs. Run `npm run verify:vendor-live -- --live` only in a real deployment with your tenant credentials.

## Platform SDK Scaffold

When a source system is not built in yet, scaffold a custom integration instead of hand-writing a connector from scratch:

```bash
npx cognibrain sdk list
npx cognibrain sdk platform acme --kind project_management --out integrations/acme
npx cognibrain sdk doctor
```

The scaffold creates a TypeScript integration, connector manifest, `.env.example` and local runbook. Edit the generated `poll()` and `mapRecord()` functions, then register the manifest and run one sync:

```bash
npx cognibrain memory connector-register "$(cat integrations/acme/acme.connector.json)"
npx tsx integrations/acme/acme.integration.ts
npx cognibrain memory connector-health acme
```

## Adapter Setup

Adapters are the runtime extension points behind storage, provider intelligence, media extraction, benchmark comparisons and remote MCP transport. They are also configured through the CLI and use the same no-secret-values policy.

```bash
npx cognibrain adapter list
npx cognibrain adapter add storage-sqlite --set path=.cognibrain/memory.sqlite
npx cognibrain adapter add storage-postgres --url-env MEMORY_POSTGRES_URL
npx cognibrain adapter add intelligence-json-command --command-env MEMORY_INTELLIGENCE_COMMAND
npx cognibrain adapter add embedding-openai-compatible --set baseUrl=http://localhost:11434/v1 --set model=text-embedding-3-small
npx cognibrain adapter add media-json-command --command-env MEMORY_MEDIA_COMMAND
npx cognibrain adapter add benchmark-arena
npx cognibrain adapter add mcp-remote --set url=https://memory.example.com/mcp --token-env MEMORY_MCP_REMOTE_TOKEN
npx cognibrain adapter doctor
```

## Config And Skill

Use `config` when you want to inspect or regenerate generated setup files without reading the filesystem manually.

```bash
npx cognibrain config list
npx cognibrain config show --json
npx cognibrain config paths
npx cognibrain config doctor
npx cognibrain config codex
npx cognibrain config all
```

The Codex Skill lifecycle is also CLI-controlled:

```bash
npx cognibrain skill status
npx cognibrain skill install
npx cognibrain skill doctor --fix
npx cognibrain skill path
```

## Doctor And Proof

```bash
npx cognibrain doctor --fix
npx cognibrain doctor --publish
npx cognibrain config doctor
npx cognibrain connector doctor
npx cognibrain adapter doctor
npm run verify:compatibility
npm run verify:vendor-connectors
```

`doctor --fix` creates missing setup state, connector directories, harness package metadata and local runtime pieces that are safe to repair automatically.
