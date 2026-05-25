#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, platform as hostPlatformName } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchCwd = process.cwd();
const rawArgs = process.argv.slice(2);
const { args, runtimeRoot } = parseGlobalArgs(rawArgs);
const command = args[0]?.startsWith("--") ? undefined : args[0];
const commandArgs = args[0]?.startsWith("--") ? args : args.slice(1);

switch (command) {
  case undefined:
  case "ui":
  case "home":
    await cliHome(commandArgs);
    break;

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
    runNodeAndExit("scripts/start-local.mjs", ["--daemon", ...commandArgs]);
    break;

  case "dev":
    runNodeAndExit("scripts/start-local.mjs", commandArgs);
    break;

  case "dashboard":
    runNodeAndExit("scripts/start-local.mjs", ["--daemon", "--dashboard", ...commandArgs]);
    break;

  case "status":
    await statusCommand(commandArgs);
    break;

  case "stop":
    runNodeAndExit("scripts/start-local.mjs", ["--stop"]);
    break;

  case "service":
    await serviceCommand(commandArgs);
    break;

  case "clean":
    cleanGenerated();
    break;

  case "skill":
    await skillCommand(commandArgs);
    break;

  case "config":
    await configCommand(commandArgs);
    break;

  case "connector":
    await connectorCommand(commandArgs);
    break;

  case "connection":
  case "connections":
    await connectionsCommand(commandArgs);
    break;

  case "adapter":
    await adapterCommand(commandArgs);
    break;

  case "sdk":
    await sdkCommand(commandArgs);
    break;

  case "memory":
    runTsxAndExit("src/cli/memctl.ts", commandArgs);
    break;

  case "memories":
    await memoriesCommand(commandArgs);
    break;

  case "mcp":
    runTsxAndExit("src/connectors/mcpServer.ts", commandArgs);
    break;

  case "help":
    usage(0);
    break;

  default:
    usage(1);
}

async function setup(setupArgs) {
  if (shouldRouteSetupToWizard(setupArgs)) {
    await init(setupArgs);
    return;
  }
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

  if (!flags.has("--no-start")) runNodeChecked("scripts/start-local.mjs", ["--daemon", ...(flags.has("--dashboard") ? ["--dashboard"] : [])]);
  if (!flags.has("--no-doctor")) await doctor(selfHosted ? ["--publish"] : []);
}

async function cliHome(homeArgs = []) {
  if (homeArgs.includes("--help")) {
    usage(0);
    return;
  }
  const result = await cliHomeData();
  if (homeArgs.includes("--json")) {
    printJson(result);
    return;
  }
  await renderCliSurface("home", result, { title: "cognibrain CLI home" });
}

async function statusCommand(statusArgs = []) {
  if (statusArgs.includes("--raw")) {
    runNodeAndExit("scripts/start-local.mjs", ["--status"]);
    return;
  }
  const result = await cliHomeData();
  if (statusArgs.includes("--json")) {
    printJson(result);
    return;
  }
  await renderCliSurface("status", result, { title: "cognibrain status" });
}

async function memoriesCommand(memoryArgs = []) {
  const subcommand = firstSubcommand(memoryArgs);
  if (subcommand === "help" || subcommand === "--help") {
    memoriesUsage(0);
    return;
  }
  if (subcommand === "overview" || subcommand === "status" || subcommand === "list") {
    const result = await memoryDashboardData(memoryArgs);
    if (memoryArgs.includes("--json")) printJson(result);
    else await renderCliSurface("memories", result, { title: "cognibrain memories" });
    return;
  }
  runTsxAndExit("src/cli/memctl.ts", memoryArgs);
}

