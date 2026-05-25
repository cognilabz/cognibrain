# Quickstart

## Install

```bash
npm install
./bin/cognibrain.mjs setup --self-hosted
```

For the published package path:

```bash
npx cognibrain init
```

## First Memory

```bash
./bin/cognibrain.mjs memory add "Atlas releases require npm test before publish."
./bin/cognibrain.mjs memory evidence-pack "What should Atlas do before release?"
```

## Verify

```bash
./bin/cognibrain.mjs doctor --publish
npm run benchmark:cognicode
npm run benchmark:arena
```

Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-COGNICODE`, `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-PRODUCTION`.
