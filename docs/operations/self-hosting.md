# Self-Hosting

Cognibrain is designed to run as a self-hosted service controlled entirely by the CLI. This guide covers persistent deployment on your own infrastructure.

## Overview

A production Cognibrain deployment consists of:

1. **The Cognibrain daemon** — HTTP API serving all surfaces
2. **A storage backend** — SQLite or PostgreSQL
3. **A service manager** — keeps the daemon running across reboots
4. **(Optional) Connectors** — configured integrations to external systems
5. **(Optional) Operator UI** — commercial browser dashboard

## Quick Production Setup

```bash
# Install
npm i -g @cognilabz/cognibrain

# Initialize with team or enterprise profile
cognibrain init --profile team --yes

# Configure storage
export MEMORY_POSTGRES_URL="postgresql://user:pass@localhost:5432/cognibrain"
cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL

# Configure auth
export MEMORY_API_KEY="your-secure-api-key"
export MEMORY_POLICY_MODE="production"

# Install as service
cognibrain service install --activate

# Verify
cognibrain status
cognibrain doctor --fix
```

## Service Management

### Installation

```bash
cognibrain service plan              # Preview what will be installed
cognibrain service install --activate # Install and start
```

### Supported Managers

| Platform | Default | System-wide |
|----------|---------|-------------|
| **Linux** | systemd user service | `--system` for system service |
| **macOS** | launchd LaunchAgent | `--system` for LaunchDaemon |
| **Windows** | Task Scheduler | Startup task |

### Operational Commands

```bash
cognibrain service status     # Is it running?
cognibrain service logs       # View recent logs
cognibrain service restart    # Restart after config change
cognibrain service uninstall --deactivate  # Remove completely
```

## Storage Configuration

### PostgreSQL (Recommended for Production)

```bash
# Set the connection URL
export MEMORY_POSTGRES_URL="postgresql://cognibrain:secret@db.internal:5432/cognibrain"

# Add the storage connector
cognibrain connections add storage-postgres --url-env MEMORY_POSTGRES_URL

# Verify connectivity
npm run internal -- verify:postgres
```

!!! tip "Connection pooling"
    For high-throughput deployments, place a connection pooler (PgBouncer, pgpool) between Cognibrain and PostgreSQL.

### SQLite (Single-Machine)

For single-machine deployments that don't need PostgreSQL:

```bash
cognibrain connections add storage-sqlite
```

SQLite storage lives at `.cognibrain/cognibrain.db` by default.

## Multi-Machine Deployment

For teams sharing a Cognibrain instance:

```mermaid
graph TB
    subgraph "Developer Machines"
        D1[Dev 1 Agent]
        D2[Dev 2 Agent]
        D3[CI Runner]
    end

    subgraph "Cognibrain Server"
        API[Cognibrain Daemon]
        PG[(PostgreSQL)]
    end

    D1 -->|HTTPS + API Key| API
    D2 -->|HTTPS + API Key| API
    D3 -->|HTTPS + API Key| API
    API --> PG
```

Requirements:

- PostgreSQL storage backend
- API key or OIDC authentication
- Network access from developer machines to the Cognibrain host
- TLS termination (reverse proxy recommended)

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name cognibrain.internal.example.com;

    ssl_certificate /etc/ssl/certs/cognibrain.crt;
    ssl_certificate_key /etc/ssl/private/cognibrain.key;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Runtime Root

All runtime state lives under the runtime root:

```bash
# Default
.cognibrain/

# Override
export COGNIBRAIN_RUNTIME_ROOT=/var/lib/cognibrain
cognibrain service restart
```

## Backup Strategy

### Automated Backups

```bash
#!/bin/bash
# backup-cognibrain.sh
BACKUP_DIR="/backup/cognibrain/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# PostgreSQL
pg_dump "$MEMORY_POSTGRES_URL" > "$BACKUP_DIR/cognibrain.sql"

# Runtime config (non-secret)
cp -r /var/lib/cognibrain/config.json "$BACKUP_DIR/"
```

### Restore

```bash
psql "$MEMORY_POSTGRES_URL" < backup/cognibrain.sql
cognibrain service restart
cognibrain doctor --fix
```

## Smoke Test

After any deployment:

```bash
cognibrain status
cognibrain doctor --fix
cognibrain connections doctor
cognibrain health --json
```

For package maintainers:

```bash
npm run verify:selfhosted
```
