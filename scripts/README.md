# Scripts

Repository scripts are grouped by operational role:

| Path | Purpose |
| --- | --- |
| `runtime/` | Runtime helpers used by the public CLI, including local API/dashboard startup and skill install. |
| `release/` | Release, docs, status, self-host and product-truth gates. |
| `benchmark/` | Benchmark orchestration and competitor adapters. |
| `demo/` | Small reproducible demo flows. |
| `dev/` | Local-only development helpers. |
| `internal/` | Internal task router used by CI and release gates so `package.json` stays compact. |

Generated reports belong under `artifacts/` and stay out of the source package.

Most contributors only need `npm test`, `npm run build`, `npm run verify` and
`npm run release:check`. Maintainers can run specialized gates through:

```bash
npm run internal -- <task>
```
