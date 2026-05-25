# MCP Integration

## Install

```bash
./bin/cognibrain.mjs setup --self-hosted
./bin/cognibrain.mjs mcp
```

Use Streamable HTTP when a client needs an HTTP session transport:

```bash
./bin/cognibrain.mjs mcp --http --port 8791
```

## Verify

```bash
npm run verify:connectors
```

## Maturity

`local-ready`: MCP exposes add/search/context, evidence pack, coding context, correction capture, action guard, patch evidence, graph, policy, procedure and maintenance tools.

## Troubleshoot

- Confirm the generated MCP command points to `bin/cognibrain.mjs`.
- Run `./bin/cognibrain.mjs doctor --publish`.
- Use `memory_context_pack` before long coding tasks and `memory_patch_evidence` after a patch.

Claim ID: `CB-CLAIM-MCP`.
