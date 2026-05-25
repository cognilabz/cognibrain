# Migrations

Use migration bundles to move from local-first operation toward managed or self-hosted target environments.

```bash
./bin/cognibrain.mjs memory migration-export managed > managed-bundle.json
curl -X POST http://localhost:8787/migration/import --data-binary @managed-bundle.json
```

The bundle includes memories, profiles, personas, connectors, marketplace modules, retention rules, compliance metadata and deployment artifact references.

Claim ID: `CB-CLAIM-PRODUCTION`.
