# Monitoring & Health

Keep your Cognibrain deployment healthy with built-in health checks, observability hooks, and operational runbooks.

## Health Checks

### CLI Health

```bash
cognibrain status          # Human-readable overview
cognibrain health --json   # Machine-readable health
cognibrain doctor --fix    # Diagnose and repair
```

### HTTP Health Endpoint

```bash
curl http://localhost:8787/api/health
```

```json
{
  "status": "healthy",
  "memoryCount": 42,
  "staleCandidates": 2,
  "uptime": 86400,
  "version": "0.1.0",
  "storage": "postgres",
  "lastDreamCycle": "2026-06-10T08:00:00Z"
}
```

Use this endpoint for:

- Container liveness/readiness probes
- Load balancer health checks
- Monitoring system polling

### Connector Health

```bash
cognibrain connections doctor
```

Checks all configured connectors for reachability and valid credentials.

## Operational Runbook

Daily/weekly operator checklist:

```bash
# 1. Check overall health
cognibrain status

# 2. Fix any detected issues
cognibrain doctor --fix

# 3. Review memory state
cognibrain proof

# 4. Check for stale memories needing review
cognibrain memories list --status review

# 5. Verify connectors
cognibrain connections doctor

# 6. Run release checks (if maintaining the package)
npm run release:check
```

## Key Metrics

Monitor these indicators for a healthy deployment:

| Metric | Healthy Range | Action if Unhealthy |
|--------|--------------|---------------------|
| Memory count | Growing steadily | Check if agents are recording |
| Stale candidates | < 10% of total | Run dream cycle, review items |
| Last dream cycle | < 7 days ago | Trigger manually or check schedule |
| Response time (p95) | < 200ms | Check storage backend, indexing |
| Error rate | < 1% | Check logs for patterns |
| Storage usage | Below capacity | Archive old memories, verify cleanup |

## Alerting

### Health Check Failure

```bash
#!/bin/bash
# alert-on-unhealthy.sh
STATUS=$(curl -s http://localhost:8787/api/health | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
  echo "ALERT: Cognibrain unhealthy — status: $STATUS"
  # Send to your alerting system
fi
```

### Service Down

Monitor the service manager:

```bash
# systemd
systemctl is-active cognibrain.service

# Or check the PID
cognibrain service status
```

## Logs

### Service Logs

```bash
cognibrain service logs           # Recent logs
journalctl -u cognibrain --since "1 hour ago"  # systemd
```

### Log Levels

Set via environment:

```bash
export COGNIBRAIN_LOG_LEVEL=debug  # debug, info, warn, error
cognibrain service restart
```

## Dream Cycle Monitoring

Dream cycles should run regularly. Monitor:

```bash
# Check last run
cognibrain health --json | jq '.lastDreamCycle'

# Manual trigger if overdue
cognibrain dream-plan --json
```

## Storage Health

### PostgreSQL

```bash
# Verify connectivity and schema
npm run internal -- verify:postgres

# Check connection count
psql "$MEMORY_POSTGRES_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'cognibrain';"
```

### SQLite

```bash
# Integrity check
sqlite3 .cognibrain/cognibrain.db "PRAGMA integrity_check;"
```

## Capacity Planning

| Deployment Size | Memories | Storage | RAM | CPU |
|----------------|----------|---------|-----|-----|
| Solo developer local | < 1,000 | Local JSON | 128 MB | Minimal |
| Solo developer durable | 1,000–10,000 | SQLite/Postgres | 256 MB | 0.5 core |
| Benchmark/proof lab | 10,000+ | PostgreSQL | 512 MB+ | 1+ core |
