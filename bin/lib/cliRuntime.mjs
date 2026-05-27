import { spawnSync } from "node:child_process";
import { adapterDefinitions, connectorDefinitions } from "./catalogs.mjs";
import { handleHarnessCommand, handleLifecycleCommand, handleMemoryLifecycleCommand, isLifecycleCommand, isMemoryLifecycleCommand } from "./lifecycleCli.mjs";
import { createHarnessRuntime } from "./harnessRuntime.mjs";
import { renderCliPanel, renderCliSurface } from "./render.mjs";
import { createServiceRuntime } from "./serviceRuntime.mjs";
import { adapterUsage, configUsage, connectionsUsage, connectorUsage, initUsage, memoriesUsage, proofUsage, sdkUsage, serviceUsage, skillUsage, usage } from "./usage.mjs";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { homedir, platform as hostPlatformName } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launchCwd = process.cwd();
const rawArgs = process.argv.slice(2);

export async function runCli({ root, launchCwd = process.cwd(), rawArgs = process.argv.slice(2) } = {}) {
const { args, runtimeRoot } = parseGlobalArgs(rawArgs);
const command = args[0]?.startsWith("--") ? undefined : args[0];
const commandArgs = args[0]?.startsWith("--") ? args : args.slice(1);
const {
  writeHarnessConfig,
  writeHarnessPackageManifest,
  writeGeneratedFile,
  harnessTemplateHealth,
  harnessGeneratedHealth,
  connectorProofHealth,
  stdioServerConfig
} = createHarnessRuntime({ root, launchCwd, rawArgs, readJson, writeJson });
const {
  servicePlan,
  serviceHostPlatform,
  writeServicePlan,
  removeServicePlan,
  runServiceNativeAction,
  printServiceInstall,
  printServiceRemove,
  printServiceLogs
} = createServiceRuntime({ root, runtimeRoot, hostPlatformName, optionValue, optionValues, readJson, writeJson, runtimeStatus, serviceUsage });

if (isLifecycleCommand(command)) {
  await handleLifecycleCommand([command, ...commandArgs], { root, launchCwd, runtimeRoot });
  return;
}

switch (command) {
  case undefined:
  case "ui":
  case "tui":
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
    runNodeAndExit("scripts/runtime/start-local.mjs", ["--daemon", ...commandArgs]);
    break;

  case "dev":
    runNodeAndExit("scripts/runtime/start-local.mjs", commandArgs);
    break;

  case "dashboard":
    runNodeAndExit("scripts/runtime/start-local.mjs", ["--daemon", "--dashboard", ...commandArgs]);
    break;

  case "status":
    await statusCommand(commandArgs);
    break;

  case "proof":
    await proofCommand(commandArgs);
    break;

  case "truth":
    if (commandArgs.length === 0 || commandArgs.includes("--help")) await proofCommand(commandArgs);
    else runTsxAndExit("src/cli/memctl.ts", [`truth-${commandArgs[0]}`, ...commandArgs.slice(1)]);
    break;

  case "dream":
    runTsxAndExit("src/cli/memctl.ts", [`dream-${commandArgs[0] ?? "plan"}`, ...commandArgs.slice(1)]);
    break;

  case "stop":
    runNodeAndExit("scripts/runtime/start-local.mjs", ["--stop"]);
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
    if (isMemoryLifecycleCommand(commandArgs)) {
      await handleMemoryLifecycleCommand(commandArgs, { root, launchCwd, runtimeRoot });
      return;
    }
    runTsxAndExit("src/cli/memctl.ts", commandArgs);
    break;

  case "memories":
    await memoriesCommand(commandArgs);
    break;

  case "harness":
    await handleHarnessCommand(commandArgs, { root, launchCwd, runtimeRoot });
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
  if (!flags.has("--no-skill")) runNodeChecked("scripts/runtime/install-codex-skill.mjs", []);

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
    if (flags.has("--windsurf")) writeHarnessConfig("windsurf");
    if (flags.has("--continue")) writeHarnessConfig("continue");
    if (flags.has("--aider")) writeHarnessConfig("aider");
    if (flags.has("--roo-cline")) writeHarnessConfig("roo-cline");
    if (flags.has("--goose")) writeHarnessConfig("goose");
    if (flags.has("--sourcegraph-amp")) writeHarnessConfig("sourcegraph-amp");
    if (flags.has("--devin-style")) writeHarnessConfig("devin-style");
  }

  if (!flags.has("--no-start")) runNodeChecked("scripts/runtime/start-local.mjs", ["--daemon", ...(flags.has("--dashboard") ? ["--dashboard"] : [])]);
  if (!flags.has("--no-doctor")) await doctor(selfHosted ? ["--publish"] : []);
}

