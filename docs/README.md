# Cognibrain Documentation

Cognibrain is a self-hosted engineering memory layer for coding agents. The CLI is the operator surface, MCP is the agent surface, and SDK/HTTP is reserved for custom integrations.

## Read First

- [Install and self-hosting](install.md)
- [Connectors and integration surfaces](integrations.md)
- [Operations and production boundary](operations.md)
- [CLI, MCP, API and SDK reference](reference.md)
- [Benchmarks](benchmarks.md)
- [Production readiness status](status.md)
- [Claims and evidence map](claims.md)

## Product Snapshot

![Cognibrain CLI home](assets/cli-home.svg)

Cognibrain stores durable engineering memory and returns cited context before the next agent action. It is built for repo rules, review corrections, commands, connector events, timelines, graph links, evidence packs and release proof.

## Claim Boundary

Cognibrain is documented as a local-first, self-hosted production candidate after target-environment gates pass. Managed SaaS uptime, billing, hosted support, autoscaling and deployment-specific SSO readiness are not claimed by this repository.

Generated benchmark, connector and truth reports are internal CI/build outputs under `artifacts/`. They are intentionally ignored by git and excluded from the npm package.
