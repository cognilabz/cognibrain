# Cognibrain Documentation

Cognibrain is a self-hosted engineering memory layer for coding agents. It
captures durable engineering context, retrieves compact evidence before an
agent acts, warns on known risky actions, records patch evidence, and keeps
claim boundaries explicit.

The docs are organized around the operator workflow, integration surfaces and
checked result artifacts. Product claims should stay tied to source, tests,
generated artifacts, audits or CI.

## Read First

- [Install and setup](install.md)
- [Usage and reference](reference.md)
- [Connectors, SDKs and community adapters](integrations.md)
- [Operations guide](operations.md)
- [Benchmark results](benchmarks.md)
- [Runtime status](status.md)
- [Evidence register](evidence.md)

## Product Snapshot

Cognibrain records durable engineering memory: repo rules, user corrections,
action guards, connector events, evidence packs, patch evidence, release
outcomes and maintenance signals. Agents can ask for compact context before
they act; operators can inspect and manage the runtime from a stable operator
CLI.

The current implementation is best understood as six cooperating layers:

| Layer | Current implementation anchor |
| --- | --- |
| Capture | CLI, MCP, HTTP and connector write paths record corrections, outcomes, source refs and patch evidence. |
| Retrieval | Evidence packs and coding context packs rank memories by semantic, lexical, graph, trust, temporal and access signals. |
| Truth gate | Claim/current-truth records suppress superseded claims and keep review-only evidence out of injected context. |
| Action guard | Guard commands surface prior corrections and risk before shell commands or file edits. |
| Feedback loop | `memory feedback-injection` records whether delivered memories were accepted or rejected. |
| Proof | Release audits and benchmark artifacts keep diagnostic results separate from quality or market claims. |

## Honest Boundaries

- Local benchmark diagnostics are not market proof unless the relevant
  judge/market gate allows that claim.
- Connector drivers and fixtures do not imply tenant verification or
  production certification without signed live artifacts and owner approval.
- Generated `artifacts/` outputs are local review evidence, not shipped source
  docs.
- The Operator UI is a separately licensed add-on.

## Documentation Standard

Result pages must point at current code, tests or generated artifacts. They
should not turn benchmark procedures or aspirational status language into
documentation copy.
