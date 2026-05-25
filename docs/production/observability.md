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

`cognibrain status`, `cognibrain memories`, `cognibrain connections`, and `cognibrain service status` expose the day-to-day operator state in the terminal. The optional dashboard reads `/metrics` and connector health when you want a browser view.

Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-OBSERVABILITY`.
