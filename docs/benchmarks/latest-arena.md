# Latest Benchmark Arena

Generated from `artifacts/arena/run.json` at 2026-05-26T09:07:43.443Z.

Recall is not enough. The next code change has to prove the memory worked.

## Marketing Scorecard

| System | Points | Score | Bar | Proof level | Scenarios | Repeated mistake rate | Gaps |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
| Cognibrain | 972 / 1000 | 0.9722 | [#################.] | same-run-full | 30 | 0.0000 | 0 |
| LangMem | 667 / 1000 | 0.6667 | [############......] | same-run-native | 30 | 1.0000 | 6 |
| Mem0 | 667 / 1000 | 0.6667 | [############......] | same-run-native | 30 | 1.0000 | 7 |
| GBrain | 156 / 1000 | 0.1556 | [###...............] | same-run-cli | 30 | 1.0000 | 5 |
| Graphiti/Zep | 0 / 1000 | 0.0000 | [..................] | credential-blocked | 30 | 1.0000 | 4 |
| Cognee | 0 / 1000 | 0.0000 | [..................] | credential-blocked | 30 | 1.0000 | 4 |

## Capability Score Breakdown

| System | Correction carryover | Mistake avoided | Procedure recall | Patch correctness | Evidence completeness | Wrong-memory suppression |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cognibrain | 30/30 [##########] | 30/30 [##########] | 30/30 [##########] | 30/30 [##########] | 30/30 [##########] | 25/30 [########..] |
| LangMem | 30/30 [##########] | 0/30 [..........] | 30/30 [##########] | 30/30 [##########] | 30/30 [##########] | 0/30 [..........] |
| Mem0 | 30/30 [##########] | 0/30 [..........] | 30/30 [##########] | 30/30 [##########] | 30/30 [##########] | 0/30 [..........] |
| GBrain | 7/30 [##........] | 0/30 [..........] | 7/30 [##........] | 7/30 [##........] | 7/30 [##........] | 0/30 [..........] |
| Graphiti/Zep | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] |
| Cognee | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] | 0/30 [..........] |

## Scenario Score Matrix

Each cell is points out of 1000 plus a compact bar from the checked scenario result.

| Scenario | Cognibrain | LangMem | Mem0 | GBrain | Graphiti/Zep | Cognee |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| cognicode-001 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-002 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-003 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-004 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-005 | 833 [#######.] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-006 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-007 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-008 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-009 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-010 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-011 | 833 [#######.] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-012 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-013 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-014 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-015 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-016 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-017 | 833 [#######.] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-018 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-019 | 1000 [########] | 667 [#####...] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] |
| cognicode-020 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-021 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-022 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-023 | 833 [#######.] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-024 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-025 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-026 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-027 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-028 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-029 | 833 [#######.] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |
| cognicode-030 | 1000 [########] | 667 [#####...] | 667 [#####...] | 0 [........] | 0 [........] | 0 [........] |

## Capability Gaps

| System | Declared gaps |
| --- | --- |
| Cognibrain | none |
| LangMem | external runner configured by MEMORY_ARENA_LANGMEM_COMMAND; capability gaps come from runner output when provided; framework memory primitive, not productized connector/writeback proof; no typed graph-path or patch evidence trail; LangMem run used real create_manage_memory_tool/create_search_memory_tool with LangGraph InMemoryStore; LangMem does not expose Cognibrain's typed pre-tool action guard in this adapter; LangMem does not emit Cognibrain Patch Evidence Trail objects for commands/files |
| Mem0 | external runner configured by MEMORY_ARENA_MEM0_COMMAND; capability gaps come from runner output when provided; no typed coding-action guard; no patch evidence trail; limited temporal stale-rule suppression; Mem0 OSS run used real mem0ai add/search with infer=false and local Qdrant/FastEmbed, not Mem0 cloud; Mem0 does not expose Cognibrain's typed pre-tool action guard in this adapter; Mem0 does not emit Cognibrain Patch Evidence Trail objects for commands/files |
| GBrain | external runner configured by MEMORY_ARENA_GBRAIN_COMMAND; capability gaps come from runner output when provided; graph recall without self-hosted install wizard proof; no vendor connector writeback verifier; GBrain search/capture does not expose Cognibrain's typed pre-tool action guard; GBrain does not emit Cognibrain Patch Evidence Trail objects for commands/files |
| Graphiti/Zep | external runner configured by MEMORY_ARENA_GRAPHITI_COMMAND; capability gaps come from runner output when provided; no first-class patch evidence trail; no pre-tool forbidden-action gate; OPENAI_API_KEY or GRAPHITI_OPENAI_API_KEY is missing; Graphiti extraction/search cannot be executed honestly |
| Cognee | external runner configured by MEMORY_ARENA_COGNEE_COMMAND; capability gaps come from runner output when provided; knowledge pipeline focus, not pre-tool action prevention; no command outcome evidence trail; OPENAI_API_KEY/LLM_API_KEY is missing; Cognee remember/recall cannot be executed honestly |

## Public Benchmark Gate

Generated from `artifacts/market-gate.json` at 2026-05-26T08:26:22.404Z. Proof level: `certified-public-benchmark-baseline-superiority`.

| Dataset | Metric | Points | Cognibrain | Bar | Best local baseline | Margin | Questions |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| LoCoMo | Evidence recall@K against LoCoMo QA evidence dialog ids | 742 / 1000 | 1139/1536 | [#############.....] | keyword-only 981/1536 | +0.1029 | 1536 |
| LongMemEval-S | Answer-session recall@K against answer_session_ids | 996 / 1000 | 498/500 | [##################] | keyword-only 495/500 | +0.0060 | 500 |
| BEAM 100K | Retrieval nugget score@K against BEAM ideal responses and rubrics | 965 / 1000 | 386/400 | [#################.] | keyword-only 328/400 | +0.1450 | 400 |
| BEAM 500K | Retrieval nugget score@K against BEAM ideal responses and rubrics | 977 / 1000 | 684/700 | [##################] | keyword-only 554/700 | +0.1857 | 700 |

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
