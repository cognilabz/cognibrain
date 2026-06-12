# CLI Commands

Complete reference for all Cognibrain CLI commands.

## Global Options

These options are available on all commands:

| Flag | Description |
|------|-------------|
| `--json` | Output machine-readable JSON |
| `--help` | Show help for the command |
| `--version` | Show Cognibrain version |
| `--quiet` | Suppress non-essential output |

---

## Setup & Lifecycle

### `cognibrain init`

Initialize Cognibrain in a project directory.

```bash
cognibrain init [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--yes` | — | Accept all defaults without prompting |
| `--profile <name>` | `solo-dev` | Profile: `solo-dev`, `team`, `enterprise`, `benchmark` |
| `--no-start` | — | Don't start the daemon after init |
| `--no-skill` | — | Skip Codex skill installation |
| `--no-doctor` | — | Skip the doctor check |
| `--runtime-root <path>` | `.` | Override the runtime root directory |
| `--dashboard` | — | Start the Operator UI after init |
| `--benchmark` | — | Shorthand for `--profile benchmark` |

### `cognibrain setup`

Alias for `init`. Routes to the same wizard/default flow.

```bash
cognibrain setup [options]
```

Legacy flags for backward compatibility:

| Option | Description |
|--------|-------------|
| `--codex` | Generate Codex harness files |
| `--cursor` | Generate Cursor harness files |
| `--all-harnesses` | Generate all harness files |

### `cognibrain start`

Start the local API daemon.

```bash
cognibrain start
```

### `cognibrain stop`

Stop the local API daemon.

```bash
cognibrain stop
```

### `cognibrain status`

Display runtime state, memory health, connections, and next actions.

```bash
cognibrain status [--json]
```

### `cognibrain doctor`

Diagnose and optionally fix configuration issues.

```bash
cognibrain doctor [--fix]
```

---

## Memory Operations

### `cognibrain memories add`

Store a durable memory.

```bash
cognibrain memories add <content> [options]
```

| Option | Description |
|--------|-------------|
| `--scope <scope>` | Memory scope: `repo`, `user`, `global`, `task` |

### `cognibrain memories list`

List stored memories.

```bash
cognibrain memories list [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--json` | — | JSON output |
| `--scope <scope>` | all | Filter by scope |
| `--status <status>` | all | Filter by status (`active`, `stale`, `review`) |
| `--limit <n>` | 50 | Maximum results |

### `cognibrain memories coding-context`

Retrieve relevant memories for a coding task.

```bash
cognibrain memories coding-context <task> [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--json` | — | JSON output |
| `--budget <tokens>` | 1200 | Token budget for the context pack |

---

## Agent Lifecycle

### `cognibrain context`

Request a context pack before starting work.

```bash
cognibrain context --task <description> [options]
```

| Option | Description |
|--------|-------------|
| `--task <description>` | Task description for relevance matching |
| `--repo <owner/name>` | Repository context |
| `--budget <tokens>` | Token budget |
| `--json` | JSON output |

### `cognibrain guard`

Check an action against known guards.

```bash
cognibrain guard --action <description> [options]
```

| Option | Description |
|--------|-------------|
| `--action <description>` | Action to check |
| `--json` | JSON output |

### `cognibrain outcome`

Record the result of a command.

```bash
cognibrain outcome --command <cmd> --exit-code <n> [options]
```

| Option | Description |
|--------|-------------|
| `--command <cmd>` | Command that was run |
| `--exit-code <n>` | Exit code (0 = success) |
| `--stderr <text>` | Standard error output (on failure) |
| `--json` | JSON output |

### `cognibrain correction`

Record a human correction.

```bash
cognibrain correction --text <correction> [options]
```

| Option | Description |
|--------|-------------|
| `--text <correction>` | The correction text |
| `--json` | JSON output |

### `cognibrain patch-evidence`

Record what changed during a task.

```bash
cognibrain patch-evidence --task <description> [options]
```

| Option | Description |
|--------|-------------|
| `--task <description>` | Task that was completed |
| `--files <paths>` | Files that were changed |
| `--commands <cmds>` | Commands that were run |
| `--json` | JSON output |

