# Installation

## Requirements

| Dependency | Version | Notes |
|-----------|---------|-------|
| Node.js | 20+ | Required |
| npm | 10+ | Included with Node.js |
| Python 3 | 3.10+ | Only for Python SDK usage |
| PostgreSQL | 14+ | Only for Postgres-backed deployments |

## Install from npm

The fastest path for most users:

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --yes
npx cognibrain doctor --fix
npx cognibrain status
```

!!! tip "What `init --yes` does"
    The `--yes` flag accepts all defaults for the `solo-dev` profile:

    - Local JSON storage
    - Local-only auth (no API key required)
    - Codex + Cursor harness files
    - GitHub connector stub
    - SQLite storage adapter stub

## Install from Source

Use a checkout when developing Cognibrain or testing unpublished changes:

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
./bin/cognibrain.mjs init --yes
./bin/cognibrain.mjs doctor --fix
```

## Profiles

`init` is scoped to single-developer setup by default. Benchmark mode is a
separate proof lab:

=== "Solo Developer"

    ```bash
    npx cognibrain init --profile solo-dev --yes
    ```

    Local coding-agent memory on one machine. Codex/Cursor harness, local storage, no auth.

=== "Benchmark"

    ```bash
    npx cognibrain init --benchmark --yes
    ```

    Reproducible benchmark/proof lab with all harnesses and proof-oriented tooling.

## Defaults Reference

These defaults come from the current CLI implementation:

| Setting | Default | Meaning |
|---------|---------|---------|
| Profile | `solo-dev` | Local coding-agent memory on one machine |
| Harness files | `codex`, `cursor` | Writes Codex and Cursor memory instructions/config |
| Storage | `local-json` | Local runtime storage under the project runtime root |
| Auth | `local-only` | No OIDC/API-key gate for the local solo runtime |
| Connector stub | `github` | Writes non-secret GitHub connector config |
| Adapter stub | `storage-sqlite` | Prepares a local SQLite storage adapter config |
| Runtime root | Current project | Override with `--runtime-root` or `COGNIBRAIN_RUNTIME_ROOT` |

## Start and Stop

```bash
npx cognibrain start      # Start the local API daemon
npx cognibrain status     # Check runtime state
npx cognibrain stop       # Stop the daemon
```

## Service Installation

For machines that should restart Cognibrain automatically:

```bash
npx cognibrain service plan           # Preview what will be installed
npx cognibrain service install --activate  # Install and start
npx cognibrain service status         # Verify the service
```

??? info "Supported service managers"
    | Platform | Manager |
    |----------|---------|
    | Linux | systemd user service (default); system service with `--system` |
    | macOS | launchd LaunchAgent (default); LaunchDaemon with `--system` |
    | Windows | Task Scheduler startup task |

## Verify the Install

After setup, run these checks:

```bash
npx cognibrain status
npx cognibrain doctor --fix
npx cognibrain config doctor
npx cognibrain connections doctor
```

For package/release maintainers:

```bash
npm run release:check
npm pack --dry-run
```

## Next Steps

- [Quick Start →](quickstart.md) — Your first memory in 5 minutes
- [CLI Usage →](../guides/cli-usage.md) — Detailed CLI guide
- [Configuration →](../reference/configuration.md) — Environment variables and runtime config
