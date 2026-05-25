# EvidencePack

An EvidencePack is the canonical "why was this memory used?" artifact.

It includes selected memories, excluded memories, policy decisions, graph paths, temporal state, trust/confidence signals and source citations.

```mermaid
flowchart LR
  Query["Agent query"] --> Search["Hybrid retrieval"]
  Search --> Policy["Policy and validity gates"]
  Policy --> Evidence["EvidencePack"]
  Evidence --> Agent["Injected context"]
```

Claim ID: `CB-CLAIM-EVIDENCE`.
