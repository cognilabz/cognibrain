# Cognibrain

Cognibrain is a self-hosted engineering memory layer with an open-source runtime
and a separately licensed operator experience.

## Language

**Memory**:
A durable, scoped fact, correction, procedure, preference, or evidence item that
can be recalled before an agent or operator acts.
_Avoid_: note, snippet, random context

**Operator**:
The human or service account responsible for inspecting, correcting, approving,
and maintaining Cognibrain memory state.
_Avoid_: admin when the role is about memory stewardship rather than deployment

**Operator UI**:
The commercial, opt-in Next.js browser surface for managing memories,
connectors, reports, dream cycles, and harness installation.
_Avoid_: OSS dashboard, public dashboard

**Operator CLI**:
The open-source, text-first command surface for setup, status, memory work,
connectors, proof, and automation.
_Avoid_: TUI, dashboard

**Connector**:
A configured integration source or sink that can ingest external events,
surface review queues, or write back memory-linked context.
_Avoid_: plugin when the component syncs external operational data

**Harness**:
An installable agent or shell lifecycle integration that asks Cognibrain for
context, guards actions, and records outcomes.
_Avoid_: connector when the component wraps an agent workflow

**Dream Cycle**:
A memory maintenance pass that can detect stale or contradictory memories,
produce summaries, and schedule operator review.
_Avoid_: cleanup job, cron when discussing the domain behavior

## Example Dialogue

Developer: "Should the OSS dashboard manage paid tenants?"

Domain expert: "No. The Operator CLI stays open source. The Operator UI is a
commercial add-on, and it manages memories, connectors, reports, dream cycles,
and harnesses only when a licensed deployment opts in."
