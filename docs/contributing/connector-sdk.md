# Connector SDK

Build community connectors that integrate external systems with Cognibrain's memory engine.

## Overview

A connector is a configured integration that can:

- **Ingest** events from external systems → create memories
- **Emit** memory-linked context back to external systems
- **Sync** bidirectional state between systems

## Scaffold a Connector

Use the CLI to generate the boilerplate:

```bash
npx cognibrain sdk platform acme-tracker \
  --kind issue_tracker \
  --direction ingest \
  --auth token \
  --out integrations/acme-tracker
```

This generates:

```
integrations/acme-tracker/
├── manifest.json         # Connector metadata
├── adapter.ts           # TypeScript adapter entrypoint
├── .env.example         # Required environment variables
├── fixtures/            # Test fixtures
│   └── sample-event.json
├── tests/
│   └── adapter.test.ts  # Smoke test
└── README.md            # Connector documentation
```

## Connector Kinds

| Kind | Examples |
|------|----------|
| `issue_tracker` | Jira, Linear, Asana, ClickUp, GitHub Issues |
| `code_host` | GitHub, GitLab, Azure DevOps |
| `chat` | Slack, Discord, Microsoft Teams |
| `docs` | Confluence, Notion, Google Drive |
| `calendar` | Google Calendar |
| `observability` | Sentry, Datadog, PagerDuty, PostHog |
| `email` | Gmail |
| `storage` | PostgreSQL (as connector) |

## Adapter Implementation

### TypeScript Adapter

```typescript
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";

export const acmeTracker = createPlatformIntegration({
  id: "acme-tracker",
  kind: "issue_tracker",
  direction: "ingest",
  version: "1.0.0",

  auth: {
    method: "token",
    envVar: "ACME_API_TOKEN",
    scopes: ["read:issues", "read:comments"],
  },

  rateLimits: {
    requestsPerMinute: 30,
  },

  handlers: {
    async fetchEvents(config) {
      const response = await fetch(`${config.baseUrl}/api/issues`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      const issues = await response.json();

      return issues.map(issue => ({
        externalId: issue.id,
        type: "issue_update",
        content: `[${issue.key}] ${issue.title}: ${issue.status}`,
        timestamp: issue.updatedAt,
        metadata: {
          issueKey: issue.key,
          status: issue.status,
          assignee: issue.assignee,
        },
      }));
    },

    async testConnection(config) {
      const response = await fetch(`${config.baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      return { success: response.ok };
    },
  },
});
```

### Manifest

```json
{
  "id": "acme-tracker",
  "name": "Acme Issue Tracker",
  "kind": "issue_tracker",
  "direction": "ingest",
  "version": "1.0.0",
  "description": "Ingest issue updates from Acme Tracker into Cognibrain memory",
  "auth": {
    "method": "token",
    "envVar": "ACME_API_TOKEN",
    "scopes": ["read:issues", "read:comments"]
  },
  "config": {
    "baseUrl": {
      "type": "string",
      "description": "Acme Tracker API base URL",
      "required": true
    },
    "project": {
      "type": "string",
      "description": "Project key to watch",
      "required": false
    }
  },
  "rateLimits": {
    "requestsPerMinute": 30
  }
}
```

## Quality Guidelines

A good community connector should:

### Required

- [x] Map external records to durable memory fields
- [x] Keep secrets in environment variables (never in code or config files)
- [x] Include a small fixture and smoke test
- [x] Provide a `testConnection` handler for health checks
- [x] Document rate limits and required scopes

### Recommended

- [ ] Provide a dry-run or preview path
- [ ] Handle pagination for large data sets
- [ ] Implement incremental sync (only fetch new events)
- [ ] Include retry logic with exponential backoff
- [ ] Log structured output for debugging

## Testing

### Unit Test

```typescript
import { describe, it, expect } from "vitest";
import { acmeTracker } from "./adapter";

describe("acme-tracker connector", () => {
  it("normalizes issue events to memory fields", () => {
    const events = acmeTracker.handlers.fetchEvents({
      baseUrl: "http://localhost:3000",
      token: "test-token",
    });
    // ...
  });
});
```

### Fixture-Based Testing

Use deterministic fixtures for reproducible tests:

```bash
# Run against fixtures (no network)
npm test -- --filter acme-tracker

# Live smoke (requires credentials)
MEMORY_VENDOR_LIVE_SMOKE=true npm run internal -- verify:vendor-live
```

## Registration

Once your connector is ready, register it:

```bash
npx cognibrain connections add acme-tracker \
  --set baseUrl=https://acme.example.com \
  --token-env ACME_API_TOKEN
```

## Publishing

Community connectors can be:

1. **In-repo** — add to `integrations/` in a Cognibrain fork
2. **Standalone npm package** — publish as `cognibrain-connector-acme-tracker`
3. **PR to upstream** — propose inclusion as a first-party connector