async function cliHome(homeArgs = []) {
  if (homeArgs.includes("--help")) {
    usage(0);
    return;
  }
  const result = await cliAppData();
  if (homeArgs.includes("--json")) {
    printJson(result);
    return;
  }
  await renderCliSurface("home", result, { title: "cognibrain" });
}

async function statusCommand(statusArgs = []) {
  if (statusArgs.includes("--raw")) {
    runNodeAndExit("scripts/runtime/start-local.mjs", ["--status"]);
    return;
  }
  const result = await cliHomeData();
  if (statusArgs.includes("--json")) {
    printJson(result);
    return;
  }
  await renderCliSurface("status", result, { title: "cognibrain status" });
}

async function proofCommand(proofArgs = []) {
  if (proofArgs.includes("--help")) {
    proofUsage(0);
    return;
  }
  const refresh = !proofArgs.includes("--no-refresh");
  let refreshError;
  if (refresh) {
    const result = runCapture(process.execPath, ["scripts/release/audit-product-truth.mjs"]);
    if (result.status !== 0) refreshError = result.stderr || result.stdout || `audit exited with ${result.status}`;
  }
  const result = productTruthData(refreshError);
  if (proofArgs.includes("--json")) {
    printJson(result);
    if (!result.passed) process.exit(1);
    return;
  }
  await renderCliSurface("proof", result, { title: "cognibrain proof" });
  if (!result.passed) process.exit(1);
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
      runNodeChecked("scripts/runtime/install-codex-skill.mjs", []);
      fixed.push("codex-skill");
    }
    if (!noStart) {
      const state = readRuntimeState();
      const apiAlive = state?.api?.pid ? isAlive(state.api.pid) : false;
      const uiAlive = state?.ui?.pid ? isAlive(state.ui.pid) : false;
      if (!apiAlive || (dashboardRequired && !uiAlive)) {
        runNodeChecked("scripts/runtime/start-local.mjs", ["--daemon", ...(dashboardRequired ? ["--dashboard"] : [])]);
        fixed.push("runtime");
      }
    }
  }

  const checks = [];
  const add = (name, ok, detail = "", level = ok ? "ok" : "fail") => checks.push({ name, ok, detail, level });

  add("Node >= 20", majorVersion(process.version) >= 20, process.version);
  const sqliteRuntime = sqliteRuntimeCheck();
  const selectedStorage = process.env.MEMORY_STORAGE_BACKEND ?? readJson(configPaths().setupState, null)?.storage;
  const sqliteRequired = selectedStorage === "sqlite" || selectedStorage === "sql";
  add(
    "SQLite runtime",
    sqliteRuntime.ok || !sqliteRequired,
    sqliteRuntime.ok
      ? "node:sqlite DatabaseSync available"
      : `${sqliteRuntime.detail}; use JSON storage, Postgres storage, or a Node runtime with node:sqlite`,
    sqliteRuntime.ok ? "ok" : sqliteRequired ? "fail" : "warn"
  );
  const npmVersion = runCapture("npm", ["--version"]);
  add("npm available", npmVersion.status === 0, npmVersion.stdout.trim() || npmVersion.stderr.trim());
  add("package manifest", existsSync(join(root, "package.json")), join(root, "package.json"));
  add("runtime launcher", existsSync(join(root, "scripts", "runtime", "start-local.mjs")), "scripts/runtime/start-local.mjs");
  add("CLI entrypoint", existsSync(join(root, "bin", "cognibrain.mjs")), "bin/cognibrain.mjs");
  const tsx = resolveExecutable("tsx");
  add("tsx runtime", Boolean(tsx), tsx ?? "missing");

  const skillPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "skills", "cognibrain", "SKILL.md");
  const skillInstalled = existsSync(skillPath);
  add("Codex skill installed", skillInstalled, skillPath, skillInstalled ? "ok" : doctorArgs.includes("--no-skill") ? "warn" : "fail");
  add("guided setup state", existsSync(join(runtimeRoot, ".cognibrain", "setup-state.json")), join(runtimeRoot, ".cognibrain", "setup-state.json"), existsSync(join(runtimeRoot, ".cognibrain", "setup-state.json")) ? "ok" : "warn");
  add("connector config directory", existsSync(join(runtimeRoot, ".cognibrain", "connectors")), join(runtimeRoot, ".cognibrain", "connectors"), existsSync(join(runtimeRoot, ".cognibrain", "connectors")) ? "ok" : "warn");
  add("adapter config directory", existsSync(join(runtimeRoot, ".cognibrain", "adapters")), join(runtimeRoot, ".cognibrain", "adapters"), existsSync(join(runtimeRoot, ".cognibrain", "adapters")) ? "ok" : "warn");
  const paths = configPaths();
  const setupState = readJson(paths.setupState, null);
  add("storage backend selected", Boolean(setupState?.storage || process.env.MEMORY_STORAGE_BACKEND), setupState?.storage ?? process.env.MEMORY_STORAGE_BACKEND ?? "missing", setupState?.storage || process.env.MEMORY_STORAGE_BACKEND ? "ok" : "warn");
  add("auth mode selected", Boolean(setupState?.auth), setupState?.auth ?? "missing", setupState?.auth ? "ok" : "warn");
  const connectorReadiness = connectorDoctor();
  add("connector credentials", connectorReadiness.ok || connectorReadiness.checks.length === 0, connectorReadiness.checks.length ? `${connectorReadiness.checks.filter((check) => check.ok).length}/${connectorReadiness.checks.length} configured` : "no connector configs yet", connectorReadiness.ok || connectorReadiness.checks.length === 0 ? "ok" : "warn");
  const adapterReadiness = adapterDoctor();
  add("adapter credentials", adapterReadiness.ok || adapterReadiness.checks.length === 0, adapterReadiness.checks.length ? `${adapterReadiness.checks.filter((check) => check.ok).length}/${adapterReadiness.checks.length} configured` : "no adapter configs yet", adapterReadiness.ok || adapterReadiness.checks.length === 0 ? "ok" : "warn");
  const publicArenaReady = existsSync(join(root, "public", "benchmark-arena", "results.json")) && existsSync(join(root, "docs", "benchmarks", "latest-arena.md"));
  add("benchmark artifacts fresh enough", publicArenaReady, publicArenaReady ? "public arena and latest markdown present" : "run npm run benchmark:arena && npm run benchmark:arena:publish", publicArenaReady ? "ok" : "warn");
  const packageJson = readJson(join(root, "package.json"), {});
  add("operator CLI", !packageJson.dependencies?.ink && readFileSync(join(root, "bin", "lib", "render.mjs"), "utf8").includes("function renderPlainSurface"), "stable compact text surface");
  const mcpReady = existsSync(join(root, "src", "connectors", "mcpServer.ts")) && existsSync(join(root, "src", "connectors", "mcpHandlers.ts"));
  add("MCP server files", mcpReady, mcpReady ? "src/connectors/mcpServer.ts" : "missing MCP server files");

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
    const packOutput = `${pack.stdout}\n${pack.stderr}`;
    const unexpectedArtifacts = packOutput
      .split(/\r?\n/)
      .filter((line) => line.includes("artifacts/") || line.includes("public/benchmark-arena/") || line.includes("public/leaderboard/"));
    const leaked = [
      ".cognibrain/",
      ".cognibrain-harness-package.json",
      ".memory-harness.json",
      ".playwright-cli",
      "output/",
      "data/benchmarks",
      "__pycache__",
      "sdk/python/build",
      "sdk/python/cognibrain.egg-info",
      "sdk/go",
      "sdk/rust"
    ].filter((item) => packOutput.includes(item));
    add("package excludes generated files", leaked.length === 0 && unexpectedArtifacts.length === 0, [...leaked, ...unexpectedArtifacts].length ? [...leaked, ...unexpectedArtifacts].join(", ") : "clean");
    const transport = transportSecurityCheck(state?.api?.url);
    add("transport security", transport.ok, transport.detail, transport.level);
    const harnessTemplates = harnessTemplateHealth();
    add("harness package templates", harnessTemplates.ok, harnessTemplates.detail);
    const harnessGenerated = harnessGeneratedHealth();
    add("harness generated configs", harnessGenerated.ok, harnessGenerated.detail, harnessGenerated.ok ? "ok" : "warn");
    const productionDocs = [
      "docs/README.md",
      "docs/install.md",
      "docs/operations.md",
      "docs/reference.md",
      "docs/claims.md"
    ].filter((path) => existsSync(join(root, path)));
    add("production docs", productionDocs.length === 5, productionDocs.length === 5 ? "docs/operations.md and docs/claims.md" : "missing production docs");
    const connectorProof = connectorProofHealth();
    add("connector proof levels", connectorProof.ok, connectorProof.detail, connectorProof.level);
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
    uiFramework: "plain-cli",
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
    runNodeAndExit("scripts/runtime/install-codex-skill.mjs", []);
    return;
  }
  if (subcommand === "path") {
    console.log(path);
    return;
  }
  if (subcommand === "status" || subcommand === "doctor") {
    if (!existsSync(path) && (subcommand === "doctor" || fix)) runNodeChecked("scripts/runtime/install-codex-skill.mjs", []);
    const installed = existsSync(path);
    const result = {
      installed,
      path,
      installCommand: "cognibrain skill install",
      doctorCommand: "cognibrain skill doctor --fix",
      docs: "docs/install.md",
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
    else await renderCliSurface("config", result, { title: "cognibrain config", configPaths });
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
  if (subcommand === "wizard" || subcommand === "preview") {
    const provider = commandArgs[1] ?? "github";
    if (!provider || !connectorDefinitions()[provider]) connectorUsage(1);
    const settings = connectorSettingsFromArgs(provider, commandArgs);
    const result = connectorWizard(provider, { settings });
    if (commandArgs.includes("--json")) printJson(result);
    else await renderCliSurface("connector-wizard", result, { title: `${provider} connector wizard` });
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
  if (subcommand !== "platform" && subcommand !== "harness") sdkUsage(1);
  const name = commandArgs[1];
  if (!name) sdkUsage(1);
  const result = subcommand === "platform"
    ? platformSdkScaffold(name, {
        kind: optionValue(commandArgs, "--kind") ?? "custom",
        direction: optionValue(commandArgs, "--direction") ?? "two_way",
        auth: optionValue(commandArgs, "--auth") ?? "token",
        out: optionValue(commandArgs, "--out"),
        dryRun: commandArgs.includes("--dry-run")
      })
    : harnessSdkScaffold(name, {
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
  const hasLegacySetupFlag = ["--self-hosted", "--codex", "--claude", "--copilot", "--cursor", "--vscode", "--opencode", "--openclaw", "--langgraph", "--crewai", "--windsurf", "--continue", "--aider", "--roo-cline", "--goose", "--sourcegraph-amp", "--devin-style", "--all-harnesses"].some((flag) => flags.has(flag));
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
    const goal = choiceToGoal(await ask(rl, "Improve first [1 repeated mistakes, 2 repo rules/tests, 3 GitHub/Jira/docs, 4 benchmark demo, 5 team server]", profile.goalChoice ?? "1"));
    const primaryAgent = choiceToAgent(await ask(rl, "Primary agent [1 Codex, 2 Claude Code, 3 Cursor, 4 Copilot, 5 LangGraph/CrewAI]", profile.primaryAgent ?? "codex"));
    const defaultHarnesses = primaryAgent === "langgraph-crewai" ? ["langgraph", "crewai"] : [primaryAgent];
    const harnesses = splitList(await ask(rl, "Harnesses", (profile.harnesses.length ? profile.harnesses : defaultHarnesses).join(",")), profile.harnesses.length ? profile.harnesses : defaultHarnesses);
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
      goal,
      primaryAgent,
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

function choiceToGoal(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const choices = {
    "1": "stop repeated coding-agent mistakes",
    "2": "remember repo rules and test commands",
    "3": "connect GitHub, Jira, Confluence or Notion",
    "4": "run benchmark demo",
    "5": "set up a team memory server"
  };
  return choices[normalized] ?? (normalized || choices["1"]);
}

function choiceToAgent(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const choices = { "1": "codex", "2": "claude", "3": "cursor", "4": "copilot", "5": "langgraph-crewai", "claude code": "claude" };
  return choices[normalized] ?? (normalized || "codex");
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
  const supported = new Set(["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "roo-cline", "goose", "sourcegraph-amp", "devin-style"]);
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
      goalChoice: "1",
      goal: "stop repeated coding-agent mistakes",
      primaryAgent: "codex",
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
      harnesses: ["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "roo-cline", "goose", "sourcegraph-amp", "devin-style"],
      storage: "local-json-or-postgres",
      auth: "reverse-proxy-or-oidc",
      goalChoice: "3",
      goal: "connect GitHub, Jira, Confluence or Notion",
      primaryAgent: "codex",
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
      goalChoice: "5",
      goal: "set up a team memory server",
      primaryAgent: "codex",
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
      goalChoice: "4",
      goal: "run benchmark demo",
      primaryAgent: "codex",
      connectors: ["github", "jira", "notion", "linear"],
      adapters: ["benchmark-arena", "storage-sqlite"],
      runDemo: true,
      nextSteps: ["Run benchmark:arena", "Review the ignored local report under artifacts/", "Run audit:truth before public claims"]
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
    goal: profile.goal,
    primaryAgent: profile.primaryAgent,
    connectors: profile.connectors,
    adapters: profile.adapters ?? [],
    runDemo: profile.runDemo,
    nextSteps: profile.nextSteps,
    metadata
  });
  console.log(`Wrote setup state: ${path}`);
  return path;
}

function harnessTargets() {
  return ["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "roo-cline", "goose", "sourcegraph-amp", "devin-style"];
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
      "cognibrain context --task <task> --json",
      "cognibrain guard --action <command> --json",
      "cognibrain outcome --command <command> --exit-code <code> --json",
      "cognibrain connections",
      "cognibrain connections add github --set repo=owner/repo",
      "cognibrain config show",
      "cognibrain proof",
      "cognibrain service plan",
      "cognibrain service install --activate",
      "cognibrain dashboard"
    ]
  };
}

async function cliAppData() {
  const home = await cliHomeData();
  const apiSpec = readJson(join(root, "artifacts", "vendor-api-specs.json"), {
    schemaVersion: "1.0",
    generatedAt: null,
    passed: false,
    summary: { total: 0, passed: 0, failed: 0 },
    rows: []
  });
  return {
    ...home,
    surface: "operator-cli",
    configCatalog: configCatalog(),
    connectors: {
      ...home.connections.connectors,
      catalog: connectorCatalog(),
      doctor: connectorDoctor(),
      apiSpec: {
        ...apiSpec,
        artifact: "artifacts/vendor-api-specs.json"
      }
    },
    adapters: {
      ...home.connections.adapters,
      catalog: adapterCatalog(),
      doctor: adapterDoctor()
    },
    reports: productTruthData(),
    sdk: {
      catalog: sdkCatalog(),
      doctor: sdkDoctor()
    },
    doctor: {
      config: configurationDoctor(),
      connections: combinedConnectionsDoctor(),
      sdk: sdkDoctor()
    }
  };
}

function productTruthData(refreshError) {
  const artifact = readJson(join(root, "artifacts", "product-truth-audit.json"), null);
  const arena = readJson(join(root, "artifacts", "arena", "run.json"), { systems: [] });
  const maturity = readJson(join(root, "artifacts", "connector-maturity.json"), { rows: [], summary: {} });
  const systems = Array.isArray(arena.systems) ? arena.systems : [];
  const maturityRows = Array.isArray(maturity.rows) ? maturity.rows : [];
  const fallback = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "cli_truth_snapshot",
    passed: !refreshError,
    planComplete: false,
    summary: {
      checks: 0,
      passed: 0,
      failures: refreshError ? 1 : 0,
      openGaps: 1,
      realCompetitorRuns: systems.filter((system) => system.system !== "cognibrain" && ["same-run-native", "same-run-cloud-api", "same-run-cli", "vendor-signed", "real-customer-field"].includes(system.proofLevel)).length,
      apiShapeCompetitors: systems.filter((system) => system.system !== "cognibrain" && system.proofLevel === "same-run-api-shape").length,
      nativeConnectorRows: maturityRows.length,
      hermeticDrivers: maturityRows.filter((row) => row.maturity?.hermeticFixture && row.maturity?.apiSpec).length,
      liveSmokeReadyConnectors: maturityRows.filter((row) => ["live-smoke-ready", "tenant-verified", "production-certified"].includes(row.proofLevel)).length,
      tenantLiveSmokes: maturityRows.filter((row) => row.maturity?.tenantVerified || row.maturity?.liveSmoke).length,
      productionCertifiedConnectors: maturityRows.filter((row) => row.maturity?.productionCertified).length,
      cliScreenshots: 0,
      dockerOptional: undefined
    },
    truthTuples: [
      ["arena.competitors.realRuns", systems.filter((system) => system.system !== "cognibrain" && ["same-run-native", "same-run-cloud-api", "same-run-cli", "vendor-signed", "real-customer-field"].includes(system.proofLevel)).length, "artifacts/arena/run.json"],
      ["connectors.tenantLiveSmokes", maturityRows.filter((row) => row.maturity?.liveSmoke).length, "artifacts/connector-maturity.json"]
    ],
    checks: refreshError ? [{ id: "truth-refresh", message: String(refreshError).slice(0, 500), passed: false, severity: "fail", evidence: { command: "node scripts/release/audit-product-truth.mjs" } }] : [],
    openGaps: []
  };
  return {
    ...(artifact ?? fallback),
    refreshError: refreshError ? String(refreshError).slice(0, 2000) : undefined,
    commands: [
      "cognibrain proof --json",
      "npm run audit:truth",
      "npm run benchmark:arena",
      "MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live",
      "npm run connectors:maturity"
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

async function memoryDashboardData(memoryArgs = []) {
  const limit = Number(optionValue(memoryArgs, "--limit") ?? process.env.MEMORY_LIMIT ?? 8);
  const health = captureMemoryJson(["health"]);
  const maintenance = captureMemoryJson(["maintenance"]);
  const recent = captureMemoryJson(["list", "--limit", String(limit)]);
  const reviewCandidates = Array.isArray(recent)
    ? recent.filter((memory) => memory?.beliefState === "needs_verification" || memory?.metadata?.reviewQueue?.status === "pending")
    : [];
  return {
    userId: process.env.MEMORY_USER_ID ?? process.env.USER ?? "local",
    health,
    maintenance,
    recent: Array.isArray(recent) ? recent : [],
    reviewQueue: {
      pending: reviewCandidates.length,
      items: reviewCandidates.slice(0, 8).map((memory) => ({
        id: memory.id,
        content: memory.content,
        connectorId: memory.metadata?.reviewQueue?.connectorId ?? memory.metadata?.connectorId,
        command: `cognibrain memory inspect ${memory.id}`,
        approveCommand: `cognibrain memory confirm ${memory.id}`,
        retractCommand: `cognibrain memory retract ${memory.id} "not durable"`
      }))
    },
    managementFlows: [
      { label: "add", command: "cognibrain memories add <text>", checkedBy: "src/cli/memctl.ts add" },
      { label: "search", command: "cognibrain memories search <query>", checkedBy: "src/cli/memctl.ts search" },
      { label: "inspect", command: "cognibrain memory inspect <id>", checkedBy: "src/cli/memctl.ts inspect" },
      { label: "confirm", command: "cognibrain memory confirm <id>", checkedBy: "src/cli/memctl.ts confirm" },
      { label: "retract", command: "cognibrain memory retract <id> <reason>", checkedBy: "src/cli/memctl.ts retract" },
      { label: "evidence", command: "cognibrain memory evidence-pack <query>", checkedBy: "src/cli/memctl.ts evidence-pack" },
      { label: "graph", command: "cognibrain memory graph <query>", checkedBy: "src/cli/memctl.ts graph" },
      { label: "dream", command: "cognibrain memory dream", checkedBy: "src/cli/memctl.ts dream" }
    ],
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
      "connector sync/writeback/health through connections plus memory connector-* subcommands",
      "review queue surfaces connector candidates with inspect/confirm/retract commands"
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
    { name: "connector directory", ok: true, level: existsSync(paths.connectors) ? "ok" : "warn", path: paths.connectors, fix: "optional; run cognibrain connections add github --set repo=owner/repo" },
    { name: "adapter directory", ok: true, level: existsSync(paths.adapters) ? "ok" : "warn", path: paths.adapters, fix: "optional; run cognibrain connections add storage-sqlite" },
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
    addCommand: `cognibrain connections add ${provider}`,
    wizardCommand: `cognibrain connector wizard ${provider}`
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
  if (!provider && targets.length === 0) {
    return { ok: true, level: "warn", checks: [], note: "no connector configs found; native connectors are optional until configured with credentials or env refs" };
  }
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

function connectorWizard(provider, options = {}) {
  const definition = connectorDefinitions()[provider];
  const preview = writeConnectorConfig(provider, { dryRun: true, settings: options.settings ?? {}, wizard: true });
  const existing = readJson(preview.path, null);
  const diff = safeJsonDiff(existing, preview.config);
  return {
    schemaVersion: "1.0",
    provider,
    connectorId: definition.connectorId,
    title: `${provider} connector setup wizard`,
    path: preview.path,
    configured: preview.configured,
    fields: (definition.fields ?? []).map((field) => ({
      name: field.name,
      label: field.label,
      secret: Boolean(field.secret),
      env: field.env,
      current: field.secret ? `env:${field.env}` : preview.config.settings[field.name] ?? field.default ?? null,
      required: definition.requiredEnv.includes(field.env)
    })),
    validation: {
      missingEnv: preview.missing,
      missingSettings: preview.config.missingSettings,
      credentialPolicy: preview.config.storagePolicy,
      doctorCommand: `cognibrain connector doctor ${provider}`,
      liveSmokeCommand: "MEMORY_VENDOR_LIVE_SMOKE=true npm run verify:vendor-live"
    },
    preview: {
      dryRun: true,
      existing: Boolean(existing),
      diff,
      writeCommand: `cognibrain connector add ${provider}${connectorSetFlags(preview.config.settings).join("")}`,
      healthCommand: preview.config.healthCommand
    },
    reviewQueue: {
      command: `cognibrain memory connector-sync-records ${definition.connectorId}`,
      previewTags: ["memory-candidate", "review-required", provider]
    },
    nextSteps: preview.config.nextSteps
  };
}

function connectorSetFlags(settings) {
  return Object.entries(settings ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ` --set ${key}=${String(value).replace(/\s+/g, " ")}`);
}

function safeJsonDiff(before, after) {
  const beforeText = before ? JSON.stringify(redactConnectorConfig(before), null, 2).split(/\r?\n/) : [];
  const afterText = JSON.stringify(redactConnectorConfig(after), null, 2).split(/\r?\n/);
  if (!beforeText.length) return afterText.map((line) => `+ ${line}`);
  const beforeSet = new Set(beforeText);
  const afterSet = new Set(afterText);
  return [
    ...beforeText.filter((line) => !afterSet.has(line)).map((line) => `- ${line}`),
    ...afterText.filter((line) => !beforeSet.has(line)).map((line) => `+ ${line}`)
  ];
}

function redactConnectorConfig(value) {
  if (!value || typeof value !== "object") return value;
  const clone = JSON.parse(JSON.stringify(value));
  for (const [key, item] of Object.entries(clone.settings ?? {})) {
    if (/token|secret|key|email/i.test(key)) clone.settings[key] = String(item).startsWith("MEMORY_") ? item : "redacted";
  }
  return clone;
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
  if (!adapter && targets.length === 0) {
    return { ok: true, level: "warn", checks: [], note: "no adapter configs found; adapters are optional until configured" };
  }
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
      includes: ["TypeScript integration", "connector manifest", ".env.example", "README"]
    },
    {
      sdk: "harness",
      status: "available",
      command: "cognibrain sdk harness <name> --out integrations/<name>",
      includes: ["TypeScript harness integration", ".env.example", "README", "HTTP lifecycle smoke"]
    },
    {
      sdk: "connector-author",
      status: "available",
      command: "import { createPlatformIntegration } from '@cognilabz/cognibrain/sdk/typescript/connectors'",
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
      name: "public TypeScript SDK exports",
      ok: existsSync(join(root, "sdk", "typescript", "index.ts")) && readFileSync(join(root, "sdk", "typescript", "index.ts"), "utf8").includes("./harness") && readFileSync(join(root, "sdk", "typescript", "connectors.ts"), "utf8").includes("createPlatformIntegration"),
      detail: "sdk/typescript/index.ts"
    },
    {
      name: "harness SDK helpers",
      ok: existsSync(join(root, "sdk", "typescript", "harness.ts")) && readFileSync(join(root, "sdk", "typescript", "harness.ts"), "utf8").includes("CognibrainHarnessSdk"),
      detail: "sdk/typescript/harness.ts"
    },
    {
      name: "platform SDK CLI",
      ok: readFileSync(join(root, "bin", "lib", "cliRuntime.mjs"), "utf8").includes("platformSdkScaffold"),
      detail: "bin/cognibrain.mjs"
    },
    {
      name: "publish package exports SDK subpaths",
      ok: readFileSync(join(root, "package.json"), "utf8").includes("\"./sdk/typescript/harness\"") && readFileSync(join(root, "package.json"), "utf8").includes("\"./sdk/typescript/connectors\""),
      detail: "package.json exports"
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
    docs: "docs/integrations.md#platform-sdk"
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
  const sdkImport = pathToFileURL(join(root, "sdk", "typescript", "index.ts")).href;
  return [
    'import { pathToFileURL } from "node:url";',
    `import { CognibrainClient, createPlatformIntegration, mapPlatformRecord } from "${sdkImport}";`,
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

function harnessSdkScaffold(name, options) {
  const slug = platformSlug(name);
  const envPrefix = `MEMORY_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const outputDir = resolve(launchCwd, options.out ?? join(".cognibrain", "integrations", slug));
  const files = [
    {
      path: join(outputDir, `${slug}.harness.ts`),
      content: harnessIntegrationTemplate({ slug, name, envPrefix })
    },
    {
      path: join(outputDir, ".env.example"),
      content: harnessEnvTemplate({ slug, envPrefix })
    },
    {
      path: join(outputDir, "README.md"),
      content: harnessReadmeTemplate({ slug, name })
    }
  ];
  if (!options.dryRun) {
    for (const file of files) writeGeneratedFile(file.path, file.content);
  }
  return {
    schemaVersion: "1.0",
    sdk: "harness",
    name,
    slug,
    dryRun: Boolean(options.dryRun),
    outputDir,
    files: files.map((file) => file.path),
    commands: [
      `npx tsx ${join(outputDir, `${slug}.harness.ts`)}`,
      `npx cognibrain memory action --user "$${envPrefix}_USER_ID" --command "npm test"`
    ]
  };
}

function harnessIntegrationTemplate({ slug, name, envPrefix }) {
  const sdkImport = pathToFileURL(join(root, "sdk", "typescript", "index.ts")).href;
  return [
    'import { pathToFileURL } from "node:url";',
    `import { CognibrainHarnessSdk } from "${sdkImport}";`,
    "",
    "const harness = new CognibrainHarnessSdk({",
    "  baseUrl: process.env.COGNIBRAIN_URL,",
    "  apiKey: process.env.COGNIBRAIN_API_KEY,",
    `  actorId: process.env.${envPrefix}_AGENT_ID ?? "${slug}-agent"`,
    "});",
    "",
    "export async function runHarnessSmoke() {",
    "  const context = {",
    `    userId: process.env.${envPrefix}_USER_ID ?? process.env.MEMORY_USER_ID ?? "local",`,
    `    agentId: process.env.${envPrefix}_AGENT_ID ?? "${slug}-agent",`,
    `    appId: "${slug}",`,
    `    projectId: process.env.${envPrefix}_PROJECT_ID ?? "local",`,
    `    sessionId: process.env.${envPrefix}_SESSION_ID ?? "${slug}-smoke",`,
    `    prompt: process.env.${envPrefix}_PROMPT ?? "Run ${escapeTsString(name)} harness smoke.",`,
    `    codebaseScope: { repo: process.env.${envPrefix}_REPO ?? "local", harness: "${slug}" }`,
    "  };",
    "",
    "  await harness.startSession(context);",
    "  const preTool = await harness.beforeToolCall(context, { command: process.env.HARNESS_SMOKE_COMMAND ?? \"npm test\" });",
    "  const outcome = await harness.afterToolCall(context, {",
    "    command: process.env.HARNESS_SMOKE_COMMAND ?? \"npm test\",",
    "    exitCode: 0,",
    "    outputSummary: \"local harness SDK smoke completed\"",
    "  });",
    "  const patch = await harness.finishPatch(context, {",
    "    task: \"harness SDK smoke\",",
    "    commandsRun: [process.env.HARNESS_SMOKE_COMMAND ?? \"npm test\"],",
    "    memoryIds: [outcome.action?.id].filter((id): id is string => Boolean(id))",
    "  });",
    "  await harness.prepareHandoff(context, { content: \"Harness SDK smoke ready for handoff.\", runDream: false });",
    "  console.log(JSON.stringify({ harness: context.appId, guard: preTool.guard.severity, patchEvidenceTrailId: patch.trail.id }, null, 2));",
    "}",
    "",
    "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {",
    "  runHarnessSmoke().catch((error) => {",
    "    console.error(error);",
    "    process.exit(1);",
    "  });",
    "}",
    ""
  ].join("\n");
}

function harnessEnvTemplate({ slug, envPrefix }) {
  return [
    "COGNIBRAIN_URL=http://127.0.0.1:8787",
    "COGNIBRAIN_API_KEY=",
    `${envPrefix}_USER_ID=local`,
    `${envPrefix}_AGENT_ID=${slug}-agent`,
    `${envPrefix}_PROJECT_ID=local`,
    `${envPrefix}_SESSION_ID=${slug}-smoke`,
    `${envPrefix}_REPO=local`,
    `${envPrefix}_PROMPT=Run harness SDK smoke.`,
    "HARNESS_SMOKE_COMMAND=npm test",
    ""
  ].join("\n");
}

function harnessReadmeTemplate({ slug, name }) {
  return [
    `# ${name} cognibrain harness integration`,
    "",
    "This scaffold connects a non-MCP harness to cognibrain through the public TypeScript Harness SDK.",
    "",
    "## Files",
    "",
    `- \`${slug}.harness.ts\`: context, guard, telemetry, patch evidence and handoff smoke.`,
    "- `.env.example`: runtime variable names; keep real secrets outside git.",
    "",
    "## Run",
    "",
    "```bash",
    "cp .env.example .env",
    "npx cognibrain start",
    `npx tsx ${slug}.harness.ts`,
    "```",
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
      credentialValidation: `cognibrain connector doctor ${provider}`,
      liveSmoke: "npm run verify:vendor-live",
      writePolicy: "dry-run preview before writeback; explicit dryRun=false required for writes",
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

function sqliteRuntimeCheck() {
  const result = spawnSync(process.execPath, ["-e", "const sqlite = require('node:sqlite'); if (!sqlite.DatabaseSync) process.exit(2);"], {
    cwd: root,
    env: runtimeEnv(),
    encoding: "utf8"
  });
  if (result.status === 0) return { ok: true, detail: "available" };
  return { ok: false, detail: (result.stderr || result.stdout || "node:sqlite DatabaseSync unavailable").trim() };
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

}
