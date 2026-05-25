# Local Install

Local mode is for one developer machine. It can use JSON storage and no API key because the server is not exposed to a network.

```bash
npm install
./bin/cognibrain.mjs setup --self-hosted --no-start
./bin/cognibrain.mjs start
./bin/cognibrain.mjs status
```

Open the dashboard URL printed by `status`.

## Troubleshooting

- If `tsx` is missing, run `npm install`.
- If the dashboard is stale, run `./bin/cognibrain.mjs stop` and `./bin/cognibrain.mjs start`.
- If you plan to expose the API, switch to [`self-hosted-install.md`](self-hosted-install.md).
