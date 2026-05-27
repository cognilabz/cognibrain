import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join, resolve } from "node:path";

const EXIT_CODES = {
  success: 0,
  genericFailure: 1,
  guardWarning: 2,
  guardBlock: 3,
  authConfigError: 4,
  daemonUnavailable: 5,
  policyDenied: 6,
  needsVerification: 7
};

const MCP_PARITY = {
  context: "memory_coding_context_pack",
  guard: "memory_action_guard",
  outcome: "memory_action_outcome",
  correction: "memory_code_correction",
  "patch-evidence": "memory_patch_evidence",
  "dream-plan": "memory_dream_plan",
  "session-end": "memory_session_end",
  handoff: "memory_handoff_prepare",
  "release-prepare": "memory_release_prepare",
  "source-revalidate": "memory_source_revalidate",
  conflicts: "memory_conflict_sets"
};

const COMMAND_SCHEMAS = {
  context: {
    required: ["userId", "task"],
    properties: ["userId", "task", "repo", "branch", "harness", "agentId", "sessionId", "appId", "orgId", "projectId", "limit", "tokenBudget", "codebaseScope"]
  },
  guard: {
    required: ["userId", "action"],
    properties: ["userId", "action", "repo", "branch", "harness", "agentId", "sessionId", "appId", "orgId", "projectId", "codebaseScope"]
  },
  outcome: {
    required: ["userId", "command"],
    properties: ["userId", "command", "exitCode", "cwd", "summary", "files", "durationMs", "repo", "branch", "harness"]
  },
  correction: {
    required: ["userId", "text"],
    properties: ["userId", "text", "wrongAction", "correctAction", "repo", "branch", "harness", "kind", "previousMemoryId", "evidenceIds"]
  },
  "patch-evidence": {
    required: ["userId", "task"],
    properties: ["userId", "task", "files", "commands", "memoryIds", "repo", "branch", "harness"]
  },
  "session-end": {
    required: ["userId"],
    properties: ["userId", "harness", "harnessRunId", "runDreamIfDue", "force", "budget", "sourceRefresh"]
  },
  handoff: {
    required: ["userId"],
    properties: ["userId", "harness", "harnessRunId", "runDreamIfDue", "force", "budget", "sourceRefresh"]
  },
  "release-prepare": {
    required: ["userId"],
    properties: ["userId", "repo", "branch", "harnessRunId", "sourceRefresh", "runDreamIfDue", "force", "budget"]
  },
  "dream-plan": {
    required: ["userId"],
    properties: ["userId", "repo", "branch", "harnessRunId", "trigger", "budget", "sourceRefresh", "force"]
  },
  health: {
    required: [],
    properties: ["userId"]
  },
  "source-revalidate": {
    required: ["userId"],
    properties: ["userId", "memoryId", "connectorIds", "limit"]
  },
  conflicts: {
    required: [],
    properties: ["status"]
  }
};

const LIFECYCLE_COMMANDS = new Set(Object.keys(COMMAND_SCHEMAS));
const MEMORY_LIFECYCLE_ALIASES = new Set(["coding-context", "action-guard", "action", "code-correction", "patch-evidence"]);

export function isLifecycleCommand(command) {
  return LIFECYCLE_COMMANDS.has(command);
}

export function isMemoryLifecycleCommand(args = []) {
  return MEMORY_LIFECYCLE_ALIASES.has(args[0]);
}

export async function handleLifecycleCommand(args, context) {
  await runLifecycleCommand(args, context, { prefix: "cognibrain", alias: false });
}

export async function handleHarnessCommand(args, context) {
  await runLifecycleCommand(args, context, { prefix: "cognibrain harness", alias: true });
}

export async function handleMemoryLifecycleCommand(args, context) {
  await runLifecycleCommand(memoryLifecycleArgs(args), context, { prefix: "cognibrain", alias: true });
}

