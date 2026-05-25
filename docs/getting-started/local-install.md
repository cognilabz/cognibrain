# Local Install

Local mode is for one developer machine. It can use JSON storage and no API key because the server is not exposed to a network.

```bash
npm install
./bin/cognibrain.mjs setup --self-hosted --no-start
./bin/cognibrain.mjs start
./bin/cognibrain.mjs
./bin/cognibrain.mjs status
```

`start` launches the API only. `cognibrain` with no subcommand opens the terminal home for status, memories, connections and config. Start the optional browser dashboard only when you want it:

```bash
./bin/cognibrain.mjs dashboard
```

## Troubleshooting

- If `tsx` is missing, run `npm install`.
- If runtime status is stale, run `./bin/cognibrain.mjs stop` and `./bin/cognibrain.mjs start`.
- If the optional dashboard is stale, run `./bin/cognibrain.mjs stop` and `./bin/cognibrain.mjs dashboard`.
- If you plan to expose the API, switch to [`self-hosted-install.md`](self-hosted-install.md).
