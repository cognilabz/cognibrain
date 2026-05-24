# One-Click Local Install

Run from a fresh checkout:

```bash
npm install
./bin/cognibrain.mjs setup --all-harnesses
./bin/cognibrain.mjs doctor --publish
```

Add and inspect memory:

```bash
./bin/cognibrain.mjs memory add "Atlas uses TypeScript for the SDK."
./bin/cognibrain.mjs memory search "What does Atlas use?"
./bin/cognibrain.mjs memory dream-policy
```

The setup command installs the Codex skill, writes harness configs when requested, starts the API and dashboard, then runs doctor.
