# Same Benchmark

Memory comparisons are full of slogans. Cognibrain runs the same coding-agent scenarios.

Recall is not enough. The next code change has to prove the memory worked.

## Latest Table

The generated report lives at [latest-arena.md](../benchmarks/latest-arena.md), [public/benchmark-arena](../../public/benchmark-arena/index.html) and `public/benchmark-arena/scorecard.html`. It includes points, visual bars, capability pass counts, declared gaps, public benchmark gate results and the per-scenario score matrix.

Every comparison starts with the table:

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | from artifact | same-run-full | from artifact | from artifact |
| Mem0 | from adapter | same-run-native, same-run-cloud-api, artifact-import, credential-blocked or same-run-api-shape | from artifact | from artifact |
| Graphiti/Zep | from adapter | same-run-native, same-run-cloud-api, artifact-import, credential-blocked or same-run-api-shape | from artifact | from artifact |
| Cognee | from adapter | same-run-native, same-run-cloud-api, artifact-import, credential-blocked or same-run-api-shape | from artifact | from artifact |
| LangMem | from adapter | same-run-native, same-run-cli, artifact-import, credential-blocked or same-run-api-shape | from artifact | from artifact |
| GBrain | from adapter | same-run-cli, artifact-import or same-run-api-shape | from artifact | from artifact |

## What CogniCodeBench Measures

Generic memory benchmarks ask whether a model can remember. CogniCodeBench asks whether the next code change gets better.

It checks:

- correction carry-over,
- repeated mistake avoidance,
- procedure recall,
- patch correctness,
- evidence completeness,
- wrong-memory suppression,
- connector sourceRef correctness,
- granular patch correctness,
- long-horizon recall.

## Competitor Boundaries

`same-run-api-shape` means the row is a local compatibility model. It is honest, but it is not a real vendor run.

The current hard 300-scenario Arena artifact uses explicit runner selection with `MEMORY_ARENA_AUTO_NATIVE=false`, records Cognibrain as `same-run-full`, records LangMem as `same-run-native`, and leaves the remaining competitor rows as `same-run-api-shape`. At least one competitor row in this checked artifact is a real same-run native or CLI proof. API-shape rows remain compatibility models unless their row records native, cloud, CLI, vendor-signed or field proof.

Native package, cloud, CLI, artifact-import, credential-blocked and vendor-signed rows are supported by the adapter contract, but they must appear as that proof level in `artifacts/arena/run.json` before docs can claim them.

Use these environment variables to raise a competitor row to a stronger proof level:

```bash
MEMORY_ARENA_MEM0_COMMAND="node adapters/mem0-runner.js" npm run benchmark:arena
MEMORY_ARENA_GRAPHITI_COMMAND="python adapters/graphiti_runner.py" npm run benchmark:arena
MEMORY_ARENA_GBRAIN_COMMAND="gbrain arena-run --json" npm run benchmark:arena
MEMORY_ARENA_COGNEE_ARTIFACT=artifacts/vendor/cognee-arena.json npm run benchmark:arena
```

The external runner reads one scenario JSON object from stdin and returns checks/evidence JSON. Without a runner or artifact, the row stays `same-run-api-shape`.

## Reproduce

```bash
export MEMORY_ARENA_AUTO_NATIVE=false
export MEMORY_ARENA_LANGMEM_COMMAND="$(command -v node) scripts/competitors/native-python-runner.mjs --system langmem"
export MEMORY_ARENA_LANGMEM_PROOF_LEVEL=same-run-native
npm run benchmark:cognicode -- --count 1000 --difficulty hard --noise-ratio 0.5 --sessions 12 --repos 100 --stale-ratio 0.25
MEMORY_ARENA_AUTO_NATIVE=false npm run benchmark:arena:run -- --count 300 --difficulty hard --noise-ratio 0.5 --sessions 12 --repos 100
npm run benchmark:arena:publish
npm run audit:truth
```
