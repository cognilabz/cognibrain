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
| Graphiti/Zep | 0.6667 | same-run-api-shape | 0.8333 | 2 |
| Cognee | 0.4445 | same-run-api-shape | 1 | 2 |
| LangMem | 0.2222 | same-run-api-shape | 1 | 2 |
| GBrain | 0.1778 | same-run-cli | 1 | 5 |
| Mem0 | 0.1111 | same-run-api-shape | 1 | 3 |

Boundary: competitor rows are local API-shape compatibility adapters unless their proof level says otherwise. They are not vendor-hosted certifications. Cognibrain's row uses the full local implementation. GBrain is now checked as a real same-run-cli competitor row through `gbrain capture/search/get` from a cloned GBrain repo. Mem0 remains same-run-api-shape in the checked artifact because no MEM0_API_KEY was available; `artifacts/arena/native-competitors.json` records the install check and credential block.

Arena v2 can raise a competitor row when an external runner or artifact is configured:

```bash
MEMORY_ARENA_MEM0_COMMAND="node adapters/mem0-runner.js" npm run benchmark:arena
MEMORY_ARENA_GRAPHITI_COMMAND="python adapters/graphiti_runner.py" npm run benchmark:arena
MEMORY_ARENA_GBRAIN_COMMAND="gbrain arena-run --json" npm run benchmark:arena
MEMORY_ARENA_COGNEE_ARTIFACT=artifacts/vendor/cognee-arena.json npm run benchmark:arena
```

Without a runner or artifact, competitor rows stay `same-run-api-shape`.

Native competitor run:

```bash
npm run benchmark:competitors:native
```

This installs/checks `mem0ai@3.0.3`, `@mem0/cli@0.2.7` and `gbrain@0.41.14.0`. With the current environment, GBrain produced a same-run-cli row and Mem0 was installed but not executed against the cloud API because no MEM0_API_KEY was configured.

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
