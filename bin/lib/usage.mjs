import { adapterDefinitions, connectorDefinitions } from "./catalogs.mjs";

export function usage(exitCode) {
  console.log(`cognibrain

Usage:
  cognibrain
      Print the compact operator CLI home with runtime, memories, connections, config, and next actions
  cognibrain tui|ui|home
      Alias for the same stable terminal surface; --json remains script-safe
  cognibrain [--runtime-root <path>] <command>
  cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--dashboard] [--no-start] [--no-doctor] [--no-skill]
      Guided self-hosted install that writes setup state, native connector configs, harness config, starts the API, and runs doctor
  cognibrain setup [--profile local|team|production|benchmark] [--yes]
      Starts the same guided wizard; legacy flags below still work for scripted installs
  cognibrain setup [--self-hosted] [--codex] [--claude] [--copilot] [--cursor] [--vscode] [--opencode] [--openclaw] [--langgraph] [--crewai] [--windsurf] [--continue] [--aider] [--roo-cline] [--goose] [--sourcegraph-amp] [--devin-style] [--all-harnesses]
      Scripted install path for CI and package smoke tests
  cognibrain doctor [--publish] [--fix] [--no-start]
      Check and optionally fix local runtime, skill install, guided setup state, package readiness, and npm pack hygiene
  cognibrain start [--dashboard] | dev [--dashboard] | dashboard | status | stop
      Manage the local API runtime; the commercial Operator UI starts only with dashboard opt-in
  cognibrain proof|truth [--json] [--no-refresh]
      Render the code-first truth workbench from benchmark, connector, CLI, and packaging artifacts
  cognibrain service [plan|status] [--platform linux|macos|windows] [--json]
      Inspect native service automation for systemd, launchd, or Windows Task Scheduler
  cognibrain service install [--activate] [--dashboard] [--system] [--env KEY=value]
      Write native service files for automated startup; activation is explicit
  cognibrain service start|stop|restart|uninstall|logs
      Control or inspect the installed native service from the CLI
  cognibrain memories [list|status] [--json]
      CLI memory workbench with recent memories, health, maintenance, and Operator UI-equivalent memory actions
  cognibrain memories <add|search|coding-context|evidence-pack|why-used|graph|timeline|dream|marketplace|...>
      Run any memory operation from the CLI; equivalent to cognibrain memory <subcommand>
  cognibrain context|guard|outcome|correction|patch-evidence|session-end|handoff|release-prepare|dream-plan|source-revalidate|conflicts|health --json
      CLI-first agent lifecycle commands with daemon-backed JSON contracts and local-direct fallback
  cognibrain harness <lifecycle-command>
      Backward-compatible alias for existing harness scripts
  cognibrain connections [list|status|doctor] [--json]
      CLI connections workbench for connectors, adapters, harnesses, skill state, and configuration health
  cognibrain connections add <connector-or-adapter> [--dry-run] [--set key=value]
      Configure native vendor drivers, adapters, or SDK-backed sources from one connection surface
  cognibrain config list|show|paths|doctor
      Inspect setup state, harness packages, connector configs, adapter configs, and skill paths
  cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai|windsurf|continue|aider|roo-cline|goose|sourcegraph-amp|devin-style> [--refresh]
      Write MCP config for supported harnesses; use --refresh to replace existing cognibrain-owned instruction files
  cognibrain connector list|show <provider>|doctor [provider]|remove <provider>
      Inspect and maintain source-system connector configs
  cognibrain connector add <provider> [--dry-run] [--set key=value]
      Credential-safe connector setup under .cognibrain/connectors/
      Providers include github, gitlab, azure-devops, slack, discord, teams, jira, confluence, notion, linear, gmail, google-drive, google-calendar, asana, clickup, sentry, datadog, pagerduty, posthog
  cognibrain adapter list|show <adapter>|doctor [adapter]|remove <adapter>
      Inspect and maintain provider, storage, benchmark, media and MCP transport adapter configs
  cognibrain adapter add <adapter> [--dry-run] [--set key=value]
      Credential-safe adapter setup under .cognibrain/adapters/
  cognibrain sdk list|doctor
      Inspect available SDK scaffolds and SDK packaging readiness
  cognibrain sdk platform <name> [--kind project_management|chat|docs|code|custom] [--out integrations/<name>] [--dry-run]
      Scaffold a TypeScript platform integration SDK, connector manifest, env example, and README
  cognibrain sdk harness <name> [--out integrations/<name>] [--dry-run]
      Scaffold a TypeScript harness integration SDK smoke for non-MCP runners
  cognibrain skill install|status|doctor|path
      Install and inspect the Codex skill
  cognibrain memory add <text>
  cognibrain memory search <query>
  cognibrain memory coding-context <query>
  cognibrain memory code-correction <text>
  cognibrain memory action-guard <action>
  cognibrain memory patch-evidence <task>
  cognibrain memory reflect
  cognibrain memory dream
  cognibrain memory health
  cognibrain memory maintenance
  cognibrain context --task <text> --json
  cognibrain guard --action <command> --json
  cognibrain outcome --command <command> --exit-code <code> --json
  cognibrain mcp
      Run the optional stdio MCP adapter for MCP-native agent hosts
  cognibrain clean
      Remove generated local runtime, benchmark and build artifacts
`);
  process.exit(exitCode);
}

