# Benchmarks And Competitor Proof

Cognibrain benchmark claims are tied to checked artifacts and local commands. The benchmark data in this repo is deterministic and synthetic, not a customer deployment claim.

## Benchmark Arena

Command:

```bash
npm run benchmark:arena
```

Artifact:

```text
artifacts/arena/run.json
public/benchmark-arena/results.json
```

Current local result, 30 deterministic engineering-memory scenarios:

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | 0.9722 | same-run-full | 0 | 0 |
| Graphiti/Zep | 0.6667 | same-run-api-shape | 0.8333 | 2 |
| GBrain | 0.6667 | same-run-api-shape | 0.8333 | 2 |
| Cognee | 0.4445 | same-run-api-shape | 1 | 2 |
| LangMem | 0.2222 | same-run-api-shape | 1 | 2 |
| Mem0 | 0.1111 | same-run-api-shape | 1 | 3 |

Boundary: competitor rows are local API-shape adapters over the same scenario stream. They are not vendor-hosted certifications. Cognibrain's row uses the full local implementation.

## CogniCodeBench

Command:

```bash
npm run benchmark:cognicode
```

Artifact:

```text
artifacts/cognicodebench/run.json
```

The current checked artifact passes 100 deterministic synthetic coding-agent scenarios. Each scenario tests whether a correction, review note, command failure or repo rule carries into the next patch decision.

## Next-Generation Retrieval Suites

Command:

```bash
npm run benchmark:nextgen
npm run benchmark:answer-generation -- --reports artifacts/nextgen-benchmarks.json,artifacts/cognicodebench/run.json
npm run leaderboard
```

Artifacts:

```text
artifacts/nextgen-benchmarks.json
artifacts/answer-generation.json
artifacts/leaderboard.json
```

These suites cover answer generation, multi-hop temporal recall, behavioral patterns, retrieval calibration and evidence-pack behavior.

## Release Gate

```bash
npm run release:check
```

The release gate currently runs unit tests, dashboard build, status verification, CogniCodeBench, Benchmark Arena, first-win demo, docs audit, Postgres verification, connector compatibility, local runtime start, publish doctor, npm pack dry-run and Python SDK tests.

## How To Read The Numbers

- A score is only meaningful with its proof level.
- Same-run-full means Cognibrain executed the full local memory implementation.
- Same-run-api-shape means an adapter exposed the same interface over deterministic scenarios.
- Repeated mistake rate measures whether the next patch repeated a known wrong action.
- Gaps are declared missing capabilities in the comparison adapter.