### `cognibrain session-end`

Signal the end of an agent session.

```bash
cognibrain session-end [options]
```

| Option | Description |
|--------|-------------|
| `--run-dream-if-due` | Trigger dream cycle if enough time has passed |
| `--json` | JSON output |

### `cognibrain handoff`

Hand off context to another agent or session.

```bash
cognibrain handoff [options] --json
```

### `cognibrain release-prepare`

Prepare release context.

```bash
cognibrain release-prepare --repo <owner/name> --json
```

### `cognibrain dream-plan`

Preview what a dream cycle would do.

```bash
cognibrain dream-plan --json
```

### `cognibrain source-revalidate`

Revalidate memory sources.

```bash
cognibrain source-revalidate --user <user> --json
```

### `cognibrain conflicts`

Show contradicting memories.

```bash
cognibrain conflicts --json
```

### `cognibrain health`

Check system health.

```bash
cognibrain health --json
```

---

## Service Management

### `cognibrain service plan`

Preview what service installation will do.

```bash
cognibrain service plan
```

### `cognibrain service install`

Install Cognibrain as a system service.

```bash
cognibrain service install --activate [--system]
```

| Option | Description |
|--------|-------------|
| `--activate` | Start immediately after installing |
| `--system` | Install as system-wide service (vs user service) |

### `cognibrain service status`

Check service health.

```bash
cognibrain service status
```

### `cognibrain service logs`

View service logs.

```bash
cognibrain service logs
```

### `cognibrain service restart`

Restart the service.

```bash
cognibrain service restart
```

### `cognibrain service uninstall`

Remove the service.

```bash
cognibrain service uninstall --deactivate
```

---

## Connectors

### `cognibrain connections list`

List configured connectors.

```bash
cognibrain connections list [--json]
```

### `cognibrain connections add`

Add a connector.

```bash
cognibrain connections add <connector> [options]
```

| Option | Description |
|--------|-------------|
| `--set <key=value>` | Set a configuration value |
| `--token-env <VAR>` | Environment variable for the token |
| `--url-env <VAR>` | Environment variable for the URL |

### `cognibrain connections doctor`

Check connector health.

```bash
cognibrain connections doctor
```

---

## Configuration

### `cognibrain config codex`

Generate/refresh Codex harness files. By default this writes both the user-level
Codex skill and the repo-owned Codex contract: `AGENTS.md` plus
`.agents/skills/cognibrain/SKILL.md`.

```bash
cognibrain config codex
```

Use `--no-global-skill` to skip writing under `~/.codex`, or `--no-skill` to
skip both global and repo-local Codex skills.

### `cognibrain config cursor`

Generate/refresh Cursor harness files.

```bash
cognibrain config cursor
```

### `cognibrain config all`

Generate/refresh all harness files and update the repo-owned harness manifest.

```bash
cognibrain config all
```

Audit the repo-owned contract without writing files:

```bash
cognibrain config all --check
```

`--check` reports drift and warnings without failing by default. Add `--strict`
when a CI job should fail on drift.

### `cognibrain config doctor`

Check harness configuration health.

```bash
cognibrain config doctor
```

---

## Evidence & Proof

### `cognibrain proof`

Show current evidence state.

```bash
cognibrain proof [--json]
```

---

## Operator UI

### `cognibrain dashboard`

Start the commercial Operator UI (requires license).

```bash
cognibrain dashboard
```

---

## SDK Scaffolding

### `cognibrain sdk platform`

Scaffold a community connector:

```bash
cognibrain sdk platform <name> --kind <type> --out <path>
```

| Option | Description |
|--------|-------------|
| `--kind <type>` | Connector kind: `issue_tracker`, `chat`, `docs`, etc. |
| `--direction <dir>` | Data direction: `ingest`, `emit`, `bidirectional` |
| `--auth <method>` | Auth method: `token`, `oauth`, `api_key` |
| `--out <path>` | Output directory |

### `cognibrain sdk harness`

Scaffold a harness adapter:

```bash
cognibrain sdk harness <name> --out <path>
```
