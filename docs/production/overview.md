# Production Overview

cognibrain is a self-hosted production candidate after target-environment gates pass. This is not a managed SaaS certification.

## Tiers

| Tier | Label | Requirements |
| --- | --- | --- |
| Local demo | `local-ready` | JSON storage, CLI-first operator surface, native service automation, optional local dashboard, no public API |
| Team install | `self-hosted candidate` | API keys, durable storage, backup, TLS ingress |
| Target deployment | `deployment-verified` | Fresh `release:check`, Postgres, connector and doctor artifacts |
| Managed service | `managed SaaS future` | Hosted controls, SSO, billing, support and SLA proof |

## Release Gate

```bash
npm run release:check
```

Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-RELEASE`.
