# Codex Integration

## Install

```bash
./bin/cognibrain.mjs config codex
./bin/cognibrain.mjs skill install
```

`setup --self-hosted` also writes Codex config and the local Cognibrain Skill.

## Verify

```bash
./bin/cognibrain.mjs doctor --publish
npm run verify:connectors
```

## Maturity

`local-ready`: config generation, Skill install, MCP command and project `AGENTS.md` template are included. Production use depends on the target Codex environment and auth policy.

## Troubleshoot

- Check `$CODEX_HOME/config.toml` for `[mcp_servers.cognibrain]`.
- Confirm the runtime root is the project you want remembered.
- If multiple GitHub accounts exist, keep connector credentials in deployment env, not instruction files.
