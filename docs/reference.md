# Reference

This is the compact command and API reference for the self-hosted product.

## CLI

```bash
cognibrain
cognibrain tui|ui|home [--json]
cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes]
cognibrain status [--json]
cognibrain memories [--json]
cognibrain memories add <text>
cognibrain memories search <query>
cognibrain memories coding-context <query>
cognibrain connections [--json]
cognibrain connections add <connector-or-adapter> [--set key=value]
cognibrain connections doctor
cognibrain connector wizard <provider> [--set key=value] [--json]
cognibrain connector preview <provider> [--set key=value] [--json]
cognibrain config show [--json]
cognibrain config all
cognibrain config all --refresh
cognibrain proof|truth [--json] [--no-refresh]
cognibrain service plan [--platform linux|macos|windows] [--json]
cognibrain service install [--activate] [--dashboard] [--system]
cognibrain sdk platform <name> --kind project_management --out integrations/<name>
cognibrain skill install|status|doctor|path
cognibrain doctor [--fix] [--publish]
cognibrain mcp
```

The graphical CLI action palette executes selected static actions with Enter in a TTY. Commands that still contain placeholders such as `<query>` are blocked until the user runs the filled command directly, and service or destructive actions require confirmation.

## Communication Contract

| Surface | Primary caller | Contract |
| --- | --- | --- |
| CLI | Humans, scripts and installers | Control plane for runtime, setup, status, connectors, adapters, skills, service automation, proof and fallback memory commands. |
| MCP | Agent harnesses | Preferred in-agent path for context recall, coding context, action guards, durable writes, corrections, patch evidence and maintenance. |
| SDK/HTTP | Apps and custom integrations | Typed client path for platform connectors, polling, writeback, dashboards and harness helpers that cannot call MCP directly. |

For coding agents, call MCP first. Use `memory_context_pack` as the portable baseline, `memory_coding_context_pack` when available for engineering-specific packs, and `memory_action_guard` before shell or file operations with durable side effects. CLI commands such as `cognibrain memories coding-context <query>` are the fallback and operator path. SDK/HTTP calls should use `/coding-context-pack`, `/code/action-guard`, `/actions`, `/code/corrections` and `/patch-evidence` for harness lifecycle integration.

## Proof Commands

```bash
npm run benchmark:arena
npm run benchmark:arena:publish
npm run benchmark:competitors:native
npm run verify:vendor-api-specs
npm run connectors:webhooks
npm run connectors:maturity
npm run harness:maturity
npm run audit:truth
npm run leaderboard:publish
npm run release:check
```

## Memory Commands

```bash
cognibrain memory add <text>
cognibrain memory search <query>
cognibrain memory coding-context <query>
cognibrain memory evidence-pack <query>
cognibrain memory why-used <query>
cognibrain memory action <command>
cognibrain memory action-guard <action>
cognibrain memory code-correction <text>
cognibrain memory patch-evidence <task>
cognibrain memory reflect
cognibrain memory dream
cognibrain memory health
cognibrain memory maintenance
```

## API

Run the local API:

```bash
npx cognibrain start
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/openapi.json
```

Important surfaces:

| Surface | Purpose |
| --- | --- |
| `/memories` | Add, list, inspect, update and delete memories. |
| `/search` | Search memory with policy-aware retrieval. |
| `/coding-context-pack` | Generate compact engineering context for coding agents. |
| `/evidence-pack` | Return cited evidence for a query or reloadable context-pack evidence. |
| `/code/action-guard` | Check a shell/file action against repo policy, corrections and forbidden-action memories. |
| `/actions` | Record harness command, file, test, PR and outcome telemetry. |
| `/code/corrections` | Capture user or reviewer corrections as engineering memory. |
| `/patch-evidence` | Build the evidence trail for a non-trivial patch. |
| `/connectors/*` | Register, poll, sync, health-check and write back connectors. |
| `/graph/*` | Entity graph, path and activation queries. |
| `/maintenance` | Dream-cycle and lifecycle status. |
| `/openapi.json` | OpenAPI 3.1 contract for SDK generation. |

## TypeScript SDK

```ts
import { CognibrainClient } from "@cognilabz/cognibrain/src/sdk/client";

const client = new CognibrainClient({ baseUrl: "http://127.0.0.1:8787" });
await client.addMemory({
  userId: "local",
  content: "Release patches must run npm test."
});
const context = await client.contextPack({
  userId: "local",
  query: "prepare release patch"
});
```

## Python SDK

```bash
python3 -m unittest discover -s sdk/python/tests
```

See [../sdk/python/README.md](../sdk/python/README.md) for the dependency-free Python client.
