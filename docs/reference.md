# Usage And Reference

For MCP-native agents, use MCP. For shell-hook capable agents, use the harness lifecycle CLI. For operators, use the CLI. For product integrations, use SDK/HTTP.

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

## Context Lifecycle

The useful loop is:

1. Actively retrieve a context or coding-context pack before work; do not wait for memory text to be passively injected into the prompt.
2. Parse the full JSON response, including `data.context`, `data.sections[].evidence[]`, `data.excludedStaleRules[]`, `data.id`, and `data.evidencePackId`.
3. Treat `review_required` evidence as an automated review queue: verify each item against current code, tests, generated artifacts, CI, or source systems before using it. No operator/evidence-judge step is required for normal harness operation.
4. Use delivered context first; if the evidence pack already answers the question, avoid rediscovering the same fact with another search.
5. Run an action guard before edits, destructive commands, release work or credential-sensitive operations.
6. Record command outcomes while the result is still fresh.
7. Record patch evidence with the task, files changed, commands run and memory ids used.
8. Send injection feedback when a delivered memory was accepted or rejected.

```bash
cognibrain context --task "prepare release patch" --json
cognibrain guard --action "npm test" --json
cognibrain outcome --command "npm test" --exit-code 0 --json
cognibrain patch-evidence --task "release patch" --files package.json --commands "npm test" --json
cognibrain memory feedback-injection "release proof" accepted mem_1,mem_2
```

When `data.context` is empty but `data.sections[].evidence[]` contains items,
Cognibrain still delivered memories. The harness should use those evidence rows
for targeted automated verification instead of treating the response as "no
memory."

This feedback path is what lets Cognibrain measure whether retrieved memories
were actually useful, rather than only measuring whether they matched a query.

## Harness CLI

`cognibrain harness ...` is the JSON-first lifecycle path for any agent host, git hook or CI runner that can execute shell commands. Top-level lifecycle commands such as `cognibrain context`, `cognibrain guard` and `cognibrain outcome` share the same contract.

```bash
cognibrain harness context --task "prepare the next patch" --repo cognilabz/cognibrain --json
cognibrain harness guard --action "npm test" --json
cognibrain harness outcome --command "npm test" --exit-code 0 --json
cognibrain harness correction --text "Use npm test, not pnpm." --json
cognibrain harness patch-evidence --task "package cleanup" --files package.json --commands "npm test" --json
cognibrain harness session-end --run-dream-if-due --json
cognibrain harness release-prepare --repo cognilabz/cognibrain --json
cognibrain harness dream-plan --json
cognibrain harness source-revalidate --user local --json
cognibrain harness conflicts --json
cognibrain harness health --json
```

Daemon-backed mode is preferred. Auth-enabled daemons can be called with `--api-key`, `--bearer-token`, `--auth-env`, `MEMORY_API_KEY`, `COGNIBRAIN_API_KEY`, `COGNIBRAIN_API_TOKEN` or `MEMORY_BEARER_TOKEN`. In production/security mode the harness CLI requires the daemon unless `--local-direct` is explicitly requested.

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

The harness lifecycle exposes equivalent JSON commands under `cognibrain harness`, `cognibrain context`, `cognibrain guard`, `cognibrain outcome`, `cognibrain correction`, `cognibrain patch-evidence`, `cognibrain session-end`, `cognibrain handoff`, `cognibrain release-prepare`, `cognibrain dream-plan`, `cognibrain source-revalidate`, `cognibrain conflicts` and `cognibrain health`.

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

Maintainer-only verification gates live behind the internal runner:

```bash
npm run internal -- verify:compatibility
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
