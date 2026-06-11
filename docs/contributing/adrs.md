# Architecture Decisions

Cognibrain records significant architectural decisions as ADRs (Architecture Decision Records). Each ADR captures the context, decision, and consequences of a choice that affects the system's structure.

## Decision Log

### ADR-0001: Commercial Operator UI Boundary

**Status:** Accepted

**Context:** Cognibrain has both an open-source runtime and a commercial operator experience. The boundary between what's MIT-licensed and what's commercially licensed needs to be clear and enforceable.

**Decision:** Keep the CLI, API, SDK, connectors, harness templates, and docs in the MIT-licensed open-source package. The browser Operator UI is a separately licensed commercial add-on.

**Consequences:**

- The paid control-plane experience cannot be accidentally redistributed through the OSS npm package
- Licensed checkouts can still run the Next.js UI against the same local runtime
- All core functionality remains accessible via CLI and API without the commercial UI
- The `operator-ui/` directory is excluded from the npm package via `.gitignore` and `package.json` files configuration

---

## Writing New ADRs

When making a significant architectural decision, create a new ADR:

### When to Write an ADR

- A decision affects the public API surface
- A decision changes the storage model or data flow
- A decision sets a boundary between OSS and commercial
- A decision constrains future implementation choices
- Multiple reasonable alternatives were considered

### Format

```markdown
# [Title]

[Brief description of the decision and its rationale]
```

ADRs are stored in `docs/adr/` and kept deliberately concise. They record the **what** and **why**, not the **how** (that's in the code).

### File Naming

```
docs/adr/NNNN-short-title.md
```

Sequential numbering, lowercase with hyphens.

## Principles Behind Decisions

The following principles guide architectural decisions:

1. **Local-first** — everything works on a single machine without network
2. **Text-first** — CLI output is the primary interface, not a GUI
3. **Evidence-backed** — claims require artifact proof
4. **Surface-agnostic** — the memory engine doesn't know which surface is calling it
5. **Operator-in-the-loop** — automated processes surface items for human review
6. **Open core** — core functionality is MIT; operator experience is commercial
