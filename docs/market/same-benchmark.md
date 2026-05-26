# Same Benchmark

Memory comparisons are full of slogans. Cognibrain runs the same coding-agent scenarios.

Recall is not enough. The next code change has to prove the memory worked.

## Latest Table

The generated report lives at [latest-arena.md](../benchmarks/latest-arena.md) and [public/benchmark-arena](../../public/benchmark-arena/index.html).

Every comparison starts with the table:

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
| Cognibrain | from artifact | same-run-full | from artifact | from artifact |
| Mem0 | from adapter | same-run-native, same-run-cloud-api, artifact-import or same-run-api-shape | from artifact | from artifact |
| Graphiti/Zep | from adapter | same-run-native, same-run-cloud-api, artifact-import or same-run-api-shape | from artifact | from artifact |
| Cognee | from adapter | same-run-native, same-run-cloud-api, artifact-import or same-run-api-shape | from artifact | from artifact |
| LangMem | from adapter | same-run-native, same-run-cli, artifact-import or same-run-api-shape | from artifact | from artifact |
| GBrain | from adapter | same-run-cli, artifact-import or same-run-api-shape | from artifact | from artifact |

## What CogniCodeBench Measures

Generic memory benchmarks ask whether a model can remember. CogniCodeBench asks whether the next code change gets better.

It checks:

- correction carry-over,
- repeated mistake avoidance,
- procedure recall,
- patch correctness,
- evidence completeness,
- wrong-memory suppression.

## Competitor Boundaries

`same-run-api-shape` means the row is a local compatibility model. It is honest, but it is not a real vendor run.

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
npm run benchmark:cognicode
npm run benchmark:arena
npm run benchmark:arena:publish
```
