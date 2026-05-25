# Benchmark Arena

Benchmark Arena is the public proof runner for "same benchmark, no slogan" comparisons.

Run it:

```bash
npm run benchmark:arena
```

Or choose systems explicitly:

```bash
npm run benchmark:arena -- --systems cognibrain,mem0,graphiti,cognee,langmem,gbrain --benchmark cognicode
```

The runner writes `artifacts/arena/run.json` with:

- the adapter contract and proof-level definitions,
- the same scenario stream for every system,
- per-system metrics for correction carryover, repeated-mistake rate, procedure recall, patch correctness, evidence completeness and wrong-memory suppression,
- declared capability gaps for each non-Cognibrain adapter,
- a leaderboard sorted by score, repeated-mistake rate and gap count.

Current local result: Cognibrain runs as `same-run-full`; Mem0, Graphiti/Zep, Cognee, LangMem and GBrain run as `same-run-api-shape` compatibility adapters. The public table must keep that distinction visible.

Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-COGNICODE`, `CB-CLAIM-MARKET`.