async function runLifecycleCommand(args, context, commandContext) {
  const command = args[0] ?? "help";
  if (command === "help" || args.includes("--help")) {
    printLifecycleUsage(commandContext);
    return;
  }
  if (!COMMAND_SCHEMAS[command]) {
    printLifecycleUsage(commandContext);
    process.exit(EXIT_CODES.genericFailure);
  }

  const options = parseOptions(args.slice(1));
  const userId = stringOption(options, "user") ?? stringOption(options, "user-id") ?? process.env.MEMORY_USER_ID ?? process.env.USER ?? "local";
  const common = {
    userId,
    agentId: stringOption(options, "agent") ?? process.env.MEMORY_AGENT_ID,
    sessionId: stringOption(options, "session") ?? process.env.MEMORY_SESSION_ID,
    appId: stringOption(options, "app") ?? process.env.MEMORY_APP_ID,
    orgId: stringOption(options, "org") ?? process.env.MEMORY_ORG_ID,
    projectId: stringOption(options, "project") ?? process.env.MEMORY_PROJECT_ID
  };
  const codebaseScope = scopeFromOptions(options, context.launchCwd);
  const payload = payloadForCommand(command, options, common, codebaseScope);
  const client = new CliBackendClient({ ...context, options });
  const started = Date.now();
  const warnings = [];
  let data;
  let backendInfo;

  try {
    const result = await client.call(command, payload);
    data = result.data;
    backendInfo = result.backend;
    warnings.push(...(result.warnings ?? []));
  } catch (error) {
    const output = envelope({
      ok: false,
      type: typeForCommand(command),
      id: idForData(command, undefined),
      decision: "error",
      data: null,
      warnings,
      errors: [{ code: error.code ?? "harness_command_failed", message: error.message }],
      nextRecommendedCommands: recoveryCommands(error, command),
      backend: error.backend ?? client.description(),
      schema: schemaFor(command),
      mcpParity: MCP_PARITY[command],
      durationMs: Date.now() - started
    });
    printHarnessOutput(output, options);
    process.exit(error.exitCode ?? EXIT_CODES.genericFailure);
  }

  const decision = decisionFor(command, data);
  const output = envelope({
    ok: okForDecision(command, decision),
    type: typeForCommand(command),
    id: idForData(command, data),
    decision,
    data,
    warnings,
    errors: [],
    nextRecommendedCommands: nextCommands(command, decision),
    backend: backendInfo ?? client.description(),
    schema: schemaFor(command),
    mcpParity: MCP_PARITY[command],
    durationMs: Date.now() - started
  });
  printHarnessOutput(output, options);
  process.exit(exitCodeFor(command, decision, output.ok));
}

function memoryLifecycleArgs(args) {
  const [legacyCommand, ...legacyArgs] = args;
  const text = legacyArgs.filter((item) => !item.startsWith("--")).join(" ");
  switch (legacyCommand) {
    case "coding-context":
      return ["context", "--task", text, ...lifecycleAliasFlags(args)];
    case "action-guard":
      return ["guard", "--action", text, ...lifecycleAliasFlags(args)];
    case "action":
      return [
        "outcome",
        "--command",
        text,
        ...envOption("MEMORY_EXIT_CODE", "--exit-code"),
        ...envOption("MEMORY_CWD", "--cwd"),
        ...envOption("MEMORY_OUTPUT_SUMMARY", "--summary"),
        ...envOption("MEMORY_FAILURE_REASON", "--failure-reason"),
        ...envOption("MEMORY_SUCCESS_REASON", "--success-reason"),
        ...envOption("MEMORY_FILES_CHANGED", "--files"),
        ...lifecycleAliasFlags(args)
      ];
    case "code-correction":
      return [
        "correction",
        "--text",
        text,
        ...envOption("MEMORY_PREVIOUS_MEMORY_ID", "--previous-memory-id"),
        ...envOption("MEMORY_PREVIOUS_WRONG_ACTION", "--wrong-action"),
        ...envOption("MEMORY_CORRECT_ACTION", "--correct-action"),
        ...envOption("MEMORY_ENGINEERING_KIND", "--kind"),
        ...envOption("MEMORY_EVIDENCE_IDS", "--evidence-ids"),
        ...lifecycleAliasFlags(args)
      ];
    case "patch-evidence":
      return [
        "patch-evidence",
        "--task",
        text,
        ...envOption("MEMORY_FILES_CHANGED", "--files"),
        ...envOption("MEMORY_COMMANDS_RUN", "--commands"),
        ...envOption("MEMORY_MEMORY_IDS", "--memory-ids"),
        ...lifecycleAliasFlags(args)
      ];
    default:
      return args;
  }
}

function envOption(envName, optionName) {
  return process.env[envName] ? [optionName, process.env[envName]] : [];
}

function lifecycleAliasFlags(args) {
  return ["--json", "--local-direct", "--no-autostart", "--require-daemon"].filter((flag) => args.includes(flag));
}

