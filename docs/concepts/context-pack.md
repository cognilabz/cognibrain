# Context Pack

Coding context packs turn Engineering Memory into agent-ready sections:

- relevant repo policies
- procedures before action
- previous corrections
- known pitfalls
- architecture decisions
- tool commands
- forbidden actions
- graph and temporal notes

High-impact stale or unsafe memories are excluded and recorded in the pack.

```mermaid
flowchart LR
  Agent["Agent or harness"] --> Router["Memory Router"]
  Router --> Engineering["Engineering Memory"]
  Router --> Evidence["Evidence graph"]
  Engineering --> Pack["Coding Context Pack"]
  Evidence --> Pack
  Pack --> Agent
```

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-EVIDENCE`.
