# Open Benchmark Leaderboard

Generate public-safe artifacts locally:

```bash
npm run verify:nextgen
npm run leaderboard
npm run leaderboard:publish
```

The leaderboard schema is intentionally narrow:

- `schemaVersion`: current schema version,
- `privacy`: anonymized/no-raw-prompt/no-raw-evidence flags,
- `entries`: suite, metric, score, artifact path, proof level, and notes,
- `publication.anonymized`: must be `true`,
- `publication.claimScope`: explains what the numbers do and do not prove.

Direct vendor comparisons require comparable imported artifacts with the same dataset, metric, top-K, and context budget.

`leaderboard:publish` validates the anonymized leaderboard schema before writing:

- `public/leaderboard/leaderboard.json`: static JSON for dashboards or hosted pages,
- `public/leaderboard/index.html`: small static table suitable for CI artifacts or GitHub Pages.

CI runs the publish step after `verify:nextgen` and uploads both the JSON artifact and the static site directory.
