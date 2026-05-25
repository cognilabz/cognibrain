#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchCwd = process.cwd();
const rawArgs = process.argv.slice(2);
const { args, runtimeRoot } = parseGlobalArgs(rawArgs);
const command = args[0];
const commandArgs = args.slice(1);

switch (command) {
  case "init":
    await init(commandArgs);
    break;

  case "setup":
    await setup(commandArgs);
    break;

  case "doctor":
    await doctor(commandArgs);
    break;

  case "start":
    runNodeAndExit("scripts/start-local.mjs", ["--daemon"]);
    break;

  case "dev":
    runNodeAndExit("scripts/start-local.mjs", []);
    break;

  case "status":
    runNodeAndExit("scripts/start-local.mjs", ["--status"]);
    break;

  case "stop":
    runNodeAndExit("scripts/start-local.mjs", ["--stop"]);
    break;

  case "clean":
    cleanGenerated();
    break;

  case "skill":
    if (commandArgs[0] !== "install") usage(1);
    runNodeAndExit("scripts/install-codex-skill.mjs", []);
    break;

  case "config":
    writeHarnessConfig(commandArgs[0] ?? "all");
    break;

  case "connector":
    await connectorCommand(commandArgs);
    break;

  case "memory":
    runTsxAndExit("src/cli/memctl.ts", commandArgs);
    break;

  case "mcp":
    runTsxAndExit("src/connectors/mcpServer.ts", commandArgs);
    break;

  case "help":
  case undefined:
    usage(0);
    break;

  default:
    usage(1);
}

async function setup(setupArgs) {
  const flags = new Set(setupArgs);
  const selfHosted = flags.has("--self-hosted");
  if (!flags.has("--no-skill")) runNodeChecked("scripts/install-codex-skill.mjs", []);

  if (flags.has("--all-harnesses") || selfHosted) {
    writeHarnessConfig("all");
  } else {
    if (flags.has("--codex")) writeHarnessConfig("codex");
    if (flags.has("--claude")) writeHarnessConfig("claude");
    if (flags.has("--copilot")) writeHarnessConfig("copilot");
    if (flags.has("--cursor")) writeHarnessConfig("cursor");
    if (flags.has("--vscode")) writeHarnessConfig("vscode");
    if (flags.has("--opencode")) writeHarnessConfig("opencode");
    if (flags.has("--openclaw")) writeHarnessConfig("openclaw");
    if (flags.has("--langgraph")) writeHarnessConfig("langgraph");
    if (flags.has("--crewai")) writeHarnessConfig("crewai");
  }

  if (!flags.has("--no-start")) runNodeChecked("scripts/start-local.mjs", ["--daemon"]);
  if (!flags.has("--no-doctor")) await doctor(selfHosted ? ["--publish"] : []);
}