function payloadForCommand(command, options, common, codebaseScope) {
  switch (command) {
    case "context":
      return clean({
        ...common,
        query: requiredText(options, "task", "context requires --task"),
        limit: numberOption(options, "limit"),
        tokenBudget: numberOption(options, "token-budget"),
        codebaseScope
      });
    case "guard":
      return clean({
        ...common,
        action: requiredText(options, "action", "guard requires --action"),
        codebaseScope
      });
    case "outcome":
      return clean({
        ...common,
        command: requiredText(options, "command", "outcome requires --command"),
        cwd: stringOption(options, "cwd"),
        exitCode: numberOption(options, "exit-code"),
        durationMs: numberOption(options, "duration-ms"),
        outputSummary: stringOption(options, "summary"),
        failureReason: stringOption(options, "failure-reason"),
        successReason: stringOption(options, "success-reason"),
        filesChanged: listOption(options, "files")
      });
    case "correction":
      return clean({
        ...common,
        content: requiredText(options, "text", "correction requires --text"),
        previousMemoryId: stringOption(options, "previous-memory-id"),
        previousWrongAction: stringOption(options, "wrong-action"),
        correctAction: stringOption(options, "correct-action"),
        kind: stringOption(options, "kind") ?? "review_correction",
        codebase: codebaseScope,
        evidenceIds: listOption(options, "evidence-ids")
      });
    case "patch-evidence":
      return clean({
        ...common,
        task: requiredText(options, "task", "patch-evidence requires --task"),
        codebaseScope,
        filesChanged: listOption(options, "files"),
        commandsRun: listOption(options, "commands"),
        memoryIds: listOption(options, "memory-ids")
      });
    case "session-end":
    case "handoff":
    case "release-prepare":
    case "dream-plan":
      return clean({
        ...common,
        harnessRunId: stringOption(options, "harness-run-id"),
        trigger: command === "dream-plan" ? stringOption(options, "trigger") : undefined,
        scope: dreamScopeFrom(codebaseScope),
        budget: stringOption(options, "budget") ?? (command === "release-prepare" ? "release" : undefined),
        sourceRefresh: boolOption(options, "source-refresh") ?? (command === "release-prepare" ? true : undefined),
        run: boolOption(options, "run-dream-if-due") ?? false,
        force: boolOption(options, "force")
      });
    case "health":
      return clean({ userId: common.userId });
    case "source-revalidate":
      return clean({
        userId: common.userId,
        memoryId: stringOption(options, "memory-id"),
        connectorIds: listOption(options, "connector-ids"),
        limit: numberOption(options, "limit")
      });
    case "conflicts":
      return clean({ status: stringOption(options, "status") });
    default:
      throw new Error(`unsupported command ${command}`);
  }
}

class CliBackendClient {
  constructor(context) {
    this.context = context;
    this.backend = null;
  }

  async call(command, payload) {
    this.backend = await createAutoBackend(this.context);
    return this.backend.call(command, payload);
  }

  description() {
    return this.backend?.description() ?? { kind: "auto", default: "daemon" };
  }
}

async function createAutoBackend(context) {
  const mode = stringOption(context.options, "backend") ?? process.env.COGNIBRAIN_CLI_BACKEND ?? process.env.COGNIBRAIN_HARNESS_BACKEND;
  if (context.options.flags.has("local-direct") || mode === "local" || mode === "local-direct") return new LocalDirectBackend(context);
  const daemon = new DaemonBackend(context);
  const reachable = await daemon.isReachable();
  if (reachable) return daemon;
  if (!context.options.flags.has("no-autostart") && process.env.COGNIBRAIN_CLI_AUTOSTART !== "false" && process.env.COGNIBRAIN_HARNESS_AUTOSTART !== "false") {
    await autostartDaemon(context);
    if (await daemon.refresh().isReachable()) return daemon;
  }
  if (context.options.flags.has("require-daemon") || mode === "daemon") {
    const error = new Error("cognibrain daemon unavailable");
    error.code = "daemon_unavailable";
    error.exitCode = EXIT_CODES.daemonUnavailable;
    error.backend = daemon.description();
    throw error;
  }
  return new LocalDirectBackend(context, ["daemon unavailable; used local-direct fallback"]);
}

class DaemonBackend {
  constructor(context) {
    this.context = context;
    this.baseUrl = discoverDaemonUrl(context);
  }

