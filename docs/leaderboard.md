# Open Benchmark Leaderboard

Generate public-safe artifacts locally:

```bash
npm run verify:nextgen
npm run leaderboard
```

The leaderboard schema is intentionally narrow:

- `schemaVersion`: current schema version,
- `privacy`: anonymized/no-raw-prompt/no-raw-evidence flags,
- `entries`: suite, metric, score, artifact path, proof level, and notes,
- `publication.anonymized`: must be `true`,
- `publication.claimScope`: explains what the numbers do and do not prove.

Direct vendor comparisons require comparable imported artifacts with the same dataset, metric, top-K, and context budget.
