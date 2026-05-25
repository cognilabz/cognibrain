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

Connector configs are credential-safe. They store connector IDs, selected non-secret settings, `env:` references and next commands. They do not store token values.

```bash
npx cognibrain connector add github --set repo=cognilabz/cognibrain
npx cognibrain connector add jira --set baseUrl=https://example.atlassian.net --set project=ENG
npx cognibrain connector add confluence --set baseUrl=https://example.atlassian.net --set space=ENG
npx cognibrain connector add notion --set databaseId=notion_database_id
npx cognibrain connector add linear --set teamId=linear_team_id
```

Planned connector contracts can also be configured as stubs:

```bash
npx cognibrain connector add gitlab --set project=group/project
npx cognibrain connector add azure-devops --set organization=my-org --set project=my-project
npx cognibrain connector add teams --set tenantId=tenant --set channelId=channel
npx cognibrain connector add gmail --set account=engineering@example.com
npx cognibrain connector add google-drive --set root=drive_root_id
npx cognibrain connector add google-calendar --set calendarId=primary
```

## Doctor And Proof

```bash
npx cognibrain doctor --fix
npx cognibrain doctor --publish
npm run verify:compatibility
npm run verify:vendor-connectors
```

`doctor --fix` creates missing setup state, connector directories, harness package metadata and local runtime pieces that are safe to repair automatically.
