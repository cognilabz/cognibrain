# LangGraph Integration

## Install

```bash
./bin/cognibrain.mjs config langgraph
```

This writes `langgraph.cognibrain.json` and `langgraph-cognibrain.ts`.

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: helper files fetch evidence packs and can send tool-outcome telemetry through the HTTP API.

## Troubleshoot

- Confirm `MEMORY_API_URL` and API-key settings in the target runtime.
- Keep writeback dry-run until the graph workflow is reviewed.
- Use `/connectors/telemetry` for accepted/rejected context feedback.
