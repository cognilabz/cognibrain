# Testing

Cognibrain's test strategy covers unit tests, integration tests, benchmark verification, and connector smoke tests.

## Running Tests

### Quick Test Run

```bash
npm test
```

This runs the full Vitest test suite.

### Full Verification

```bash
npm run verify
```

Includes linting, type checking, tests, and build verification.

### Watch Mode

```bash
npx vitest --watch
```

## Test Structure

```
tests/
├── cli.test.ts         # CLI command tests
├── core.test.ts        # Memory engine, retrieval, graph
├── api.test.ts         # HTTP API endpoints
├── mcp.test.ts         # MCP server and tools
├── connectors.test.ts  # Connector drivers
└── sdk.test.ts         # SDK client tests
```

## Writing Tests

### Unit Tests

Use Vitest for all unit and integration tests:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("MemoryEngine", () => {
  let engine: MemoryEngine;

  beforeEach(() => {
    engine = createTestEngine();
  });

  it("stores and retrieves a memory", async () => {
    const id = await engine.add({ content: "test", scope: "repo" });
    const memory = await engine.get(id);
    expect(memory.content).toBe("test");
  });

  it("retrieves relevant context within token budget", async () => {
    await engine.add({ content: "Use npm test before release", scope: "repo" });
    await engine.add({ content: "Database uses UUIDs", scope: "repo" });

    const pack = await engine.getContext({ task: "prepare release", budget: 500 });
    expect(pack.memoriesUsed).toBeGreaterThan(0);
    expect(pack.tokenCount).toBeLessThanOrEqual(500);
  });
});
```

### Testing CLI Commands

```typescript
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("CLI", () => {
  it("status returns valid JSON", () => {
    const output = execSync("./bin/cognibrain.mjs status --json", {
      encoding: "utf-8",
    });
    const status = JSON.parse(output);
    expect(status).toHaveProperty("healthy");
  });
});
```

### Testing Connectors

```typescript
import { describe, it, expect } from "vitest";
import sampleEvent from "../fixtures/github-push.json";

describe("GitHub connector", () => {
  it("normalizes push events to memory fields", () => {
    const memories = normalizeGitHubEvent(sampleEvent);
    expect(memories[0]).toMatchObject({
      type: "code_push",
      content: expect.stringContaining("main"),
    });
  });
});
```

## Benchmark Tests

Benchmark tests verify that the memory engine meets performance baselines:

```bash
# Standard benchmarks
npm run benchmark:locomo -- --top-k 20
npm run benchmark:longmemeval -- --top-k 20
npm run benchmark:beam -- --split 100K --top-k 20
npm run benchmark:beam:500k
npm run benchmark:arena

# Full nextgen suite
npm run internal -- benchmark:nextgen
```

### Benchmark Rules

1. **Never weaken benchmark gates** to make a change pass
2. **Update docs from artifacts only** — don't manually edit benchmark results
3. **Local diagnostics ≠ quality claims** — mark appropriately
4. **Record generated artifacts** with the change

## Fixtures

Deterministic test fixtures live in `fixtures/`:

```
fixtures/
├── memories/           # Sample memory items
├── connectors/         # Connector event samples
├── api-responses/      # Expected API responses
└── benchmarks/         # Benchmark input data
```

### Using Fixtures

```typescript
import sampleMemories from "../fixtures/memories/basic.json";

describe("retrieval", () => {
  it("ranks corrections above facts", () => {
    const ranked = rankMemories(sampleMemories, "release prep");
    expect(ranked[0].source).toBe("correction");
  });
});
```

## Coverage

Vitest generates coverage reports:

```bash
npx vitest --coverage
```

Coverage reports are generated under `reports/` (git-ignored).

## Continuous Integration

Tests run on every PR via GitHub Actions (`.github/workflows/ci.yml`):

```yaml
- name: Test
  run: npm test

- name: Build
  run: npm run build

- name: Verify
  run: npm run verify
```

## Test Environment

Tests use:

- **Local JSON storage** — fast, isolated, no external dependencies
- **Deterministic fixtures** — reproducible across environments
- **No network calls** — connector tests use fixtures unless live smoke is enabled

For live integration testing:

```bash
MEMORY_VENDOR_LIVE_SMOKE=true npm run internal -- verify:vendor-live
```
