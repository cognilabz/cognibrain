# Policy-Aware Retrieval

Retrieval is not only ranking. Before memory reaches an agent, cognibrain evaluates scope, consent, policy rules, temporal state, contradiction state and unsafe-to-inject confidence.

Denied or excluded memories appear in EvidencePacks so operators can see what was kept out.

```mermaid
flowchart LR
  Query["Agent query"] --> Scope["Scope and consent check"]
  Scope --> Policy["Policy rule evaluation"]
  Policy --> Decision{"Allowed?"}
  Decision -->|yes| Rank["Rank and cite memory"]
  Decision -->|no| Exclude["Record exclusion reason"]
  Rank --> Pack["EvidencePack"]
  Exclude --> Pack
```

Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-PRODUCTION`.
