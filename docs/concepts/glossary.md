# Domain Glossary

Precise definitions for Cognibrain's domain language. Using consistent terminology prevents confusion between concepts — especially when communicating with coding agents.

---

## Core Concepts

### Memory

A durable, scoped fact, correction, procedure, preference, or evidence item that can be recalled before an agent or operator acts.

!!! warning "Avoid"
    Don't use "note", "snippet", or "random context" when referring to memories. A memory is structured, scoped, and participates in retrieval ranking.

---

### Operator

The human or service account responsible for inspecting, correcting, approving, and maintaining Cognibrain memory state.

!!! warning "Avoid"
    Don't use "admin" when the role is about memory stewardship rather than deployment.

---

### Operator Experience

The V1 workflow where the developer inspects, corrects, approves, and maintains Cognibrain memory through harness prompts, action guards, and CLI commands in the same work context.

!!! warning "Avoid"
    Don't use "Operator UI", "dashboard", or "browser control plane" for the V1 product surface.

---

### Operator CLI

The text-first command surface for setup, status, memory work, connectors, proof, and automation.

!!! warning "Avoid"
    Don't use "TUI" or "dashboard" when referring to the CLI.

---

### Connector

A configured integration source or sink that can ingest external events, surface review queues, or write back memory-linked context.

!!! warning "Avoid"
    Don't use "plugin" when the component syncs external operational data.

---

### Harness

An installable agent or shell lifecycle integration that asks Cognibrain for context, guards actions, and records outcomes.

!!! warning "Avoid"
    Don't use "connector" when the component wraps an agent workflow.

---

### Dream Cycle

A memory maintenance pass that can detect stale or contradictory memories, produce summaries, and schedule operator review.

!!! warning "Avoid"
    Don't use "cleanup job" or "cron" when discussing the domain behavior.

---

## Lifecycle Concepts

### Context Pack

A curated, token-budgeted collection of memories relevant to a specific task. Returned by the `context` command and MCP tool.

---

### Action Guard

A pre-action check that evaluates a planned operation against stored knowledge. Can result in:

- **Allowed** — no known issues
- **Warned** — proceed with caution
- **Blocked** — operation should not proceed

---

### Patch Evidence

A record of what happened during a task: files changed, commands executed, and memories that were recalled or created.

---

### Correction

A human-provided fix or clarification stored as a high-authority memory. Corrections take precedence over auto-ingested facts.

---

### Outcome

A recorded result of a command execution, including exit code and optional stderr. Used to build history and improve future guards.

---

## Maintenance Concepts

### Staleness

A memory's state when it hasn't been recalled or referenced for an extended period. Stale memories are candidates for operator review.

---

### Contradiction

A detected conflict between two or more memories that make opposing claims. Surfaced for operator resolution.

---

### Consolidation

The process of merging related, overlapping memories into a single cleaner memory. Always requires operator approval.

---

## Architecture Concepts

### Surface

An integration protocol through which agents or operators interact with Cognibrain (CLI, MCP, HTTP API, SDK).

---

### Daemon

The local HTTP API server process that serves all surfaces. Optional for simple local-direct usage; required for production.

---

### Profile

A pre-configured set of defaults for the single-developer workflow or benchmark proof lab (`solo-dev`, `benchmark`).

---

### Runtime Root

The directory where Cognibrain stores runtime state (config, memories, connector state, logs). Default: `.cognibrain/`.

---

## Scope Hierarchy

| Scope | Visibility | Example |
|-------|-----------|---------|
| `global` | All contexts | "Always use semantic versioning" |
| `repo` | Within a specific repository | "This project uses Jest for testing" |
| `user` | For a specific user, any repo | "I prefer verbose error messages" |
| `task` | Relevant to task types | "Release tasks require changelog updates" |