  refresh() {
    this.baseUrl = discoverDaemonUrl(this.context);
    return this;
  }

  description() {
    return { kind: "daemon", url: this.baseUrl };
  }

  async isReachable() {
    if (!this.baseUrl) return false;
    try {
      const health = await httpJson("GET", `${this.baseUrl}/health`, undefined, 800);
      return Boolean(health.ok);
    } catch {
      return false;
    }
  }

  async call(command, payload) {
    const route = routeFor(command, payload);
    const data = await httpJson(route.method, `${this.baseUrl}${route.path}`, route.body);
    return { data, backend: this.description(), warnings: [] };
  }
}

class LocalDirectBackend {
  constructor(context, warnings = []) {
    this.context = context;
    this.warnings = warnings;
  }

  description() {
    return { kind: "local-direct" };
  }

  async call(command, payload) {
    const tsx = resolveExecutable(this.context.root, "tsx");
    if (!tsx) {
      const error = new Error("tsx runtime missing for local-direct fallback");
      error.code = "config_error";
      error.exitCode = EXIT_CODES.authConfigError;
      error.backend = this.description();
      throw error;
    }
    const result = spawnSync(tsx, [join(this.context.root, "src", "cli", "lifecycleLocalDirect.ts"), command], {
      cwd: this.context.launchCwd,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV === "test" ? "development" : process.env.NODE_ENV,
        COGNIBRAIN_RUNTIME_ROOT: this.context.runtimeRoot,
        MEMORY_DB_PATH: process.env.MEMORY_DB_PATH ?? join(this.context.runtimeRoot, ".memory-harness.json"),
        COGNIBRAIN_LIFECYCLE_PAYLOAD_JSON: JSON.stringify(payload),
        COGNIBRAIN_HARNESS_PAYLOAD_JSON: JSON.stringify(payload)
      },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    if (result.status !== 0) {
      const error = new Error(result.stderr.trim() || result.stdout.trim() || `local-direct exited ${result.status}`);
      error.code = "local_direct_failed";
      error.exitCode = result.status ?? EXIT_CODES.genericFailure;
      error.backend = this.description();
      throw error;
    }
    return { data: JSON.parse(result.stdout), backend: this.description(), warnings: this.warnings };
  }
}

function routeFor(command, payload) {
  switch (command) {
    case "context":
      return { method: "POST", path: "/coding-context-pack", body: payload };
    case "guard":
      return { method: "POST", path: "/code/action-guard", body: payload };
    case "outcome":
      return { method: "POST", path: "/actions", body: payload };
    case "correction":
      return { method: "POST", path: "/code/corrections", body: payload };
    case "patch-evidence":
      return { method: "POST", path: "/patch-evidence", body: payload };
    case "session-end":
      return { method: "POST", path: "/harness/session-end", body: payload };
    case "handoff":
      return { method: "POST", path: "/harness/handoff-prepare", body: payload };
    case "release-prepare":
      return { method: "POST", path: "/harness/release-prepare", body: payload };
    case "dream-plan":
      return { method: "POST", path: "/dream/plan", body: payload };
    case "health":
      return { method: "GET", path: `/health?userId=${encodeURIComponent(payload.userId)}` };
    case "source-revalidate":
      return { method: "POST", path: "/sources/revalidate", body: payload };
    case "conflicts":
      return { method: "GET", path: `/conflicts${payload.status ? `?status=${encodeURIComponent(payload.status)}` : ""}` };
    default:
      throw new Error(`unsupported harness route ${command}`);
  }
}

function discoverDaemonUrl(context) {
  const explicit = process.env.MEMORY_API_URL ?? process.env.COGNIBRAIN_API_URL ?? process.env.COGNIBRAIN_URL;
  if (explicit) return stripSlash(explicit);
  for (const file of [
    join(context.runtimeRoot, ".cognibrain", "runtime.json"),
    join(context.runtimeRoot, ".cognibrain", "local-runtime.json")
  ]) {
    const state = readJson(file, null);
    if (state?.api?.url) return stripSlash(state.api.url);
  }
  return "http://127.0.0.1:8787";
}

async function autostartDaemon(context) {
  const lockPath = join(context.runtimeRoot, ".cognibrain", "cli-start.lock");
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockFd;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch {
    await sleep(1000);
    return;
  }
  try {
    writeFileSync(lockFd, `${process.pid}\n`);
    spawnSync(process.execPath, [join(context.root, "bin", "cognibrain.mjs"), "--runtime-root", context.runtimeRoot, "start"], {
      cwd: context.launchCwd,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
  } finally {
    rmSync(lockPath, { force: true });
  }
}

function httpJson(method, url, body, timeoutMs = 4_000) {
  return new Promise((resolveRequest, reject) => {
    const request = http.request(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined
    }, (response) => {
      let text = "";
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => {
        let payload;
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          payload = { body: text };
        }
        if ((response.statusCode ?? 500) >= 400) {
          const error = new Error(payload.error ?? payload.message ?? `${url} returned ${response.statusCode}`);
          error.code = payload.code ?? "http_error";
          error.exitCode = response.statusCode === 401 || response.statusCode === 403 ? EXIT_CODES.authConfigError : EXIT_CODES.genericFailure;
          reject(error);
          return;
        }
        resolveRequest(payload);
      });
    });
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`${url} timed out`)));
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

