# Observability

## Endpoints

```bash
curl http://localhost:8787/health
curl http://localhost:8787/metrics
curl http://localhost:8787/connectors/health
curl http://localhost:8787/audit/chain
```

## What To Watch

- request health and API status
- search count, no-hit rate and low-confidence search rate
- connector last sync, writeback status and lag
- dream count, dream actions and duration evidence from audit events
- policy denials
- benchmark drift
- repeated mistake rate from CogniCodeBench

The dashboard reads `/metrics` and connector health to show operational state.

Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-OBSERVABILITY`.