async function connectionsCommand(connectionArgs = []) {
  const subcommandIndex = firstSubcommandIndex(connectionArgs);
  const subcommand = subcommandIndex >= 0 ? connectionArgs[subcommandIndex] : "overview";
  if (subcommand === "help" || subcommand === "--help") {
    connectionsUsage(0);
    return;
  }
  if (["overview", "status", "list"].includes(subcommand)) {
    const result = connectionsDashboardData();
    if (connectionArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connections", result, { title: "cognibrain connections" });
    return;
  }
  if (subcommand === "doctor") {
    const result = combinedConnectionsDoctor();
    if (connectionArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connections-doctor", result, { title: "cognibrain connections doctor" });
    if (!result.ok) process.exit(1);
    return;
  }
  if (subcommand === "add" || subcommand === "configure") {
    const target = connectionArgs[subcommandIndex + 1];
    if (!target) connectionsUsage(1);
    const rest = connectionArgs.slice(subcommandIndex + 2);
    if (connectorDefinitions()[target]) {
      await connectorCommand(["add", target, ...rest]);
      return;
    }
    if (adapterDefinitions()[target]) {
      await adapterCommand(["add", target, ...rest]);
      return;
    }
    console.error(`Unknown connection target: ${target}`);
    console.error(`Connectors: ${Object.keys(connectorDefinitions()).join(", ")}`);
    console.error(`Adapters: ${Object.keys(adapterDefinitions()).join(", ")}`);
    process.exit(1);
  }
  if (subcommand === "connectors" || subcommand === "connector") {
    const nestedArgs = connectionArgs.slice(subcommandIndex + 1);
    await connectorCommand(nestedArgs.length ? nestedArgs : ["list"]);
    return;
  }
  if (subcommand === "adapters" || subcommand === "adapter") {
    const nestedArgs = connectionArgs.slice(subcommandIndex + 1);
    await adapterCommand(nestedArgs.length ? nestedArgs : ["list"]);
    return;
  }
  connectionsUsage(1);
}

async function serviceCommand(serviceArgs = []) {
  const subcommand = firstSubcommand(serviceArgs);
  if (subcommand === "help" || subcommand === "--help") {
    serviceUsage(0);
    return;
  }
  const plan = servicePlan(serviceArgs);
  if (["overview", "status", "plan", "list"].includes(subcommand)) {
    if (serviceArgs.includes("--json")) printJson(plan);
    else await renderCliSurface("service", plan, { title: "cognibrain service" });
    return;
  }
  if (subcommand === "install") {
    const dryRun = serviceArgs.includes("--dry-run");
    const result = dryRun ? { ...plan, dryRun: true, written: [] } : writeServicePlan(plan);
    if (!dryRun && serviceArgs.includes("--activate")) runServiceNativeAction(plan, "enable");
    if (serviceArgs.includes("--json")) printJson(result);
    else printServiceInstall(result, dryRun);
    return;
  }
  if (subcommand === "uninstall" || subcommand === "remove") {
    if (serviceArgs.includes("--deactivate") && existsSync(plan.files.descriptor)) runServiceNativeAction(plan, "disable");
    const result = removeServicePlan(plan);
    if (serviceArgs.includes("--json")) printJson(result);
    else printServiceRemove(result);
    return;
  }
  if (["enable", "disable", "start", "stop", "restart"].includes(subcommand)) {
    runServiceNativeAction(plan, subcommand);
    return;
  }
  if (subcommand === "logs") {
    if (serviceArgs.includes("--json")) printJson(plan.logs);
    else printServiceLogs(plan);
    return;
  }
  serviceUsage(1);
}

async function doctor(doctorArgs) {
  const publish = doctorArgs.includes("--publish");
  const fix = doctorArgs.includes("--fix");
  const noStart = doctorArgs.includes("--no-start");
  const dashboardRequired = doctorArgs.includes("--dashboard") || doctorArgs.includes("--with-dashboard");
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
    if (!existsSync(join(runtimeRoot, ".cognibrain", "adapters"))) {
      mkdirSync(join(runtimeRoot, ".cognibrain", "adapters"), { recursive: true });
      fixed.push("adapter-directory");
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
      if (!apiAlive || (dashboardRequired && !uiAlive)) {
        runNodeChecked("scripts/start-local.mjs", ["--daemon", ...(dashboardRequired ? ["--dashboard"] : [])]);
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
  add("adapter config directory", existsSync(join(runtimeRoot, ".cognibrain", "adapters")), join(runtimeRoot, ".cognibrain", "adapters"), existsSync(join(runtimeRoot, ".cognibrain", "adapters")) ? "ok" : "warn");

  const state = readRuntimeState();
  const apiAlive = state?.api?.pid ? isAlive(state.api.pid) : false;
  const uiAlive = state?.ui?.pid ? isAlive(state.ui.pid) : false;
  add("API process", apiAlive, state?.api?.url ?? "not started", apiAlive ? "ok" : noStart ? "warn" : "fail");
  add("dashboard process", uiAlive, state?.ui?.url ?? "not started", uiAlive ? "ok" : "warn");
  add("dashboard opt-in", true, dashboardRequired ? "required for this doctor run" : "optional; run cognibrain dashboard or cognibrain start --dashboard");

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

  const result = {
    schemaVersion: "1.0",
    publish,
    fixed,
    checks,
    summary: {
      total: checks.length,
      ok: checks.filter((check) => check.ok && check.level !== "warn").length,
      warn: checks.filter((check) => check.level === "warn").length,
      fail: checks.filter((check) => !check.ok && check.level !== "warn").length
    },
    runtime: runtimeStatus(),
    commands: [
      "cognibrain doctor --fix",
      "cognibrain doctor --publish",
      "cognibrain config doctor",
      "cognibrain connections doctor",
      "cognibrain service status"
    ]
  };
  if (doctorArgs.includes("--json")) printJson(result);
  else await renderCliSurface("doctor", result, { title: "cognibrain doctor" });

  if (checks.some((check) => !check.ok && check.level !== "warn")) process.exit(1);
}

async function init(initArgs) {
  if (initArgs.includes("--help")) initUsage(0);
  const interactive = shouldPrompt(initArgs);
  const profileName = normalizeProfileName(optionValue(initArgs, "--profile") ?? (initArgs.includes("--benchmark") ? "benchmark" : initArgs.includes("--enterprise") ? "enterprise" : initArgs.includes("--team") ? "team" : "solo-dev"));
  const profile = interactive ? await promptInitProfile(profileName) : profileDefinition(profileName);
  const setupArgs = new Set(profile.setupFlags);
  if (initArgs.includes("--no-start")) setupArgs.add("--no-start");
  if (initArgs.includes("--no-skill")) setupArgs.add("--no-skill");
  if (initArgs.includes("--no-doctor")) setupArgs.add("--no-doctor");
  if (initArgs.includes("--all-harnesses")) setupArgs.add("--all-harnesses");
  if (initArgs.includes("--dashboard")) setupArgs.add("--dashboard");

  await renderCliPanel("init", profile, {
    title: "cognibrain self-hosted setup",
    runtimeRoot,
    dryRun: initArgs.includes("--dry-run"),
    mode: interactive ? "interactive" : "non-interactive"
  });
  writeSetupState(profile, {
    selectedAt: new Date().toISOString(),
    installCommand: "npx cognibrain init",
    uiFramework: "ink-react",
    dryRun: initArgs.includes("--dry-run"),
    primaryInterface: "cli",
    dashboard: initArgs.includes("--dashboard") ? "opt-in-started" : "optional"
  });
  for (const connector of profile.connectors) writeConnectorConfig(connector, { dryRun: initArgs.includes("--dry-run"), suggestedByProfile: profile.name });
  for (const adapter of profile.adapters ?? []) writeAdapterConfig(adapter, { dryRun: initArgs.includes("--dry-run"), suggestedByProfile: profile.name });
  if (!initArgs.includes("--dry-run")) await setup([...setupArgs]);
  if (profile.runDemo && !initArgs.includes("--no-demo") && !initArgs.includes("--dry-run")) {
    const demo = runCapture("npm", ["run", "demo:first-win"]);
    if (demo.status !== 0) console.log(`warn  first-win demo skipped - ${demo.stderr.trim() || demo.stdout.trim()}`);
  }
  printInitSummary(profile);
}

async function skillCommand(commandArgs) {
  const subcommand = commandArgs[0] ?? "status";
  const fix = commandArgs.includes("--fix");
  const path = codexSkillPath();
  if (subcommand === "install") {
    runNodeAndExit("scripts/install-codex-skill.mjs", []);
    return;
  }
  if (subcommand === "path") {
    console.log(path);
    return;
  }
  if (subcommand === "status" || subcommand === "doctor") {
    if (!existsSync(path) && (subcommand === "doctor" || fix)) runNodeChecked("scripts/install-codex-skill.mjs", []);
    const installed = existsSync(path);
    const result = {
      installed,
      path,
      installCommand: "cognibrain skill install",
      doctorCommand: "cognibrain skill doctor --fix",
      docs: "docs/getting-started/setup-cli.md",
      commands: [
        "cognibrain skill status",
        "cognibrain skill install",
        "cognibrain skill doctor --fix",
        "cognibrain skill path"
      ]
    };
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("skill", result, { title: "cognibrain skill" });
    if (!installed && subcommand === "doctor") process.exit(1);
    return;
  }
  skillUsage(1);
}

async function configCommand(commandArgs) {
  const subcommand = commandArgs[0] ?? "show";
  if (subcommand === "help" || subcommand === "--help") configUsage(0);
  if (subcommand === "list") {
    const result = configCatalog();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("config-catalog", result, { title: "cognibrain config catalog" });
    return;
  }
  if (subcommand === "show") {
    const result = readConfigurationState();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("config", result, { title: "cognibrain config" });
    return;
  }
  if (subcommand === "paths") {
    const result = configPaths();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("config-paths", result, { title: "cognibrain config paths" });
    return;
  }
  if (subcommand === "doctor") {
    const result = configurationDoctor();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("config-doctor", result, { title: "cognibrain config doctor" });
    if (!result.ok) process.exit(1);
    return;
  }
  if (subcommand === "write") {
    writeHarnessConfig(commandArgs[1] ?? "all");
    return;
  }
  if (harnessTargets().includes(subcommand) || subcommand === "all") {
    writeHarnessConfig(subcommand);
    return;
  }
  configUsage(1);
}

async function connectorCommand(commandArgs) {
  const subcommand = commandArgs[0] ?? "list";
  if (subcommand === "help" || subcommand === "--help") connectorUsage(0);
  if (subcommand === "list") {
    const result = connectorCatalog();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connector-catalog", result, { title: "cognibrain connectors" });
    return;
  }
  if (subcommand === "show") {
    const provider = commandArgs[1];
    if (!provider) connectorUsage(1);
    const result = connectorShow(provider);
    if (!result) connectorUsage(1);
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connector-show", result, { title: `${provider} connector` });
    return;
  }
  if (subcommand === "doctor") {
    if (commandArgs[1] && !connectorDefinitions()[commandArgs[1]]) connectorUsage(1);
    const result = connectorDoctor(commandArgs[1]);
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connector-doctor", result, { title: "cognibrain connector doctor" });
    if (!result.ok) process.exit(1);
    return;
  }
  if (subcommand === "remove") {
    const provider = commandArgs[1];
    if (!provider || !connectorDefinitions()[provider]) connectorUsage(1);
    const path = connectorConfigPath(provider);
    if (existsSync(path)) unlinkSync(path);
    console.log(`${existsSync(path) ? "failed" : "removed"} connector config: ${path}`);
    return;
  }
  if (subcommand !== "add") connectorUsage(1);
  let provider = commandArgs[1];
  if (!provider && canPrompt(commandArgs)) provider = await promptConnectorProvider();
  if (!provider || !connectorDefinitions()[provider]) connectorUsage(1);
  const settings = canPrompt(commandArgs) && !commandArgs.includes("--yes") ? await promptConnectorSettings(provider, commandArgs) : connectorSettingsFromArgs(provider, commandArgs);
  const result = writeConnectorConfig(provider, {
    dryRun: commandArgs.includes("--dry-run"),
    suggestedByProfile: optionValue(commandArgs, "--profile"),
    settings
  });
  await renderCliPanel("connector", result.config, { title: `${provider} connector setup`, path: result.path, dryRun: result.dryRun });
  console.log(`${result.dryRun ? "would write" : "wrote"} connector config: ${result.path}`);
  console.log(`${result.configured ? "configured" : "needs env"}: ${result.missing.length ? result.missing.join(", ") : "none"}`);
  console.log(`next: ${result.config.healthCommand}`);
}

async function adapterCommand(commandArgs) {
  const subcommand = commandArgs[0] ?? "list";
  if (subcommand === "help" || subcommand === "--help") adapterUsage(0);
  if (subcommand === "list") {
    const result = adapterCatalog();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("adapter-catalog", result, { title: "cognibrain adapters" });
    return;
  }
  if (subcommand === "show") {
    const adapter = commandArgs[1];
    if (!adapter) adapterUsage(1);
    const result = adapterShow(adapter);
    if (!result) adapterUsage(1);
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("adapter-show", result, { title: `${adapter} adapter` });
    return;
  }
  if (subcommand === "doctor") {
    if (commandArgs[1] && !adapterDefinitions()[commandArgs[1]]) adapterUsage(1);
    const result = adapterDoctor(commandArgs[1]);
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("adapter-doctor", result, { title: "cognibrain adapter doctor" });
    if (!result.ok) process.exit(1);
    return;
  }
  if (subcommand === "remove") {
    const adapter = commandArgs[1];
    if (!adapter || !adapterDefinitions()[adapter]) adapterUsage(1);
    const path = adapterConfigPath(adapter);
    if (existsSync(path)) unlinkSync(path);
    console.log(`${existsSync(path) ? "failed" : "removed"} adapter config: ${path}`);
    return;
  }
  if (subcommand !== "add") adapterUsage(1);
  const adapter = commandArgs[1];
  if (!adapter || !adapterDefinitions()[adapter]) adapterUsage(1);
  const result = writeAdapterConfig(adapter, {
    dryRun: commandArgs.includes("--dry-run"),
    settings: settingsFromArgs(adapterDefinitions()[adapter], commandArgs)
  });
  await renderCliPanel("adapter", result.config, { title: `${adapter} adapter setup`, path: result.path, dryRun: result.dryRun });
  console.log(`${result.dryRun ? "would write" : "wrote"} adapter config: ${result.path}`);
  console.log(`${result.configured ? "configured" : "needs env"}: ${result.missing.length ? result.missing.join(", ") : "none"}`);
  console.log(`next: ${result.config.healthCommand}`);
}

async function sdkCommand(commandArgs) {
  const subcommand = commandArgs[0] ?? "list";
  if (subcommand === "help" || subcommand === "--help") sdkUsage(0);
  if (subcommand === "list") {
    const result = sdkCatalog();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("sdk-catalog", result, { title: "cognibrain SDK" });
    return;
  }
  if (subcommand === "doctor") {
    const result = sdkDoctor();
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("sdk-doctor", result, { title: "cognibrain SDK doctor" });
    if (!result.ok) process.exit(1);
    return;
  }
  if (subcommand !== "platform") sdkUsage(1);
  const name = commandArgs[1];
  if (!name) sdkUsage(1);
  const result = platformSdkScaffold(name, {
    kind: optionValue(commandArgs, "--kind") ?? "custom",
    direction: optionValue(commandArgs, "--direction") ?? "two_way",
    auth: optionValue(commandArgs, "--auth") ?? "token",
    out: optionValue(commandArgs, "--out"),
    dryRun: commandArgs.includes("--dry-run")
  });
  if (commandArgs.includes("--json")) printJson(result);
  else await renderCliSurface("sdk-scaffold", result, { title: "cognibrain SDK scaffold" });
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

function shouldRouteSetupToWizard(setupArgs) {
  const flags = new Set(setupArgs);
  const hasLegacySetupFlag = ["--self-hosted", "--codex", "--claude", "--copilot", "--cursor", "--vscode", "--opencode", "--openclaw", "--langgraph", "--crewai", "--all-harnesses"].some((flag) => flags.has(flag));
  return !hasLegacySetupFlag && (setupArgs.length === 0 || flags.has("--yes") || setupArgs.includes("--profile") || canPrompt(setupArgs));
}

function shouldPrompt(argv) {
  return canPrompt(argv) && !argv.includes("--yes") && !argv.includes("--dry-run") && !optionValue(argv, "--profile") && !argv.includes("--benchmark") && !argv.includes("--enterprise") && !argv.includes("--team");
}

function canPrompt(argv = []) {
  return process.stdin.isTTY === true && process.stdout.isTTY === true && process.env.CI !== "true" && !argv.includes("--no-interactive");
}

function normalizeProfileName(name) {
  const aliases = { local: "solo-dev", production: "enterprise", prod: "enterprise" };
  return aliases[name] ?? name;
}

async function promptInitProfile(defaultProfileName) {
  await renderCliPanel("intro", profileDefinition(defaultProfileName), {
    title: "Welcome to cognibrain",
    runtimeRoot,
    mode: "interactive"
  });
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const profileChoice = await ask(rl, "Profile [1 solo-dev, 2 team, 3 enterprise, 4 benchmark]", defaultProfileName);
    const profile = profileDefinition(choiceToProfile(profileChoice, defaultProfileName));
    const harnesses = splitList(await ask(rl, "Harnesses", profile.harnesses.join(",")), profile.harnesses);
    const storage = await ask(rl, "Storage [local-json, sqlite, postgres]", profile.storage);
    const auth = await ask(rl, "Auth [local-only, api-key, oidc-or-sso]", profile.auth);
    const connectors = splitList(await ask(rl, "Connectors", profile.connectors.join(",")), profile.connectors).filter((name) => connectorDefinitions()[name]);
    const adapters = splitList(await ask(rl, "Adapters", (profile.adapters ?? []).join(",")), profile.adapters ?? []).filter((name) => adapterDefinitions()[name]);
    const runDemo = yesNo(await ask(rl, "Run the first-win demo? [Y/n]", profile.runDemo ? "y" : "n"));
    return {
      ...profile,
      harnesses,
      storage,
      auth,
      connectors,
      adapters,
      runDemo,
      setupFlags: setupFlagsForHarnesses(harnesses),
      nextSteps: nextStepsForProfile(profile.name, connectors)
    };
  } finally {
    rl.close();
  }
}

async function promptConnectorProvider() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const providers = Object.keys(connectorDefinitions());
    const answer = await ask(rl, `Connector [${providers.join(", ")}]`, "github");
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function promptConnectorSettings(provider, commandArgs) {
  const initial = connectorSettingsFromArgs(provider, commandArgs);
  const definition = connectorDefinitions()[provider];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const settings = { ...initial };
    for (const field of definition.fields ?? []) {
      const current = settings[field.name] ?? field.default ?? "";
      const answer = await ask(rl, field.secret ? `${field.label} env var` : field.label, current);
      if (answer) settings[field.name] = answer;
    }
    return settings;
  } finally {
    rl.close();
  }
}

function ask(rl, question, defaultValue = "") {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  return rl.question(`${question}${suffix}: `).then((answer) => answer.trim() || defaultValue);
}

function choiceToProfile(value, fallback) {
  const normalized = normalizeProfileName(value.trim().toLowerCase());
  const choices = { "1": "solo-dev", "2": "team", "3": "enterprise", "4": "benchmark" };
  return choices[normalized] ?? (normalized || fallback);
}

function splitList(value, fallback) {
  const items = String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function yesNo(value) {
  return !/^n(o)?$/i.test(String(value ?? ""));
}

function setupFlagsForHarnesses(harnesses) {
  if (harnesses.includes("all")) return ["--all-harnesses"];
  const supported = new Set(["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai"]);
  const selected = harnesses.filter((harness) => supported.has(harness));
  return selected.length ? selected.map((harness) => `--${harness}`) : ["--codex", "--cursor"];
}

function nextStepsForProfile(profileName, connectors) {
  const steps = ["Run cognibrain", "Run cognibrain doctor --fix", "Run npm run demo:first-win"];
  if (connectors.length) steps.splice(1, 0, `Configure connector env: ${connectors.join(", ")}`);
  if (profileName === "benchmark") steps.push("Run npm run benchmark:arena");
  if (profileName === "enterprise") steps.push("Run npm run verify:vendor-live with tenant credentials");
  return steps;
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
      adapters: ["storage-sqlite"],
      runDemo: true,
      nextSteps: ["Run cognibrain", "Add GitHub credentials", "Run the first-win demo", "Optional: cognibrain dashboard"]
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
      adapters: ["storage-postgres", "embedding-openai-compatible", "intelligence-json-command"],
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
      adapters: ["storage-postgres", "mcp-remote", "intelligence-json-command", "media-json-command"],
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
      adapters: ["benchmark-arena", "storage-sqlite"],
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
    adapters: profile.adapters ?? [],
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
      docs: "docs/integrations/github.md",
      status: "vendor-driver",
      fields: [
        { name: "repo", label: "GitHub repo owner/name", env: "MEMORY_GITHUB_REPO", default: process.env.MEMORY_GITHUB_REPO ?? "cognilabz/cognibrain" },
        { name: "tokenEnv", label: "GitHub token", env: "MEMORY_GITHUB_TOKEN", secret: true, default: "MEMORY_GITHUB_TOKEN" }
      ],
      sampleEvents: ["pull-request review correction", "failed GitHub Actions run", "issue or PR memory comment"]
    },
    slack: {
      connectorId: "official-slack",
      requiredEnv: ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/slack-discord.md",
      status: "vendor-driver",
      fields: [
        { name: "channelId", label: "Slack channel id", env: "MEMORY_SLACK_CHANNEL_ID", default: process.env.MEMORY_SLACK_CHANNEL_ID ?? "C123" },
        { name: "tokenEnv", label: "Slack token", env: "MEMORY_SLACK_TOKEN", secret: true, default: "MEMORY_SLACK_TOKEN" }
      ],
      sampleEvents: ["decision thread", "channel runbook correction", "summary writeback"]
    },
    discord: {
      connectorId: "official-discord",
      requiredEnv: ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/slack-discord.md",
      status: "vendor-driver",
      fields: [
        { name: "channelId", label: "Discord channel id", env: "MEMORY_DISCORD_CHANNEL_ID", default: process.env.MEMORY_DISCORD_CHANNEL_ID ?? "D123" },
        { name: "tokenEnv", label: "Discord bot token", env: "MEMORY_DISCORD_BOT_TOKEN", secret: true, default: "MEMORY_DISCORD_BOT_TOKEN" }
      ],
      sampleEvents: ["support decision", "channel correction", "safe mention-free writeback"]
    },
    jira: {
      connectorId: "official-jira",
      requiredEnv: ["MEMORY_JIRA_BASE_URL", "MEMORY_JIRA_EMAIL", "MEMORY_JIRA_API_TOKEN", "MEMORY_JIRA_PROJECT"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/jira-confluence-notion-linear.md",
      status: "vendor-driver",
      fields: [
        { name: "baseUrl", label: "Jira base URL", env: "MEMORY_JIRA_BASE_URL", default: process.env.MEMORY_JIRA_BASE_URL ?? "https://example.atlassian.net" },
        { name: "project", label: "Jira project key", env: "MEMORY_JIRA_PROJECT", default: process.env.MEMORY_JIRA_PROJECT ?? "ENG" },
        { name: "emailEnv", label: "Jira email", env: "MEMORY_JIRA_EMAIL", secret: true, default: "MEMORY_JIRA_EMAIL" },
        { name: "tokenEnv", label: "Jira API token", env: "MEMORY_JIRA_API_TOKEN", secret: true, default: "MEMORY_JIRA_API_TOKEN" }
      ],
      sampleEvents: ["issue correction", "status/label metadata", "memory summary comment"]
    },
    confluence: {
      connectorId: "official-confluence",
      requiredEnv: ["MEMORY_CONFLUENCE_BASE_URL", "MEMORY_CONFLUENCE_EMAIL", "MEMORY_CONFLUENCE_API_TOKEN", "MEMORY_CONFLUENCE_SPACE"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/jira-confluence-notion-linear.md",
      status: "vendor-driver",
      fields: [
        { name: "baseUrl", label: "Confluence base URL", env: "MEMORY_CONFLUENCE_BASE_URL", default: process.env.MEMORY_CONFLUENCE_BASE_URL ?? "https://example.atlassian.net" },
        { name: "space", label: "Confluence space key", env: "MEMORY_CONFLUENCE_SPACE", default: process.env.MEMORY_CONFLUENCE_SPACE ?? "ENG" },
        { name: "emailEnv", label: "Confluence email", env: "MEMORY_CONFLUENCE_EMAIL", secret: true, default: "MEMORY_CONFLUENCE_EMAIL" },
        { name: "tokenEnv", label: "Confluence API token", env: "MEMORY_CONFLUENCE_API_TOKEN", secret: true, default: "MEMORY_CONFLUENCE_API_TOKEN" }
      ],
      sampleEvents: ["architecture decision page", "runbook page", "versioned page comment"]
    },
    notion: {
      connectorId: "official-notion",
      requiredEnv: ["MEMORY_NOTION_TOKEN", "MEMORY_NOTION_DATABASE_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/jira-confluence-notion-linear.md",
      status: "vendor-driver",
      fields: [
        { name: "databaseId", label: "Notion database id", env: "MEMORY_NOTION_DATABASE_ID", default: process.env.MEMORY_NOTION_DATABASE_ID ?? "notion_database_id" },
        { name: "tokenEnv", label: "Notion token", env: "MEMORY_NOTION_TOKEN", secret: true, default: "MEMORY_NOTION_TOKEN" }
      ],
      sampleEvents: ["decision row", "product spec", "meeting note block"]
    },
    linear: {
      connectorId: "official-linear",
      requiredEnv: ["MEMORY_LINEAR_API_KEY", "MEMORY_LINEAR_TEAM_ID"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/integrations/jira-confluence-notion-linear.md",
      status: "vendor-driver",
      fields: [
        { name: "teamId", label: "Linear team id", env: "MEMORY_LINEAR_TEAM_ID", default: process.env.MEMORY_LINEAR_TEAM_ID ?? "team_id" },
        { name: "tokenEnv", label: "Linear API key", env: "MEMORY_LINEAR_API_KEY", secret: true, default: "MEMORY_LINEAR_API_KEY" }
      ],
      sampleEvents: ["issue correction", "cycle/project metadata", "commentCreate writeback"]
    },
    gitlab: {
      connectorId: "official-gitlab",
      requiredEnv: ["MEMORY_GITLAB_PROJECT", "MEMORY_GITLAB_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "project", label: "GitLab project path", env: "MEMORY_GITLAB_PROJECT", default: "group/project" },
        { name: "tokenEnv", label: "GitLab token", env: "MEMORY_GITLAB_TOKEN", secret: true, default: "MEMORY_GITLAB_TOKEN" }
      ],
      sampleEvents: ["merge request correction", "pipeline failure", "issue comment"]
    },
    "azure-devops": {
      connectorId: "official-azure-devops",
      requiredEnv: ["MEMORY_AZURE_DEVOPS_ORG", "MEMORY_AZURE_DEVOPS_PROJECT", "MEMORY_AZURE_DEVOPS_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "organization", label: "Azure DevOps org", env: "MEMORY_AZURE_DEVOPS_ORG", default: "organization" },
        { name: "project", label: "Azure DevOps project", env: "MEMORY_AZURE_DEVOPS_PROJECT", default: "project" },
        { name: "tokenEnv", label: "Azure DevOps PAT", env: "MEMORY_AZURE_DEVOPS_TOKEN", secret: true, default: "MEMORY_AZURE_DEVOPS_TOKEN" }
      ],
      sampleEvents: ["work item correction", "pull request review", "pipeline failure"]
    },
    teams: {
      connectorId: "official-microsoft-teams",
      requiredEnv: ["MEMORY_TEAMS_TEAM_ID", "MEMORY_TEAMS_CHANNEL_ID", "MEMORY_TEAMS_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "teamId", label: "Microsoft Teams team id", env: "MEMORY_TEAMS_TEAM_ID", default: "team_id" },
        { name: "channelId", label: "Teams channel id", env: "MEMORY_TEAMS_CHANNEL_ID", default: "channel_id" },
        { name: "tokenEnv", label: "Teams token", env: "MEMORY_TEAMS_TOKEN", secret: true, default: "MEMORY_TEAMS_TOKEN" }
      ],
      sampleEvents: ["channel decision", "incident learning", "message writeback"]
    },
    gmail: {
      connectorId: "official-gmail",
      requiredEnv: ["MEMORY_GMAIL_ACCOUNT", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "account", label: "Gmail account", env: "MEMORY_GMAIL_ACCOUNT", default: "engineering@example.com" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["email thread decision", "support correction", "label summary"]
    },
    "google-drive": {
      connectorId: "official-google-drive",
      requiredEnv: ["MEMORY_GOOGLE_DRIVE_ROOT", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "root", label: "Drive folder/root id", env: "MEMORY_GOOGLE_DRIVE_ROOT", default: "drive_root_id" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["design doc", "runbook file", "policy document"]
    },
    "google-calendar": {
      connectorId: "official-google-calendar",
      requiredEnv: ["MEMORY_GOOGLE_CALENDAR_ID", "MEMORY_GOOGLE_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "calendarId", label: "Calendar id", env: "MEMORY_GOOGLE_CALENDAR_ID", default: "primary" },
        { name: "tokenEnv", label: "Google token", env: "MEMORY_GOOGLE_TOKEN", secret: true, default: "MEMORY_GOOGLE_TOKEN" }
      ],
      sampleEvents: ["release meeting", "incident review", "architecture council note"]
    },
    asana: {
      connectorId: "official-asana",
      requiredEnv: ["MEMORY_ASANA_WORKSPACE", "MEMORY_ASANA_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "workspace", label: "Asana workspace", env: "MEMORY_ASANA_WORKSPACE", default: "workspace_gid" },
        { name: "project", label: "Asana project", env: "MEMORY_ASANA_PROJECT", default: "project_gid" },
        { name: "tokenEnv", label: "Asana token", env: "MEMORY_ASANA_TOKEN", secret: true, default: "MEMORY_ASANA_TOKEN" }
      ],
      sampleEvents: ["project task correction", "goal status update", "handoff comment"]
    },
    clickup: {
      connectorId: "official-clickup",
      requiredEnv: ["MEMORY_CLICKUP_LIST_ID", "MEMORY_CLICKUP_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "listId", label: "ClickUp list id", env: "MEMORY_CLICKUP_LIST_ID", default: "list_id" },
        { name: "tokenEnv", label: "ClickUp token", env: "MEMORY_CLICKUP_TOKEN", secret: true, default: "MEMORY_CLICKUP_TOKEN" }
      ],
      sampleEvents: ["task correction", "sprint status", "implementation checklist"]
    },
    sentry: {
      connectorId: "official-sentry",
      requiredEnv: ["MEMORY_SENTRY_ORG", "MEMORY_SENTRY_PROJECT", "MEMORY_SENTRY_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "organization", label: "Sentry organization", env: "MEMORY_SENTRY_ORG", default: "organization" },
        { name: "project", label: "Sentry project", env: "MEMORY_SENTRY_PROJECT", default: "project" },
        { name: "tokenEnv", label: "Sentry token", env: "MEMORY_SENTRY_TOKEN", secret: true, default: "MEMORY_SENTRY_TOKEN" }
      ],
      sampleEvents: ["release regression", "issue triage note", "root-cause correction"]
    },
    datadog: {
      connectorId: "official-datadog",
      requiredEnv: ["MEMORY_DATADOG_SITE", "MEMORY_DATADOG_API_KEY", "MEMORY_DATADOG_APP_KEY"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "site", label: "Datadog site", env: "MEMORY_DATADOG_SITE", default: "datadoghq.com" },
        { name: "apiKeyEnv", label: "Datadog API key", env: "MEMORY_DATADOG_API_KEY", secret: true, default: "MEMORY_DATADOG_API_KEY" },
        { name: "appKeyEnv", label: "Datadog app key", env: "MEMORY_DATADOG_APP_KEY", secret: true, default: "MEMORY_DATADOG_APP_KEY" }
      ],
      sampleEvents: ["incident metric link", "monitor change", "runbook correction"]
    },
    pagerduty: {
      connectorId: "official-pagerduty",
      requiredEnv: ["MEMORY_PAGERDUTY_ACCOUNT", "MEMORY_PAGERDUTY_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "account", label: "PagerDuty account/subdomain", env: "MEMORY_PAGERDUTY_ACCOUNT", default: "team" },
        { name: "service", label: "PagerDuty service id", env: "MEMORY_PAGERDUTY_SERVICE_ID", default: "service_id" },
        { name: "tokenEnv", label: "PagerDuty token", env: "MEMORY_PAGERDUTY_TOKEN", secret: true, default: "MEMORY_PAGERDUTY_TOKEN" }
      ],
      sampleEvents: ["incident postmortem", "escalation policy correction", "service ownership note"]
    },
    posthog: {
      connectorId: "official-posthog",
      requiredEnv: ["MEMORY_POSTHOG_PROJECT", "MEMORY_POSTHOG_TOKEN"],
      verification: "npm run verify:vendor-connectors",
      docs: "docs/connectors.md#native-vendor-drivers",
      status: "vendor-driver",
      fields: [
        { name: "project", label: "PostHog project id", env: "MEMORY_POSTHOG_PROJECT", default: "project_id" },
        { name: "baseUrl", label: "PostHog base URL", env: "MEMORY_POSTHOG_BASE_URL", default: "https://app.posthog.com" },
        { name: "tokenEnv", label: "PostHog token", env: "MEMORY_POSTHOG_TOKEN", secret: true, default: "MEMORY_POSTHOG_TOKEN" }
      ],
      sampleEvents: ["feature flag decision", "product analytics finding", "experiment follow-up"]
    }
  };
}

function adapterDefinitions() {
  return {
    "intelligence-json-command": {
      adapterId: "intelligence-json-command",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_INTELLIGENCE_COMMAND"],
      verification: "cognibrain connections adapters doctor intelligence-json-command",
      docs: "docs/configuration.md#intelligence-provider-adapter",
      fields: [
        { name: "commandEnv", label: "JSON command env var", env: "MEMORY_INTELLIGENCE_COMMAND", secret: true, default: "MEMORY_INTELLIGENCE_COMMAND" },
        { name: "tasks", label: "Tasks", env: "MEMORY_INTELLIGENCE_TASKS", default: "extract,translate,expand,rerank,verify,contradiction,summarize" }
      ],
      sampleEvents: ["rerank candidate memories", "verify contradiction warnings", "summarize timeline window"]
    },
    "embedding-openai-compatible": {
      adapterId: "embedding-openai-compatible",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_EMBEDDING_BASE_URL", "MEMORY_EMBEDDING_MODEL", "MEMORY_EMBEDDING_API_KEY"],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/configuration.md#embeddings-and-vector-search",
      fields: [
        { name: "baseUrl", label: "Embedding base URL", env: "MEMORY_EMBEDDING_BASE_URL", default: "http://localhost:11434/v1" },
        { name: "model", label: "Embedding model", env: "MEMORY_EMBEDDING_MODEL", default: "text-embedding-3-small" },
        { name: "apiKeyEnv", label: "Embedding API key", env: "MEMORY_EMBEDDING_API_KEY", secret: true, default: "MEMORY_EMBEDDING_API_KEY" }
      ],
      sampleEvents: ["semantic recall", "hybrid ranking", "privacy-disabled fallback"]
    },
    "media-json-command": {
      adapterId: "media-json-command",
      kind: "provider",
      status: "available-contract",
      requiredEnv: ["MEMORY_MEDIA_COMMAND"],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/advanced-features.md#media-and-multilingual-ingest",
      fields: [
        { name: "commandEnv", label: "Media command env var", env: "MEMORY_MEDIA_COMMAND", secret: true, default: "MEMORY_MEDIA_COMMAND" },
        { name: "tasks", label: "Tasks", env: "MEMORY_MEDIA_TASKS", default: "asr,ocr,pdf,video-frames,translate" }
      ],
      sampleEvents: ["audio transcript memory", "image OCR decision", "video-frame evidence"]
    },
    "storage-sqlite": {
      adapterId: "storage-sqlite",
      kind: "storage",
      status: "built-in",
      requiredEnv: [],
      verification: "npm test -- tests/core.test.ts",
      docs: "docs/production/storage.md",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "sqlite" },
        { name: "path", label: "SQLite path", env: "MEMORY_DB_PATH", default: ".cognibrain/memory.sqlite" }
      ],
      sampleEvents: ["transactional local memory", "FTS5 lexical search", "desktop self-hosted store"]
    },
    "storage-postgres": {
      adapterId: "storage-postgres",
      kind: "storage",
      status: "remote-driver",
      requiredEnv: ["MEMORY_POSTGRES_URL"],
      verification: "npm run verify:postgres",
      docs: "docs/production/storage.md",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "postgres-remote" },
        { name: "urlEnv", label: "Postgres URL", env: "MEMORY_POSTGRES_URL", secret: true, default: "MEMORY_POSTGRES_URL" }
      ],
      sampleEvents: ["team shared memory", "remote tsvector search", "backup-ready production store"]
    },
    "storage-cassandra": {
      adapterId: "storage-cassandra",
      kind: "storage",
      status: "remote-driver",
      requiredEnv: [],
      verification: "cognibrain connections adapters doctor storage-cassandra",
      docs: "docs/production/storage.md",
      fields: [
        { name: "backend", label: "Storage backend", env: "MEMORY_STORAGE_BACKEND", default: "cassandra-remote" },
        { name: "contactPoints", label: "Cassandra contact points", env: "MEMORY_CASSANDRA_CONTACT_POINTS", default: "127.0.0.1:9042" },
        { name: "keyspace", label: "Cassandra keyspace", env: "MEMORY_CASSANDRA_KEYSPACE", default: "cognibrain" }
      ],
      sampleEvents: ["wide-column memory snapshot", "multi-region partition", "distributed audit log"]
    },
    "benchmark-arena": {
      adapterId: "benchmark-arena",
      kind: "benchmark",
      status: "built-in",
      requiredEnv: [],
      verification: "npm run benchmark:arena",
      docs: "docs/benchmarks/arena.md",
      fields: [
        { name: "systems", label: "Systems", env: "MEMORY_ARENA_SYSTEMS", default: "mem0,graphiti,zep,cognee,langmem,gbrain" },
        { name: "proofLevel", label: "Proof level", env: "MEMORY_ARENA_PROOF_LEVEL", default: "same-run-api-shape" }
      ],
      sampleEvents: ["same-run adapter comparison", "declared gap row", "public proof artifact"]
    },
    "mcp-remote": {
      adapterId: "mcp-remote",
      kind: "transport",
      status: "available-contract",
      requiredEnv: ["MEMORY_MCP_REMOTE_URL"],
      verification: "cognibrain connections adapters doctor mcp-remote",
      docs: "docs/integrations/mcp.md",
      fields: [
        { name: "url", label: "Remote MCP URL", env: "MEMORY_MCP_REMOTE_URL", default: "https://memory.example.com/mcp" },
        { name: "tokenEnv", label: "Remote MCP token", env: "MEMORY_MCP_REMOTE_TOKEN", secret: true, default: "MEMORY_MCP_REMOTE_TOKEN" }
      ],
      sampleEvents: ["remote agent context pack", "shared MCP tool call", "browser-client session"]
    }
  };
}

function harnessTargets() {
  return ["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai"];
}

function codexSkillPath() {
  return join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md");
}

function configPaths() {
  return {
    setupState: join(runtimeRoot, ".cognibrain", "setup-state.json"),
    connectors: join(runtimeRoot, ".cognibrain", "connectors"),
    adapters: join(runtimeRoot, ".cognibrain", "adapters"),
    harnessManifest: join(launchCwd, ".cognibrain-harness-package.json"),
    codexSkill: codexSkillPath(),
    runtimeState: join(runtimeRoot, ".cognibrain", "local-runtime.json")
  };
}

function configCatalog() {
  const paths = configPaths();
  return {
    runtimeRoot,
    packageRoot: root,
    harnesses: harnessTargets().map((target) => ({ target, command: `cognibrain config ${target}` })),
    connectors: Object.keys(connectorDefinitions()).map((provider) => ({ provider, status: connectorDefinitions()[provider].status, command: `cognibrain connections add ${provider}` })),
    adapters: Object.keys(adapterDefinitions()).map((adapter) => ({ adapter, status: adapterDefinitions()[adapter].status, command: `cognibrain connections add ${adapter}` })),
    skill: { command: "cognibrain skill install", path: paths.codexSkill },
    paths
  };
}

function readConfigurationState() {
  const paths = configPaths();
  return {
    runtimeRoot,
    setupState: readJson(paths.setupState, null),
    harnessManifest: readJson(paths.harnessManifest, null),
    connectors: readConfigDirectory(paths.connectors),
    adapters: readConfigDirectory(paths.adapters),
    skill: { installed: existsSync(paths.codexSkill), path: paths.codexSkill }
  };
}

async function cliHomeData() {
  const config = readConfigurationState();
  const connections = connectionsDashboardData();
  const memories = await memoryDashboardData(["--limit", "5"]);
  const service = servicePlan([]);
  return {
    schemaVersion: "1.0",
    package: packageInfo(),
    runtime: runtimeStatus(),
    config,
    memories,
    connections,
    service,
    primaryInterface: "cli",
    dashboard: {
      optional: true,
      command: "cognibrain dashboard",
      note: "The web dashboard is opt-in; every operator surface is reachable from this CLI."
    },
    commands: [
      "cognibrain",
      "cognibrain status",
      "cognibrain memories",
      "cognibrain memories search <query>",
      "cognibrain connections",
      "cognibrain connections add github --set repo=owner/repo",
      "cognibrain config show",
      "cognibrain service plan",
      "cognibrain service install --activate",
      "cognibrain dashboard"
    ]
  };
}

function packageInfo() {
  const manifest = readJson(join(root, "package.json"), {});
  return {
    name: manifest.name ?? "cognibrain",
    version: manifest.version ?? "0.0.0",
    bin: manifest.bin?.cognibrain ?? "./bin/cognibrain.mjs",
    install: `npm i ${manifest.name ?? "@cognilabz/cognibrain"}`,
    open: "cognibrain"
  };
}

function runtimeStatus() {
  const state = readRuntimeState();
  const apiAlive = state?.api?.pid ? isAlive(state.api.pid) : false;
  const uiAlive = state?.ui?.pid ? isAlive(state.ui.pid) : false;
  return {
    runtimeRoot,
    statePath: join(runtimeRoot, ".cognibrain", "local-runtime.json"),
    dbPath: process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json"),
    api: {
      alive: apiAlive,
      url: state?.api?.url ?? null,
      pid: state?.api?.pid ?? null
    },
    dashboard: {
      alive: uiAlive,
      url: state?.ui?.url ?? null,
      pid: state?.ui?.pid ?? null,
      optional: true
    },
    mode: apiAlive ? (uiAlive ? "api+optional-dashboard" : "api-only") : "stopped"
  };
}

function servicePlan(serviceArgs = []) {
  const targetPlatform = normalizeServicePlatform(optionValue(serviceArgs, "--platform") ?? optionValue(serviceArgs, "--os") ?? serviceHostPlatform());
  const serviceName = optionValue(serviceArgs, "--name") ?? "cognibrain";
  const label = optionValue(serviceArgs, "--label") ?? `dev.cognilabz.${serviceName}`;
  const system = serviceArgs.includes("--system");
  const dashboardEnabled = serviceArgs.includes("--dashboard") || serviceArgs.includes("--with-dashboard");
  const serviceDir = join(runtimeRoot, ".cognibrain", "service");
  const metadataPath = join(serviceDir, "service.json");
  const logs = {
    stdout: join(serviceDir, "cognibrain.out.log"),
    stderr: join(serviceDir, "cognibrain.err.log")
  };
  const node = process.execPath;
  const cli = join(root, "bin", "cognibrain.mjs");
  const dbPath = optionValue(serviceArgs, "--db-path") ?? process.env.MEMORY_DB_PATH ?? join(runtimeRoot, ".memory-harness.json");
  const env = {
    COGNIBRAIN_RUNTIME_ROOT: runtimeRoot,
    MEMORY_DB_PATH: dbPath,
    NODE_ENV: optionValue(serviceArgs, "--node-env") ?? process.env.NODE_ENV ?? "production",
    ...serviceEnvFromArgs(serviceArgs)
  };
  if (optionValue(serviceArgs, "--port")) env.PORT = optionValue(serviceArgs, "--port");
  if (optionValue(serviceArgs, "--dashboard-port")) env.VITE_PORT = optionValue(serviceArgs, "--dashboard-port");
  if (dashboardEnabled) env.COGNIBRAIN_DASHBOARD = "true";

  const execArgs = [cli, "--runtime-root", runtimeRoot, "dev", ...(dashboardEnabled ? ["--dashboard"] : [])];
  const scope = system ? "system" : "user";
  const descriptorPath = serviceDescriptorPath(targetPlatform, serviceName, label, scope, serviceDir);
  const descriptor = serviceDescriptor(targetPlatform, {
    name: serviceName,
    label,
    scope,
    node,
    cli,
    execArgs,
    runtimeRoot,
    root,
    env,
    logs
  });
  const commands = serviceNativeCommands(targetPlatform, { name: serviceName, label, scope, descriptorPath, scriptPath: descriptorPath });
  const installed = existsSync(descriptorPath) || existsSync(metadataPath);
  return {
    schemaVersion: "1.0",
    platform: targetPlatform,
    hostPlatform: serviceHostPlatform(),
    manager: serviceManager(targetPlatform),
    name: serviceName,
    label,
    scope,
    runtimeRoot,
    dashboard: { enabled: dashboardEnabled, optional: true },
    command: { executable: node, args: execArgs },
    env,
    files: {
      descriptor: descriptorPath,
      metadata: metadataPath,
      logs
    },
    descriptor,
    installed,
    runtime: runtimeStatus(),
    commands,
    actions: [
      "cognibrain service plan --json",
      "cognibrain service install --activate",
      "cognibrain service status",
      "cognibrain service start",
      "cognibrain service stop",
      "cognibrain service uninstall --deactivate"
    ],
    notes: serviceNotes(targetPlatform)
  };
}

function serviceHostPlatform() {
  const value = hostPlatformName();
  if (value === "darwin") return "macos";
  if (value === "win32") return "windows";
  return "linux";
}

function normalizeServicePlatform(value) {
  const normalized = String(value).toLowerCase();
  if (["darwin", "mac", "macos", "osx"].includes(normalized)) return "macos";
  if (["win", "win32", "windows"].includes(normalized)) return "windows";
  if (["linux", "systemd"].includes(normalized)) return "linux";
  console.error(`Unknown service platform: ${value}`);
  serviceUsage(1);
}

function serviceManager(targetPlatform) {
  if (targetPlatform === "macos") return "launchd";
  if (targetPlatform === "windows") return "task-scheduler";
  return "systemd";
}

function serviceDescriptorPath(targetPlatform, name, label, scope, serviceDir) {
  if (targetPlatform === "macos") {
    return scope === "system" ? `/Library/LaunchDaemons/${label}.plist` : join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  }
  if (targetPlatform === "windows") return join(serviceDir, `${name}.service.ps1`);
  return scope === "system" ? `/etc/systemd/system/${name}.service` : join(homedir(), ".config", "systemd", "user", `${name}.service`);
}

function serviceDescriptor(targetPlatform, options) {
  if (targetPlatform === "macos") return launchdPlist(options);
  if (targetPlatform === "windows") return windowsServiceScript(options);
  return systemdUnit(options);
}

function systemdUnit({ name, node, execArgs, runtimeRoot, root: workingDirectory, env }) {
  const envLines = Object.entries(env).map(([key, value]) => `Environment=${systemdQuote(`${key}=${value}`)}`).join("\n");
  return `[Unit]
Description=Cognibrain self-hosted memory runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${systemdQuote(workingDirectory)}
${envLines}
ExecStart=${systemdQuote(node)} ${execArgs.map(systemdQuote).join(" ")}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;
}

function launchdPlist({ label, node, execArgs, runtimeRoot: _runtimeRoot, root: workingDirectory, env, logs }) {
  const envEntries = Object.entries(env)
    .map(([key, value]) => `    <key>${xmlEscape(key)}</key>\n    <string>${xmlEscape(value)}</string>`)
    .join("\n");
  const args = [node, ...execArgs]
    .map((arg) => `    <string>${xmlEscape(arg)}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(workingDirectory)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envEntries}
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logs.stdout)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logs.stderr)}</string>
</dict>
</plist>
`;
}

function windowsServiceScript({ node, execArgs, root: workingDirectory, env }) {
  const envLines = Object.entries(env)
    .map(([key, value]) => `$env:${key} = ${powershellString(value)}`)
    .join("\n");
  const args = execArgs.map(powershellString).join(" ");
  return `$ErrorActionPreference = "Stop"
