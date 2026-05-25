# cognibrain vs Mem0

## Best For

Mem0 is best for teams that want a broad, managed or API-first memory layer for user facts and general agent personalization.

## Where cognibrain Differs

cognibrain is narrower by design: it targets engineering memory for coding agents. The core loop is correction, repo policy, review feedback, tool outcome, context pack, next patch.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-COGNICODE`, `CB-CLAIM-EVIDENCE`.

| Area | Mem0-style memory | cognibrain |
| --- | --- | --- |
| Primary object | User or conversation memory | Engineering Memory with codebase scope |
| Proof | General memory benchmarks | CogniCodeBench plus evidence packs |
| Retrieval explanation | Product-dependent | Source, scope, policy, graph path, temporal state |
| Coding guard | Not the central claim | Action guard and patch evidence trail |
| Deployment focus | Managed/API-first options | Local-first self-hosted candidate |

## Benchmark Boundary

CogniCodeBench is synthetic. It should not be used to claim broad real-world superiority over Mem0 unless Mem0 is evaluated on the same scenario schema, metrics and budget.

Claim IDs: `CB-CLAIM-ABLATION`, `CB-CLAIM-MARKET`.

## Honest Limitations

cognibrain does not currently claim Mem0-style managed SaaS maturity, public uptime, billing, hosted support or vendor-signed benchmark leadership.

## CTA

Run `npm run benchmark:cognicode`, inspect `artifacts/cognicodebench/run.json`, then review [`../claims.md`](../claims.md).
