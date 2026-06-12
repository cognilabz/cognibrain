# CLI Usage

The Cognibrain CLI is the primary operator interface. It provides text-first output by default (readable in small panes, CI logs, and remote shells) with JSON mode for automation.

## Command Structure

```bash
cognibrain <command> [subcommand] [options]
```

All commands support `--json` for machine-readable output and `--help` for usage information.

## Setup Commands

### `init`

Initialize Cognibrain in a project:

```bash
npx cognibrain init --yes                    # Solo-dev defaults
npx cognibrain init --benchmark --yes        # Proof lab
```

| Flag | Effect |
|------|--------|
| `--yes` | Accept all defaults without prompting |
| `--profile <name>` | Use a specific profile (`solo-dev`, `benchmark`) |
| `--no-start` | Don't start the daemon after init |
| `--no-skill` | Skip Codex skill installation |
| `--no-doctor` | Skip the doctor check |

### `doctor`

Diagnose and fix configuration issues:

```bash
npx cognibrain doctor          # Check only
npx cognibrain doctor --fix    # Check and auto-fix
```

### `status`

Display runtime state, memory health, connections, and next actions:

```bash
npx cognibrain status
npx cognibrain status --json
```

## Memory Commands

### `memories add`

Store a durable memory:

```bash
npx cognibrain memories add "Always run npm test before release."
npx cognibrain memories add "The auth module uses JWT with RS256." --scope repo
npx cognibrain memories add "User prefers verbose logging." --scope user
```

### `memories list`

List stored memories:

```bash
npx cognibrain memories list
npx cognibrain memories list --json
npx cognibrain memories list --scope repo --limit 20
```

### `memories coding-context`

Retrieve relevant memories for a task:

```bash
npx cognibrain memories coding-context "prepare the release patch"
npx cognibrain memories coding-context "fix auth refresh" --json --budget 1200
```

The `--budget` flag controls the token budget for the context pack.

## Lifecycle Commands

These commands form the agent lifecycle loop:

### `context`

Request a context pack before starting work:

```bash
npx cognibrain context --task "prepare the release patch" --json
```

### `guard`

Check an action against known guards:

```bash
npx cognibrain guard --action "edit src/api/server.ts" --json
npx cognibrain guard --action "npm test" --json
```

### `outcome`

Record the result of a command:

```bash
npx cognibrain outcome --command "npm test" --exit-code 0 --json
npx cognibrain outcome --command "npm run build" --exit-code 1 --stderr "Type error..." --json
```

### `correction`

Record a human correction:

```bash
npx cognibrain correction --text "Use npm test, not pnpm test." --json
```

### `patch-evidence`

Record what changed during a task:

```bash
npx cognibrain patch-evidence --task "release patch" --json
npx cognibrain patch-evidence --task "auth fix" --files src/auth.ts --commands "npm test" --json
```

### `session-end`

End the current session:

```bash
npx cognibrain session-end --json
npx cognibrain session-end --run-dream-if-due --json
```

## Service Commands

### `service`

Manage Cognibrain as a system service:

```bash
npx cognibrain service plan              # Preview installation
npx cognibrain service install --activate # Install and start
npx cognibrain service status            # Check service health
npx cognibrain service logs              # View logs
npx cognibrain service restart           # Restart the daemon
npx cognibrain service uninstall --deactivate  # Remove
```

## Connector Commands

### `connections`

Manage external integrations:

```bash
npx cognibrain connections list
npx cognibrain connections add github --set repo=cognilabz/cognibrain
npx cognibrain connections add slack --set channelId=C123 --token-env MEMORY_SLACK_TOKEN
npx cognibrain connections doctor
```

## Configuration Commands

### `config`

Generate or refresh harness configuration files:

```bash
npx cognibrain config codex     # Regenerate Codex config
npx cognibrain config cursor    # Regenerate Cursor config
npx cognibrain config all       # All harness files
npx cognibrain config doctor    # Check config health
```

## Proof and Evidence

### `proof`

Show the current evidence state:

```bash
npx cognibrain proof
npx cognibrain proof --json
```

## Tips

!!! tip "JSON mode for scripting"
    Append `--json` to any command for machine-readable output. This is how agents and CI systems should consume Cognibrain.

!!! tip "Backward compatibility"
    `cognibrain harness <command>` remains a backward-compatible alias for all lifecycle commands. New scripts should use the top-level commands directly.

!!! tip "Daemon vs local-direct"
    By default, lifecycle commands talk to the local daemon. Pass `--local-direct` to bypass the daemon for debugging or environments where the daemon isn't running.
