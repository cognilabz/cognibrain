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
public/benchmark-arena/index.html
docs/benchmarks/latest-arena.md
```

Current local result, 30 deterministic engineering-memory scenarios:

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | 0.9722 | same-run-full | 0 | 0 |
| Graphiti/Zep | 0.6667 | same-run-native | 1 | 6 |
| Cognee | 0.6667 | same-run-native | 1 | 6 |
| LangMem | 0.6667 | same-run-native | 1 | 6 |
| Mem0 | 0.6667 | same-run-native | 1 | 7 |
| GBrain | 0.1556 | same-run-cli | 1 | 5 |

Boundary: competitor rows are only as strong as their proof level. Cognibrain's row uses the full local implementation. Mem0, Graphiti/Zep, Cognee and LangMem are checked through real same-run-native package runners. GBrain is checked as a real same-run-cli competitor row through `gbrain capture/search/get` from a cloned GBrain repo. Mem0 uses the OSS/local path unless a Mem0 cloud key is supplied; Graphiti/Zep and Cognee require operator-supplied LLM credentials for the native run. No API-shape score is shown for the checked artifact.

Arena v2 can raise a competitor row when an external runner or artifact is configured:

```bash
MEMORY_ARENA_MEM0_COMMAND="node adapters/mem0-runner.js" npm run benchmark:arena
MEMORY_ARENA_GRAPHITI_COMMAND="python adapters/graphiti_runner.py" npm run benchmark:arena
MEMORY_ARENA_GBRAIN_COMMAND="gbrain arena-run --json" npm run benchmark:arena
MEMORY_ARENA_COGNEE_ARTIFACT=artifacts/vendor/cognee-arena.json npm run benchmark:arena
```

Without a runner or artifact, competitor rows stay `same-run-api-shape`. With a runner that cannot execute because credentials or services are missing, the row is `credential-blocked`.

Native competitor run:

```bash
npm run benchmark:competitors:native
```

This installs/checks `mem0ai==2.0.2`, `graphiti-core[kuzu]==0.29.1`, `langmem==0.0.30`, `cognee==1.1.0`, `fastembed==0.7.3`, `@mem0/cli@0.2.7` and `gbrain@0.41.14.0`. With the current environment, Mem0, Graphiti/Zep, Cognee and LangMem produced same-run-native rows, and GBrain produced a same-run-cli row. Graphiti/Zep and Cognee used operator-supplied LLM credentials; without those credentials their rows stay credential-blocked instead of falling back to API-shape.

Run the code-first truth gate when you want to see whether the checked artifact is still only API-shape or has real competitor runners:

```bash
npx cognibrain proof
npm run audit:truth
```

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

## Public Market Benchmarks

Command:

```bash
npm run benchmark:certified
```

Artifacts:

```text
artifacts/locomo-report.json
artifacts/longmemeval-report.json
artifacts/beam-report.json
artifacts/beam-500k-report.json
artifacts/answer-generation.json
artifacts/market-gate.json
```

Latest checked public benchmark gate:

| Dataset | Metric | Cognibrain | Best local baseline | Margin |
| --- | --- | ---: | ---: | ---: |
| LoCoMo | evidence recall@20 | 0.7415 | 0.6387 | +0.1029 |
| LongMemEval-S | answer-session recall@20 | 0.9960 | 0.9900 | +0.0060 |
| BEAM 100K | retrieval nugget score@20 | 0.9650 | 0.8200 | +0.1450 |
| BEAM 500K | retrieval nugget score@20 | 0.9771 | 0.7914 | +0.1857 |

`artifacts/market-gate.json` passed with proof level `certified-public-benchmark-baseline-superiority`. These are official/public dataset runs against local baselines, not direct hosted-vendor certifications.

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

The release gate currently runs unit tests, dashboard build, status verification, CogniCodeBench, Benchmark Arena, first-win demo, docs audit, product truth audit, Postgres verification, connector compatibility, local runtime start, publish doctor, npm pack dry-run and Python SDK tests.

## How To Read The Numbers

- A score is only meaningful with its proof level.
- Same-run-full means Cognibrain executed the full local memory implementation.
- Same-run-api-shape means an adapter exposed the same interface over deterministic scenarios.
- Same-run-native, same-run-cloud-api and same-run-cli require operator-supplied external runners.
- Artifact-import means the result was imported, not rerun in this checkout.
- Repeated mistake rate measures whether the next patch repeated a known wrong action.
- Gaps are declared missing capabilities in the comparison adapter.

See [Benchmark Landscape](benchmarks/landscape.md), [Latest Arena](benchmarks/latest-arena.md) and [Same Benchmark](market/same-benchmark.md).
