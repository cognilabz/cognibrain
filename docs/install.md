# Install And Setup

Cognibrain runs as a local/self-hosted API with a stable operator CLI. The browser Operator UI is optional and separately licensed.

## Requirements

- Node.js 20 or newer
- npm
- Python 3 only if you use or test the Python SDK
- Postgres only for Postgres-backed deployments; local development can use the default local runtime

## Fast Path

Use the npm package for normal projects:

```bash
npm i @cognilabz/cognibrain
npx cognibrain init --yes
npx cognibrain doctor --fix
npx cognibrain status
```

`init --yes` is intentionally enough for one developer. It uses the `solo-dev` profile by default, starts the local API unless `--no-start` is passed, installs the Codex skill unless `--no-skill` is passed, and runs doctor unless `--no-doctor` is passed.

## Defaults

These defaults are from the current CLI implementation, not from a separate documentation convention.

| Setting | Default | Meaning |
| --- | --- |
| Profile | `solo-dev` | Local coding-agent memory on one machine. |
| Harness files | `codex`, `cursor` | Writes Codex and Cursor memory instructions/config. |
| Storage | `local-json` | Local runtime storage under the project runtime root. |
| Auth | `local-only` | No OIDC/API-key gate for the local solo runtime. |
| Connector stub | `github` | Writes non-secret GitHub connector config for later env setup. |
| Adapter stub | `storage-sqlite` | Prepares a local SQLite storage adapter config. |
| Runtime root | current project | Override with `--runtime-root <path>` or `COGNIBRAIN_RUNTIME_ROOT`. |
| Dashboard | off | Start only with `--dashboard` or `cognibrain dashboard`. |

Use an explicit profile only when you want a different shape:

| Profile | Use | Main differences |
| --- | --- | --- |
| `solo-dev` | One developer, local coding-agent memory. | Codex/Cursor, local storage, local-only auth. |
| `team` | Shared team setup. | All harness files, more connector stubs, Postgres/intelligence adapter stubs. |
| `enterprise` | Enterprise pilot. | Postgres, OIDC/SSO intent, self-hosted/service-oriented setup. |
| `benchmark` | Reproducible benchmark/proof lab. | All harness files, benchmark adapter, proof-oriented next steps. |

Examples:

```bash
npx cognibrain init --profile team --yes
npx cognibrain init --profile enterprise --yes --no-start
npx cognibrain init --benchmark --yes
```

`setup` without legacy flags routes to the same wizard/default flow:

```bash
npx cognibrain setup --yes
```

## Install From A Checkout

Use a checkout when developing Cognibrain itself or testing unpublished changes:

```bash
git clone https://github.com/cognilabz/cognibrain.git
cd cognibrain
npm install
./bin/cognibrain.mjs init --yes
./bin/cognibrain.mjs doctor --fix
```

The checkout command and the npm command write the same setup state and harness files for the selected profile.

## Start And Stop

```bash
npx cognibrain start
npx cognibrain status
npx cognibrain stop
```

The commercial Operator UI starts only when requested and only from a checkout
or deployment that includes the licensed `operator-ui/` add-on:

```bash
npx cognibrain dashboard
```

## Harness Configuration

Harness configuration means the files that teach a coding agent how to call Cognibrain before non-trivial work, before risky actions, and after durable discoveries. The generated files prefer the CLI lifecycle. MCP config is written only for hosts that can use an MCP stdio adapter.

The default `solo-dev` init writes:

| Target | Files |
| --- | --- |
| Codex | `$CODEX_HOME/config.toml`, `$CODEX_HOME/skills/cognibrain/SKILL.md`, `AGENTS.md` |
| Cursor | `.cursor/mcp.json`, `.cursor/rules/open-memory.mdc` |
| Package manifest | `.cognibrain-harness-package.json` |

Supported harness targets:

