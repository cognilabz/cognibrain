# Quickstart

Use this path when you want to see the product work before reading architecture docs.

## Install And Open The Guided Setup

```bash
npm install
npx cognibrain init
```

For scripted local setup:

```bash
./bin/cognibrain.mjs setup --profile local --yes
```

## First Memory

```bash
./bin/cognibrain.mjs memory add "Atlas releases require npm test before publish."
./bin/cognibrain.mjs memory evidence-pack "What should Atlas do before release?"
```

## Verify

```bash
npx cognibrain doctor --fix
npx cognibrain doctor --publish
npm run benchmark:cognicode
npm run benchmark:arena
```

Next: [`setup-cli.md`](setup-cli.md) for profiles and connector setup, or [`overview.md`](overview.md) for the product map.

Claim IDs: `CB-CLAIM-EVIDENCE`, `CB-CLAIM-COGNICODE`, `CB-CLAIM-BENCHMARK-ARENA`, `CB-CLAIM-PRODUCTION`.
