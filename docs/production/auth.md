# Auth

Networked deployments must fail closed.

## Required Settings

```bash
export MEMORY_REQUIRE_AUTH=true
export MEMORY_API_KEYS=...
```

Clients send `x-api-key`.

## Local Mode

Local development can run without keys when the API is bound to a trusted local interface. Do not expose that mode on a network.

Claim ID: `CB-CLAIM-PRODUCTION`.