| Target | Generate with | Files |
| --- | --- | --- |
| Codex | `cognibrain config codex` | `$CODEX_HOME/config.toml`, `$CODEX_HOME/skills/cognibrain/SKILL.md`, `AGENTS.md` |
| Claude Code | `cognibrain config claude` | `.mcp.json`, `.claude/settings.json` |
| GitHub Copilot | `cognibrain config copilot` | `.github/copilot-instructions.md`, `.github/instructions/cognibrain.instructions.md` |
| Cursor | `cognibrain config cursor` | `.cursor/mcp.json`, `.cursor/rules/open-memory.mdc` |
| VS Code MCP | `cognibrain config vscode` | `.vscode/mcp.json`, `.vscode/settings.json`, `.vscode/cognibrain.instructions.md` |
| OpenCode | `cognibrain config opencode` | `.opencode/cognibrain.md` |
| OpenClaw | `cognibrain config openclaw` | `.openclaw/cognibrain.md` |
| LangGraph | `cognibrain config langgraph` | `langgraph.cognibrain.json`, `langgraph-cognibrain.ts` |
| CrewAI | `cognibrain config crewai` | `crewai.cognibrain.json`, `crewai_cognibrain.py` |
| Windsurf | `cognibrain config windsurf` | `.windsurf/rules/cognibrain.md` |
| Continue | `cognibrain config continue` | `.continue/rules/cognibrain.md` |
| Aider | `cognibrain config aider` | `.aider.conf.yml`, `.aider/cognibrain.md` |
| Roo Code / Cline | `cognibrain config roo-cline` | `.roo/mcp.json`, `.clinerules/cognibrain.md` |
| Goose | `cognibrain config goose` | `.goose/config.yaml`, `.goose/cognibrain.md` |
| Hermes Agent | `cognibrain config hermes` | `$HERMES_HOME/config.yaml`, `HERMES.md` |
| Sourcegraph Amp | `cognibrain config sourcegraph-amp` | `.amp/cognibrain.md` |
| Devin-style agents | `cognibrain config devin-style` | `.devin/cognibrain.json`, `.devin/cognibrain.md` |

Hermes uses a global `$HERMES_HOME/config.yaml` MCP section plus repo-local project context. `cognibrain config hermes` merges a `mcp_servers.cognibrain` entry into the Hermes config and writes `HERMES.md` in the current project. When `HERMES_HOME` is unset, Cognibrain uses `~/.hermes`.

Generate or refresh specific harness files:

```bash
npx cognibrain config codex
npx cognibrain config cursor
npx cognibrain config all
npx cognibrain config doctor
```

`config codex`, `setup --codex` and the default `init --yes` path install the Codex skill and write the repo-level `AGENTS.md` instructions automatically. Pass `--no-skill` only when you intentionally want Codex MCP/config files without installing `$CODEX_HOME/skills/cognibrain/SKILL.md`. Use `--refresh` to replace existing Cognibrain-owned instruction files instead of writing `.cognibrain` review sidecars.

Scripted setup still supports legacy harness flags:

```bash
npx cognibrain setup --codex --cursor --yes
npx cognibrain setup --all-harnesses --yes
```

For agents or CI jobs that can run shell hooks, use the top-level lifecycle commands:

```bash
npx cognibrain context --task "prepare release patch" --json
npx cognibrain guard --action "npm test" --json
npx cognibrain outcome --command "npm test" --exit-code 0 --json
npx cognibrain patch-evidence --task "release patch" --json
npx cognibrain session-end --json
```

`cognibrain harness <command>` is a backward-compatible alias for older scripts. New onboarding should use the top-level commands.

## Service Install

For a machine that should restart Cognibrain automatically:

```bash
npx cognibrain service plan
npx cognibrain service install --activate
npx cognibrain service status
```

For a self-hosted package smoke:

```bash
npm run verify:selfhosted
```

## Configuration

Runtime state lives under `.cognibrain/` by default, or under `COGNIBRAIN_RUNTIME_ROOT` when set.

Common environment variables:

| Variable | Purpose |
| --- | --- |
| `MEMORY_API_KEY` | API key expected by the local API. |
| `MEMORY_DB_URL` or `MEMORY_POSTGRES_URL` | Postgres connection string for DB-backed deployments. |
| `MEMORY_POLICY_MODE` | Use `production` for default-deny policy behavior. |
| `MEMORY_OIDC_ISSUER` | Optional JWT/OIDC issuer. |
| `MEMORY_OIDC_AUDIENCE` | Optional JWT/OIDC audience. |

Secrets should be stored in the environment, a secret manager or the runtime-local connector config file used by the Operator UI. Do not commit connector secrets or copy them into docs, issues or support bundles.

## Verify The Install

After setup, these checks should be enough for onboarding:

```bash
npx cognibrain status
npx cognibrain doctor --fix
npx cognibrain config doctor
npx cognibrain connections doctor
```

## Ten-Minute Proof Smoke

For a new adopter who wants to see the engineering-memory loop before reading
the rest of the docs:

```bash
npx cognibrain context --task "prepare a safe release patch" --json
npx cognibrain guard --action "npm test" --json
npx cognibrain outcome --command "npm test" --exit-code 0 --json
npx cognibrain patch-evidence --task "safe release patch" --json
```

For a checkout that needs repo-level proof:

```bash
npm test
npm run build
npm run internal -- audit:truth
npm run internal -- audit:plan-gaps
npm run internal -- audit:latest-analysis
npm run internal -- proof:plan
```

These commands prove the local engineering loop and claim boundary. They do
not replace `release:check`, live connector certification, a judged
real-world benchmark run or CI.

For package/release maintainers:

```bash
npm run release:check
npm pack --dry-run
```
