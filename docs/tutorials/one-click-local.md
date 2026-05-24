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

The setup command installs the Codex skill, writes Codex/Claude/Copilot/Cursor harness packages, starts the API and dashboard, then runs doctor. Use `--no-start` for config-only installation and `doctor --publish` before publishing an npm package or release.

Update and uninstall paths:

```bash
./bin/cognibrain.mjs setup --all-harnesses --no-start
./bin/cognibrain.mjs doctor --publish
rm -f .cognibrain-harness-package.json .github/instructions/cognibrain.instructions.md
```