function printHarnessOutput(output, options) {
  if (options.flags.has("json")) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(JSON.stringify(output, null, 2));
}

function envelope(input) {
  return {
    schemaVersion: "1.0",
    ok: input.ok,
    type: input.type,
    id: input.id,
    decision: input.decision,
    data: input.data,
    warnings: input.warnings,
    errors: input.errors,
    nextRecommendedCommands: input.nextRecommendedCommands,
    backend: input.backend,
    schema: input.schema,
    mcpParity: input.mcpParity,
    durationMs: input.durationMs
  };
}

function typeForCommand(command) {
  return command.replaceAll("-", "_");
}

function decisionFor(command, data) {
  if (command === "guard") return data?.decision ?? (data?.severity === "block" ? "block" : data?.severity === "warn" ? "warn" : "allow");
  if (command === "health") return data?.ok ? "healthy" : "needs_attention";
  if (command === "source-revalidate") return data?.needsVerification ? "needs_verification" : "ok";
  return "ok";
}

function okForDecision(command, decision) {
  if (command === "guard") return decision === "allow";
  return decision !== "needs_attention";
}

function exitCodeFor(command, decision, ok) {
  if (command === "guard" && decision === "block") return EXIT_CODES.guardBlock;
  if (command === "guard" && decision === "warn") return EXIT_CODES.guardWarning;
  if (decision === "needs_verification") return EXIT_CODES.needsVerification;
  return ok ? EXIT_CODES.success : EXIT_CODES.genericFailure;
}

function idForData(command, data) {
  if (command === "context") return data?.id ?? data?.contextPackId ?? data?.evidencePack?.id;
  if (command === "outcome" || command === "correction") return data?.id;
  if (command === "patch-evidence") return data?.id;
  if (command === "health") return `health_${Date.now()}`;
  return data?.id ?? data?.jobId ?? undefined;
}

function nextCommands(command, decision) {
  if (command === "context") return ["cognibrain guard --action \"<command>\" --json", "cognibrain outcome --command \"<command>\" --exit-code 0 --json"];
  if (command === "guard" && decision === "block") return ["Use suggestedAction or alternatives from data before running the tool"];
  if (command === "guard") return ["cognibrain outcome --command \"<command>\" --exit-code <code> --json"];
  if (command === "outcome") return ["cognibrain patch-evidence --task \"<task>\" --files <file> --commands \"<command>\" --json"];
  if (command === "correction") return ["cognibrain guard --action \"<corrected action>\" --json"];
  if (command === "patch-evidence") return ["cognibrain session-end --run-dream-if-due --json"];
  return [];
}

function recoveryCommands(error, command) {
  if (error.code === "daemon_unavailable") return ["cognibrain start", `cognibrain ${command} --local-direct --json`];
  if (error.code === "config_error") return ["npm install", "cognibrain doctor --fix"];
  return ["cognibrain health --json", "cognibrain doctor --fix"];
}

function schemaFor(command) {
  return {
    command,
    jsonEnvelope: {
      required: ["ok", "type", "decision", "data", "warnings", "errors", "nextRecommendedCommands"],
      exitCodes: EXIT_CODES
    },
    input: COMMAND_SCHEMAS[command]
  };
}

