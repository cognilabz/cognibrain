# Benchmark Results

The current checked-in CogniCodeBench artifact is `artifacts/cognicodebench/run.json`.

## Latest Synthetic Gate

| Metric | Required | Latest artifact |
| --- | --- | --- |
| Scenario count | `>= 100` | `100` |
| Correction carryover | `>= 0.90` | `1` |
| Repeated mistake rate | `<= 0.05` | `0` |
| Procedure recall | `>= 0.90` | `1` |
| Patch correctness | high | `1` |
| Evidence completeness | high | `1` |
| Wrong-memory suppression | `>= 0.90` | `1` |

Regenerate before release:

```bash
npm run benchmark:cognicode
```

Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-ABLATION`.
