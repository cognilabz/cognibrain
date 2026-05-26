# Latest Benchmark Arena

Generated from `artifacts/arena/run.json` at 2026-05-26T05:27:38.809Z.

Recall is not enough. The next code change has to prove the memory worked.

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | 0.9722 | same-run-full | 0.0000 | 0 |
| Graphiti/Zep | 0.6667 | same-run-api-shape | 0.8333 | 2 |
| Cognee | 0.4445 | same-run-api-shape | 1.0000 | 2 |
| LangMem | 0.2222 | same-run-api-shape | 1.0000 | 2 |
| GBrain | 0.1556 | same-run-cli | 1.0000 | 5 |
| Mem0 | 0.1111 | same-run-api-shape | 1.0000 | 3 |

Boundary: competitor rows are only as strong as their proof level. `same-run-api-shape` is a local compatibility model. `same-run-native`, `same-run-cloud-api` and `same-run-cli` require configured external runners.

## Proof Levels

| Level | Meaning |
| --- | --- |
| local-baseline | Local baseline or fixture that does not represent a product run. |
| public-claim-only | Public claim or documentation row without direct same-scenario execution. |
| artifact-import | Adapter result was imported from a prior artifact and was not rerun. |
| same-run-api-shape | Adapter executes the same scenario stream through a local API-shaped compatibility model with documented gaps. |
| same-run-native | Adapter executes the same scenario stream through a real local package, SDK, or service configured by the operator. |
| same-run-cloud-api | Adapter executes the same scenario stream against a hosted API using operator-supplied credentials. |
| same-run-cli | Adapter executes the same scenario stream through a real CLI runner configured by the operator. |
| same-run-full | Adapter executes the same scenario stream through the local product pipeline. |
| vendor-signed | Vendor-reviewed or vendor-signed artifact for the same scenario contract. |
| real-customer-field | Anonymized customer-field evidence from a real deployment, not a synthetic benchmark. |
| planned | Adapter is listed for roadmap tracking only. |

Reproduce:

```bash
npm run benchmark:arena
npm run benchmark:arena:publish
```
