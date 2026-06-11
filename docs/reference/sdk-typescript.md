# TypeScript SDK

The TypeScript SDK provides programmatic access to Cognibrain for product integrations, custom connectors, and non-CLI agent runtimes.

## Installation

The SDK is included in the main package:

```bash
npm i @cognilabz/cognibrain
```

## Imports

```typescript
import { CognibrainClient } from "@cognilabz/cognibrain/sdk/typescript/client";
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";
import { CognibrainHarnessSdk } from "@cognilabz/cognibrain/sdk/typescript/harness";
```

## Client

### Initialization

```typescript
import { CognibrainClient } from "@cognilabz/cognibrain/sdk/typescript/client";

const client = new CognibrainClient({
  baseUrl: "http://localhost:8787",
  apiKey: process.env.MEMORY_API_KEY,
});
```

### Memory Operations

#### Add a Memory

```typescript
const memory = await client.memories.add({
  content: "Always run tests before release",
  scope: "repo",
});
```

#### List Memories

```typescript
const memories = await client.memories.list({
  scope: "repo",
  limit: 50,
});
```

#### Get Coding Context

```typescript
const context = await client.memories.codingContext({
  task: "prepare the release patch",
  tokenBudget: 1200,
});
```

### Lifecycle Operations

#### Request Context Pack

```typescript
const pack = await client.context({
  task: "fix auth token refresh",
  repo: "cognilabz/cognibrain",
});
```

#### Guard an Action

```typescript
const result = await client.guard({
  action: "edit src/api/server.ts",
});

if (!result.allowed) {
  console.warn("Action blocked:", result.warnings);
}
```

#### Record Outcome

```typescript
await client.outcome({
  command: "npm test",
  exitCode: 0,
});
```

#### Record Patch Evidence

```typescript
await client.patchEvidence({
  task: "release patch",
  files: ["package.json", "CHANGELOG.md"],
  commands: ["npm test", "npm run build"],
});
```

### Evidence Pack

```typescript
const evidence = await client.evidencePack({
  userId: "dev",
  query: "What should I remember before release?",
  tokenBudget: 900,
});

console.log(evidence.context);
```

## Connector SDK

### Creating a Platform Integration

```typescript
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";

const integration = createPlatformIntegration({
  id: "acme-tracker",
  kind: "issue_tracker",
  direction: "ingest",
  auth: {
    method: "token",
    envVar: "ACME_TOKEN",
  },
  handlers: {
    async fetchEvents(config) {
      // Fetch events from your system
      return events.map(e => ({
        type: "issue_update",
        content: e.summary,
        timestamp: e.updatedAt,
      }));
    },
  },
});
```

### Integration Manifest

Every connector integration requires a manifest:

```typescript
const manifest = {
  id: "acme-tracker",
  name: "Acme Issue Tracker",
  kind: "issue_tracker",
  direction: "ingest",
  version: "1.0.0",
  auth: {
    method: "token",
    scopes: ["read:issues"],
  },
  rateLimits: {
    requestsPerMinute: 30,
  },
};
```

## Harness SDK

For non-MCP agent runtimes that need programmatic lifecycle access:

```typescript
import { CognibrainHarnessSdk } from "@cognilabz/cognibrain/sdk/typescript/harness";

const harness = new CognibrainHarnessSdk({
  baseUrl: "http://localhost:8787",
  apiKey: process.env.MEMORY_API_KEY,
});

// Before work
const context = await harness.getContext({ task: "fix auth" });

// Before risky action
const guard = await harness.checkGuard({ action: "npm test" });

// After work
await harness.recordOutcome({ command: "npm test", exitCode: 0 });
await harness.recordPatchEvidence({ task: "fix auth", files: ["src/auth.ts"] });

// End session
await harness.endSession({ runDreamIfDue: true });
```

## Error Handling

```typescript
import { CognibrainClient, CognibrainError } from "@cognilabz/cognibrain/sdk/typescript/client";

try {
  await client.memories.add({ content: "test" });
} catch (error) {
  if (error instanceof CognibrainError) {
    console.error(`Cognibrain error [${error.code}]: ${error.message}`);
  }
}
```

## TypeScript Types

Key types exported by the SDK:

```typescript
interface MemoryItem {
  id: string;
  content: string;
  scope: "repo" | "user" | "global" | "task";
  status: "active" | "stale" | "review" | "archived";
  createdAt: string;
  lastRecalledAt: string | null;
}

interface ContextPack {
  context: string;
  memoriesUsed: number;
  tokenCount: number;
}

interface GuardResult {
  allowed: boolean;
  warnings: string[];
  blockers: string[];
}

interface PatchEvidence {
  evidenceId: string;
  task: string;
  files: string[];
  commands: string[];
  memoriesUsed: string[];
}
```
