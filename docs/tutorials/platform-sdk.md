# Platform SDK

Use the Platform SDK when your system is not yet a built-in cognibrain connector or when you want to pilot a private integration before turning it into a native driver.

```bash
npx cognibrain sdk platform acme --kind project_management --out integrations/acme
```

The scaffold creates:

- `acme.integration.ts`: TypeScript code that polls the platform, maps records to memory events, registers the connector, and syncs once.
- `acme.connector.json`: the connector manifest for the local API.
- `.env.example`: credential names; real tokens stay in your shell or secret manager.
- `README.md`: the short runbook for that integration.

## Three-Step Flow

1. Scaffold the integration.

```bash
npx cognibrain sdk platform acme --kind project_management --direction two_way --out integrations/acme
```

2. Map your platform fields.

Edit `integrations/acme/acme.integration.ts` so `poll()` calls your real endpoint and `mapRecord()` maps source records into:

- `externalId`: stable id from the source platform,
- `content`: the decision, correction, incident, task, note or runbook content,
- `url`: source URL for evidence,
- `author`: source actor when available,
- `metadata`: status, labels, team, project, severity or any audit-safe fields.

3. Register and run.

```bash
npx cognibrain start
npx cognibrain memory connector-register "$(cat integrations/acme/acme.connector.json)"
npx tsx integrations/acme/acme.integration.ts
npx cognibrain memory connector-health acme
```

## SDK API

The generated integration uses the shared TypeScript helpers:

```ts
import { createPlatformIntegration, mapPlatformRecord } from "cognibrain/src/connectors/sdk";

export const integration = createPlatformIntegration(
  {
    id: "acme",
    name: "Acme",
    kind: "project_management",
    direction: "two_way",
    envPrefix: "MEMORY_ACME"
  },
  {
    async poll() {
      return [{ id: "task-1", title: "Release decision", body: "Ship after backup proof is green." }];
    },
    mapRecord(record) {
      return mapPlatformRecord(record, { platform: "acme" });
    }
  }
);
```

`createPlatformIntegration()` returns:

- `manifest`: a validated `ConnectorManifest`,
- `pollEvents(scope)`: normalized memory extraction events with source provenance,
- `writeback(payload, dryRun)`: a dry-run writeback plan unless you provide a write handler,
- `health()`: a credential-safe health envelope,
- `adapter`: a `ConnectorAdapter` compatible with the lower-level connector SDK.

## Choosing Built-In, Planned, Or SDK

Use `connector add github`, `connector add slack`, `connector add jira`, `connector add confluence`, `connector add notion` or `connector add linear` when your platform is already a native vendor driver. Use planned connector contracts for GitLab, Azure DevOps, Teams, Google Workspace, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog when their config shape already fits. Use `sdk platform` for everything else: internal tools, customer portals, CRMs, support systems, incident tools, data catalogs, feature flag systems and domain-specific platforms.

The Platform SDK is local-first. It works for self-hosted installs today and keeps the manifest, event shape and writeback contract compatible with a future managed SaaS control plane.
