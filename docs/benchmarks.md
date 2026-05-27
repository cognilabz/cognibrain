# Benchmarks

Cognibrain includes benchmark and proof tools for maintainers. The benchmark commands write ignored local reports under `artifacts/`.

## Common Gates

```bash
npm run internal -- benchmark:cognicode
npm run internal -- benchmark:arena
npm run internal -- benchmark:certified
npm run internal -- benchmark:hardening
npm run internal -- audit:truth
```

## What The Benchmarks Cover

| Suite | Purpose |
| --- | --- |
| CogniCodeBench | Synthetic coding-agent scenarios for correction carry-over, stale-rule suppression and connector noise. |
| Benchmark Arena | Same scenario stream across Cognibrain and configured comparison systems. |
| Hardening | Scenario hashing, schema checks, fixture coverage and competitor-run boundaries. |
| Connector gates | Native connector transforms, API/spec coverage, webhook transport and credential-smoke readiness. |

## Proof Levels

| Level | Meaning |
| --- | --- |
| `same-run-full` | Cognibrain ran locally in this repository. |
| `same-run-native` | A native runner for another system ran locally in the same benchmark pass. |
| `same-run-cloud-api` | A configured cloud API runner executed in the same benchmark pass. |
| `same-run-cli` | A configured vendor CLI ran in the same benchmark pass. |
| `same-run-api-shape` | Compatibility model only; not a vendor-certified result. |
| `credential-blocked` | The code path exists, but live credentials are required for stronger proof. |

Benchmark claims should state the proof level. Synthetic scenarios are useful for regression control; they are not a guarantee for every customer repo.

## Publishing Artifacts

Maintainers can regenerate local HTML/JSON outputs:

```bash
npm run internal -- leaderboard:publish
```

Generated reports are written under `artifacts/` and are not committed as public docs.
