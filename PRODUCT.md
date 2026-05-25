# PRODUCT.md

## Product

cognibrain

## Publisher

Cognilabz

## Register

product

## Product Purpose

cognibrain is a local-first Evidence-grade Agent Memory OS for engineering workflows and a CLI-first operator console for AI agents. It helps technical teams inspect what an agent remembers about a codebase, why that context was retrieved, whether memory hygiene is healthy, and whether benchmark proof supports production use.

## USP

Stop fixing the same agent mistake twice. cognibrain captures corrections, repo policies, architecture decisions, review feedback and tool outcomes as evidence-grade memory, then injects the right context before the next coding change.

Canonical public messaging lives in `docs/marketing/messaging.md`; public claims must map to `docs/claims.md`.

## Benefits

- Reduces repeated agent onboarding by preserving durable project and user context across harnesses.
- Reduces repeated coding-agent mistakes by turning reviews, failed commands and repo conventions into scoped Engineering Memory.
- Makes recall inspectable through evidence packs instead of opaque vector hits.
- Warns or blocks known bad actions such as editing generated files, using the wrong package manager, or following stale migration instructions.
- Lets teams enforce memory boundaries with scopes, consent, policy rules, auth, and audit logs.
- Gives operators reproducible proof through CogniCodeBench, Benchmark Arena, local benchmarks, HTTP and vendor connector verifiers, Postgres gates, CLI status surfaces, and optional dashboard artifacts.
- Lets self-hosted operators automate startup from the CLI through systemd, launchd, or Windows Task Scheduler without making the dashboard mandatory.
- Keeps deployment ownership local-first while supporting self-hosted team storage and native connector integrations across code hosts, chat, docs, tasks, incident tools, observability and product systems.

## Users

- Engineers evaluating memory before connecting coding agents to repositories.
- Technical founders and operators who need proof, not vague AI claims.
- Agent platform builders who care about source quality, recall trust, lifecycle maintenance, and benchmark evidence.

## Primary Job

Show whether coding-agent memory is safe and useful enough to inject into a real workflow, and make the platform/operator boundary obvious.

## Design Principles

- Proof first: surface health, evidence, and benchmark state before decorative explanation.
- Useful density: make the UI scannable for repeated technical review without becoming cramped.
- Quiet confidence: Cognilabz style is practical, precise, and workflow-first.
- Every panel earns its place: remove anything that does not help inspect recall quality, lifecycle hygiene, or proof.
- Product familiarity over novelty: standard app patterns, strong typography, clear controls, no theatrical effects.

## Tone

Calm, technical, direct. Avoid hype. Prefer nouns like recall, evidence, source, trust, lifecycle, benchmark, artifact, and gate.

## Anti-References

- Generic SaaS hero dashboards.
- Purple-gradient AI tooling.
- Decorative cards with no user action.
- Fake navigation that does not navigate.
- Marketing copy inside the app surface.
- Big-number hero metrics that hide the underlying proof.

## Success Criteria

- The app name appears as `cognibrain` in the app and browser title.
- The Cognilabz logo is visible without making the product name `Cognilabz`.
- A first-time user understands the three jobs: test recall, run memory hygiene, inspect proof.
- A public README visitor understands setup, usage, benefits, production-readiness scope, CogniCodeBench, Benchmark Arena, and how cognibrain differs from Mem0/GBrain-style alternatives.
- Launch copy reuses the canonical messaging pack and keeps self-hosted readiness separate from managed SaaS future claims.
- The terminal CLI is the primary product surface; the dashboard remains optional and works on desktop and mobile with no horizontal overflow.
- README feels like a polished public repo overview, not an internal report.
