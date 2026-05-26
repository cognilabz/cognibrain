# Benchmarks

Cognibrain benchmark commands are useful for development and release review, but their generated reports are internal build outputs. Generated reports are written under `artifacts/`; those files are ignored by git, not committed and not shipped in the npm package. The benchmark commands write ignored local reports under `artifacts/`.

## Commands

```bash
npm run benchmark:cognicode
npm run benchmark:arena
npm run benchmark:certified
npm run benchmark:hardening
npm run audit:truth
```

## Proof Levels

| Proof level | Meaning |
| --- | --- |
| `same-run-full` | Cognibrain executed the full local implementation. |
| `same-run-native` | A competitor or external system ran through a local native runner. |
| `same-run-cloud-api` | A competitor or external system ran through a configured cloud API. |
| `same-run-cli` | A competitor or external system ran through a configured CLI. |
| `same-run-api-shape` | Compatibility model only; not a real vendor run. |
| `credential-blocked` | A stronger run is wired but credentials or services were unavailable. |

## Boundaries

- Synthetic benchmark scenarios are not customer deployment proof.
- API-shape competitor rows are not vendor certification.
- Native/cloud/CLI competitor rows require configured external runners.
- Public benchmark rows prove only the checked local run against the documented baseline.
- Real customer field proof requires a separate deployment artifact.
