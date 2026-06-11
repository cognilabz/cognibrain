# Security

Security configuration for production Cognibrain deployments.

## Authentication

Cognibrain supports multiple authentication methods:

### API Key

The simplest auth method for local and team deployments:

```bash
export MEMORY_API_KEY="your-secure-random-key"
```

Clients authenticate with:

```bash
curl -H "X-API-Key: your-key" http://localhost:8787/api/memories
```

!!! tip "Generate a strong key"
    ```bash
    openssl rand -hex 32
    ```

### JWT / OIDC

For enterprise deployments with an existing identity provider:

```bash
export MEMORY_OIDC_ISSUER="https://auth.example.com"
export MEMORY_OIDC_AUDIENCE="cognibrain"
```

Clients authenticate with:

```bash
curl -H "Authorization: Bearer your-jwt-token" http://localhost:8787/api/memories
```

### No Auth (Development Only)

The `solo-dev` profile disables auth by default. This is **only** safe for local development on a single machine.

!!! danger "Never run without auth in production"
    Any network-accessible Cognibrain instance must have authentication configured.

## Authorization

### Policy Mode

```bash
export MEMORY_POLICY_MODE="production"  # Default-deny for unmatched policy checks
```

| Mode | Behavior |
|------|----------|
| `development` | Permissive — allows most operations without explicit policy |
| `production` | Strict — unmatched policy checks default to deny |

### Actor Scopes

API keys and tokens can be scoped to specific operations:

| Scope | Allows |
|-------|--------|
| `read` | List and retrieve memories, context packs |
| `write` | Create, update, archive memories |
| `admin` | Service management, connector config, dream cycles |

## Secret Management

### Principles

1. **Never commit secrets** to source control
2. **Use environment variables** for API keys and tokens
3. **Use `env:` references** in connector configs (not literal values)
4. **Rotate keys** periodically

### Connector Secrets

Connector configurations store only references to secrets:

```bash
# Correct — references an env var
cognibrain connections add slack --token-env MEMORY_SLACK_TOKEN

# WRONG — never do this
cognibrain connections add slack --set token=xoxb-actual-secret
```

### Environment Variable Priority

| Source | Priority |
|--------|----------|
| CLI flags | Highest |
| Environment variables | High |
| Runtime-local config file | Medium |
| Profile defaults | Lowest |

## Network Security

### Bind Address

By default, Cognibrain binds to `127.0.0.1` (localhost only):

```bash
# Only accessible from the same machine (default)
export COGNIBRAIN_HOST="127.0.0.1"

# Accessible from network (use with TLS + auth)
export COGNIBRAIN_HOST="0.0.0.0"
```

!!! warning "Binding to 0.0.0.0"
    If you bind to all interfaces, you **must** configure authentication and use TLS.

### TLS

Cognibrain doesn't terminate TLS directly. Use a reverse proxy:

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
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Data Security

### Memory Content

- Memories may contain sensitive engineering knowledge
- Access is controlled by authentication and policy mode
- Consider network isolation for deployments with sensitive content

### Connector Data

- Connector tokens are stored as `env:` references, never as plaintext
- The Operator UI reads connector configs in redacted form
- Live smoke tests are opt-in and never run automatically

### Backup Security

- Encrypt database backups at rest
- Restrict access to backup storage
- Include backup verification in your security review

## Recommended Production Posture

```bash
# Authentication
export MEMORY_API_KEY="$(openssl rand -hex 32)"

# Or OIDC for enterprise
export MEMORY_OIDC_ISSUER="https://auth.company.com"
export MEMORY_OIDC_AUDIENCE="cognibrain"

# Strict policy
export MEMORY_POLICY_MODE="production"

# Database-backed persistence
export MEMORY_POSTGRES_URL="postgresql://cognibrain:secret@db:5432/cognibrain"

# Localhost-only binding (reverse proxy handles external access)
export COGNIBRAIN_HOST="127.0.0.1"
```

## Security Checklist

- [ ] Authentication configured (API key or OIDC)
- [ ] Policy mode set to `production`
- [ ] TLS configured (via reverse proxy)
- [ ] Bind address restricted to localhost
- [ ] Connector secrets in environment variables
- [ ] Database credentials not in source control
- [ ] Backup encryption enabled
- [ ] Access logs enabled
- [ ] Regular key rotation scheduled