Set-Location ${powershellString(workingDirectory)}
${envLines}
& ${powershellString(node)} ${args}
exit $LASTEXITCODE
`;
}

function serviceEnvFromArgs(args) {
  return Object.fromEntries(optionValues(args, "--env").map((item) => {
    const index = item.indexOf("=");
    if (index <= 0) {
      console.error(`Invalid --env value: ${item}. Use KEY=value.`);
      process.exit(1);
    }
    return [item.slice(0, index), item.slice(index + 1)];
  }));
}

function serviceNativeCommands(targetPlatform, { name, label, scope, descriptorPath }) {
  if (targetPlatform === "macos") {
    return {
      enable: [`launchctl load -w ${shellQuote(descriptorPath)}`],
      disable: [`launchctl unload -w ${shellQuote(descriptorPath)}`],
      start: [`launchctl start ${shellQuote(label)}`],
      stop: [`launchctl stop ${shellQuote(label)}`],
      restart: [`launchctl stop ${shellQuote(label)}`, `launchctl start ${shellQuote(label)}`],
      status: [`launchctl list | grep ${shellQuote(label)}`],
      uninstall: [`rm ${shellQuote(descriptorPath)}`]
    };
  }
  if (targetPlatform === "windows") {
    const task = `Cognibrain\\${name}`;
    const action = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File '${descriptorPath.replace(/'/g, "''")}'`;
    return {
      enable: [`schtasks /Create /TN "${task}" /SC ONLOGON /TR "${action}" /F`],
      disable: [`schtasks /Delete /TN "${task}" /F`],
      start: [`schtasks /Run /TN "${task}"`],
      stop: [`schtasks /End /TN "${task}"`],
      restart: [`schtasks /End /TN "${task}"`, `schtasks /Run /TN "${task}"`],
      status: [`schtasks /Query /TN "${task}" /V /FO LIST`],
      uninstall: [`del "${descriptorPath}"`]
    };
  }
  const prefix = scope === "system" ? "sudo systemctl" : "systemctl --user";
  const unit = `${name}.service`;
  return {
    enable: [`${prefix} daemon-reload`, `${prefix} enable --now ${unit}`],
    disable: [`${prefix} disable --now ${unit}`],
    start: [`${prefix} start ${unit}`],
    stop: [`${prefix} stop ${unit}`],
    restart: [`${prefix} restart ${unit}`],
    status: [`${prefix} status ${unit}`],
    uninstall: [`rm ${shellQuote(descriptorPath)}`]
  };
}

