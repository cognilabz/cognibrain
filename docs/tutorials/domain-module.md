# Domain Module Tutorial

Domain modules package ontology, extraction hints, retrieval defaults, privacy behaviour, and application-level evaluation into a reusable installable unit.

## 1. Preview An Official Module

```bash
./bin/cognibrain.mjs memory marketplace
./bin/cognibrain.mjs memory marketplace-plan domain-coding
```

The install plan shows connector changes, retrieval profiles, persona defaults, and security scan results before anything is written.
It also reports signature metadata, requested permissions, version compatibility, and rating/trust signals so operators can review module risk before install.

## 2. Install Into A Local Store

```bash
export MEMORY_DB_PATH=/tmp/cognibrain-domain.json
./bin/cognibrain.mjs memory marketplace-install domain-coding
./bin/cognibrain.mjs memory profiles
./bin/cognibrain.mjs memory personas
```

An installed module should be immediately visible in retrieval profiles and operator personas, so harnesses can opt into domain behaviour without custom code.
Domain modules also activate runtime behaviour: aliases are loaded into the entity registry, retrieval defaults are exposed as a `domain:<id>` profile, and enrichment rules can add tags or privacy behaviour to new memories.

## 3. Contribute A Module

Open a "Domain module contribution" issue with:

- ontology terms and aliases,
- enrichment and retrieval behaviour,
- privacy/redaction expectations,
- evaluation fixtures and expected artifact output.
- signature metadata, requested permissions, and supported cognibrain version range.

Run `npm run verify:nextgen` before proposing the module. If the module makes public claims, run `npm run leaderboard` and link the generated artifact.
