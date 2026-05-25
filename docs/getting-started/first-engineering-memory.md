# First Engineering Memory

This flow demonstrates the core product loop.

## 1. Record A Failed Action

```bash
./bin/cognibrain.mjs memory action "pnpm test failed because this repo uses npm test"
```

## 2. Record The Correction

```bash
./bin/cognibrain.mjs memory code-correction "Do not use pnpm in this repo; use npm test."
```

## 3. Ask For Context

```bash
./bin/cognibrain.mjs memory evidence-pack "What command should I run before release?"
./bin/cognibrain.mjs memory why-used "Why should Atlas run npm test?"
```

## 4. Build Patch Evidence

```bash
./bin/cognibrain.mjs memory patch-evidence "release validation"
```

## 5. Replay The Local Demo

```bash
npm run demo:why-used
```

The replay stores the wrong action, stores the correction, asks why the memory was used, blocks the repeated `pnpm test` action, builds a Patch Evidence Trail, and writes `artifacts/demos/why-used.json`.

The stored correction can derive repo-policy, forbidden-action and procedure memory so future guards can warn before the same mistake repeats.

Claim IDs: `CB-CLAIM-CONTEXT`, `CB-CLAIM-GUARD`, `CB-CLAIM-PATCH-EVIDENCE`.
