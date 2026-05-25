# cognibrain vs Zep / Graphiti

## Best For

Zep and Graphiti-style systems are strongest when temporal knowledge graph memory for conversational AI is the main need.

## Where cognibrain Differs

cognibrain also cares about time, but the product question is engineering-specific: which rule, correction, command or migration applies before the next code change?

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-PLANNER`, `CB-CLAIM-EVIDENCE`.

| Area | Temporal graph memory | cognibrain |
| --- | --- | --- |
| Temporal target | Conversation and facts over time | Repo rules, migrations, corrections and branches |
| Retrieval output | Memory or graph context | EvidencePack and coding context pack |
| Action layer | Product-dependent | Action guard and patch trail |
| Benchmark | General memory benchmarks | CogniCodeBench synthetic engineering loop |
| Production claim | Product-dependent | Self-hosted candidate with explicit boundaries |

## Benchmark Boundary

Do not claim cognibrain beats Zep or Graphiti on their own benchmark domains without comparable artifacts.

Claim ID: `CB-CLAIM-MARKET`.

## Same-Run Arena

Benchmark Arena runs a Graphiti/Zep API-shape adapter on the same synthetic engineering-memory scenario stream as Cognibrain. Current local result: Cognibrain `same-run-full` 97.22%, Graphiti/Zep `same-run-api-shape` 66.67%. The gap is the coding-action layer: pre-tool guard plus Patch Evidence Trail, not temporal graph recall in the abstract.

Claim ID: `CB-CLAIM-BENCHMARK-ARENA`.

## Honest Limitations

cognibrain is not marketed as a general temporal knowledge graph platform. Its graph and temporal features serve coding-agent memory.

## CTA

Use the temporal graph for engineering validity: stale migration notes should not silently shape a new patch.
