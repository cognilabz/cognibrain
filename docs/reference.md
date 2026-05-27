# Reference

This is the compact command and API reference for the self-hosted product.

## Surface Contract

For agents, use MCP first. For operators, use the CLI. For product integrations, use SDK/HTTP.

| Surface | Primary caller | Contract |
| --- | --- | --- |
| MCP | Agent harnesses | Context recall, coding context, action guards, durable writes, corrections, patch evidence and maintenance. |
| CLI | Humans, scripts and installers | Runtime control, setup, status, connectors, adapters, skills, service automation, proof and fallback memory commands. |
| SDK/HTTP | Apps and custom integrations | Typed client path for platform connectors, polling, writeback, dashboards and non-MCP runtimes. |

## CLI

```bash
cognibrain
cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes]
cognibrain status [--json]
cognibrain memories [--json]
cognibrain memories add <text>
cognibrain memories search <query>
cognibrain memories coding-context <query>
cognibrain connections [--json]
cognibrain connections add <connector-or-adapter> [--set key=value]
cognibrain connections doctor
cognibrain config show [--json]
cognibrain config all
cognibrain proof|truth [--json] [--no-refresh]
cognibrain service plan [--platform linux|macos|windows] [--json]
cognibrain service install [--activate] [--dashboard] [--system]
cognibrain sdk platform <name> --kind project_management --out integrations/<name>
cognibrain doctor [--fix] [--publish]
cognibrain mcp
```

## MCP

Use the installed MCP server for agent memory workflows:

- `memory_context_pack`
- `memory_coding_context_pack`
- `memory_action_guard`
- `memory_add`
- `memory_patch_evidence`
- `memory_maintenance_status`
- `memory_dream`

## API

Run the local API:

```bash
npx cognibrain start
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/openapi.json
```

Important routes:

| Route | Purpose |
| --- | --- |
| `/memories` | Add, list, inspect, update and delete memories. |
| `/search` | Search memory with policy-aware retrieval. |
| `/coding-context-pack` | Generate compact engineering context for coding agents. |
| `/evidence-pack` | Return cited evidence for a query. |
| `/code/action-guard` | Check a shell/file action against repo policy and corrections. |
| `/actions` | Record harness command, file, test, PR and outcome telemetry. |
| `/code/corrections` | Capture user or reviewer corrections as engineering memory. |
| `/patch-evidence` | Build the evidence trail for a non-trivial patch. |
| `/connectors/*` | Register, poll, sync, health-check and write back connectors. |
| `/maintenance` | Dream-cycle and lifecycle status. |
| `/openapi.json` | OpenAPI 3.1 contract for SDK generation. |

## TypeScript SDK

```ts
import { CognibrainClient, CognibrainHarnessSdk, createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript";

const client = new CognibrainClient({ baseUrl: "http://127.0.0.1:8787" });
await client.add({
  userId: "local",
  content: "Release patches must run npm test."
});
const context = await client.codingContextPack({
  userId: "local",
  query: "prepare release patch"
});
const harness = new CognibrainHarnessSdk(client);
const integration = createPlatformIntegration({ name: "Acme Tasks" });
```

Stable TypeScript subpaths:

- `@cognilabz/cognibrain/sdk/typescript`
- `@cognilabz/cognibrain/sdk/typescript/client`
- `@cognilabz/cognibrain/sdk/typescript/connectors`
- `@cognilabz/cognibrain/sdk/typescript/harness`

## Python SDK

```bash
python3 -m unittest discover -s sdk/python/tests
```

See [../sdk/python/README.md](../sdk/python/README.md) for the dependency-free Python client.

The TypeScript and Python SDKs both wrap the same HTTP API. TypeScript is shipped for Node/TS applications; Python is shipped for LangGraph, CrewAI and Python automation. Agents should still use MCP first when MCP is available.
