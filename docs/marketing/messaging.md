# Canonical Messaging

This is the source of truth for public cognibrain copy. Public pages should reuse these phrases or link back here so product, README, benchmark, comparison and launch copy stay aligned with the claim map in [`../claims.md`](../claims.md).

## One-Liner

Stop fixing the same agent mistake twice.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-COGNICODE`, `CB-CLAIM-EVIDENCE`.

## Thirty-Second Pitch

cognibrain is the local-first Engineering Memory OS for coding agents. It captures corrections, repo policies, architecture decisions, review feedback and tool outcomes as evidence-grade memory, then injects the right scoped context before the next code change.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-EVIDENCE`, `CB-CLAIM-PATCH-EVIDENCE`.

## Long Product Description

cognibrain turns agent experience into reusable engineering memory. Instead of storing vague summaries or generic user facts, it captures what matters for software work: repo-specific policies, previous corrections, PR review feedback, tool outcomes, procedures, architecture decisions, forbidden actions and codebase evolution. Every context pack is scoped, cited, policy-checked and explainable before it reaches the agent.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-GUARD`, `CB-CLAIM-MCP`, `CB-CLAIM-PATCH-EVIDENCE`.

## Value Props

- Correction carryover: user and reviewer corrections become future context instead of disappearing into chat history. Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-CONTEXT`.
- Evidence-grade recall: context packs include source, scope, trust, graph path, temporal state and policy decisions. Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-PATCH-EVIDENCE`.
- Coding-agent guardrails: known bad commands, generated-file edits and stale repo rules can warn or block before action. Claim ID: `CB-CLAIM-GUARD`.
- Self-hosted ownership: teams can run the API, dashboard, MCP server, connectors and storage under their own controls. Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-STORAGE`.
- Connector path: official manifests and built-in native drivers cover GitHub, GitLab, Azure DevOps, Slack, Discord, Teams, Jira, Confluence, Notion, Linear, Gmail, Google Drive, Google Calendar, Asana, ClickUp, Sentry, Datadog, PagerDuty and PostHog with hermetic verifier proof. Claim IDs: `CB-CLAIM-CONNECTORS`, `CB-CLAIM-CONNECTOR-MATURITY`.
- Same-benchmark proof: Benchmark Arena compares Cognibrain, Mem0, Graphiti/Zep, Cognee, LangMem and GBrain on one local synthetic engineering-memory runner with explicit proof levels. Claim ID: `CB-CLAIM-BENCHMARK-ARENA`.

## Proof Points

- CogniCodeBench: 100 deterministic synthetic coding-agent scenarios with measured ablations. Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-ABLATION`.
- Benchmark Arena: same scenario stream across Cognibrain and API-shaped competitor adapters, with proof-level boundaries visible in the report. Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`.
- EvidencePack: inspectable why-used artifact across CLI, API and MCP. Claim ID: `CB-CLAIM-EVIDENCE`.
- Patch Evidence Trail: records memories, corrections, procedures, tool outcomes and stale-rule exclusions for a patch. Claim ID: `CB-CLAIM-PATCH-EVIDENCE`.
- Production gates: `verify:nextgen`, `verify:postgres`, connector verification, `doctor --publish`, package dry-run and `release:check`. Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-RELEASE`.

## Comparison Snippets

- Mem0 remembers user facts broadly; cognibrain is the only `same-run-full` system in Benchmark Arena because it carries corrections into action guards and patch evidence. Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`.
- GBrain is a personal/graph memory surface; cognibrain adds API-first team and harness memory plus same-run patch-evidence proof. Claim IDs: `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-MARKET`.
- Hindsight builds general agent memory infrastructure; cognibrain focuses on corrections, review feedback, command outcomes and next-patch evidence. Claim ID: `CB-CLAIM-MARKET`.
- Zep/Graphiti model temporal conversational facts; cognibrain models which engineering rule is valid before a code change. Claim ID: `CB-CLAIM-MARKET`.
- Cognee connects knowledge sources; cognibrain turns engineering feedback into better agent action. Claim ID: `CB-CLAIM-MARKET`.

## FAQ

### Is cognibrain production ready?

It is a self-hosted production candidate when the target deployment passes the release gates. It is not a managed SaaS certification. Claim ID: `CB-CLAIM-PRODUCTION`.

### Does CogniCodeBench prove real customer repo performance?

No. It proves a synthetic engineering-memory loop in this checkout. Real repository claims need deployment-specific harness evidence. Claim IDs: `CB-CLAIM-COGNICODE`, `CB-CLAIM-ABLATION`.

### Which connectors are production certified?

The native connector drivers have hermetic vendor-driver proof in this repo. Tenant certification still requires fresh deployment credentials and a live smoke artifact because every vendor account, permission model and network boundary is different. Claim IDs: `CB-CLAIM-CONNECTORS`, `CB-CLAIM-CONNECTOR-MATURITY`.

### Does Benchmark Arena prove competitor cloud performance?

No. It proves same-run behavior in this checkout. Competitor rows are local API-shape adapters unless a vendor-hosted artifact is explicitly imported. Claim ID: `CB-CLAIM-BENCHMARK-ARENA`.

## Approved Claims List

Use the exact claim boundaries in [`../claims.md`](../claims.md). Do not use "best", "market leader", "fully managed SaaS", "certified vendor integration", "vendor-hosted competitor benchmark proof", or "real customer benchmark proof" unless a comparable external artifact or deployment-specific evidence is linked.
