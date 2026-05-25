# VS Code Integration

## Install

```bash
./bin/cognibrain.mjs config vscode
```

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: VS Code MCP config generation is included.

## Troubleshoot

- Inspect `.vscode/mcp.json`.
- Confirm the API is running with `./bin/cognibrain.mjs status`.
- Use `npx cognibrain-connect vscode --no-start` for package-style setup.
