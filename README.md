# Cognibrain

**Self-hosted engineering memory for coding agents.**

Stop fixing the same agent mistake twice. Cognibrain stores durable engineering context — repo rules, reviewer corrections, failed commands, connector events, and patch evidence — then returns compact context before the next agent action.

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@cognilabz/cognibrain)](https://www.npmjs.com/package/@cognilabz/cognibrain)
[![Docs](https://img.shields.io/badge/docs-cognibrain.cognilabz.com-teal)](https://cognibrain.cognilabz.com)

## Quick Start

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --yes
npx cognibrain status
```

## What It Does

- **Durable corrections** survive across agent sessions
- **Context retrieval** returns relevant facts before each action
- **Action guards** warn or block known-bad operations
- **Patch evidence** tracks what changed, what commands ran, and why
- **19+ connectors** integrate GitHub, Jira, Slack, Sentry, and more
- **Dream cycles** automatically maintain memory health

## Integration Surfaces

| Surface | Best for |
|---------|----------|
| **CLI** | Operators, CI/CD, shell scripts |
| **MCP** | MCP-native agents (Codex, Cursor) |
| **Harness CLI** | Any shell-capable agent or git hook |
| **SDK/HTTP** | Product integrations, dashboards, custom runtimes |

## Documentation

**📖 [cognibrain.cognilabz.com](https://cognibrain.cognilabz.com)**

- [Getting Started](https://cognibrain.cognilabz.com/getting-started/quickstart/)
- [CLI Reference](https://cognibrain.cognilabz.com/reference/cli-commands/)
- [MCP Integration](https://cognibrain.cognilabz.com/guides/mcp-integration/)
- [TypeScript SDK](https://cognibrain.cognilabz.com/reference/sdk-typescript/)
- [Python SDK](https://cognibrain.cognilabz.com/reference/sdk-python/)
- [Self-Hosting](https://cognibrain.cognilabz.com/operations/self-hosting/)

## Contributing

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
npm run verify
```

See [Contributing Guide](https://cognibrain.cognilabz.com/contributing/development-setup/) for details.

## License

MIT — see [LICENSE](LICENSE) for details.

The browser Operator UI is a separately licensed commercial add-on not included in the MIT package.
