# Reference

This is the compact command and API reference for the self-hosted product.

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
cognibrain skill install|status|doctor|path
cognibrain doctor [--fix] [--publish]
cognibrain mcp
```

## Proof Commands

```bash
npm run benchmark:arena
npm run benchmark:arena:publish
npm run connectors:maturity
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
| `/context-pack` | Generate compact agent context. |
| `/evidence-pack` | Return cited evidence for a query. |
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
