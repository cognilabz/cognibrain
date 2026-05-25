# OpenCode Integration

## Install

```bash
./bin/cognibrain.mjs config opencode
```

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: OpenCode MCP config and instruction helper are generated.

## Troubleshoot

- Inspect `.opencode/mcp.json` and `.opencode/cognibrain.md`.
- Run `./bin/cognibrain.mjs doctor --publish`.
- Keep connector telemetry scoped to the project until team policy is configured.