export function initUsage(exitCode) {
  console.log(`Usage: cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--dry-run] [--dashboard] [--no-start] [--no-doctor] [--no-skill] [--no-demo]`);
  process.exit(exitCode);
}

export function proofUsage(exitCode) {
  console.log(`Usage: cognibrain proof [--json] [--no-refresh]

Shows the code-first product truth surface:
- Benchmark Arena proof levels and real competitor-run count.
- Connector maturity, tenant live-smoke count, and production certification count.
- Stable operator CLI evidence.
- Docker optional/CLI-primary boundary.

Default behavior refreshes artifacts/product-truth-audit.json before rendering.`);
  process.exit(exitCode);
}

export function serviceUsage(exitCode) {
  console.log(`Usage:
  cognibrain service [plan|status] [--platform linux|macos|windows] [--system] [--dashboard] [--json]
  cognibrain service install [--activate] [--dry-run] [--dashboard] [--system] [--env KEY=value] [--port 8787] [--db-path <path>]
  cognibrain service enable|disable|start|stop|restart
  cognibrain service uninstall [--deactivate]
  cognibrain service logs

Native managers:
  linux: systemd user service by default, system service with --system
  macos: launchd LaunchAgent by default, LaunchDaemon with --system
  windows: Task Scheduler startup task without extra dependencies`);
  process.exit(exitCode);
}

export function memoriesUsage(exitCode) {
  console.log(`Usage:
  cognibrain memories [list|status] [--json] [--limit 20]
  cognibrain memories add <text>
  cognibrain memories search <query>
  cognibrain memories coding-context <query>
  cognibrain memories evidence-pack <query>
  cognibrain memories why-used <query>
  cognibrain memories graph|timeline|dream|marketplace|health|maintenance|export ...`);
  process.exit(exitCode);
}

export function connectionsUsage(exitCode) {
  console.log(`Usage:
  cognibrain connections [list|status] [--json]
  cognibrain connections doctor [--json]
  cognibrain connections add <connector-or-adapter> [--dry-run] [--set key=value]
  cognibrain connections connectors <list|show|doctor|add|remove> ...
  cognibrain connections adapters <list|show|doctor|add|remove> ...`);
  process.exit(exitCode);
}

export function configUsage(exitCode) {
  console.log(`Usage:
  cognibrain config list [--json]
  cognibrain config show [--json]
  cognibrain config paths [--json]
  cognibrain config doctor [--json]
  cognibrain config write <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai|windsurf|continue|aider|roo-cline|goose|sourcegraph-amp|devin-style> [--refresh]
  cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai|windsurf|continue|aider|roo-cline|goose|sourcegraph-amp|devin-style> [--refresh]`);
  process.exit(exitCode);
}

export function connectorUsage(exitCode) {
  console.log(`Usage:
  cognibrain connector list [--json]
  cognibrain connector show <provider> [--json]
  cognibrain connector doctor [provider] [--json]
  cognibrain connector add <${Object.keys(connectorDefinitions()).join("|")}> [--dry-run] [--set key=value]
  cognibrain connector remove <provider>`);
  process.exit(exitCode);
}

export function adapterUsage(exitCode) {
  console.log(`Usage:
  cognibrain adapter list [--json]
  cognibrain adapter show <adapter> [--json]
  cognibrain adapter doctor [adapter] [--json]
  cognibrain adapter add <${Object.keys(adapterDefinitions()).join("|")}> [--dry-run] [--set key=value]
  cognibrain adapter remove <adapter>`);
  process.exit(exitCode);
}

export function sdkUsage(exitCode) {
  console.log(`Usage:
  cognibrain sdk list [--json]
  cognibrain sdk doctor [--json]
  cognibrain sdk platform <name> [--kind issue_tracker|chat|docs|calendar|ci|observability|custom] [--direction ingest|export|two_way] [--auth none|api_key|oauth|token] [--out <dir>] [--dry-run]
  cognibrain sdk harness <name> [--out <dir>] [--dry-run]`);
  process.exit(exitCode);
}

export function skillUsage(exitCode) {
  console.log(`Usage:
  cognibrain skill install
  cognibrain skill status [--json]
  cognibrain skill doctor [--fix] [--json]
  cognibrain skill path`);
  process.exit(exitCode);
}
