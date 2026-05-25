# Benchmark Landscape

Most memory products can store useful facts. The hard engineering-memory question is narrower: after an agent is corrected, does the next patch avoid the same mistake, run the right procedure, cite the reason, and leave evidence?

`npm run benchmark:arena` is the same-run landscape check for that question. It runs CogniCode-style correction scenarios through Cognibrain and API-shaped adapters for Mem0, Graphiti/Zep, Cognee, LangMem, and GBrain.

| System | Arena proof level | Strongest modeled area | Declared gap |
| --- | --- | --- | --- |
| Cognibrain | `same-run-full` | Correction carryover, action guard, procedures, patch evidence, connector proof | None in the local synthetic runner |
| Mem0 | `same-run-api-shape` | User-memory style correction recall | No typed pre-tool guard or patch evidence trail |
| Graphiti/Zep | `same-run-api-shape` | Temporal graph recall | No first-class patch evidence trail or pre-tool action gate |
| Cognee | `same-run-api-shape` | Knowledge pipeline retrieval | Not a coding-action prevention surface |
| LangMem | `same-run-api-shape` | Framework-level memory primitive | No productized evidence trail, graph path, or connector proof |
| GBrain | `same-run-api-shape` | Graph-style recall | No self-hosted install wizard or vendor writeback verifier in this runner |

The current local arena artifact is `artifacts/arena/run.json`. The public summary lives at `public/benchmark-arena/index.html` and `public/benchmark-arena/results.json`.

Boundaries:

- Same-run API-shape adapters are not vendor-hosted benchmark certifications.
- Synthetic CogniCode scenarios are not customer-repository claims.
- Managed SaaS claims require a deployment-specific control-plane run.
- Tenant connector certification requires `npm run verify:vendor-live` with approved credentials.

Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`, `CB-CLAIM-CONNECTOR-MATURITY`.
