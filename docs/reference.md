# Usage And Reference

For agents, use MCP first. For operators, use the CLI. For product integrations, use SDK/HTTP.

## CLI

```bash
cognibrain
cognibrain init --profile solo-dev --yes
cognibrain status
cognibrain proof
cognibrain memories list --json
cognibrain memories add "Release work requires npm test."
cognibrain memories coding-context "prepare the next patch"
cognibrain guard --action "edit package.json" --json
cognibrain patch-evidence --task "package cleanup" --json
cognibrain connections list
cognibrain connections add github --set repo=cognilabz/cognibrain
cognibrain service install --activate
```

The CLI is stable text output by default and supports JSON where automation needs it.

## MCP

MCP-capable hosts should call Cognibrain tools directly before coding or debugging work:

| Tool class | Purpose |
| --- | --- |
| Context pack | Retrieve compact memory context for a task. |
| Coding context | Retrieve codebase-specific corrections and conventions. |
| Action guard | Warn or block known bad actions before edits or shell commands. |
| Memory add | Store durable corrections, decisions and setup facts. |
| Patch evidence | Record files changed, commands run and memories used. |
| Maintenance | Inspect health and run dream-cycle maintenance. |

The CLI exposes fallback equivalents under `cognibrain memory`, `cognibrain memories`, `cognibrain context`, `cognibrain guard`, `cognibrain outcome` and `cognibrain patch-evidence`.

## HTTP API

The HTTP API backs the CLI, MCP server and SDKs. It includes memory CRUD, search, context/evidence packs, graph, connectors, governance, marketplace, timeline and operations routes. Use the generated OpenAPI route when integrating external services:

```bash
curl http://localhost:8787/openapi.json
```

## Package Scripts

Public npm scripts are intentionally compact:

```bash
npm test
npm run build
npm run verify
npm run release:check
npm run verify:selfhosted
```

Maintainer-only gates live behind the internal runner:

```bash
npm run internal -- benchmark:cognicode
npm run internal -- verify:compatibility
npm run internal -- audit:truth
```

## SDKs

TypeScript exports:

```ts
import { CognibrainClient } from "@cognilabz/cognibrain/sdk/typescript/client";
import { createPlatformIntegration } from "@cognilabz/cognibrain/sdk/typescript/connectors";
import { CognibrainHarnessSdk } from "@cognilabz/cognibrain/sdk/typescript/harness";
```

Python:

```python
from cognibrain_client import CognibrainClient

client = CognibrainClient(api_key="dev-secret", actor_id="agent")
pack = client.evidence_pack({
    "userId": "dev",
    "query": "What should I remember before release?",
    "tokenBudget": 900,
})
print(pack["context"])
```

See [../sdk/python/README.md](../sdk/python/README.md).
