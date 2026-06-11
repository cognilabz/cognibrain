# Cognibrain Documentation

Cognibrain is a self-hosted engineering memory layer for coding agents. It
captures durable engineering context, retrieves compact evidence before an
agent acts, warns on known risky actions, records patch evidence, and keeps
claim boundaries explicit.

The docs are organized around the operator workflow, integration surfaces and
checked result artifacts. Product claims should stay tied to source, tests,
generated artifacts, audits or CI.

## Start Here

Use this page as the map. The README explains the product story; these docs
explain how to install, integrate, operate and verify it.

If you are trying to judge the repo quickly, use this reading path:

1. Read the root README through "What This Repo Represents" and "Plain-English Mental Model."
2. Run the install fast path in [Install and setup](install.md).
3. Use [Usage and reference](reference.md) for the daily `context -> guard -> work -> outcome -> patch-evidence` loop.
4. Use [Benchmark results](benchmarks.md) only after you understand the product loop; it explains what is proven and what remains blocked.

| Reader | Best first page | Why |
| --- | --- | --- |
| New user | [Install and setup](install.md) | Get a local agent memory loop running quickly. |
| Coding-agent maintainer | [Usage and reference](reference.md) | Learn the context, guard, outcome and patch-evidence lifecycle. |
| Platform or connector builder | [Connectors, SDKs and community adapters](integrations.md) | Choose MCP, CLI or SDK/HTTP and wire external systems safely. |
| Operator | [Operations guide](operations.md) | Run the service, manage runtime state and keep generated evidence separate from source docs. |
| Reviewer or buyer | [Benchmark results](benchmarks.md) and [Evidence register](evidence.md) | See what is proved, what is diagnostic and what remains claim-blocked. |
| Release owner | [Runtime status](status.md) | Check implementation surfaces and evidence anchors before shipping. |

## Core Pages

- [Install and setup](install.md)
- [Usage and reference](reference.md)
- [Connectors, SDKs and community adapters](integrations.md)
- [Operations guide](operations.md)
- [Benchmark results](benchmarks.md)
- [Runtime status](status.md)
- [Evidence register](evidence.md)

## Daily Mental Model

Cognibrain is easiest to understand as a before, during and after loop:

| Moment | Command family | What it protects |
| --- | --- | --- |
| Before work | `context`, `memories coding-context` | Pull only the repo rules, corrections and prior evidence that matter for this task. |
| Before a risky action | `guard` | Surface known bad commands, destructive edits or release-policy mismatches before they happen. |
| After a command | `outcome` | Preserve what actually happened while the result is fresh. |
| After a patch | `patch-evidence` | Connect changed files, verification commands and memory ids to the work. |
| After context delivery | `memory feedback-injection` | Teach retrieval whether a delivered memory helped or hurt. |

In plain language: Cognibrain is the place where an agent checks "what did we already learn here?" before acting, "is this action known to be risky?" before touching code, and "what proof did this patch leave behind?" after the work is done.

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

## Market Readiness

The current repo is professionally strongest as engineering memory for coding
agents: context before work, guard before risky actions, patch evidence after
work, and audits that keep claims tied to code.

Current checked proof:

- Product truth audit: 69/69 checks passed, 0 open code-truth gaps.
- Plan closure: 16/16 plan-gap checks, 10/10 latest-analysis checks and 10/10
  full-plan proof checks.
- CogniCodeBench: 1,000 engineering-memory scenarios, 100.0% full-system
  diagnostic score and 96.0% integrity score.
- Public dataset diagnostics: LoCoMo 57.9%, LongMemEval-S 99.8% and BEAM 1M
  51.3%, each bounded as local diagnostic evidence.
- Real-world black-box harness: manifest coverage, raw outputs and telemetry
  are ready, but quality scoring and market leaderboard claims remain blocked
  until an LLM/harness judge and original competitor commands are configured.

This is enough to show a serious proof culture and a clear product identity.
It is not enough for a blanket "best on market" claim; [Benchmark results](benchmarks.md)
and the [Evidence register](evidence.md) list the exact blockers.

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