function serviceNotes(targetPlatform) {
  if (targetPlatform === "windows") return ["Windows uses Task Scheduler for no-extra-dependency background startup.", "Use --dashboard only when the optional browser UI should run too."];
  if (targetPlatform === "macos") return ["macOS uses launchd LaunchAgents by default.", "Use --system only for LaunchDaemons when installing with administrator rights."];
  return ["Linux uses systemd user services by default.", "Use --system for a machine service when installing with administrator rights."];
}

function writeServicePlan(plan) {
  if (plan.platform !== serviceHostPlatform()) {
    console.error(`Refusing to install ${plan.platform} service files on ${serviceHostPlatform()}. Use service plan --platform ${plan.platform} --json on this host, or run install on the target OS.`);
    process.exit(1);
  }
  mkdirSync(dirname(plan.files.descriptor), { recursive: true });
  mkdirSync(dirname(plan.files.logs.stdout), { recursive: true });
  writeFileSync(plan.files.descriptor, plan.descriptor);
  const metadata = { ...plan, descriptor: undefined };
  writeJson(plan.files.metadata, metadata);
  return { ...plan, installed: true, written: [plan.files.descriptor, plan.files.metadata], dryRun: false };
}

function removeServicePlan(plan) {
  const removed = [];
  for (const path of [plan.files.descriptor, plan.files.metadata]) {
    if (existsSync(path)) {
      rmSync(path, { force: true });
      removed.push(path);
    }
  }
  return { ...plan, installed: false, removed };
}

