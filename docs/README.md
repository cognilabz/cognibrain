# Cognibrain Documentation

Cognibrain is a self-hosted Engineering Memory OS for coding agents. The CLI is the primary product surface; the dashboard is optional.

## Read First

- [Install and self-hosting](install.md)
- [Benchmarks and competitor proof](benchmarks.md)
- [Latest Benchmark Arena](benchmarks/latest-arena.md)
- [Benchmark landscape](benchmarks/landscape.md)
- [Connectors, adapters and SDK](integrations.md)
- [Connector maturity matrix](integrations/connector-maturity.md)
- [Harness maturity matrix](integrations/harness-maturity.md)
- [Terminal Memory OS plan coverage](roadmap/terminal-memory-os-plan.md)
- [Benchmark and harness hardening plan coverage](roadmap/benchmark-harness-connector-plan.md)
- [Operations and production boundary](operations.md)
- [CLI, API and SDK reference](reference.md)
- [Claims and evidence map](claims.md)
- [Same Benchmark market page](market/same-benchmark.md)
- [Table-first comparisons](market/compare.md)

## Product Snapshot

![Cognibrain CLI home](assets/cli-home.svg)

Cognibrain stores durable engineering memory and returns cited context before the next agent action. It is built for repo rules, review corrections, commands, connector events, timelines, graph links, evidence packs and release proof.

## Current Evidence

| Gate | Command | Artifact |
| --- | --- | --- |
| Release check | `npm run release:check` | `artifacts/release-check.json` |
| Product truth | `npm run audit:truth` or `cognibrain proof` | `artifacts/product-truth-audit.json` |
| Coding-agent memory | `npm run benchmark:cognicode` | `artifacts/cognicodebench/run.json` |
| Competitor arena | `MEMORY_ARENA_AUTO_NATIVE=false MEMORY_ARENA_LANGMEM_COMMAND="..." MEMORY_ARENA_LANGMEM_PROOF_LEVEL=same-run-native npm run benchmark:arena:run -- --count 300 --difficulty hard --noise-ratio 0.5` | `artifacts/arena/run.json` |
| Native competitor runner | `npm run benchmark:competitors:native` | `artifacts/arena/native-competitors.json` |
| Connector compatibility | `npm run verify:compatibility` | `artifacts/connectors-live.json`, `artifacts/vendor-connectors-live.json`, `artifacts/vendor-api-specs.json` |
| Harness maturity | `npm run harness:maturity` | `artifacts/harness-maturity.json`, `docs/integrations/harness-maturity.md` |
| Self-hosted storage | `npm run verify:postgres` | `artifacts/postgres-live.json` |

## Claim Boundary

Cognibrain is documented as a local-first, self-hosted production candidate after target-environment gates pass. Managed SaaS uptime, billing, hosted support, autoscaling and deployment-specific SSO readiness are not claimed by this repository.

Current checked boundaries: the hard 300-scenario Arena artifact records Cognibrain as `same-run-full`, LangMem as `same-run-native` and the remaining competitor rows as `same-run-api-shape`; it is not a vendor certification or cloud proof. Connector rows are hermetic, API/spec-verified, webhook-verified for 10 priority providers and live-smoke-ready, but not tenant-verified or production-certified. Harness rows include 16 generated packages and no planned rows; the Devin-style row is a generic external-agent JSON-command contract, not a vendor-native hook. Docker is optional while the CLI remains the control plane.

The current connector and TUI plan is tracked in [Terminal Memory OS plan coverage](roadmap/terminal-memory-os-plan.md). The hard benchmark, harness and connector follow-up from `plan_.md` is tracked in [Benchmark and harness hardening plan coverage](roadmap/benchmark-harness-connector-plan.md).