async function doctor(doctorArgs) {
  const publish = doctorArgs.includes("--publish");
  const fix = doctorArgs.includes("--fix");
  const noStart = doctorArgs.includes("--no-start");
  const fixed = [];

  if (fix) {
    if (!existsSync(join(runtimeRoot, ".cognibrain", "setup-state.json"))) {
      writeSetupState(profileDefinition("solo-dev"), { fixedByDoctor: true });
      fixed.push("setup-state");
    }
    if (!existsSync(join(runtimeRoot, ".cognibrain", "connectors"))) {
      mkdirSync(join(runtimeRoot, ".cognibrain", "connectors"), { recursive: true });
      fixed.push("connector-directory");
    }
    if (!existsSync(join(launchCwd, ".cognibrain-harness-package.json"))) {
      writeHarnessPackageManifest();
      fixed.push("harness-package");
    }
    const skillPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md");
    if (!existsSync(skillPath) && !doctorArgs.includes("--no-skill")) {
      runNodeChecked("scripts/install-codex-skill.mjs", []);
      fixed.push("codex-skill");
    }
    if (!noStart) {
      const state = readRuntimeState();
      const apiAlive = state?.api?.pid ? isAlive(state.api.pid) : false;
      const uiAlive = state?.ui?.pid ? isAlive(state.ui.pid) : false;
      if (!apiAlive || !uiAlive) {
        runNodeChecked("scripts/start-local.mjs", ["--daemon"]);
        fixed.push("runtime");
      }
    }
  }

  const checks = [];
  const add = (name, ok, detail = "", level = ok ? "ok" : "fail") => checks.push({ name, ok, detail, level });

  add("Node >= 20", majorVersion(process.version) >= 20, process.version);
  const npmVersion = runCapture("npm", ["--version"]);
  add("npm available", npmVersion.status === 0, npmVersion.stdout.trim() || npmVersion.stderr.trim());
  add("package manifest", existsSync(join(root, "package.json")), join(root, "package.json"));
  add("runtime launcher", existsSync(join(root, "scripts", "start-local.mjs")), "scripts/start-local.mjs");
  add("CLI entrypoint", existsSync(join(root, "bin", "cognibrain.mjs")), "bin/cognibrain.mjs");
  const tsx = resolveExecutable("tsx");
  add("tsx runtime", Boolean(tsx), tsx ?? "missing");

  const skillPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md");
  const skillInstalled = existsSync(skillPath);
  add("Codex skill installed", skillInstalled, skillPath, skillInstalled ? "ok" : doctorArgs.includes("--no-skill") ? "warn" : "fail");
  add("guided setup state", existsSync(join(runtimeRoot, ".cognibrain", "setup-state.json")), join(runtimeRoot, ".cognibrain", "setup-state.json"), existsSync(join(runtimeRoot, ".cognibrain", "setup-state.json")) ? "ok" : "warn");
  add("connector config directory", existsSync(join(runtimeRoot, ".cognibrain", "connectors")), join(runtimeRoot, ".cognibrain", "connectors"), existsSync(join(runtimeRoot, ".cognibrain", "connectors")) ? "ok" : "warn");

  const state = readRuntimeState();
  const apiAlive = state?.api?.pid ? isAlive(state.api.pid) : false;
  const uiAlive = state?.ui?.pid ? isAlive(state.ui.pid) : false;
  add("API process", apiAlive, state?.api?.url ?? "not started", apiAlive ? "ok" : noStart ? "warn" : "fail");
  add("dashboard process", uiAlive, state?.ui?.url ?? "not started", uiAlive ? "ok" : noStart ? "warn" : "fail");

  if (state?.api?.url && apiAlive) {
    const health = await requestJson(`${state.api.url}/health`).catch((error) => ({ error: error.message }));
    add("API health", Boolean(health.ok), JSON.stringify(health));
    const maintenance = await requestJson(`${state.api.url}/maintenance`).catch((error) => ({ error: error.message }));
    add("dream maintenance", maintenance.enabled === true, JSON.stringify(maintenance));
  }

  if (publish) {
    const pack = runCapture("npm", ["pack", "--dry-run"]);
    add("npm pack dry-run", pack.status === 0, pack.status === 0 ? "ok" : pack.stderr.trim());
    const leaked = [
      ".cognibrain/",
      ".cognibrain-harness-package.json",
      ".memory-harness.json",
      ".playwright-cli",
      "output/",
      "artifacts/",
      "data/benchmarks",
      "__pycache__",
      "sdk/python/build",
      "sdk/python/cognibrain.egg-info",
      "sdk/go",
      "sdk/rust"
    ].filter((item) => `${pack.stdout}\n${pack.stderr}`.includes(item));
    add("package excludes generated files", leaked.length === 0, leaked.length ? leaked.join(", ") : "clean");
    const transport = transportSecurityCheck(state?.api?.url);
    add("transport security", transport.ok, transport.detail, transport.level);
    const harnessTemplates = harnessTemplateHealth();
    add("harness package templates", harnessTemplates.ok, harnessTemplates.detail);
    const harnessGenerated = harnessGeneratedHealth();
    add("harness generated configs", harnessGenerated.ok, harnessGenerated.detail, harnessGenerated.ok ? "ok" : "warn");
    const productionDocs = [
      "docs/production-readiness.md",
      "docs/production/overview.md",
      "docs/production/release-checklist.md",
      "docs/production/observability.md",
      "docs/claims.md"
    ].filter((path) => existsSync(join(root, path)));
    add("production docs", productionDocs.length === 5, productionDocs.length === 5 ? "docs/production/overview.md and docs/claims.md" : "missing production docs");
  }

  for (const check of checks) {
    console.log(`${check.level === "warn" ? "warn" : check.ok ? "ok" : "fail"}  ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
  }
  if (fixed.length) console.log(`fixed ${fixed.join(", ")}`);

  if (checks.some((check) => !check.ok && check.level !== "warn")) process.exit(1);
}

async function init(initArgs) {
  if (initArgs.includes("--help")) initUsage(0);
  const profileName = optionValue(initArgs, "--profile") ?? (initArgs.includes("--benchmark") ? "benchmark" : initArgs.includes("--enterprise") ? "enterprise" : initArgs.includes("--team") ? "team" : "solo-dev");
  const profile = profileDefinition(profileName);
  const setupArgs = new Set(profile.setupFlags);
  if (initArgs.includes("--no-start")) setupArgs.add("--no-start");
  if (initArgs.includes("--no-skill")) setupArgs.add("--no-skill");
  if (initArgs.includes("--no-doctor")) setupArgs.add("--no-doctor");
  if (initArgs.includes("--all-harnesses")) setupArgs.add("--all-harnesses");

  console.log(`cognibrain init: ${profile.label}`);
  console.log(`runtime root: ${runtimeRoot}`);
  console.log(`profile: ${profile.name}`);
  writeSetupState(profile, {
    selectedAt: new Date().toISOString(),
    installCommand: "npx cognibrain init",
    dryRun: initArgs.includes("--dry-run"),
    dashboard: !initArgs.includes("--no-dashboard")
  });
  for (const connector of profile.connectors) writeConnectorConfig(connector, { dryRun: initArgs.includes("--dry-run"), suggestedByProfile: profile.name });
  if (!initArgs.includes("--dry-run")) await setup([...setupArgs]);
  if (profile.runDemo && !initArgs.includes("--no-demo") && !initArgs.includes("--dry-run")) {
    const demo = runCapture("npm", ["run", "demo:first-win"]);
    if (demo.status !== 0) console.log(`warn  first-win demo skipped - ${demo.stderr.trim() || demo.stdout.trim()}`);
  }
  console.log("next: cognibrain status, cognibrain doctor --fix, cognibrain connector add github");
}

async function connectorCommand(commandArgs) {
  const subcommand = commandArgs[0];
  if (subcommand !== "add") connectorUsage(1);
  const provider = commandArgs[1];
  if (!provider || !connectorDefinitions()[provider]) connectorUsage(1);
  const result = writeConnectorConfig(provider, {
    dryRun: commandArgs.includes("--dry-run"),
    suggestedByProfile: optionValue(commandArgs, "--profile")
  });
  console.log(`${result.dryRun ? "would write" : "wrote"} connector config: ${result.path}`);
  console.log(`${result.configured ? "configured" : "missing env"}: ${result.missing.length ? result.missing.join(", ") : "none"}`);
}

function transportSecurityCheck(localUrl) {
  const publicUrl = process.env.MEMORY_PUBLIC_URL || localUrl || "";
  const deploymentMode = process.env.MEMORY_DEPLOYMENT_MODE || inferDeploymentMode(publicUrl);
  const tlsTerminatedBy = process.env.MEMORY_TLS_TERMINATED_BY;
  const encrypted = publicUrl.startsWith("https://") || Boolean(tlsTerminatedBy);
  const nonLocal = deploymentMode === "managed" || deploymentMode === "self_hosted" || deploymentMode === "production";
  if (nonLocal && !encrypted) {
    return {
      ok: true,
      level: "warn",
      detail: `warn: ${deploymentMode} publish target is not HTTPS and MEMORY_TLS_TERMINATED_BY is unset`
    };
  }
  return { ok: true, level: "ok", detail: encrypted ? `encrypted in transit via ${tlsTerminatedBy || "https"}` : "local-only transport" };
}

function inferDeploymentMode(url) {
  if (!url) return "local";
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" ? "local" : "production";
  } catch {
    return "production";
  }
}

function profileDefinition(name) {
  const profiles = {
    "solo-dev": {
      name: "solo-dev",
      label: "self-hosted solo developer",
      mode: "self_hosted",
      setupFlags: ["--codex", "--cursor"],
      harnesses: ["codex", "cursor"],
      storage: "local-json",
      auth: "local-only",
      connectors: ["github"],
      runDemo: true,
      nextSteps: ["Open the dashboard", "Add GitHub credentials", "Run the first-win demo"]
    },
    team: {
      name: "team",
      label: "self-hosted team workspace",
      mode: "self_hosted",
      setupFlags: ["--all-harnesses"],
      harnesses: ["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai"],
      storage: "local-json-or-postgres",
      auth: "reverse-proxy-or-oidc",
      connectors: ["github", "slack", "jira", "confluence", "notion", "linear"],
      runDemo: true,
      nextSteps: ["Set connector env vars", "Run verify:compatibility", "Publish deployment docs"]
    },
    enterprise: {
      name: "enterprise",
      label: "self-hosted enterprise pilot",
      mode: "self_hosted",
      setupFlags: ["--self-hosted"],
      harnesses: ["all"],
      storage: "postgres",
      auth: "oidc-or-sso",
      connectors: ["github", "slack", "discord", "jira", "confluence", "notion", "linear"],
      runDemo: true,
      nextSteps: ["Enable TLS", "Run vendor-live smoke with tenant credentials", "Review SECURITY.md"]
    },
    benchmark: {
      name: "benchmark",
      label: "benchmark proof lab",
      mode: "self_hosted",
      setupFlags: ["--all-harnesses"],
      harnesses: ["all"],
      storage: "local-json",
      auth: "local-only",
      connectors: ["github", "jira", "notion", "linear"],
      runDemo: true,
      nextSteps: ["Run benchmark:arena", "Open artifacts/arena/run.json", "Publish same-benchmark proof"]
    }
  };
  const profile = profiles[name];
  if (!profile) {
    console.error(`Unknown init profile: ${name}`);
    console.error(`Available profiles: ${Object.keys(profiles).join(", ")}`);
    process.exit(1);
  }
  return profile;
}

function writeSetupState(profile, metadata = {}) {
  const path = join(runtimeRoot, ".cognibrain", "setup-state.json");
  writeJson(path, {
    schemaVersion: "1.0",
    product: "cognibrain",
    profile: profile.name,
    label: profile.label,
    mode: profile.mode,
    runtimeRoot,
    packageRoot: root,
    harnesses: profile.harnesses,
    storage: profile.storage,
    auth: profile.auth,
    connectors: profile.connectors,
    runDemo: profile.runDemo,
    nextSteps: profile.nextSteps,
    metadata
  });
  console.log(`Wrote setup state: ${path}`);
  return path;
}

function connectorDefinitions() {
  return {
    github: {
      connectorId: "official-github",
      requiredEnv: ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/github.md"
    },
    slack: {
      connectorId: "official-slack",
      requiredEnv: ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/slack-discord.md"
    },
    discord: {
      connectorId: "official-discord",
      requiredEnv: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/slack-discord.md"
    },
    jira: {
      connectorId: "official-jira",
      requiredEnv: ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md"
    },
    confluence: {
      connectorId: "official-confluence",
      requiredEnv: ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md"
    },
    notion: {
      connectorId: "official-notion",
      requiredEnv: ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md"
    },
    linear: {
      connectorId: "official-linear",
      requiredEnv: ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md"
    }
  };
}

function writeConnectorConfig(provider, metadata = {}) {
  const definition = connectorDefinitions()[provider];
  const missing = definition.requiredEnv.filter((key) => !process.env[key]);
  const path = join(runtimeRoot, ".cognibrain", "connectors", `${provider}.json`);
  const config = {
    schemaVersion: "1.0",
    provider,
    connectorId: definition.connectorId,
    configured: missing.length === 0,
    requiredEnv: definition.requiredEnv.map((key) => ({ name: key, present: Boolean(process.env[key]), valueRef: `env:${key}` })),
    missingEnv: missing,
    storagePolicy: "never store credential values; read from environment at runtime",
    verification: definition.verification,
    docs: definition.docs,
    nextSteps: missing.length ? [`Set ${missing.join(", ")}`, definition.verification] : [definition.verification, "npm run verify:vendor-live -- --live"],
    metadata: { writtenAt: new Date().toISOString(), ...metadata }
  };
  if (!metadata.dryRun) writeJson(path, config);
  return { path, configured: missing.length === 0, missing, dryRun: Boolean(metadata.dryRun), config };
}

function writeHarnessConfig(target) {
  switch (target) {
    case "all":
      writeCodexConfig();
      writeClaudeConfig();
      writeCopilotConfig();
      writeCursorConfig();
      writeVsCodeConfig();
      writeOpenCodeConfig();
      writeOpenClawConfig();
      writeLangGraphConfig();
      writeCrewAIConfig();
      writeHarnessPackageManifest();
      break;
    case "codex":
      writeCodexConfig();
      break;
    case "claude":
      writeClaudeConfig();
      break;
    case "copilot":
      writeCopilotConfig();
      break;
    case "cursor":
      writeCursorConfig();
      break;
    case "vscode":
      writeVsCodeConfig();
      break;
    case "opencode":
      writeOpenCodeConfig();
      break;
    case "openclaw":
      writeOpenClawConfig();
      break;
    case "langgraph":
      writeLangGraphConfig();
      break;
    case "crewai":
      writeCrewAIConfig();
      break;
    default:
      console.error("Usage: cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai>");
      process.exit(1);
  }
}

function writeCodexConfig() {
  const configPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");
  mkdirSync(dirname(configPath), { recursive: true });
  const current = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  if (current.includes("[mcp_servers.cognibrain]")) {
    console.log(`Codex MCP config already present: ${configPath}`);
  } else {
    const block = [
      "",
      "[mcp_servers.cognibrain]",
      `command = ${tomlString(process.execPath)}`,
      `args = [${tomlString(join(root, "bin", "cognibrain.mjs"))}, "--runtime-root", ${tomlString(launchCwd)}, "mcp"]`,
      ""
    ].join("\n");
    writeFileSync(configPath, `${current.trimEnd()}${block}`);
    console.log(`Wrote Codex MCP config: ${configPath}`);
  }
  writeTemplateFile(join(launchCwd, "AGENTS.md"), "templates/codex/AGENTS.md");
  writeHarnessPackageManifest();
}

function writeClaudeConfig() {
  const path = join(launchCwd, ".mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote Claude MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".claude", "settings.json"), "templates/claude/settings.json");
  writeHarnessPackageManifest();
}

function writeCopilotConfig() {
  writeTemplateFile(join(launchCwd, ".github", "copilot-instructions.md"), "templates/copilot/copilot-instructions.md");
  writeTextFile(join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"), generatedCopilotScopedInstructions());
  writeHarnessPackageManifest();
}

function writeCursorConfig() {
  const path = join(launchCwd, ".cursor", "mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote Cursor MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".cursor", "rules", "open-memory.mdc"), "templates/cursor/open-memory.mdc");
  writeHarnessPackageManifest();
}

function writeVsCodeConfig() {
  const path = join(launchCwd, ".vscode", "mcp.json");
  const json = readJson(path, { servers: {} });
  json.servers ??= {};
  json.servers.cognibrain = { type: "stdio", ...stdioServerConfig() };
  writeJson(path, json);
  console.log(`Wrote VS Code MCP config: ${path}`);
  writeHarnessPackageManifest();
}

function writeOpenCodeConfig() {
  const path = join(launchCwd, ".opencode", "mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote OpenCode MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".opencode", "cognibrain.md"), "templates/opencode/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeOpenClawConfig() {
  const path = join(launchCwd, ".openclaw", "mcp.json");
  const json = readJson(path, { mcpServers: {} });
  json.mcpServers ??= {};
  json.mcpServers.cognibrain = stdioServerConfig();
  writeJson(path, json);
  console.log(`Wrote OpenClaw MCP config: ${path}`);
  writeTemplateFile(join(launchCwd, ".openclaw", "cognibrain.md"), "templates/openclaw/cognibrain.md");
  writeHarnessPackageManifest();
}

function writeLangGraphConfig() {
  writeTemplateFile(join(launchCwd, "langgraph.cognibrain.json"), "templates/langgraph/langgraph.cognibrain.json");
  writeTemplateFile(join(launchCwd, "langgraph-cognibrain.ts"), "templates/langgraph/langgraph-cognibrain.ts");
  writeHarnessPackageManifest();
}

function writeCrewAIConfig() {
  writeTemplateFile(join(launchCwd, "crewai.cognibrain.json"), "templates/crewai/crewai.cognibrain.json");
  writeTemplateFile(join(launchCwd, "crewai_cognibrain.py"), "templates/crewai/crewai_cognibrain.py");
  writeHarnessPackageManifest();
}

function writeTemplateFile(targetPath, templatePath) {
  const content = readFileSync(join(root, templatePath), "utf8")
    .replaceAll("/ABSOLUTE/PATH/TO/cognibrain", root)
    .replaceAll("__COGNIBRAIN_ROOT__", root);
  writeTextFile(targetPath, content);
}

function writeTextFile(targetPath, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (existsSync(targetPath)) {
    const current = readFileSync(targetPath, "utf8");
    if (current === normalized || current.includes("cognibrain")) {
      console.log(`cognibrain harness file already present: ${targetPath}`);
      return;
    }
    const sidecar = `${targetPath}.cognibrain`;
    mkdirSync(dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, normalized);
    console.log(`Wrote reviewable cognibrain sidecar: ${sidecar}`);
    return;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, normalized);
  console.log(`Wrote harness file: ${targetPath}`);
}

function generatedCopilotScopedInstructions() {
  return `---
applyTo: "**/*"
---

# cognibrain scoped memory policy

Use the local cognibrain runtime for durable project memory. Start it with \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} start\`.

Before multi-step coding or debugging, query memory through MCP when available. After durable discoveries, record source-backed facts with \`memory_add\` or \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory add "<fact>"\`.

Use feedback adapters through the CLI:

- accepted suggestion: \`MEMORY_CONNECTOR_FEEDBACK_KIND=accepted_change node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory feedback-injection "<query>" accepted\`
- rejected suggestion: \`MEMORY_CONNECTOR_FEEDBACK_KIND=rejected_suggestion node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory feedback-injection "<query>" rejected\`
- failing test: \`node ${join(root, "bin", "cognibrain.mjs")} --runtime-root ${launchCwd} memory add "A harness suggestion caused a failing test: <summary>"\`
`;
}

function writeHarnessPackageManifest() {
  const path = join(launchCwd, ".cognibrain-harness-package.json");
  writeJson(path, {
    schemaVersion: "1.0",
    runtimeRoot: launchCwd,
    packageRoot: root,
    harnesses: {
      codex: {
        mcpConfig: join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml"),
        policyFile: join(launchCwd, "AGENTS.md"),
        skill: join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md"),
        feedback: ["memory_add", "memory_maintenance_status", "memory_dream"]
      },
      claude: {
        mcpConfig: join(launchCwd, ".mcp.json"),
        hooks: join(launchCwd, ".claude", "settings.json"),
        feedback: ["PostToolUse maintenance hook", "memory feedback-injection"]
      },
      copilot: {
        repositoryInstructions: join(launchCwd, ".github", "copilot-instructions.md"),
        scopedInstructions: join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"),
        feedback: ["accepted_change", "rejected_suggestion", "failing_test"]
      },
      cursor: {
        mcpConfig: join(launchCwd, ".cursor", "mcp.json"),
        rule: join(launchCwd, ".cursor", "rules", "open-memory.mdc"),
        feedback: ["memory_add", "memory_context_pack", "memory_dream"]
      },
      vscode: {
        mcpConfig: join(launchCwd, ".vscode", "mcp.json"),
        feedback: ["memory_context_pack", "memory_add", "connector-telemetry"]
      },
      opencode: {
        mcpConfig: join(launchCwd, ".opencode", "mcp.json"),
        instructions: join(launchCwd, ".opencode", "cognibrain.md"),
        feedback: ["memory_context_pack", "connector-telemetry", "memory_dream"]
      },
      openclaw: {
        mcpConfig: join(launchCwd, ".openclaw", "mcp.json"),
        instructions: join(launchCwd, ".openclaw", "cognibrain.md"),
        feedback: ["memory_context_pack", "connector-telemetry", "memory_dream"]
      },
      langgraph: {
        config: join(launchCwd, "langgraph.cognibrain.json"),
        helper: join(launchCwd, "langgraph-cognibrain.ts"),
        feedback: ["context pack middleware", "tool outcome telemetry"]
      },
      crewai: {
        config: join(launchCwd, "crewai.cognibrain.json"),
        helper: join(launchCwd, "crewai_cognibrain.py"),
        feedback: ["task memory prefetch", "tool outcome telemetry"]
      }
    }
  });
  console.log(`Wrote harness package manifest: ${path}`);
}

function harnessTemplateHealth() {
  const templates = [
    "templates/codex/AGENTS.md",
    "templates/codex/cognibrain-skill/SKILL.md",
    "templates/claude/settings.json",
    "templates/copilot/copilot-instructions.md",
    "templates/cursor/open-memory.mdc",
    "templates/opencode/cognibrain.md",
    "templates/openclaw/cognibrain.md",
    "templates/langgraph/langgraph.cognibrain.json",
    "templates/langgraph/langgraph-cognibrain.ts",
    "templates/crewai/crewai.cognibrain.json",
    "templates/crewai/crewai_cognibrain.py"
  ];
  const missing = templates.filter((template) => !existsSync(join(root, template)));
  return { ok: missing.length === 0, detail: missing.length ? `missing ${missing.join(", ")}` : `${templates.length} templates available` };
}

function harnessGeneratedHealth() {
  const expected = [
    join(launchCwd, "AGENTS.md"),
    join(launchCwd, ".mcp.json"),
    join(launchCwd, ".claude", "settings.json"),
    join(launchCwd, ".github", "copilot-instructions.md"),
    join(launchCwd, ".github", "instructions", "cognibrain.instructions.md"),
    join(launchCwd, ".cursor", "mcp.json"),
    join(launchCwd, ".cursor", "rules", "open-memory.mdc"),
    join(launchCwd, ".vscode", "mcp.json"),
    join(launchCwd, ".opencode", "mcp.json"),
    join(launchCwd, ".opencode", "cognibrain.md"),
    join(launchCwd, ".openclaw", "mcp.json"),
    join(launchCwd, ".openclaw", "cognibrain.md"),
    join(launchCwd, "langgraph.cognibrain.json"),
    join(launchCwd, "langgraph-cognibrain.ts"),
    join(launchCwd, "crewai.cognibrain.json"),
    join(launchCwd, "crewai_cognibrain.py"),
    join(launchCwd, ".cognibrain-harness-package.json")
  ];
  const missing = expected.filter((path) => !existsSync(path));
  return { ok: missing.length === 0, detail: missing.length ? `run cognibrain setup --all-harnesses; missing ${missing.map((path) => path.replace(`${launchCwd}/`, "")).join(", ")}` : "Codex, Claude, Copilot, Cursor, VS Code, OpenCode, OpenClaw, LangGraph and CrewAI configs present" };
}

function stdioServerConfig() {
  return {
    command: process.execPath,
    args: [join(root, "bin", "cognibrain.mjs"), "--runtime-root", launchCwd, "mcp"]
  };
}

function cleanGenerated() {
  for (const name of [".cognibrain", ".memory-harness.json"]) {
    rmSync(join(runtimeRoot, name), { recursive: true, force: true });
  }
  const developerArtifactRoot = runtimeRoot === root ? runtimeRoot : root;
  for (const name of [".playwright-cli", "output", "artifacts", "dist", "data/benchmarks"]) {
    rmSync(join(developerArtifactRoot, name), { recursive: true, force: true });
  }
  console.log(`Removed generated local runtime data from ${runtimeRoot}.`);
  if (developerArtifactRoot === root) console.log("Removed generated benchmark, browser, and build artifacts.");
}

function runNodeChecked(script, runArgs) {
  runChecked(process.execPath, [join(root, script), ...runArgs]);
}

function runNodeAndExit(script, runArgs) {
  runAndExit(process.execPath, [join(root, script), ...runArgs]);
}

function runTsxAndExit(script, runArgs) {
  const tsx = resolveExecutable("tsx");
  if (!tsx) {
    console.error("tsx is missing. Run npm install or reinstall the cognibrain package.");
    process.exit(1);
  }
  runAndExit(tsx, [join(root, script), ...runArgs]);
}

function runChecked(cmd, runArgs) {
  const result = spawnSync(cmd, runArgs, { cwd: root, env: runtimeEnv(), stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runAndExit(cmd, runArgs) {
  const result = spawnSync(cmd, runArgs, { cwd: root, env: runtimeEnv(), stdio: "inherit" });
  process.exit(result.status ?? 1);
}

function runCapture(cmd, runArgs) {
  return spawnSync(cmd, runArgs, { cwd: root, env: runtimeEnv(), encoding: "utf8" });
}

function commandExists(cmd) {
  const result = spawnSync(cmd, ["--version"], { cwd: root, env: process.env, stdio: "ignore" });
  return result.status === 0;
}

function resolveExecutable(name) {
  for (const local of executableCandidates(name)) {
    if (existsSync(local)) return local;
  }
  if (commandExists(name)) return name;
  return null;
}

function localBin(name) {
  return executableCandidates(name)[0];
}

function executableCandidates(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  return [
    join(root, "node_modules", ".bin", `${name}${suffix}`),
    join(root, "..", ".bin", `${name}${suffix}`),
    join(root, "..", "..", ".bin", `${name}${suffix}`)
  ];
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function tomlString(value) {
  return JSON.stringify(value);
}

function majorVersion(version) {
  return Number(version.replace(/^v/, "").split(".")[0] ?? 0);
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function readRuntimeState() {
  const statePath = join(runtimeRoot, ".cognibrain", "local-runtime.json");
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function requestJson(url) {
  return new Promise((resolveRequest, reject) => {
    const request = http.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }
        try {
          resolveRequest(body ? JSON.parse(body) : {});
        } catch {
          resolveRequest({ body });
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(1_500, () => request.destroy(new Error(`${url} timed out`)));
  });
}

function usage(exitCode) {
  console.log(`cognibrain

Usage:
  cognibrain [--runtime-root <path>] <command>
  cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--no-start] [--no-doctor] [--no-skill]
      Guided self-hosted install that writes setup state, connector stubs, harness config, starts runtime, and runs doctor
  cognibrain setup [--self-hosted] [--codex] [--claude] [--copilot] [--cursor] [--vscode] [--opencode] [--openclaw] [--langgraph] [--crewai] [--all-harnesses]
      Install the Codex skill, optionally write harness configs, start API + dashboard, run doctor
  cognibrain doctor [--publish] [--fix] [--no-start]
      Check and optionally fix local runtime, skill install, guided setup state, package readiness, and npm pack hygiene
  cognibrain start | dev | status | stop
      Manage the local API + dashboard runtime
  cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai>
      Write MCP config for supported harnesses
  cognibrain connector add <github|slack|discord|jira|confluence|notion|linear> [--dry-run]
      Write a credential-safe connector setup stub under .cognibrain/connectors/
  cognibrain skill install
      Install the Codex skill
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
  cognibrain mcp
      Run the stdio MCP server for agent harnesses
  cognibrain clean
      Remove generated local runtime, benchmark, screenshot, and build artifacts
`);
  process.exit(exitCode);
}

function initUsage(exitCode) {
  console.log(`Usage: cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--dry-run] [--no-start] [--no-doctor] [--no-skill] [--no-demo]`);
  process.exit(exitCode);
}

function connectorUsage(exitCode) {
  console.log("Usage: cognibrain connector add <github|slack|discord|jira|confluence|notion|linear> [--dry-run]");
  process.exit(exitCode);
}

function parseGlobalArgs(input) {
  const parsed = [];
  let runtimeRootArg;
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (item === "--runtime-root") {
      runtimeRootArg = input[index + 1];
      index += 1;
      continue;
    }
    parsed.push(item);
  }
  return {
    args: parsed,
    runtimeRoot: resolve(runtimeRootArg ?? process.env.COGNIBRAIN_RUNTIME_ROOT ?? process.env.COGNIBRAIN_HOME ?? launchCwd)
  };
}

function runtimeEnv() {
  return {
    ...process.env,
    COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
    MEMORY_DB_PATH: process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json")
  };
}
