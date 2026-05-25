# Slack And Discord Connectors

## Install

Slack:

```bash
export MEMORY_SLACK_TOKEN=...
export MEMORY_SLACK_CHANNEL_ID=...
```

Discord:

```bash
export MEMORY_DISCORD_BOT_TOKEN=...
export MEMORY_DISCORD_CHANNEL_ID=...
```

## Verify

```bash
npm run verify:vendor-connectors
npm run verify:vendor-live
```

## Maturity

`vendor-smoke required`: hermetic vendor-driver proof exists. Production claims require fresh tenant credentials. Discord writeback disables mentions by default.

## Troubleshoot

- Use channel-scoped credentials first.
- Keep decisions in `needs_verification` until a human promotes them.
- Inspect connector health before claiming live sync.
