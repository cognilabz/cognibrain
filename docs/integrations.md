# Connectors, SDKs And Community Adapters

Cognibrain has three integration surfaces:

| Surface | Boundary |
| --- | --- |
| MCP first for agents | Agent hosts should retrieve context, run action guards and write patch evidence through MCP. |
| CLI for humans and automation | Operators use the CLI for setup, status, service, connectors, config and proof. |
| SDK/HTTP only for app and connector integrations | Product teams and community maintainers use SDK/HTTP for custom sources, dashboards and non-MCP runtimes. |

## Native Connectors

Native connector definitions exist for GitHub, GitLab, Azure DevOps, Slack, Discord, Teams, Jira, Confluence, Notion, Linear, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog.

```bash
cognibrain connections list
cognibrain connections add github --set repo=cognilabz/cognibrain
cognibrain connections add slack --set channelId=C123 --token-env MEMORY_SLACK_TOKEN
cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL
```

Connector configs store identifiers, URLs and `env:` references. Secrets stay in the environment.

## Connector Maturity Matrix

The maturity gates are generated from connector code and verification scripts. Maintainers can refresh them with:

```bash
npm run internal -- verify:vendor-connectors
npm run internal -- verify:vendor-api-specs
npm run internal -- verify:vendor-live
npm run internal -- connectors:maturity
```

Credential-backed live smoke is opt-in:

```bash
MEMORY_VENDOR_LIVE_SMOKE=true npm run internal -- verify:vendor-live
MEMORY_VENDOR_LIVE_SMOKE=true MEMORY_VENDOR_LIVE_WRITE=true npm run internal -- verify:vendor-live
```

Without tenant credentials, rows can be implementation-ready or credential-blocked, but not tenant-verified.

## Community Adapter SDK

Use the CLI to scaffold a connector-style integration:

```bash
cognibrain sdk platform acme-tracker --kind issue_tracker --direction ingest --auth token --out integrations/acme-tracker
```

The scaffold includes a manifest, TypeScript adapter entrypoint, env example and README. A good community adapter should:

- Map external records to durable memory fields.
- Keep secrets in environment variables.
- Provide a dry-run or preview path.
- Include a small fixture and smoke test.
- Document rate limits and required scopes.

## Harness SDK

For non-MCP agent runners:

```bash
cognibrain sdk harness custom-agent --out integrations/custom-agent
```

Harness adapters should inject context before model calls, run action guards before side effects and write patch evidence after non-trivial changes.

## TypeScript SDK

```ts
import { CognibrainClient } from "@cognilabz/cognibrain/sdk/typescript/client";
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";

const client = new CognibrainClient({ baseUrl: "http://localhost:8787", apiKey: process.env.MEMORY_API_KEY });
const integration = createPlatformIntegration({
  id: "acme-tracker",
  kind: "issue_tracker",
  direction: "ingest",
});
```

## Python SDK

The Python SDK is dependency-free and aimed at Python agent frameworks:

```bash
cd sdk/python
python3 -m pip install .
python3 -m unittest discover -s tests
```

Examples live in `sdk/python/examples/`.
