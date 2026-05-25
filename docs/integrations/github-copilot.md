# GitHub Copilot Integration

## Install

```bash
./bin/cognibrain.mjs config copilot
```

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: repository instruction files are generated. Copilot behavior remains dependent on the client that consumes those instructions.

## Troubleshoot

- Inspect `.github/copilot-instructions.md`.
- Keep generated `.cognibrain` sidecars under review.
- Use the GitHub connector for PR review ingestion when you need durable review feedback.
