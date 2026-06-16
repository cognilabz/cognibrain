# Development Setup

Get a local Cognibrain development environment running from source.

## Prerequisites

- Node.js 20+
- npm 10+
- Git
- Python 3.10+ (only for Python SDK work)

## Clone and Install

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
```

## Verify the Build

```bash
npm run verify
```

This runs the full verification suite: linting, type checking, tests, and build.

## Start Development

### API Server (foreground)

```bash
npm run dev
```

### Using the CLI from Source

```bash
./bin/cognibrain.mjs init --yes
./bin/cognibrain.mjs status
./bin/cognibrain.mjs doctor --fix
```

## Project Structure

| Path | Purpose |
|------|---------|
| `bin/` | Public CLI entrypoints |
| `src/` | Product source |
| `src/api/` | HTTP server, service runtime, persistence adapters |
| `src/connectors/` | MCP server, connector registry, connector tooling |
| `src/core/` | Memory model, retrieval, graph, policy, storage logic |
| `src/cli/` | CLI command implementation |
| `src/eval/` | Internal benchmark and verification generators |
| `sdk/typescript/` | TypeScript HTTP and integration SDK |
| `sdk/python/` | Dependency-free Python HTTP client |
| `scripts/` | Automation scripts (runtime, release, benchmark, etc.) |
| `fixtures/` | Deterministic test fixtures |
| `templates/` | Harness and integration templates |
| `docker/` | Optional Docker packaging |
| `deploy/` | Optional deployment manifests |
| `tests/` | Test suites |
| `docs/` | Documentation (this site) |

## Development Rules

1. **Keep memory claims evidence-backed** — don't document capabilities without proof artifacts
2. **Add or update tests** for retrieval, lifecycle, connector, or benchmark behavior changes
3. **Do not weaken benchmark gates** to make a change pass
4. **Keep docs readable** for non-developers when behavior changes user expectations
5. **Do not store secrets** or real sensitive transcripts in fixtures, docs, screenshots, or examples

## Package Scripts

```bash
npm test              # Run test suite
npm run build         # Build production artifacts
npm run verify        # Full verification (lint + types + tests + build)
npm run release:check # Pre-release validation
```

Internal scripts (maintainer-only):

```bash
npm run internal -- <task>
npm run internal -- verify:compatibility
npm run internal -- verify:vendor-connectors
```

## Before Submitting a PR

```bash
npm test
npm run build
npm run verify
```

For benchmark-related changes, also run:

```bash
npm run benchmark:locomo -- --top-k 20
npm run benchmark:arena
npm run internal -- benchmark:release
```

## Pull Request Checklist

- [ ] Tests pass
- [ ] Docs explain any user-visible behavior change
- [ ] New memories, summaries, or benchmark claims include provenance
- [ ] Connector changes have an opt-out or clear local scope
- [ ] CLI screenshots refreshed with `npm run docs:cli-screenshots` (if terminal UI changed)
