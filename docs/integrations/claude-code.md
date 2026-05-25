# Claude Code Integration

## Install

```bash
./bin/cognibrain.mjs config claude
```

This writes `.mcp.json` and Claude hook settings without overwriting unrelated user content.

## Verify

```bash
npm run verify:connectors
```

The verifier runs a Claude Code-style hook golden path through session context, pre-tool guard, tool outcome, correction capture and patch evidence.

## Maturity

`local-ready`: stdio MCP config and hook template are covered by the connector verifier.

## Troubleshoot

- Inspect `.mcp.json` and `.claude/settings.json`.
- Run `./bin/cognibrain.mjs status`.
- Use `memory_action_guard` before risky file edits.