function parseOptions(argv) {
  const values = new Map();
  const flags = new Set();
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      positionals.push(item);
      continue;
    }
    const name = item.slice(2);
    if (["json", "local-direct", "no-autostart", "require-daemon", "run-dream-if-due", "source-refresh", "force"].includes(name)) {
      flags.add(name);
      continue;
    }
    const value = argv[index + 1];
    index += 1;
    if (values.has(name)) values.set(name, [...asArray(values.get(name)), value]);
    else values.set(name, value);
  }
  return { values, flags, positionals };
}

function scopeFromOptions(options, launchCwd) {
  const scope = clean({
    org: stringOption(options, "scope-org"),
    orgId: stringOption(options, "scope-org-id"),
    repo: stringOption(options, "repo") ?? process.env.MEMORY_REPO,
    repository: stringOption(options, "repository"),
    branch: stringOption(options, "branch") ?? process.env.MEMORY_BRANCH,
    commit: stringOption(options, "commit") ?? process.env.MEMORY_COMMIT,
    workspace: stringOption(options, "workspace") ?? process.env.MEMORY_WORKSPACE,
    directory: stringOption(options, "directory") ?? process.env.MEMORY_DIRECTORY,
    filePattern: stringOption(options, "file-pattern"),
    language: stringOption(options, "language"),
    framework: stringOption(options, "framework"),
    harness: stringOption(options, "harness") ?? process.env.MEMORY_HARNESS,
    currentPath: stringOption(options, "current-path") ?? launchCwd
  });
  return Object.keys(scope).length ? scope : undefined;
}

function dreamScopeFrom(codebaseScope) {
  if (!codebaseScope) return undefined;
  return clean({
    kind: codebaseScope.repo ? "repo" : undefined,
    repo: codebaseScope.repo ?? codebaseScope.repository,
    branch: codebaseScope.branch,
    orgId: codebaseScope.orgId
  });
}

function requiredText(options, name, message) {
  const value = stringOption(options, name);
  if (value) return value;
  const error = new Error(message);
  error.code = "validation_error";
  error.exitCode = EXIT_CODES.genericFailure;
  throw error;
}

function stringOption(options, name) {
  const value = options.values.get(name);
  return Array.isArray(value) ? value[value.length - 1] : value;
}

function numberOption(options, name) {
  const value = stringOption(options, name);
  return value === undefined ? undefined : Number(value);
}

function boolOption(options, name) {
  return options.flags.has(name) ? true : undefined;
}

function listOption(options, name) {
  const value = options.values.get(name);
  const values = asArray(value).flatMap((item) => String(item).split(","));
  const cleanValues = values.map((item) => item.trim()).filter(Boolean);
  return cleanValues.length ? cleanValues : undefined;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function clean(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function stripSlash(value) {
  return value.replace(/\/+$/, "");
}

function resolveExecutable(root, name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  for (const candidate of [
    join(root, "node_modules", ".bin", `${name}${suffix}`),
    join(root, "..", ".bin", `${name}${suffix}`),
    join(root, "..", "..", ".bin", `${name}${suffix}`)
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  const result = spawnSync(name, ["--version"], { cwd: root, stdio: "ignore" });
  return result.status === 0 ? name : null;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function printLifecycleUsage(context = { prefix: "cognibrain", alias: false }) {
  const prefix = context.prefix ?? "cognibrain";
  console.log(`Usage:
  ${prefix} context --user <id> --task <text> [--repo owner/repo] [--harness codex] --json
  ${prefix} guard --user <id> --action <command> [--repo owner/repo] --json
  ${prefix} outcome --user <id> --command <command> [--exit-code n] [--cwd path] [--summary text] --json
  ${prefix} correction --user <id> --text <correction> [--wrong-action text] [--correct-action text] --json
  ${prefix} patch-evidence --user <id> --task <text> [--files a,b] [--commands "npm test"] --json
  ${prefix} session-end|handoff|release-prepare --user <id> [--run-dream-if-due] --json
  ${prefix} dream-plan|source-revalidate|conflicts|health --json

Backend flags:
  --local-direct       Run the local fallback without the daemon.
  --require-daemon     Fail with exit code 5 if the daemon is unavailable.
  --no-autostart       Do not start the local daemon automatically.

Stable exit codes:
  0 success/allow, 1 generic failure, 2 guard warning, 3 guard block,
  4 auth/config error, 5 daemon unavailable, 6 policy denied, 7 needs verification

Compatibility:
  cognibrain harness <command> remains an alias for existing scripts.
  cognibrain memory coding-context|action-guard|action|code-correction|patch-evidence remain legacy aliases.`);
}
