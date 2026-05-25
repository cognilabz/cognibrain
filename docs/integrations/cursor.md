# Cursor Integration

## Install

```bash
./bin/cognibrain.mjs config cursor
```

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: Cursor MCP config and rule template are generated. Native Cursor runtime behavior should be validated in the target workspace.

## Troubleshoot

- Inspect `.cursor/mcp.json` and `.cursor/rules/open-memory.mdc`.
- Restart Cursor after writing MCP config.
- Run `./bin/cognibrain.mjs memory evidence-pack "project rules"` to verify recall.
