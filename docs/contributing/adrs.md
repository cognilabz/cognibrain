# Architecture Decisions

Cognibrain records significant architectural decisions as ADRs (Architecture Decision Records). Each ADR captures the context, decision, and consequences of a choice that affects the system's structure.

## Decision Log

### ADR-0001: Commercial Operator UI Boundary

**Status:** Superseded by ADR-0062

**Context:** Cognibrain previously had both an open-source runtime and a commercial operator experience. The boundary between what's MIT-licensed and what's commercially licensed needed to be clear and enforceable.

**Decision:** Superseded. V1 no longer includes an Operator UI as a product surface; operator work is harness-native and CLI-backed.

**Consequences:**

- The previous commercial dashboard boundary is no longer current product scope
- Future browser inspection tools require a new ADR before becoming product surface

---

### ADR-0002: Repo-Owned Harness Package

**Status:** Accepted

**Context:** Agent memory use should not depend on a user reminder or on a global Codex skill being selected. Harness instructions need to live where each agent host can discover them from the repository.

**Decision:** `config all` writes native, commit-ready repository harness files for every supported harness. Codex uses `AGENTS.md` plus `.agents/skills/cognibrain/SKILL.md`; other harnesses use their native discovery paths. Global installation remains a fallback.

**Consequences:**

- Repository contracts use portable commands such as `npx @cognilabz/cognibrain`
- Managed files can be fully regenerated; advisory files are updated only through marked Cognibrain blocks
- `.cognibrain-harness-package.json` remains the audit surface for paths, hashes, ownership mode, ignored state, and check results
- `config all --check` reports drift across all supported repo-owned harness contracts by default without acting as a hard CI gate

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
6. **Harness-native operator experience** — agent-facing work happens in harnesses; explicit inspection and repair happens through the CLI
