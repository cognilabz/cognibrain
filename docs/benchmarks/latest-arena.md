# Latest Benchmark Arena

Generated from `artifacts/arena/run.json` at 2026-05-26T07:06:18.335Z.

Recall is not enough. The next code change has to prove the memory worked.

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | 0.9722 | same-run-full | 0.0000 | 0 |
| LangMem | 0.6667 | same-run-native | 1.0000 | 6 |
| Mem0 | 0.6667 | same-run-native | 1.0000 | 7 |
| GBrain | 0.1556 | same-run-cli | 1.0000 | 5 |
| Graphiti/Zep | 0.0000 | credential-blocked | 1.0000 | 4 |
| Cognee | 0.0000 | credential-blocked | 1.0000 | 4 |

Boundary: competitor rows are only as strong as their proof level. `same-run-api-shape` is a local compatibility model. `credential-blocked` means the real runner exists but could not execute without required credentials or services. `same-run-native`, `same-run-cloud-api` and `same-run-cli` require configured external runners.

## Proof Levels

| Level | Meaning |
| --- | --- |
| local-baseline | Local baseline or fixture that does not represent a product run. |
| public-claim-only | Public claim or documentation row without direct same-scenario execution. |
| artifact-import | Adapter result was imported from a prior artifact and was not rerun. |
| credential-blocked | A real runner exists, but this checked run could not execute the product path because required credentials or external services were not configured. |
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
