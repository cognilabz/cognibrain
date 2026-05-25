# Backup And Restore

Self-hosted operators own backup and restore.

## Export

```bash
MEMORY_BACKUP_REF=local-backup://release ./bin/cognibrain.mjs memory migration-export managed > managed-bundle.json
```

## Verify Recovery

```bash
./bin/cognibrain.mjs memory backup-verify managed-bundle.json
```

For encrypted memories, provide the deployment keyring through the documented runtime settings. Do not place secrets in memory content.

Claim IDs: `CB-CLAIM-PRODUCTION`, `CB-CLAIM-STORAGE`.