function runServiceNativeAction(plan, action) {
  if (plan.platform !== serviceHostPlatform()) {
    console.error(`Cannot run ${plan.platform} ${action} command on ${serviceHostPlatform()}.`);
    process.exit(1);
  }
  const commands = action === "uninstall" ? plan.commands.uninstall : plan.commands[action];
  if (!commands?.length) serviceUsage(1);
  for (const command of commands) {
    const result = spawnSync(command, [], { cwd: root, shell: true, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function printServiceInstall(result, dryRun) {
  console.log(`${dryRun ? "would write" : "wrote"} ${result.manager} service for ${result.platform}`);
  console.log(`descriptor: ${result.files.descriptor}`);
  console.log(`metadata: ${result.files.metadata}`);
  console.log(`runtime: ${result.runtimeRoot}`);
  console.log(`dashboard: ${result.dashboard.enabled ? "enabled" : "optional/off"}`);
  console.log(`next: ${result.commands.enable.join(" && ")}`);
}

function printServiceRemove(result) {
  console.log(`removed service files: ${result.removed.length ? result.removed.join(", ") : "none"}`);
}

function printServiceLogs(plan) {
  if (plan.platform === "linux") console.log(`logs: ${plan.scope === "system" ? "journalctl -u" : "journalctl --user -u"} ${plan.name}.service -f`);
  else if (plan.platform === "macos") console.log(`logs: tail -f ${plan.files.logs.stdout} ${plan.files.logs.stderr}`);
  else console.log(`logs: schtasks /Query /TN "Cognibrain\\${plan.name}" /V /FO LIST`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function systemdQuote(value) {
  return `"${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
}

function powershellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function memoryDashboardData(memoryArgs = []) {
  const limit = Number(optionValue(memoryArgs, "--limit") ?? process.env.MEMORY_LIMIT ?? 8);
  const health = captureMemoryJson(["health"]);
  const maintenance = captureMemoryJson(["maintenance"]);
  const recent = captureMemoryJson(["list", "--limit", String(limit)]);
  return {
    userId: process.env.MEMORY_USER_ID ?? process.env.USER ?? "local",
    health,
    maintenance,
    recent: Array.isArray(recent) ? recent : [],
    commands: [
      "cognibrain memories add <text>",
      "cognibrain memories search <query>",
      "cognibrain memories coding-context <query>",
      "cognibrain memories verify",
      "cognibrain memories dream",
      "cognibrain memories export"
    ],
    dashboardParity: [
      "inspect/add/archive/delete/confirm/retract memories through memory subcommands",
      "recall/context/evidence through search, coding-context, evidence-pack and why-used",
      "graph/timeline/dream/marketplace through graph, timeline, dream and marketplace subcommands",
      "connector sync/writeback/health through connections plus memory connector-* subcommands"
    ]
  };
}

function connectionsDashboardData() {
  const config = readConfigurationState();
  const connectorItems = connectorCatalog();
  const adapterItems = adapterCatalog();
  const configuredConnectors = config.connectors.map((item) => item.provider).filter(Boolean);
  const configuredAdapters = config.adapters.map((item) => item.adapter).filter(Boolean);
  return {
    runtimeRoot,
    connectors: {
      configured: configuredConnectors,
      available: connectorItems,
      doctor: connectorDoctor()
    },
    adapters: {
      configured: configuredAdapters,
      available: adapterItems,
      doctor: adapterDoctor()
    },
    harnesses: {
      targets: harnessTargets(),
      manifest: config.harnessManifest ? "present" : "missing",
      skill: config.skill
    },
    commands: [
      "cognibrain connections add github --set repo=owner/repo",
      "cognibrain connections add storage-postgres --set urlEnv=MEMORY_POSTGRES_URL",
      "cognibrain connections connectors list",
      "cognibrain connections adapters list",
      "cognibrain connections doctor",
      "cognibrain config all"
    ]
  };
}

function combinedConnectionsDoctor() {
  const config = configurationDoctor();
  const connectors = connectorDoctor();
  const adapters = adapterDoctor();
  const ok = config.ok && (connectors.ok || connectors.checks.length === 0) && (adapters.ok || adapters.checks.length === 0);
  return { ok, config, connectors, adapters };
}

function captureMemoryJson(memoryArgs) {
  const tsx = resolveExecutable("tsx");
  if (!tsx) return null;
  const result = runCapture(tsx, [join(root, "src", "cli", "memctl.ts"), ...memoryArgs]);
  if (result.status !== 0) return { error: result.stderr.trim() || result.stdout.trim() || `memctl ${memoryArgs.join(" ")} failed` };
  try {
    return JSON.parse(result.stdout);
  } catch {
    return result.stdout.trim();
  }
}

function configurationDoctor() {
  const paths = configPaths();
  const checks = [
    { name: "setup state", ok: existsSync(paths.setupState), path: paths.setupState, fix: "cognibrain init --profile solo-dev --yes" },
    { name: "connector directory", ok: existsSync(paths.connectors), path: paths.connectors, fix: "cognibrain connections add github --set repo=owner/repo" },
    { name: "adapter directory", ok: existsSync(paths.adapters), path: paths.adapters, fix: "cognibrain connections add storage-sqlite" },
    { name: "harness manifest", ok: existsSync(paths.harnessManifest), path: paths.harnessManifest, fix: "cognibrain config all" },
    { name: "Codex skill", ok: existsSync(paths.codexSkill), path: paths.codexSkill, fix: "cognibrain skill install" }
  ];
  return { ok: checks.every((check) => check.ok), checks, paths };
}

function readConfigDirectory(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(join(directory, name), null))
    .filter(Boolean);
}

function printConfigCatalog(result) {
  console.log(`runtime: ${result.runtimeRoot}`);
  console.log(`harnesses: ${result.harnesses.map((item) => item.target).join(", ")}`);
  console.log(`connectors: ${result.connectors.map((item) => item.provider).join(", ")}`);
  console.log(`adapters: ${result.adapters.map((item) => item.adapter).join(", ")}`);
  console.log(`skill: ${result.skill.path}`);
}

function printConfigurationState(result) {
  console.log(`runtime: ${result.runtimeRoot}`);
  console.log(`setup: ${result.setupState ? result.setupState.profile : "missing"}`);
  console.log(`harness manifest: ${result.harnessManifest ? "present" : "missing"}`);
  console.log(`connectors: ${result.connectors.map((item) => item.provider).join(", ") || "none"}`);
  console.log(`adapters: ${result.adapters.map((item) => item.adapter).join(", ") || "none"}`);
  console.log(`skill: ${result.skill.installed ? "installed" : "missing"} - ${result.skill.path}`);
}

function printConfigurationDoctor(result) {
  for (const check of result.checks) {
    console.log(`${check.ok ? "ok" : "warn"}  ${check.name} - ${check.path}`);
    if (!check.ok) console.log(`next: ${check.fix}`);
  }
}

function connectorConfigPath(provider) {
  return join(runtimeRoot, ".cognibrain", "connectors", `${provider}.json`);
}

function connectorCatalog() {
  const definitions = connectorDefinitions();
  return Object.entries(definitions).map(([provider, definition]) => ({
    provider,
    connectorId: definition.connectorId,
    status: definition.status,
    docs: definition.docs,
    configured: existsSync(connectorConfigPath(provider)),
    addCommand: `cognibrain connections add ${provider}`
  }));
}

function connectorShow(provider) {
  const definition = connectorDefinitions()[provider];
  if (!definition) return null;
  const path = connectorConfigPath(provider);
  return {
    provider,
    path,
    definition,
    config: readJson(path, null)
  };
}

function connectorDoctor(provider) {
  const targets = provider ? [provider] : Object.keys(connectorDefinitions()).filter((name) => existsSync(connectorConfigPath(name)));
  const checks = targets.map((name) => {
    const definition = connectorDefinitions()[name];
    const path = connectorConfigPath(name);
    const config = readJson(path, null);
    const configuredEnv = new Set((definition.fields ?? [])
      .filter((field) => !field.secret && (config?.settings?.[field.name] ?? process.env[field.env] ?? field.default))
      .map((field) => field.env));
    const missingEnv = definition.requiredEnv.filter((key) => !process.env[key] && !configuredEnv.has(key));
    const missingSettings = (definition.fields ?? []).filter((field) => !field.secret && !(config?.settings?.[field.name] ?? process.env[field.env] ?? field.default)).map((field) => field.name);
    return {
      provider: name,
      connectorId: definition.connectorId,
      status: definition.status,
      configPresent: existsSync(path),
      path,
      missingEnv,
      missingSettings,
      ok: existsSync(path) && missingSettings.length === 0 && (definition.status !== "vendor-driver" || missingEnv.length === 0),
      healthCommand: `cognibrain memory connector-health ${definition.connectorId}`,
      docs: definition.docs
    };
  });
  return { ok: checks.length > 0 && checks.every((check) => check.ok), checks };
}

function printConnectorCatalog(items) {
  for (const item of items) console.log(`${item.configured ? "ok" : "available"}  ${item.provider} - ${item.connectorId} (${item.status})`);
  console.log("next: cognibrain connections add <provider> --set key=value");
}

function printConnectorShow(result) {
  console.log(`${result.provider}: ${result.definition.connectorId} (${result.definition.status})`);
  console.log(`config: ${result.config ? result.path : "missing"}`);
  console.log(`docs: ${result.definition.docs}`);
  console.log(`required env: ${result.definition.requiredEnv.join(", ") || "none"}`);
}

function printConnectorDoctor(result) {
  if (!result.checks.length) {
    console.log("warn  no connector configs found");
    console.log("next: cognibrain connections add github --set repo=owner/repo");
    return;
  }
  for (const check of result.checks) {
    console.log(`${check.ok ? "ok" : "fail"}  ${check.provider} - ${check.configPresent ? check.path : "missing config"}`);
    if (check.missingSettings.length) console.log(`missing settings: ${check.missingSettings.join(", ")}`);
    if (check.missingEnv.length) console.log(`missing env: ${check.missingEnv.join(", ")}`);
    console.log(`next: ${check.healthCommand}`);
  }
}

function adapterConfigPath(adapter) {
  return join(runtimeRoot, ".cognibrain", "adapters", `${adapter}.json`);
}

function adapterCatalog() {
  const definitions = adapterDefinitions();
  return Object.entries(definitions).map(([adapter, definition]) => ({
    adapter,
    adapterId: definition.adapterId,
    kind: definition.kind,
    status: definition.status,
    docs: definition.docs,
    configured: existsSync(adapterConfigPath(adapter)),
    addCommand: `cognibrain connections add ${adapter}`
  }));
}

function adapterShow(adapter) {
  const definition = adapterDefinitions()[adapter];
  if (!definition) return null;
  const path = adapterConfigPath(adapter);
  return {
    adapter,
    path,
    definition,
    config: readJson(path, null)
  };
}

function adapterDoctor(adapter) {
  const targets = adapter ? [adapter] : Object.keys(adapterDefinitions()).filter((name) => existsSync(adapterConfigPath(name)));
  const checks = targets.map((name) => {
    const definition = adapterDefinitions()[name];
    const path = adapterConfigPath(name);
    const config = readJson(path, null);
    const missingEnv = definition.requiredEnv.filter((key) => !process.env[key]);
    const missingSettings = (definition.fields ?? []).filter((field) => !field.secret && !(config?.settings?.[field.name] ?? process.env[field.env] ?? field.default)).map((field) => field.name);
    return {
      adapter: name,
      adapterId: definition.adapterId,
      kind: definition.kind,
      status: definition.status,
      configPresent: existsSync(path),
      path,
      missingEnv,
      missingSettings,
      ok: existsSync(path) && missingSettings.length === 0 && missingEnv.length === 0,
      healthCommand: `cognibrain connections adapters doctor ${name}`,
      docs: definition.docs
    };
  });
  return { ok: checks.length > 0 && checks.every((check) => check.ok || check.status === "available-contract"), checks };
}

function printAdapterCatalog(items) {
  for (const item of items) console.log(`${item.configured ? "ok" : "available"}  ${item.adapter} - ${item.adapterId} (${item.kind}, ${item.status})`);
  console.log("next: cognibrain connections add <adapter> --set key=value");
}

function printAdapterShow(result) {
  console.log(`${result.adapter}: ${result.definition.adapterId} (${result.definition.kind}, ${result.definition.status})`);
  console.log(`config: ${result.config ? result.path : "missing"}`);
  console.log(`docs: ${result.definition.docs}`);
  console.log(`required env: ${result.definition.requiredEnv.join(", ") || "none"}`);
}

function printAdapterDoctor(result) {
  if (!result.checks.length) {
    console.log("warn  no adapter configs found");
    console.log("next: cognibrain connections add storage-sqlite");
    return;
  }
  for (const check of result.checks) {
    const ok = check.ok || check.status === "available-contract";
    console.log(`${ok ? "ok" : "fail"}  ${check.adapter} - ${check.configPresent ? check.path : "missing config"}`);
    if (check.missingSettings.length) console.log(`missing settings: ${check.missingSettings.join(", ")}`);
    if (check.missingEnv.length) console.log(`missing env: ${check.missingEnv.join(", ")}`);
    console.log(`next: ${check.healthCommand}`);
  }
}

function sdkCatalog() {
  return [
    {
      sdk: "platform",
      status: "available",
      command: "cognibrain sdk platform <name> --kind project_management --out integrations/<name>",
      docs: "docs/tutorials/platform-sdk.md",
      includes: ["TypeScript integration", "connector manifest", ".env.example", "README"]
    },
    {
      sdk: "connector-author",
      status: "available",
      command: "import { createPlatformIntegration } from 'cognibrain/src/connectors/sdk'",
      docs: "docs/connectors.md#platform-sdk",
      includes: ["manifest validation", "event normalization", "writeback dry-run plans", "health envelope"]
    }
  ];
}

function printSdkCatalog(items) {
  for (const item of items) console.log(`${item.status}  ${item.sdk} - ${item.command}`);
  console.log("next: cognibrain sdk platform acme --kind project_management --out integrations/acme");
}

function sdkDoctor() {
  const checks = [
    {
      name: "platform SDK helpers",
      ok: existsSync(join(root, "src", "connectors", "sdk.ts")) && readFileSync(join(root, "src", "connectors", "sdk.ts"), "utf8").includes("createPlatformIntegration"),
      detail: "src/connectors/sdk.ts"
    },
    {
      name: "platform SDK CLI",
      ok: readFileSync(join(root, "bin", "cognibrain.mjs"), "utf8").includes("platformSdkScaffold"),
      detail: "bin/cognibrain.mjs"
    },
    {
      name: "platform SDK docs",
      ok: existsSync(join(root, "docs", "tutorials", "platform-sdk.md")),
      detail: "docs/tutorials/platform-sdk.md"
    },
    {
      name: "publish package includes src and docs",
      ok: readFileSync(join(root, "package.json"), "utf8").includes("\"src/\"") && readFileSync(join(root, "package.json"), "utf8").includes("\"docs/\""),
      detail: "package.json files"
    }
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

function printSdkDoctor(result) {
  for (const check of result.checks) console.log(`${check.ok ? "ok" : "fail"}  ${check.name} - ${check.detail}`);
  console.log("next: cognibrain sdk platform acme --kind project_management --out integrations/acme");
}

function platformSdkScaffold(name, options) {
  const slug = platformSlug(name);
  const kind = validateChoice(options.kind, connectorKinds(), "--kind");
  const direction = validateChoice(options.direction, ["ingest", "export", "two_way"], "--direction");
  const auth = validateChoice(options.auth, ["none", "api_key", "oauth", "token"], "--auth");
  const envPrefix = `MEMORY_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const outputDir = resolve(launchCwd, options.out ?? join(".cognibrain", "integrations", slug));
  const manifest = platformSdkManifest({ slug, name, kind, direction, auth, envPrefix });
  const files = [
    {
      path: join(outputDir, `${slug}.integration.ts`),
      content: platformIntegrationTemplate({ slug, name, kind, direction, auth, envPrefix })
    },
    {
      path: join(outputDir, `${slug}.connector.json`),
      content: `${JSON.stringify(manifest, null, 2)}\n`
    },
    {
      path: join(outputDir, ".env.example"),
      content: platformEnvTemplate({ envPrefix })
    },
    {
      path: join(outputDir, "README.md"),
      content: platformReadmeTemplate({ slug, name, kind })
    }
  ];
  if (!options.dryRun) {
    for (const file of files) writeGeneratedFile(file.path, file.content);
  }
  return {
    schemaVersion: "1.0",
    sdk: "platform",
    name,
    slug,
    dryRun: Boolean(options.dryRun),
    outputDir,
    manifest,
    files: files.map((file) => file.path),
    commands: [
      `npx cognibrain memory connector-register "$(cat ${join(outputDir, `${slug}.connector.json`)})"`,
      `npx tsx ${join(outputDir, `${slug}.integration.ts`)}`,
      `npx cognibrain memory connector-health ${slug}`
    ],
    docs: "docs/tutorials/platform-sdk.md"
  };
}

function printPlatformSdkScaffold(result) {
  console.log(`${result.dryRun ? "would scaffold" : "scaffolded"} platform SDK: ${result.slug}`);
  console.log(`path: ${result.outputDir}`);
  for (const file of result.files) console.log(`file: ${file}`);
  console.log("next:");
  for (const command of result.commands) console.log(`  ${command}`);
}

function platformSdkManifest({ slug, name, kind, direction, auth, envPrefix }) {
  const now = new Date().toISOString();
  return {
    id: slug,
    name,
    kind,
    version: "1.0.0",
    direction,
    capabilities: defaultPlatformCapabilities(direction),
    auth,
    defaultSourceKind: "import",
    metadataMapping: {
      externalId: "externalId",
      url: "source.uri",
      author: "sourceRef.author",
      platform: "metadata.platform"
    },
    privacyPolicy: "project",
    list: direction !== "export" ? { endpoint: `https://your-platform.example/api/${slug}/items`, method: "GET", authRef: `env:${envPrefix}_TOKEN` } : undefined,
    poll: direction !== "export" ? { endpoint: `https://your-platform.example/api/${slug}/events`, method: "GET", authRef: `env:${envPrefix}_TOKEN` } : undefined,
    writeback: direction !== "ingest" ? { endpoint: `https://your-platform.example/api/${slug}/writeback`, method: "POST", authRef: `env:${envPrefix}_TOKEN`, operations: ["comment", "summary", "memory_link"] } : undefined,
    createdAt: now,
    updatedAt: now
  };
}

function platformIntegrationTemplate({ slug, name, kind, direction, auth, envPrefix }) {
  const clientImport = pathToFileURL(join(root, "src", "sdk", "client.ts")).href;
  const sdkImport = pathToFileURL(join(root, "src", "connectors", "sdk.ts")).href;
  return [
    'import { pathToFileURL } from "node:url";',
    `import { CognibrainClient } from "${clientImport}";`,
    `import { createPlatformIntegration, mapPlatformRecord } from "${sdkImport}";`,
    "",
    "export const integration = createPlatformIntegration(",
    "  {",
    `    id: "${slug}",`,
    `    name: "${escapeTsString(name)}",`,
    `    kind: "${kind}",`,
    `    direction: "${direction}",`,
    `    auth: "${auth}",`,
    `    envPrefix: "${envPrefix}",`,
    `    pollEndpoint: "https://your-platform.example/api/${slug}/events",`,
    `    writebackEndpoint: "https://your-platform.example/api/${slug}/writeback"`,
    "  },",
    "  {",
    "    async poll() {",
    `      const baseUrl = process.env.${envPrefix}_BASE_URL;`,
    `      const token = process.env.${envPrefix}_TOKEN;`,
    "      if (!baseUrl) {",
    `        return [{ id: "example-1", title: "${escapeTsString(name)} decision", body: "Map your platform record fields here.", url: "https://example.invalid/${slug}/example-1" }];`,
    "      }",
    "      const headers: Record<string, string> = token ? { authorization: \"Bearer \" + token } : {};",
    "      const response = await fetch(baseUrl.replace(/\\/$/, \"\") + \"/events\", { headers });",
    "      if (!response.ok) throw new Error(`Platform poll failed: ${response.status} ${response.statusText}`);",
    "      const payload = await response.json() as { events?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;",
    "      return Array.isArray(payload) ? payload : payload.events ?? [];",
    "    },",
    "    mapRecord(record) {",
    `      return mapPlatformRecord(record, { platform: "${slug}" });`,
    "    }",
    "  }",
    ");",
    "",
    "export async function syncOnce() {",
    "  const client = new CognibrainClient({",
    "    baseUrl: process.env.COGNIBRAIN_URL,",
    "    apiKey: process.env.COGNIBRAIN_API_KEY",
    "  });",
    "  const userId = process.env.MEMORY_USER_ID ?? \"local\";",
    "  await client.registerConnector(integration.manifest);",
    "  const events = await integration.pollEvents({ userId });",
    "  if (events.length) await client.syncConnector(integration.manifest.id, events, { userId });",
    "  console.log(JSON.stringify({ connectorId: integration.manifest.id, events: events.length }, null, 2));",
    "}",
    "",
    "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {",
    "  syncOnce().catch((error) => {",
    "    console.error(error);",
    "    process.exit(1);",
    "  });",
    "}",
    ""
  ].join("\n");
}

function platformEnvTemplate({ envPrefix }) {
  return [
    `${envPrefix}_BASE_URL=https://your-platform.example/api`,
    `${envPrefix}_TOKEN=replace-with-a-real-token`,
    "COGNIBRAIN_URL=http://127.0.0.1:8787",
    "COGNIBRAIN_API_KEY=",
    "MEMORY_USER_ID=local",
    ""
  ].join("\n");
}

function platformReadmeTemplate({ slug, name, kind }) {
  return [
    `# ${name} cognibrain platform integration`,
    "",
    "This scaffold maps an external platform into cognibrain through the Platform SDK.",
    "",
    "## Files",
    "",
    `- \`${slug}.integration.ts\`: poll, map, health and sync code.`,
    `- \`${slug}.connector.json\`: connector manifest that can be registered with the local API.`,
    "- `.env.example`: environment variable names; keep real secrets outside git.",
    "",
    "## Run",
    "",
    "```bash",
    "cp .env.example .env",
    "npx cognibrain start",
    `npx cognibrain memory connector-register "$(cat ${slug}.connector.json)"`,
    `npx tsx ${slug}.integration.ts`,
    `npx cognibrain memory connector-health ${slug}`,
    "```",
    "",
    `Kind: \`${kind}\`. Edit \`${slug}.integration.ts\` to call the real list or events endpoint and map source fields to \`externalId\`, \`content\`, \`url\`, \`author\` and metadata.`,
    ""
  ].join("\n");
}

function connectorKinds() {
  return ["email", "chat", "project_management", "docs", "code", "calendar", "cloud_storage", "custom"];
}

function defaultPlatformCapabilities(direction) {
  if (direction === "ingest") return ["ingest", "poll"];
  if (direction === "export") return ["export", "writeback"];
  return ["ingest", "poll", "writeback"];
}

function platformSlug(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    console.error("Platform name must contain letters or numbers");
    process.exit(1);
  }
  return slug;
}

function validateChoice(value, choices, flag) {
  if (choices.includes(value)) return value;
  console.error(`Invalid ${flag}: ${value}`);
  console.error(`Allowed: ${choices.join(", ")}`);
  process.exit(1);
}

function escapeTsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function writeConnectorConfig(provider, metadata = {}) {
  const definition = connectorDefinitions()[provider];
  const settings = sanitizeConnectorSettings(definition, metadata.settings ?? {});
  const { settings: _settings, ...safeMetadata } = metadata;
  const missing = definition.requiredEnv.filter((key) => !process.env[key]);
  const missingSettings = (definition.fields ?? []).filter((field) => !field.secret && !settings[field.name]).map((field) => field.name);
  const path = connectorConfigPath(provider);
  const config = {
    schemaVersion: "1.0",
    provider,
    connectorId: definition.connectorId,
    status: definition.status,
    configured: missing.length === 0 && missingSettings.length === 0,
    requiredEnv: definition.requiredEnv.map((key) => ({ name: key, present: Boolean(process.env[key]), valueRef: `env:${key}` })),
    settings,
    missingSettings,
    missingEnv: missing,
    storagePolicy: "never store credential values; read from environment at runtime",
    verification: definition.verification,
    docs: definition.docs,
    preview: {
      dryRunPoll: `cognibrain memory connector-poll ${definition.connectorId}`,
      sampleMemoryEvents: definition.sampleEvents ?? []
    },
    healthCommand: `cognibrain memory connector-health ${definition.connectorId}`,
    nextSteps: connectorNextSteps(definition, missing, missingSettings),
    metadata: { writtenAt: new Date().toISOString(), ...safeMetadata }
  };
  if (!metadata.dryRun) writeJson(path, config);
  return { path, configured: config.configured, missing, dryRun: Boolean(metadata.dryRun), config };
}

function writeAdapterConfig(adapter, metadata = {}) {
  const definition = adapterDefinitions()[adapter];
  const settings = sanitizeSettings(definition, metadata.settings ?? {});
  const { settings: _settings, ...safeMetadata } = metadata;
  const missing = definition.requiredEnv.filter((key) => !process.env[key]);
  const missingSettings = (definition.fields ?? []).filter((field) => !field.secret && !settings[field.name]).map((field) => field.name);
  const path = adapterConfigPath(adapter);
  const config = {
    schemaVersion: "1.0",
    adapter,
    adapterId: definition.adapterId,
    kind: definition.kind,
    status: definition.status,
    configured: missing.length === 0 && missingSettings.length === 0,
    requiredEnv: definition.requiredEnv.map((key) => ({ name: key, present: Boolean(process.env[key]), valueRef: `env:${key}` })),
    settings,
    missingSettings,
    missingEnv: missing,
    storagePolicy: "never store credential values; read from environment at runtime",
    verification: definition.verification,
    docs: definition.docs,
    preview: {
      sampleMemoryEvents: definition.sampleEvents ?? []
    },
    healthCommand: `cognibrain connections adapters doctor ${adapter}`,
    nextSteps: adapterNextSteps(definition, missing, missingSettings),
    metadata: { writtenAt: new Date().toISOString(), ...safeMetadata }
  };
  if (!metadata.dryRun) writeJson(path, config);
  return { path, configured: config.configured, missing, dryRun: Boolean(metadata.dryRun), config };
}

function sanitizeSettings(definition, inputSettings) {
  const sanitized = {};
  for (const field of definition.fields ?? []) {
    const value = inputSettings[field.name] ?? (field.secret ? field.default : inputSettings[field.env] ?? process.env[field.env] ?? field.default);
    if (!value) continue;
    sanitized[field.name] = field.secret ? normalizeSecretEnvRef(value, field.env) : String(value);
  }
  return sanitized;
}

function sanitizeConnectorSettings(definition, inputSettings) {
  return sanitizeSettings(definition, inputSettings);
}

function normalizeSecretEnvRef(value, fallbackEnv) {
  const raw = String(value).replace(/^env:/, "");
  if (raw === process.env[fallbackEnv]) return `env:${fallbackEnv}`;
  return /^[A-Z][A-Z0-9_]*$/.test(raw) ? `env:${raw}` : `env:${fallbackEnv}`;
}

function connectorSettingsFromArgs(provider, argv) {
  const definition = connectorDefinitions()[provider];
  const settings = settingsFromArgs(definition, argv);
  for (const field of definition.fields ?? []) {
    if (field.env && process.env[field.env] && !settings[field.name] && !field.secret) settings[field.name] = process.env[field.env];
  }
  return settings;
}

function settingsFromArgs(definition, argv) {
  const settings = {};
  const aliases = {
    "--repo": "repo",
    "--channel": "channelId",
    "--project": "project",
    "--service": "service",
    "--space": "space",
    "--database": "databaseId",
    "--team": "teamId",
    "--tenant": "tenantId",
    "--base-url": "baseUrl",
    "--org": "organization",
    "--workspace": "workspace",
    "--site": "site",
    "--model": "model",
    "--command-env": "commandEnv",
    "--root": "root",
    "--account": "account",
    "--calendar": "calendarId",
    "--email-env": "emailEnv",
    "--token-env": "tokenEnv",
    "--api-key-env": "apiKeyEnv",
    "--app-key-env": "appKeyEnv",
    "--url-env": "urlEnv"
  };
  for (const [flag, key] of Object.entries(aliases)) {
    const value = optionValue(argv, flag);
    if (value) settings[key] = value;
  }
  for (const value of optionValues(argv, "--set")) {
    const [key, ...rest] = value.split("=");
    if (key && rest.length) settings[key] = rest.join("=");
  }
  return settings;
}

function connectorNextSteps(definition, missingEnv, missingSettings) {
  const steps = [];
  if (missingSettings.length) steps.push(`Choose ${missingSettings.join(", ")} with connector add --set key=value`);
  if (missingEnv.length) steps.push(`Export ${missingEnv.join(", ")}`);
  steps.push(definition.status === "vendor-driver" ? definition.verification : "Use the Platform SDK custom connector contract for systems outside the native driver list");
  if (definition.status === "vendor-driver") steps.push("MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live");
  return steps;
}

function adapterNextSteps(definition, missingEnv, missingSettings) {
  const steps = [];
  if (missingSettings.length) steps.push(`Choose ${missingSettings.join(", ")} with adapter add --set key=value`);
  if (missingEnv.length) steps.push(`Export ${missingEnv.join(", ")}`);
  steps.push(definition.verification);
  return steps;
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

function writeGeneratedFile(targetPath, content) {
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  if (existsSync(targetPath)) {
    const current = readFileSync(targetPath, "utf8");
    if (current === normalized) {
      console.log(`SDK file already current: ${targetPath}`);
      return;
    }
    const sidecar = `${targetPath}.cognibrain`;
    mkdirSync(dirname(sidecar), { recursive: true });
    writeFileSync(sidecar, normalized);
    console.log(`Wrote reviewable SDK sidecar: ${sidecar}`);
    return;
  }
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, normalized);
  console.log(`Wrote SDK file: ${targetPath}`);
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

function firstSubcommand(argv, fallback = "overview") {
  const index = firstSubcommandIndex(argv);
  return index >= 0 ? argv[index] : fallback;
}

function firstSubcommandIndex(argv) {
  return argv.findIndex((item) => !item.startsWith("--"));
}

function optionValues(argv, name) {
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1]) values.push(argv[index + 1]);
  }
  return values;
}

async function renderCliPanel(kind, payload, options = {}) {
  if (process.stdout.isTTY !== true && process.env.COGNIBRAIN_FORCE_INK !== "true") {
    renderPlainPanel(kind, payload, options);
    return;
  }
  try {
    const React = await import("react");
    const ink = await import("ink");
    const h = React.createElement;
    const Text = ink.Text;
    const Box = ink.Box;
    const muted = (text) => h(Text, { color: "gray" }, text);
    const line = (label, value, color = "white") => h(Box, { gap: 1 }, h(Text, { color: "gray" }, `${label}:`), h(Text, { color }, String(value)));
    const list = (items) => (items ?? []).map((item, index) => h(Text, { key: `${item}-${index}` }, `  ${index + 1}. ${item}`));
    let body;
    if (kind === "connector") {
      body = [
        line("connector", `${payload.connectorId} (${payload.status})`, payload.status === "vendor-driver" ? "green" : "yellow"),
        line("config", options.path ?? ""),
        line("credentials", payload.missingEnv?.length ? `missing ${payload.missingEnv.join(", ")}` : "env refs ready", payload.missingEnv?.length ? "yellow" : "green"),
        line("docs", payload.docs),
        muted("sample memory events"),
        ...list(payload.preview?.sampleMemoryEvents),
        muted("next"),
        ...list(payload.nextSteps)
      ];
    } else if (kind === "adapter") {
      body = [
        line("adapter", `${payload.adapterId} (${payload.kind}, ${payload.status})`, payload.status === "built-in" ? "green" : "yellow"),
        line("config", options.path ?? ""),
        line("credentials", payload.missingEnv?.length ? `missing ${payload.missingEnv.join(", ")}` : "env refs ready", payload.missingEnv?.length ? "yellow" : "green"),
        line("docs", payload.docs),
        muted("sample memory events"),
        ...list(payload.preview?.sampleMemoryEvents),
        muted("next"),
        ...list(payload.nextSteps)
      ];
    } else {
      body = [
        line("profile", `${payload.name} - ${payload.label}`, "cyan"),
        line("runtime", options.runtimeRoot ?? runtimeRoot),
        line("storage", payload.storage),
        line("auth", payload.auth),
        line("harnesses", payload.harnesses.join(", ")),
        line("connectors", payload.connectors.join(", ") || "none"),
        line("adapters", (payload.adapters ?? []).join(", ") || "none"),
        muted("next"),
        ...list(payload.nextSteps)
      ];
    }
    const element = h(
      Box,
      { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0 },
      h(Text, { bold: true, color: "cyan" }, options.title ?? "cognibrain"),
      ...body
    );
    const instance = ink.render(element, { exitOnCtrlC: false });
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 20));
    instance.unmount();
  } catch {
    renderPlainPanel(kind, payload, options);
  }
}

async function renderCliSurface(kind, payload, options = {}) {
  if (process.stdout.isTTY !== true && process.env.COGNIBRAIN_FORCE_INK !== "true") {
    renderPlainSurface(kind, payload, options);
    return;
  }
  try {
    const React = await import("react");
    const ink = await import("ink");
    const h = React.createElement;
    const Text = ink.Text;
    const Box = ink.Box;
    const line = (label, value, color = "white") => h(Box, { gap: 1 }, h(Text, { color: "gray" }, `${label}:`), h(Text, { color }, String(value)));
    const section = (title, items = []) => h(
      Box,
      { key: title, flexDirection: "column", marginTop: 1 },
      h(Text, { bold: true, color: "cyan" }, title),
      ...items.map((item, index) => h(Text, { key: `${title}-${index}` }, `  ${item}`))
    );
    const body = surfaceLines(kind, payload);
    const element = h(
      Box,
      { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, paddingY: 0 },
      h(Text, { bold: true, color: "cyan" }, options.title ?? "cognibrain"),
      ...body.metrics.map(([label, value, color]) => line(label, value, color)),
      ...body.sections.map((item) => section(item.title, item.items))
    );
    const instance = ink.render(element, { exitOnCtrlC: false });
    await new Promise((resolveTimeout) => setTimeout(resolveTimeout, 20));
    instance.unmount();
  } catch {
    renderPlainSurface(kind, payload, options);
  }
}

function surfaceLines(kind, payload) {
  if (kind === "doctor") {
    const summary = payload.summary ?? {};
    return {
      metrics: [
        ["checks", `${summary.ok ?? 0} ok / ${summary.warn ?? 0} warn / ${summary.fail ?? 0} fail`, (summary.fail ?? 0) ? "red" : (summary.warn ?? 0) ? "yellow" : "green"],
        ["publish", payload.publish ? "enabled" : "local", payload.publish ? "cyan" : "gray"],
        ["runtime", payload.runtime?.mode ?? "unknown", payload.runtime?.api?.alive ? "green" : "yellow"],
        ["fixed", payload.fixed?.length ? payload.fixed.join(", ") : "none", payload.fixed?.length ? "green" : "gray"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 14) },
        { title: "Commands", items: payload.commands ?? [] }
      ]
    };
  }
  if (kind === "skill") {
    return {
      metrics: [
        ["skill", payload.installed ? "installed" : "missing", payload.installed ? "green" : "yellow"],
        ["path", payload.path, payload.installed ? "green" : "gray"]
      ],
      sections: [
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Docs", items: [payload.docs].filter(Boolean) },
        { title: "Next", items: [payload.installed ? "cognibrain memories coding-context <query>" : payload.installCommand, payload.doctorCommand].filter(Boolean) }
      ]
    };
  }
  if (kind === "config") {
    return {
      metrics: [
        ["runtime", payload.runtimeRoot, "cyan"],
        ["setup", payload.setupState?.profile ?? "missing", payload.setupState ? "green" : "yellow"],
        ["harness", payload.harnessManifest ? "present" : "missing", payload.harnessManifest ? "green" : "yellow"],
        ["skill", payload.skill?.installed ? "installed" : "missing", payload.skill?.installed ? "green" : "yellow"]
      ],
      sections: [
        { title: "Connectors", items: payload.connectors?.length ? payload.connectors.map((item) => item.provider ?? item.connectorId ?? "connector") : ["none configured"] },
        { title: "Adapters", items: payload.adapters?.length ? payload.adapters.map((item) => item.adapter ?? item.adapterId ?? "adapter") : ["none configured"] },
        { title: "Files", items: Object.entries(configPaths()).map(([name, value]) => `${name}: ${value}`) },
        { title: "Commands", items: ["cognibrain config list", "cognibrain config doctor", "cognibrain config all", "cognibrain connections"] }
      ]
    };
  }
  if (kind === "config-catalog") {
    return {
      metrics: [
        ["runtime", payload.runtimeRoot, "cyan"],
        ["harnesses", payload.harnesses?.length ?? 0, "green"],
        ["connectors", payload.connectors?.length ?? 0, "green"],
        ["adapters", payload.adapters?.length ?? 0, "green"]
      ],
      sections: [
        { title: "Harnesses", items: compactItems(payload.harnesses ?? [], (item) => `${item.target} - ${item.command}`, 10) },
        { title: "Connectors", items: compactItems(payload.connectors ?? [], (item) => `${item.provider} (${item.status})`, 12) },
        { title: "Adapters", items: compactItems(payload.adapters ?? [], (item) => `${item.adapter} (${item.status})`, 8) },
        { title: "Skill", items: [payload.skill?.command, payload.skill?.path].filter(Boolean) }
      ]
    };
  }
  if (kind === "config-paths") {
    return {
      metrics: [["paths", Object.keys(payload).length, "cyan"]],
      sections: [{ title: "Files", items: Object.entries(payload).map(([name, value]) => `${name}: ${value}`) }]
    };
  }
  if (kind === "config-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 12) },
        { title: "Commands", items: ["cognibrain doctor --fix", "cognibrain config all", "cognibrain connections"] }
      ]
    };
  }
  if (kind === "connections-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["config", payload.config?.ok ? "ok" : "warn", payload.config?.ok ? "green" : "yellow"],
        ["connectors", payload.connectors?.checks?.length ?? 0, "cyan"],
        ["adapters", payload.adapters?.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Config", items: compactItems(payload.config?.checks ?? [], checkLine, 6) },
        { title: "Connectors", items: compactItems(payload.connectors?.checks ?? [], connectorCheckLine, 8) },
        { title: "Adapters", items: compactItems(payload.adapters?.checks ?? [], adapterCheckLine, 8) }
      ]
    };
  }
  if (kind === "connector-catalog") {
    const configured = payload.filter((item) => item.configured);
    const available = payload.filter((item) => !item.configured);
    const vendor = payload.filter((item) => item.status === "vendor-driver");
    return {
      metrics: [
        ["configured", `${configured.length}/${payload.length}`, configured.length ? "green" : "yellow"],
        ["native drivers", vendor.length, "cyan"],
        ["available", available.length, "white"]
      ],
      sections: [
        { title: "Configured", items: configured.length ? configured.map((item) => `${item.provider} - ${item.connectorId}`) : ["none yet"] },
        { title: "Available", items: compactItems(available, (item) => `${item.provider} (${item.status})`, 25) },
        { title: "Commands", items: ["cognibrain connections add <provider> --set key=value", "cognibrain connector show <provider>", "cognibrain connector doctor <provider>"] }
      ]
    };
  }
  if (kind === "connector-show") {
    return {
      metrics: [
        ["provider", payload.provider, "cyan"],
        ["status", payload.definition?.status ?? "unknown", payload.config ? "green" : "yellow"],
        ["config", payload.config ? "present" : "missing", payload.config ? "green" : "yellow"]
      ],
      sections: [
        { title: "Required Env", items: payload.definition?.requiredEnv?.length ? payload.definition.requiredEnv : ["none"] },
        { title: "Settings", items: payload.config?.settings ? Object.entries(payload.config.settings).map(([key, value]) => `${key}: ${value}`) : ["not configured"] },
        { title: "Preview", items: payload.definition?.sampleEvents ?? [] },
        { title: "Docs", items: [payload.definition?.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "connector-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], connectorCheckLine, 12) },
        { title: "Commands", items: ["cognibrain connections add github --set repo=owner/repo", "cognibrain memory connector-health <connector-id>"] }
      ]
    };
  }
  if (kind === "adapter-catalog") {
    const configured = payload.filter((item) => item.configured);
    const available = payload.filter((item) => !item.configured);
    return {
      metrics: [
        ["configured", `${configured.length}/${payload.length}`, configured.length ? "green" : "yellow"],
        ["storage", payload.filter((item) => item.kind === "storage").length, "cyan"],
        ["providers", payload.filter((item) => item.kind === "provider").length, "cyan"]
      ],
      sections: [
        { title: "Configured", items: configured.length ? configured.map((item) => `${item.adapter} - ${item.adapterId}`) : ["none yet"] },
        { title: "Available", items: compactItems(available, (item) => `${item.adapter} (${item.kind}, ${item.status})`, 20) },
        { title: "Commands", items: ["cognibrain connections add <adapter> --set key=value", "cognibrain adapter show <adapter>", "cognibrain adapter doctor <adapter>"] }
      ]
    };
  }
  if (kind === "adapter-show") {
    return {
      metrics: [
        ["adapter", payload.adapter, "cyan"],
        ["kind", payload.definition?.kind ?? "unknown", "white"],
        ["config", payload.config ? "present" : "missing", payload.config ? "green" : "yellow"]
      ],
      sections: [
        { title: "Required Env", items: payload.definition?.requiredEnv?.length ? payload.definition.requiredEnv : ["none"] },
        { title: "Settings", items: payload.config?.settings ? Object.entries(payload.config.settings).map(([key, value]) => `${key}: ${value}`) : ["not configured"] },
        { title: "Preview", items: payload.definition?.sampleEvents ?? [] },
        { title: "Docs", items: [payload.definition?.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "adapter-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], adapterCheckLine, 12) },
        { title: "Commands", items: ["cognibrain connections add storage-sqlite", "cognibrain connections adapters doctor"] }
      ]
    };
  }
  if (kind === "sdk-catalog") {
    return {
      metrics: [
        ["surfaces", payload.length, "cyan"],
        ["platform sdk", payload.some((item) => item.sdk === "platform") ? "available" : "missing", "green"]
      ],
      sections: [
        { title: "SDKs", items: payload.map((item) => `${item.sdk} (${item.status}) - ${item.command}`) },
        { title: "Includes", items: compactItems(payload.flatMap((item) => item.includes ?? []), (item) => item, 10) },
        { title: "Commands", items: ["cognibrain sdk platform acme --kind project_management --out integrations/acme", "cognibrain sdk doctor"] }
      ]
    };
  }
  if (kind === "sdk-doctor") {
    return {
      metrics: [
        ["status", payload.ok ? "ready" : "needs attention", payload.ok ? "green" : "yellow"],
        ["checks", payload.checks?.length ?? 0, "cyan"]
      ],
      sections: [
        { title: "Checks", items: compactItems(payload.checks ?? [], checkLine, 10) },
        { title: "Commands", items: ["cognibrain sdk platform acme --kind project_management --out integrations/acme"] }
      ]
    };
  }
  if (kind === "sdk-scaffold") {
    return {
      metrics: [
        ["sdk", payload.sdk, "cyan"],
        ["name", payload.slug, "white"],
        ["mode", payload.dryRun ? "dry run" : "written", payload.dryRun ? "yellow" : "green"]
      ],
      sections: [
        { title: "Summary", items: [`${payload.dryRun ? "would scaffold" : "scaffolded"} platform SDK: ${payload.slug}`] },
        { title: "Files", items: payload.files ?? [] },
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Docs", items: [payload.docs].filter(Boolean) }
      ]
    };
  }
  if (kind === "service") {
    return {
      metrics: [
        ["platform", `${payload.platform} (${payload.manager})`, "cyan"],
        ["installed", payload.installed ? "yes" : "no", payload.installed ? "green" : "yellow"],
        ["runtime", payload.runtime?.mode ?? "unknown", payload.runtime?.api?.alive ? "green" : "yellow"],
        ["dashboard", payload.dashboard?.enabled ? "enabled" : "optional/off", payload.dashboard?.enabled ? "green" : "gray"]
      ],
      sections: [
        { title: "Files", items: [payload.files?.descriptor, payload.files?.metadata].filter(Boolean) },
        { title: "Commands", items: payload.actions ?? [] },
        { title: "Native Enable", items: payload.commands?.enable ?? [] },
        { title: "Notes", items: payload.notes ?? [] }
      ]
    };
  }
  if (kind === "memories") {
    const health = payload.health ?? {};
    return {
      metrics: [
        ["user", payload.userId ?? "local", "cyan"],
        ["memories", health.memories ?? health.total ?? payload.recent?.length ?? 0, "green"],
        ["quality", health.qualityScore ?? health.freshness ?? "n/a", "white"]
      ],
      sections: [
        { title: "Recent", items: (payload.recent ?? []).slice(0, 5).map((memory) => `${shortMemoryId(memory)} ${memory.content}`) },
        { title: "Commands", items: payload.commands ?? [] },
        { title: "Dashboard Parity", items: payload.dashboardParity ?? [] }
      ]
    };
  }
  if (kind === "connections") {
    const configuredConnectors = payload.connectors?.configured ?? [];
    const configuredAdapters = payload.adapters?.configured ?? [];
    return {
      metrics: [
        ["connectors", `${configuredConnectors.length}/${payload.connectors?.available?.length ?? 0}`, configuredConnectors.length ? "green" : "yellow"],
        ["adapters", `${configuredAdapters.length}/${payload.adapters?.available?.length ?? 0}`, configuredAdapters.length ? "green" : "yellow"],
        ["skill", payload.harnesses?.skill?.installed ? "installed" : "missing", payload.harnesses?.skill?.installed ? "green" : "yellow"]
      ],
      sections: [
        { title: "Configured Connectors", items: configuredConnectors.length ? configuredConnectors : ["none yet"] },
        { title: "Configured Adapters", items: configuredAdapters.length ? configuredAdapters : ["none yet"] },
        { title: "Commands", items: payload.commands ?? [] }
      ]
    };
  }
  const runtime = payload.runtime ?? {};
  const config = payload.config ?? {};
  return {
    metrics: [
      ["package", `${payload.package?.name ?? "cognibrain"} ${payload.package?.version ?? ""}`.trim(), "cyan"],
      ["runtime", runtime.mode ?? "unknown", runtime.api?.alive ? "green" : "yellow"],
      ["dashboard", runtime.dashboard?.alive ? "running" : "optional", runtime.dashboard?.alive ? "green" : "gray"],
      ["setup", config.setupState?.profile ?? "missing", config.setupState ? "green" : "yellow"]
    ],
    sections: [
      { title: "Memories", items: [`${payload.memories?.health?.memories ?? payload.memories?.recent?.length ?? 0} stored`, "cognibrain memories search <query>", "cognibrain memories add <text>"] },
      { title: "Connections", items: [`${payload.connections?.connectors?.configured?.length ?? 0} connectors configured`, `${payload.connections?.adapters?.configured?.length ?? 0} adapters configured`, "cognibrain connections add github --set repo=owner/repo"] },
      { title: "Service", items: [`${payload.service?.platform ?? "local"} ${payload.service?.installed ? "installed" : "not installed"}`, "cognibrain service plan", "cognibrain service install --activate"] },
      { title: "Commands", items: payload.commands ?? [] }
    ]
  };
}

function renderPlainSurface(kind, payload, options = {}) {
  const lines = surfaceLines(kind, payload);
  console.log(options.title ?? "cognibrain CLI home");
  for (const [label, value] of lines.metrics) console.log(`${label}: ${value}`);
  for (const section of lines.sections) {
    console.log(`\n${section.title}`);
    for (const item of section.items) console.log(`  - ${item}`);
  }
}

function printCombinedConnectionsDoctor(result) {
  console.log(`${result.ok ? "ok" : "fail"}  connections`);
  printConfigurationDoctor(result.config);
  printConnectorDoctor(result.connectors);
  printAdapterDoctor(result.adapters);
}

function shortMemoryId(memory) {
  return String(memory?.id ?? "memory").slice(0, 8);
}

function compactItems(items, formatter = (item) => String(item), limit = 10) {
  const rendered = items.slice(0, limit).map(formatter);
  if (items.length > limit) rendered.push(`and ${items.length - limit} more`);
  return rendered.length ? rendered : ["none"];
}

function checkLine(check) {
  const state = check.level === "warn" ? "warn" : check.ok ? "ok" : "fail";
  const detail = check.detail || check.path || check.fix || "";
  return `${state} ${check.name}${detail ? ` - ${detail}` : ""}`;
}

function connectorCheckLine(check) {
  const state = check.ok ? "ok" : "fail";
  const missing = [...(check.missingSettings ?? []), ...(check.missingEnv ?? [])];
  return `${state} ${check.provider ?? check.connectorId} - ${missing.length ? `missing ${missing.join(", ")}` : check.healthCommand ?? check.path ?? "ready"}`;
}

function adapterCheckLine(check) {
  const state = check.ok || check.status === "available-contract" ? "ok" : "fail";
  const missing = [...(check.missingSettings ?? []), ...(check.missingEnv ?? [])];
  return `${state} ${check.adapter ?? check.adapterId} - ${missing.length ? `missing ${missing.join(", ")}` : check.healthCommand ?? check.path ?? "ready"}`;
}

function renderPlainPanel(kind, payload, options = {}) {
  if (kind === "connector") {
    console.log(`${options.title ?? "connector"}: ${payload.connectorId} (${payload.status})`);
    console.log(`docs: ${payload.docs}`);
    if (payload.preview?.sampleMemoryEvents?.length) console.log(`preview: ${payload.preview.sampleMemoryEvents.join(", ")}`);
    return;
  }
  if (kind === "adapter") {
    console.log(`${options.title ?? "adapter"}: ${payload.adapterId} (${payload.kind}, ${payload.status})`);
    console.log(`docs: ${payload.docs}`);
    if (payload.preview?.sampleMemoryEvents?.length) console.log(`preview: ${payload.preview.sampleMemoryEvents.join(", ")}`);
    return;
  }
  console.log(`${options.title ?? "cognibrain init"}: ${payload.label}`);
  console.log(`runtime root: ${options.runtimeRoot ?? runtimeRoot}`);
  console.log(`profile: ${payload.name}`);
}

function printInitSummary(profile) {
  console.log("ready: setup state, native connector configs, adapter configs, skill path, and harness config are in place");
  console.log(`next: ${profile.nextSteps.join(" -> ")}`);
  console.log("proof: cognibrain config doctor, cognibrain connections doctor, npm run demo:first-win");
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
  cognibrain
      Open the React/Ink CLI home with runtime, memories, connections, config, and next actions
  cognibrain [--runtime-root <path>] <command>
  cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--dashboard] [--no-start] [--no-doctor] [--no-skill]
      React/Ink guided self-hosted install that writes setup state, native connector configs, harness config, starts the API, and runs doctor
  cognibrain setup [--profile local|team|production|benchmark] [--yes]
      Starts the same guided wizard; legacy flags below still work for scripted installs
  cognibrain setup [--self-hosted] [--codex] [--claude] [--copilot] [--cursor] [--vscode] [--opencode] [--openclaw] [--langgraph] [--crewai] [--all-harnesses]
      Scripted install path for CI and package smoke tests
  cognibrain doctor [--publish] [--fix] [--no-start]
      Check and optionally fix local runtime, skill install, guided setup state, package readiness, and npm pack hygiene
  cognibrain start [--dashboard] | dev [--dashboard] | dashboard | status | stop
      Manage the local API runtime; the web dashboard is optional and starts only with dashboard opt-in
  cognibrain service [plan|status] [--platform linux|macos|windows] [--json]
      Inspect native service automation for systemd, launchd, or Windows Task Scheduler
  cognibrain service install [--activate] [--dashboard] [--system] [--env KEY=value]
      Write native service files for automated startup; activation is explicit
  cognibrain service start|stop|restart|uninstall|logs
      Control or inspect the installed native service from the CLI
  cognibrain memories [list|status] [--json]
      CLI memory workbench with recent memories, health, maintenance, and dashboard-equivalent memory actions
  cognibrain memories <add|search|coding-context|evidence-pack|why-used|graph|timeline|dream|marketplace|...>
      Run any memory operation from the CLI; equivalent to cognibrain memory <subcommand>
  cognibrain connections [list|status|doctor] [--json]
      CLI connections workbench for connectors, adapters, harnesses, skill state, and configuration health
  cognibrain connections add <connector-or-adapter> [--dry-run] [--set key=value]
      Configure native vendor drivers, adapters, or SDK-backed sources from one connection surface
  cognibrain config list|show|paths|doctor
      Inspect setup state, harness packages, connector configs, adapter configs, and skill paths
  cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai>
      Write MCP config for supported harnesses; "config write <target>" works too
  cognibrain connector list|show <provider>|doctor [provider]|remove <provider>
      Inspect and maintain source-system connector configs
  cognibrain connector add <provider> [--dry-run] [--set key=value]
      React/Ink guided, credential-safe connector setup under .cognibrain/connectors/
      Providers include github, gitlab, azure-devops, slack, discord, teams, jira, confluence, notion, linear, gmail, google-drive, google-calendar, asana, clickup, sentry, datadog, pagerduty, posthog
  cognibrain adapter list|show <adapter>|doctor [adapter]|remove <adapter>
      Inspect and maintain provider, storage, benchmark, media and MCP transport adapter configs
  cognibrain adapter add <adapter> [--dry-run] [--set key=value]
      Credential-safe adapter setup under .cognibrain/adapters/
  cognibrain sdk list|doctor
      Inspect available SDK scaffolds and SDK packaging readiness
  cognibrain sdk platform <name> [--kind project_management|chat|docs|code|custom] [--out integrations/<name>] [--dry-run]
      Scaffold a TypeScript platform integration SDK, connector manifest, env example, and README
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
  cognibrain mcp
      Run the stdio MCP server for agent harnesses
  cognibrain clean
      Remove generated local runtime, benchmark, screenshot, and build artifacts
`);
  process.exit(exitCode);
}

function initUsage(exitCode) {
  console.log(`Usage: cognibrain init [--profile solo-dev|team|enterprise|benchmark] [--yes] [--dry-run] [--dashboard] [--no-start] [--no-doctor] [--no-skill] [--no-demo]`);
  process.exit(exitCode);
}

function serviceUsage(exitCode) {
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

function memoriesUsage(exitCode) {
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

function connectionsUsage(exitCode) {
  console.log(`Usage:
  cognibrain connections [list|status] [--json]
  cognibrain connections doctor [--json]
  cognibrain connections add <connector-or-adapter> [--dry-run] [--set key=value]
  cognibrain connections connectors <list|show|doctor|add|remove> ...
  cognibrain connections adapters <list|show|doctor|add|remove> ...`);
  process.exit(exitCode);
}

function configUsage(exitCode) {
  console.log(`Usage:
  cognibrain config list [--json]
  cognibrain config show [--json]
  cognibrain config paths [--json]
  cognibrain config doctor [--json]
  cognibrain config write <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai>
  cognibrain config <all|codex|claude|copilot|cursor|vscode|opencode|openclaw|langgraph|crewai>`);
  process.exit(exitCode);
}

function connectorUsage(exitCode) {
  console.log(`Usage:
  cognibrain connector list [--json]
  cognibrain connector show <provider> [--json]
  cognibrain connector doctor [provider] [--json]
  cognibrain connector add <${Object.keys(connectorDefinitions()).join("|")}> [--dry-run] [--set key=value]
  cognibrain connector remove <provider>`);
  process.exit(exitCode);
}

function adapterUsage(exitCode) {
  console.log(`Usage:
  cognibrain adapter list [--json]
  cognibrain adapter show <adapter> [--json]
  cognibrain adapter doctor [adapter] [--json]
  cognibrain adapter add <${Object.keys(adapterDefinitions()).join("|")}> [--dry-run] [--set key=value]
  cognibrain adapter remove <adapter>`);
  process.exit(exitCode);
}

function sdkUsage(exitCode) {
  console.log(`Usage:
  cognibrain sdk list [--json]
  cognibrain sdk doctor [--json]
  cognibrain sdk platform <name> [--kind ${connectorKinds().join("|")}] [--direction ingest|export|two_way] [--auth none|api_key|oauth|token] [--out <dir>] [--dry-run]`);
  process.exit(exitCode);
}

function skillUsage(exitCode) {
  console.log(`Usage:
  cognibrain skill install
  cognibrain skill status [--json]
  cognibrain skill doctor [--fix] [--json]
  cognibrain skill path`);
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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}
