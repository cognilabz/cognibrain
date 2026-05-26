# Benchmarks And Competitor Proof

Cognibrain benchmark claims are tied to checked artifacts and local commands. The benchmark data in this repo is deterministic and synthetic, not a customer deployment claim.

## Benchmark Arena

Command:

```bash
MEMORY_ARENA_AUTO_NATIVE=false \
MEMORY_ARENA_LANGMEM_COMMAND="$(command -v node) scripts/competitors/native-python-runner.mjs --system langmem" \
MEMORY_ARENA_LANGMEM_PROOF_LEVEL=same-run-native \
npm run benchmark:arena:run -- --count 300 --systems cognibrain,mem0,graphiti,zep,cognee,langmem,gbrain --difficulty hard --noise-ratio 0.5 --sessions 12 --repos 100 --stale-ratio 0.25
```

Artifact:

```text
artifacts/arena/run.json
public/benchmark-arena/results.json
public/benchmark-arena/index.html
public/benchmark-arena/scorecard.html
docs/benchmarks/latest-arena.md
```

Current local result, 300 hard CogniCodeBench v2 engineering-memory scenarios:

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | 0.9550 | same-run-full | 0.0100 | 0 |
| Graphiti/Zep | 0.6667 | same-run-api-shape | 0.9500 | 2 |
| Zep | 0.6667 | same-run-api-shape | 0.9500 | 2 |
| GBrain | 0.6667 | same-run-api-shape | 0.9500 | 2 |
| LangMem | 0.6667 | same-run-native | 1.0000 | 6 |
| Cognee | 0.6000 | same-run-api-shape | 1.0000 | 2 |
| Mem0 | 0.1500 | same-run-api-shape | 1.0000 | 3 |

Boundary: competitor rows are only as strong as their proof level. Cognibrain's row uses the full local implementation. The current hard Arena artifact uses explicit runner selection with `MEMORY_ARENA_AUTO_NATIVE=false`. At least one competitor row in this checked artifact is a real same-run native or CLI proof: LangMem records `same-run-native` from the checked native runner. API-shape rows remain compatibility models unless their row records native, cloud, CLI, vendor-signed or field proof.

The generated Arena report is marketing-ready: it includes points out of 1000, visual score bars, capability pass counts, declared gaps, a 30-scenario score matrix and the public benchmark gate table. Regenerate it with `npm run benchmark:arena:publish`.

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

This installs/checks `mem0ai==2.0.2`, `graphiti-core[kuzu]==0.29.1`, `langmem==0.0.30`, `cognee==1.1.0`, `fastembed==0.7.3`, `@mem0/cli@0.2.7` and `gbrain@0.41.14.0`. Native rows are only claimed when the checked Arena artifact actually records a native, cloud or CLI proof level. The current hard 300-scenario artifact records LangMem as same-run native and leaves the remaining competitor rows at API-shape compatibility proof.

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

The current checked artifact passes 1,000 hard CogniCodeBench v2 synthetic coding-agent scenarios with 22,000 generated memory events, 100 repo templates selected from 768 available templates, 20 correction types, 12 sessions per scenario, `noiseRatio=0.5`, `staleRatio=0.25`, connector-backed source refs and granular synthetic patch models. Each scenario tests whether a correction, review note, command failure, connector decision or repo rule carries into the next patch decision.

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
