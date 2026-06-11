# Cognibrain Reality Bench

Reality Bench implements the Engineering Memory Reality Protocol v1 (`emrp-v1`).

The protocol is intentionally claim-conservative:

- frozen JSONL manifests and lock hashes are required before a run
- raw outputs and scorer traces are retained per system
- local baselines and capability-profile adapters are diagnostic only
- original competitor implementations must enter through explicit API, SDK, or CLI commands
- public output is an evidence table unless all market claim gates pass

The default manifest lives in `benchmarks/reality/manifests/emrp-v1.jsonl` and is locked by `benchmarks/reality/manifests/emrp-v1.lock.json`.

Useful commands:

```bash
npm run benchmark:reality:freeze
npm run benchmark:reality:verify
npm run benchmark:reality:run
npm run benchmark:reality:publish
npm run benchmark:reality:competitors
```

Market leaderboard publication is blocked until Cognibrain and at least two original competitor systems are judged on the same frozen manifest with retained raw outputs, cost/latency accounting, public artifact hash, and independent replication hash.
