# Connector Authoring

Create a connector plan before installing it:

```bash
./bin/cognibrain.mjs memory marketplace-plan market-official-chat
```

Register a custom connector:

```bash
./bin/cognibrain.mjs memory connector-register '{"id":"support-chat","name":"Support Chat","kind":"chat","version":"1.0.0","direction":"two_way","capabilities":["ingest","webhook","writeback"],"auth":"token","defaultSourceKind":"transcript","metadataMapping":{"channel":"metadata.channel","messageId":"externalId"}}'
./bin/cognibrain.mjs memory connector-sync support-chat "Support confirmed the release-note owner."
./bin/cognibrain.mjs memory connector-sync-records support-chat
```

Connector manifests should declare direction, auth style, default source kind, capabilities, and metadata mapping. Writeback-capable connectors must also support ingest, so the install plan can keep the memory graph auditable.
