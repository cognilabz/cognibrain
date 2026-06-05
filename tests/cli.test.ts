import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";
import { createMcpRuntimeToolHandlers, DaemonRuntimeClient } from "../src/connectors/mcpRuntimeClient";
import { harnessCommandSchemas, harnessLifecycleContractVersion, harnessMcpParity } from "../src/contracts/harness/v1";
import { sanitizedRuntimeEnv } from "../src/core/runtimeEnv";
import { RuntimeDaemonClient } from "../src/runtime/daemonClient";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "cognibrain.mjs");
const connectCli = join(root, "bin", "cognibrain-connect.mjs");
const slowCliTimeout = 180_000;

function valueAtPath(input: unknown, path: string) {
  return path.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, input);
}

describe("cognibrain CLI", () => {
  it("prints the one-command surface", () => {
    const output = execFileSync(process.execPath, [cli, "help"], { cwd: root, encoding: "utf8" });
    expect(output).toContain("cognibrain\n      Print the compact operator CLI home");
    expect(output).toContain("cognibrain tui|ui|home");
    expect(output).toContain("cognibrain setup");
    expect(output).toContain("cognibrain doctor");
    expect(output).toContain("cognibrain resources");
    expect(output).toContain("cognibrain memories");
    expect(output).toContain("cognibrain context|guard|outcome|correction|patch-evidence|session-end|handoff|release-prepare|dream-plan|source-revalidate|conflicts|health --json");
    expect(output).toContain("cognibrain connections");
    expect(output).toContain("cognibrain proof|truth");
    expect(output).toContain("cognibrain service");
    expect(output).toContain("cognibrain memory search");
    expect(output).toContain("cognibrain guard --action <command> --json");
    expect(output).toContain("Guided self-hosted install");
    expect(output).toContain("azure-devops");
    expect(output).toContain("cognibrain adapter list");
    expect(output).toContain("cognibrain skill install|status|doctor|path");
  }, slowCliTimeout);

  it("measures and prunes reinstallable benchmark caches without deleting memory data", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-resources-"));
    const cacheRoot = mkdtempSync(join(tmpdir(), "cognibrain-cli-cache-"));
    try {
      const env = { ...process.env, MEMORY_AUTO_DREAM: "false", MEMORY_DB_PATH: join(dir, ".memory-harness.json"), COGNIBRAIN_BENCHMARK_CACHE_ROOT: cacheRoot };
      const writeGenerated = (relative: string, content = "generated-cache") => {
        const path = join(dir, relative);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      };
      const writeCache = (relative: string, content = "generated-cache") => {
        const path = join(cacheRoot, relative);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content);
      };
      writeGenerated(".memory-harness.json", JSON.stringify({ memories: [] }));
      writeGenerated(".cognibrain/connectors/github.json", JSON.stringify({ provider: "github" }));
      writeGenerated(".cognibrain/original-benchmarks/fixture/result.txt");
      writeGenerated(".cognibrain/native-runners/fixture/output.txt");
      writeGenerated(".cognibrain/vendor/fixture/package.txt");
      writeCache("native-runners/fixture/output.txt");

      const before = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "resources", "--json"], { cwd: dir, env, encoding: "utf8" }));
      expect(before.generated.benchmarkCacheBytes).toBeGreaterThan(0);
      expect(before.activeProcesses).toMatchObject({
        source: "ps",
        totalCpuPercent: expect.any(Number),
        totalRssKb: expect.any(Number),
        note: expect.stringContaining("not normal API/MCP/dashboard runtime")
      });
      expect(Array.isArray(before.activeProcesses.benchmarkProcesses)).toBe(true);
      expect(before.generated.rows).toEqual(expect.arrayContaining([expect.objectContaining({ name: "user-cache/native-runners", exists: true })]));
      expect(before.localRuntimeState).toMatchObject({ present: true, parseable: true });
      expect(before.prune.requested).toBe(false);
      expect(before.vscode.settingsPresent).toBe(false);
      expect(before.vscode.missingLowResourceSettings).toEqual([
        "javascript.suggest.autoImports",
        "npm.autoDetect",
        "python.analysis.autoImportCompletions",
        "python.analysis.exclude",
        "python.analysis.indexing",
        "task.autoDetect",
        "typescript.disableAutomaticTypeAcquisition",
        "typescript.preferences.includePackageJsonAutoImports",
        "typescript.suggest.autoImports",
        "typescript.tsserver.maxTsServerMemory",
        "typescript.tsserver.experimental.enableProjectDiagnostics",
        "typescript.tsserver.watchOptions"
      ]);

      const dryRun = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "resources", "--prune-benchmark-caches", "--dry-run", "--json"], { cwd: dir, env, encoding: "utf8" }));
      expect(dryRun.prune.dryRun).toBe(true);
      expect(existsSync(join(dir, ".cognibrain", "original-benchmarks"))).toBe(true);

      const pruned = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "resources", "--prune-benchmark-caches", "--json"], { cwd: dir, env, encoding: "utf8" }));
      expect(pruned.prune.reclaimedBytes).toBeGreaterThan(0);
      expect(existsSync(join(dir, ".cognibrain", "original-benchmarks"))).toBe(false);
      expect(existsSync(join(dir, ".cognibrain", "native-runners"))).toBe(false);
      expect(existsSync(join(dir, ".cognibrain", "vendor"))).toBe(false);
      expect(existsSync(join(cacheRoot, "native-runners"))).toBe(false);
      expect(pruned.generated.benchmarkCacheBytes).toBe(0);
      expect(existsSync(join(dir, ".memory-harness.json"))).toBe(true);
      expect(existsSync(join(dir, ".cognibrain", "connectors", "github.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("reports local JSON runtime state drivers for VS Code and memory-footprint debugging", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-resources-state-"));
    try {
      const env = { ...process.env, MEMORY_AUTO_DREAM: "false", MEMORY_DB_PATH: join(dir, ".memory-harness.json") };
      writeFileSync(join(dir, ".memory-harness.json"), JSON.stringify({
        version: 2,
        memories: [{ id: "m1", content: "Atlas memory" }],
        auditEvents: [{ id: "a1", type: "search.run" }, { id: "a2", type: "memory.write" }],
        evidencePacks: [{ id: "ctx_1", query: "Atlas", context: "x".repeat(500), results: [] }],
        maintenance: { users: {} }
      }));

      const report = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "resources", "--json"], { cwd: dir, env, encoding: "utf8" }));
      expect(report.localRuntimeState.present).toBe(true);
      expect(report.localRuntimeState.evidencePacks).toMatchObject({ name: "evidencePacks", count: 1 });
      expect(report.localRuntimeState.auditEvents).toMatchObject({ name: "auditEvents", count: 2 });
      expect(report.localRuntimeState.topArrays.map((row: { name: string }) => row.name)).toContain("evidencePacks");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("sanitizes generic OpenAI provider secrets from runtime child process environments", () => {
    const env = sanitizedRuntimeEnv({
      ...process.env,
      MEMORY_OPENAI_API_KEY: "runtime-provider-secret",
      OPENAI_API_KEY: "generic-provider-secret",
      MEMORY_API_KEY: "local-api-key"
    });
    const cliEnv = JSON.parse(execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      `import { sanitizedRuntimeEnv } from ${JSON.stringify(new URL("../bin/lib/runtimeEnv.mjs", import.meta.url).href)};
       console.log(JSON.stringify(sanitizedRuntimeEnv({
         MEMORY_OPENAI_API_KEY: "runtime-provider-secret",
         OPENAI_API_KEY: "generic-provider-secret",
         MEMORY_API_KEY: "local-api-key"
       })));`
    ], { cwd: root, encoding: "utf8" }));

    expect(env.MEMORY_OPENAI_API_KEY).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.MEMORY_API_KEY).toBe("local-api-key");
    expect(cliEnv.MEMORY_OPENAI_API_KEY).toBeUndefined();
    expect(cliEnv.OPENAI_API_KEY).toBeUndefined();
    expect(cliEnv.MEMORY_API_KEY).toBe("local-api-key");
  });

  it("does not treat memory subcommand help flags as memory content or ids", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-memory-help-"));
    try {
      const env = { ...process.env, MEMORY_AUTO_DREAM: "false", MEMORY_DB_PATH: join(dir, "memory.json") };
      const commands = [
        { args: ["memory", "add", "--help"], usage: "Usage: memctl add <content>" },
        { args: ["memories", "add", "--help"], usage: "Usage: memctl add <content>" },
        { args: ["memory", "edit", "--help"], usage: "Usage: memctl edit <memory-id> <new-content>" },
        { args: ["memory", "archive", "--help"], usage: "Usage: memctl archive <memory-id>" }
      ];

      for (const item of commands) {
        const result = spawnSync(process.execPath, [cli, "--runtime-root", dir, ...item.args], { cwd: dir, env, encoding: "utf8" });
        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toContain(item.usage);
        expect(result.stderr).toBe("");
      }

      const lifecycleAlias = spawnSync(process.execPath, [cli, "--runtime-root", dir, "memory", "patch-evidence", "--help"], { cwd: dir, env, encoding: "utf8" });
      expect(lifecycleAlias.status).toBe(0);
      expect(lifecycleAlias.stdout).toContain("cognibrain patch-evidence --user <id> --task <text>");
      expect(lifecycleAlias.stdout).toContain("legacy aliases");
      expect(lifecycleAlias.stderr).toBe("");

      const memories = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories", "--json"], { cwd: dir, env, encoding: "utf8" }));
      expect(memories.recent).toEqual([]);
      if (existsSync(join(dir, "memory.json"))) expect(readFileSync(join(dir, "memory.json"), "utf8")).not.toContain("--help");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("stores memory add CLI flags as structured provenance instead of raw content", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-memory-add-flags-"));
    try {
      const env = { ...process.env, MEMORY_AUTO_DREAM: "false", MEMORY_DB_PATH: join(dir, "memory.json") };
      const created = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "memory",
        "add",
        "Runtime footprint proof is source-backed.",
        "--source-kind",
        "tool",
        "--source-confidence",
        "0.82",
        "--source-uri",
        "file://runtime-report.json",
        "--line-start",
        "7",
        "--tags",
        "runtime,proof",
        "--metadata-json",
        "{\"proof\":\"resources\"}",
        "--source-ref-connector-id",
        "github",
        "--source-ref-external-id",
        "run-26918810816",
        "--visibility",
        "user",
        "--delete-on-request",
        "true"
      ], { cwd: dir, env, encoding: "utf8" }));

      expect(created.content).toBe("Runtime footprint proof is source-backed.");
      expect(created.content).not.toContain("--source-kind");
      expect(created.source).toMatchObject({ kind: "tool", confidence: 0.82, uri: "file://runtime-report.json", lineStart: 7 });
      expect(created.tags).toEqual(expect.arrayContaining(["runtime", "proof"]));
      expect(created.metadata).toMatchObject({ proof: "resources" });
      expect(created.consent).toMatchObject({ visibility: "user", deleteOnRequest: true });
      expect(created.provenance.citations).toContain("file://runtime-report.json:7");

      const persisted = JSON.parse(readFileSync(join(dir, "memory.json"), "utf8"));
      const saved = persisted.memories.find((memory: { id: string }) => memory.id === created.id);
      expect(saved.content).not.toContain("--source-kind");
      expect(saved.provenance.sourceRef).toMatchObject({ connectorId: "github", externalId: "run-26918810816" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("does not treat operator subcommand help flags as durable write targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-operator-help-"));
    const repoHelpScaffold = join(root, ".cognibrain", "integrations", "help");
    const listFiles = (path: string, prefix = ""): string[] => {
      if (!existsSync(path)) return [];
      return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = join(path, entry.name);
        return entry.isDirectory() ? listFiles(full, rel) : [rel];
      });
    };
    try {
      const env = {
        ...process.env,
        CODEX_HOME: join(dir, ".codex"),
        MEMORY_AUTO_DREAM: "false",
        MEMORY_DB_PATH: join(dir, "memory.json")
      };
      const commands = [
        { args: ["connector", "add", "--help"], usage: "cognibrain connector add" },
        { args: ["connector", "remove", "--help"], usage: "cognibrain connector remove" },
        { args: ["adapter", "add", "--help"], usage: "cognibrain adapter add" },
        { args: ["adapter", "remove", "--help"], usage: "cognibrain adapter remove" },
        { args: ["connections", "add", "--help"], usage: "cognibrain connections add" },
        { args: ["sdk", "platform", "--help"], usage: "cognibrain sdk platform <name>" },
        { args: ["sdk", "harness", "--help"], usage: "cognibrain sdk harness <name>" },
        { args: ["service", "install", "--help"], usage: "cognibrain service install" },
        { args: ["config", "codex", "--help"], usage: "cognibrain config <all|codex" }
      ];

      expect(existsSync(repoHelpScaffold)).toBe(false);
      for (const item of commands) {
        const result = spawnSync(process.execPath, [cli, "--runtime-root", dir, ...item.args], { cwd: root, env, encoding: "utf8" });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(item.usage);
        expect(result.stderr).toBe("");
      }

      expect(listFiles(dir)).toEqual([]);
      expect(existsSync(repoHelpScaffold)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("plans native service automation for Linux, macOS, and Windows from the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-service-"));
    try {
      const linux = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "service", "plan", "--platform", "linux", "--system", "--dashboard", "--env", "MEMORY_REQUIRE_AUTH=true", "--json"], { cwd: dir, encoding: "utf8" }));
      const macos = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "service", "plan", "--platform", "macos", "--json"], { cwd: dir, encoding: "utf8" }));
      const windows = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "service", "plan", "--platform", "windows", "--json"], { cwd: dir, encoding: "utf8" }));
      const dryRun = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "service", "install", "--platform", "windows", "--dry-run", "--json"], { cwd: dir, encoding: "utf8" }));

      expect(linux.manager).toBe("systemd");
      expect(linux.files.descriptor).toBe("/etc/systemd/system/cognibrain.service");
      expect(linux.descriptor).toContain("[Service]");
      expect(linux.descriptor).toContain("--dashboard");
      expect(linux.descriptor).toContain("Environment=\"MEMORY_REQUIRE_AUTH=true\"");
      expect(linux.commands.enable.join(" ")).toContain("systemctl");
      expect(macos.manager).toBe("launchd");
      expect(macos.descriptor).toContain("<key>ProgramArguments</key>");
      expect(macos.commands.enable.join(" ")).toContain("launchctl");
      expect(windows.manager).toBe("task-scheduler");
      expect(windows.descriptor).toContain("Set-Location");
      expect(windows.commands.enable.join(" ")).toContain("schtasks /Create");
      expect(dryRun.dryRun).toBe(true);
      expect(existsSync(join(dir, ".cognibrain", "service", "cognibrain.service.ps1"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("opens the package-style CLI home without requiring the web dashboard", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-home-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-home",
        MEMORY_AUTO_DREAM: "false"
      };
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories", "add", "The terminal CLI is the primary product surface."], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "connections", "add", "github", "--set", "repo=cognilabz/cognibrain", "--token-env", "MEMORY_GITHUB_TOKEN"], { cwd: dir, env, encoding: "utf8" });
      mkdirSync(join(dir, ".cognibrain"), { recursive: true });
      writeFileSync(join(dir, ".cognibrain", "local-runtime.json"), JSON.stringify({ api: { pid: process.pid, url: "http://127.0.0.1:8787", runtime: "source-node-import-tsx", processModel: "single-process", entrypoint: "src/api/server.ts" }, ui: {} }));

      const home = execFileSync(process.execPath, [cli, "--runtime-root", dir], { cwd: dir, env, encoding: "utf8" });
      const homeJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "--json"], { cwd: dir, env, encoding: "utf8" }));
      const tuiJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "tui", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const status = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "status", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const memoriesJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const connectionsJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "connections", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const memories = execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories"], { cwd: dir, env, encoding: "utf8" });
      const connections = execFileSync(process.execPath, [cli, "--runtime-root", dir, "connections"], { cwd: dir, env, encoding: "utf8" });

      expect(home).toContain("cognibrain");
      expect(home).toContain("Memories");
      expect(home).toContain("Connections");
      expect(home).toContain("Commands");
      expect(memories).toContain("cognibrain memories");
      expect(memories).toContain("primary product surface");
      expect(connections).toContain("cognibrain connections");
      expect(connections).toContain("github");
      expect(status.package.name).toBe("@cognilabz/cognibrain");
      expect(tuiJson.surface).toBe("operator-cli");
      expect(homeJson.service.manager).toBeTruthy();
      expect(homeJson.commands).toContain("cognibrain service plan");
      expect(homeJson.commands).toContain("cognibrain proof");
      expect(status.dashboard.optional).toBe(true);
      expect(status.runtime.dashboard.optional).toBe(true);
      expect(status.runtime.api.resources.rssMb).toBeGreaterThan(0);
      expect(status.runtime.api.resources.cpuPercent).toBeGreaterThanOrEqual(0);
      expect(status.runtime.api.runtime).toBe("source-node-import-tsx");
      expect(status.runtime.api.processModel).toBe("single-process");
      expect(memoriesJson.recent.length).toBeGreaterThan(0);
      expect(connectionsJson.connectors.configured).toContain("github");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("renders compact stable operator surfaces without animated control frames", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-operator-"));
    try {
      const env = { ...process.env, COGNIBRAIN_FORCE_INK: "true", MEMORY_AUTO_DREAM: "false", COLUMNS: "52" };
      const surfaces = [
        { args: ["config", "show"], title: "cognibrain config" },
        { args: ["connector", "list"], title: "cognibrain connectors" },
        { args: ["adapter", "list"], title: "cognibrain adapters" },
        { args: ["sdk", "list"], title: "cognibrain SDK" },
        { args: ["proof", "--no-refresh"], title: "cognibrain proof", allowFailure: true },
        { args: ["skill", "status"], title: "cognibrain skill" },
        { args: ["doctor", "--no-start", "--no-skill"], title: "cognibrain doctor" }
      ];
      for (const surface of surfaces) {
        const result = spawnSync(process.execPath, [cli, "--runtime-root", dir, ...surface.args], { cwd: dir, env, encoding: "utf8" });
        if (!surface.allowFailure) expect(result.status).toBe(0);
        const output = `${result.stdout}${result.stderr}`;
        expect(output).not.toContain("╭");
        expect(output).not.toContain("╰");
        expect(output).toContain(surface.title);
        expect(Math.max(...output.split(/\r?\n/).map((line) => line.length))).toBeLessThanOrEqual(100);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("manages setup config, connector config, adapter config, and skill status through CLI commands", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-config-"));
    const codexHome = join(dir, ".codex");
    try {
      const env = {
        ...process.env,
        CODEX_HOME: codexHome,
        MEMORY_AUTO_DREAM: "false",
        MEMORY_GITHUB_REPO: "cognilabz/cognibrain",
        MEMORY_GITHUB_TOKEN: "test-token-should-not-be-written",
        MEMORY_SENTRY_TOKEN: "test-sentry-token-should-not-be-written"
      };
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "init", "--profile", "solo-dev", "--yes", "--dry-run", "--no-start", "--no-doctor", "--no-skill", "--no-demo"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "add", "sentry", "--set", "organization=cognilabz", "--set", "project=memory", "--token-env", "MEMORY_SENTRY_TOKEN"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "add", "storage-sqlite", "--set", "path=.cognibrain/memory.sqlite"], { cwd: dir, env, encoding: "utf8" });
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "doctor", "--fix", "--no-start", "--no-skill"], { cwd: dir, env, encoding: "utf8" });

      const connectorList = execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "list"], { cwd: dir, env, encoding: "utf8" });
      const adapterList = execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "list"], { cwd: dir, env, encoding: "utf8" });
      const config = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "config", "show", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const skill = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "skill", "status", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const connectorWizard = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "wizard", "jira", "--set", "project=CB", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const adapterDoctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "doctor", "storage-sqlite"], { cwd: dir, env, encoding: "utf8" });
      const connectorDoctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "doctor", "sentry"], { cwd: dir, env, encoding: "utf8" });

      expect(connectorList).toContain("sentry");
      expect(connectorList).toContain("native drivers: 19");
      expect(adapterList).toContain("storage-sqlite");
      expect(adapterList).toContain("mcp-remote");
      expect(config.setupState.profile).toBe("solo-dev");
      expect(config.connectors.some((item: { provider: string }) => item.provider === "sentry")).toBe(true);
      expect(config.adapters.some((item: { adapter: string }) => item.adapter === "storage-sqlite")).toBe(true);
      expect(skill.installed).toBe(false);
      expect(skill.path).toContain(codexHome);
      expect(connectorWizard.preview.dryRun).toBe(true);
      expect(connectorWizard.preview.diff.some((line: string) => line.includes("official-jira"))).toBe(true);
      expect(connectorWizard.validation.credentialPolicy).toContain("never store credential values");
      expect(adapterDoctor).toContain("storage-sqlite");
      expect(connectorDoctor).toContain("sentry");
      const sentryConfig = readFileSync(join(dir, ".cognibrain", "connectors", "sentry.json"), "utf8");
      expect(sentryConfig).toContain("env:MEMORY_SENTRY_TOKEN");
      expect(sentryConfig).not.toContain("test-token-should-not-be-written");
      expect(sentryConfig).not.toContain("test-sentry-token-should-not-be-written");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("scaffolds custom platform integrations through the SDK CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-sdk-platform-"));
    try {
      const out = join(dir, "integrations", "acme");
      const dryRun = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "platform", "acme", "--kind", "project_management", "--out", out, "--dry-run"], { cwd: dir, encoding: "utf8" });
      expect(dryRun).toContain("would scaffold platform SDK: acme");
      expect(existsSync(join(out, "acme.integration.ts"))).toBe(false);

      const output = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "platform", "acme", "--kind", "project_management", "--out", out], { cwd: dir, encoding: "utf8" });
      const list = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "list"], { cwd: dir, encoding: "utf8" });
      const doctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "doctor"], { cwd: dir, encoding: "utf8" });

      expect(output).toContain("scaffolded platform SDK: acme");
      expect(list).toContain("cognibrain sdk platform");
      expect(doctor).toContain("platform SDK helpers");
      expect(readFileSync(join(out, "acme.integration.ts"), "utf8")).toContain("createPlatformIntegration");
      expect(readFileSync(join(out, "acme.integration.ts"), "utf8")).toContain("sdk/typescript/index.ts");
      expect(readFileSync(join(out, "acme.integration.ts"), "utf8")).not.toContain("src/connectors/sdk.ts");
      expect(readFileSync(join(out, "acme.connector.json"), "utf8")).toContain("\"kind\": \"project_management\"");
      expect(readFileSync(join(out, ".env.example"), "utf8")).toContain("MEMORY_ACME_TOKEN");
      expect(readFileSync(join(out, "README.md"), "utf8")).toContain("connector-register");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("scaffolds non-MCP harness integrations through the SDK CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-sdk-harness-"));
    try {
      const out = join(dir, "integrations", "external-runner");
      const dryRun = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "harness", "external-runner", "--out", out, "--dry-run"], { cwd: dir, encoding: "utf8" });
      expect(dryRun).toContain("would scaffold harness SDK: external-runner");
      expect(existsSync(join(out, "external-runner.harness.ts"))).toBe(false);

      const output = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "harness", "external-runner", "--out", out], { cwd: dir, encoding: "utf8" });
      const list = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "list"], { cwd: dir, encoding: "utf8" });
      const doctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "sdk", "doctor"], { cwd: dir, encoding: "utf8" });

      expect(output).toContain("scaffolded harness SDK: external-runner");
      expect(list).toContain("cognibrain sdk harness");
      expect(doctor).toContain("harness SDK helpers");
      expect(readFileSync(join(out, "external-runner.harness.ts"), "utf8")).toContain("CognibrainHarnessSdk");
      expect(readFileSync(join(out, "external-runner.harness.ts"), "utf8")).toContain("sdk/typescript/index.ts");
      expect(readFileSync(join(out, ".env.example"), "utf8")).toContain("MEMORY_EXTERNAL_RUNNER_USER_ID");
      expect(readFileSync(join(out, "README.md"), "utf8")).toContain("non-MCP harness");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("adds and searches memories through the publishable bin entrypoint", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-test",
        MEMORY_AUTO_DREAM: "false"
      };
      execFileSync(process.execPath, [cli, "memory", "add", "The CLI is the primary user-facing surface."], {
        cwd: root,
        env,
        encoding: "utf8"
      });
      const output = execFileSync(process.execPath, [cli, "memory", "search", "primary surface"], {
        cwd: root,
        env,
        encoding: "utf8"
      });
      expect(output).toContain("primary user-facing surface");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("exports and reloads evidence packs by context-pack id through the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-evidence-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-evidence",
        MEMORY_AUTO_DREAM: "false"
      };
      execFileSync(process.execPath, [cli, "memory", "add", "Atlas evidence packs can be reloaded by context id."], {
        cwd: root,
        env,
        encoding: "utf8"
      });
      const created = JSON.parse(execFileSync(process.execPath, [cli, "memory", "evidence-pack", "Atlas evidence packs"], {
        cwd: root,
        env,
        encoding: "utf8"
      }));
      const loaded = JSON.parse(execFileSync(process.execPath, [cli, "memory", "evidence", created.id], {
        cwd: root,
        env,
        encoding: "utf8"
      }));
      expect(loaded.id).toBe(created.id);
      expect(loaded.context).toContain("Atlas evidence packs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("explains truth decisions and context packs through operator aliases", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-explain-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-explain",
        MEMORY_PROJECT_ID: "atlas",
        MEMORY_AUTO_DREAM: "false"
      };
      const created = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "memory",
        "add",
        "Atlas cache backend is Redis."
      ], { cwd: root, env, encoding: "utf8" }));

      const truth = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "truth",
        "explain",
        "--memory",
        created.id
      ], { cwd: root, env, encoding: "utf8" }));
      expect(truth).toMatchObject({
        schemaVersion: "1.0",
        memory: { id: created.id, content: "Atlas cache backend is Redis." },
        audit: {
          command: "cognibrain truth explain --memory <id>",
          canCorrectWith: "cognibrain memory code-correction <text>"
        }
      });
      expect(truth.memory).toHaveProperty("source");
      expect(truth.memory).toHaveProperty("temporal");

      const pack = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "memory",
        "evidence-pack",
        "Atlas cache backend"
      ], { cwd: root, env, encoding: "utf8" }));
      const context = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "context",
        "explain",
        "--pack",
        pack.id
      ], { cwd: root, env, encoding: "utf8" }));
      expect(context).toMatchObject({
        schemaVersion: "1.0",
        id: pack.id,
        kind: "evidence-pack",
        query: "Atlas cache backend",
        audit: {
          command: "cognibrain context explain --pack <id>",
          whyInjectedVisible: true
        }
      });
      expect(context.injected.memoryIds).toContain(created.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("records coding corrections, guards actions, and exports patch evidence through the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-code-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-code",
        MEMORY_PROJECT_ID: "atlas",
        MEMORY_REPO: "atlas",
        MEMORY_AUTO_DREAM: "false",
        COGNIBRAIN_CLI_BACKEND: "local-direct",
        COGNIBRAIN_HARNESS_AUTOSTART: "false"
      };
      const wrong = JSON.parse(execFileSync(process.execPath, [cli, "memory", "action", "pnpm test"], {
        cwd: root,
        env: {
          ...env,
          MEMORY_EXIT_CODE: "1",
          MEMORY_FAILURE_REASON: "CI uses npm test",
          MEMORY_FILES_TOUCHED: "src/generated/api.generated.ts"
        },
        encoding: "utf8"
      }));
      const correction = JSON.parse(execFileSync(process.execPath, [cli, "memory", "code-correction", "Do not use pnpm in this repo; use npm test and do not edit generated files."], {
        cwd: root,
        env: {
          ...env,
          MEMORY_PREVIOUS_MEMORY_ID: wrong.data.id,
          MEMORY_PREVIOUS_WRONG_ACTION: "pnpm test",
          MEMORY_CORRECT_ACTION: "npm test",
          MEMORY_ENGINEERING_KIND: "repo_policy"
        },
        encoding: "utf8"
      }));
      expect(correction.data.metadata.correctionPipeline.derivedMemoryIds.length).toBeGreaterThanOrEqual(2);
      const guardResult = spawnSync(process.execPath, [cli, "memory", "action-guard", "pnpm test", "--json"], { cwd: root, env, encoding: "utf8" });
      expect(guardResult.status).toBe(3);
      const guard = JSON.parse(guardResult.stdout);
      expect(guard.type).toBe("guard");
      expect(guard.data.severity).not.toBe("allow");
      const trail = JSON.parse(execFileSync(process.execPath, [cli, "memory", "patch-evidence", "release validation"], {
        cwd: root,
        env: {
          ...env,
          MEMORY_MEMORY_IDS: [wrong.data.id, correction.data.id, ...correction.data.metadata.correctionPipeline.derivedMemoryIds].join(","),
          MEMORY_COMMANDS_RUN: "npm test"
        },
        encoding: "utf8"
      }));
      expect(trail.data.correctionsApplied.some((item: { memoryId: string }) => item.memoryId === correction.data.id)).toBe(true);
      expect(trail.data.forbiddenActionsAvoided.length).toBeGreaterThan(0);
      const procedureOnly = execFileSync(process.execPath, [cli, "memory", "search", "npm test"], {
        cwd: root,
        env: { ...env, MEMORY_ENGINEERING_KIND: "procedure" },
        encoding: "utf8"
      });
      expect(procedureOnly).toContain("Procedure");
      expect(procedureOnly).not.toContain("Forbidden action");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("runs the CLI-first lifecycle commands with stable JSON contracts and local-direct fallback", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-cli-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "harness-cli",
        MEMORY_AUTO_DREAM: "false",
        COGNIBRAIN_HARNESS_AUTOSTART: "false"
      };
      const correction = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "correction",
        "--local-direct",
        "--user",
        "harness-cli",
        "--text",
        "Use npm test, not pnpm in this repo.",
        "--wrong-action",
        "pnpm test",
        "--correct-action",
        "npm test",
        "--repo",
        "demo/harness",
        "--harness",
        "codex",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(correction.schemaVersion).toBe("1.0");
      expect(correction.ok).toBe(true);
      expect(correction.type).toBe("correction");
      expect(correction.mcpParity).toBe("memory_code_correction");
      expect(correction.backend.kind).toBe("local-direct");
      expect(correction.schema.jsonEnvelope.exitCodes.guardBlock).toBe(3);

      const context = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "context",
        "--local-direct",
        "--user",
        "harness-cli",
        "--task",
        "prepare validation patch",
        "--repo",
        "demo/harness",
        "--harness",
        "codex",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(context.ok).toBe(true);
      expect(context.type).toBe("context");
      expect(context.mcpParity).toBe("memory_coding_context_pack");
      expect(context.schema.input.apiMapping).toEqual({
        endpoint: "/coding-context-pack",
        fields: { task: "query" }
      });
      expect(context.data.query).toBe("prepare validation patch");
      expect(context.nextRecommendedCommands).toContain("cognibrain guard --action \"<command>\" --json");

      const blocked = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "guard",
        "--local-direct",
        "--user",
        "harness-cli",
        "--action",
        "pnpm test",
        "--repo",
        "demo/harness",
        "--harness",
        "codex",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" });
      expect(blocked.status).toBe(3);
      const guard = JSON.parse(blocked.stdout);
      expect(guard.type).toBe("guard");
      expect(guard.decision).toBe("block");
      expect(guard.ok).toBe(false);
      expect(guard.mcpParity).toBe("memory_action_guard");

      const harnessAlias = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "harness",
        "guard",
        "--local-direct",
        "--user",
        "harness-cli",
        "--action",
        "pnpm test",
        "--repo",
        "demo/harness",
        "--harness",
        "codex",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" });
      expect(harnessAlias.status).toBe(3);
      const harnessGuard = JSON.parse(harnessAlias.stdout);
      expect(harnessGuard.schemaVersion).toBe(guard.schemaVersion);
      expect(harnessGuard.type).toBe(guard.type);
      expect(harnessGuard.mcpParity).toBe(guard.mcpParity);

      const memoryAlias = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "memory",
        "action-guard",
        "pnpm test",
        "--local-direct",
        "--json"
      ], { cwd: dir, env: { ...env, MEMORY_REPO: "demo/harness", MEMORY_HARNESS: "codex" }, encoding: "utf8" });
      expect(memoryAlias.status).toBe(3);
      const memoryGuard = JSON.parse(memoryAlias.stdout);
      expect(memoryGuard.type).toBe("guard");
      expect(memoryGuard.mcpParity).toBe("memory_action_guard");

      const outcome = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "outcome",
        "--local-direct",
        "--user",
        "harness-cli",
        "--command",
        "npm test",
        "--exit-code",
        "0",
        "--cwd",
        dir,
        "--summary",
        "All tests passed",
        "--files",
        "src/example.ts",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(outcome.ok).toBe(true);
      expect(outcome.type).toBe("outcome");
      expect(outcome.mcpParity).toBe("memory_action_outcome");

      const patch = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "patch-evidence",
        "--local-direct",
        "--user",
        "harness-cli",
        "--task",
        "validation patch",
        "--files",
        "src/example.ts",
        "--commands",
        "npm test",
        "--memory-ids",
        [correction.data.id, outcome.data.id].join(","),
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(patch.ok).toBe(true);
      expect(patch.type).toBe("patch_evidence");
      expect(patch.mcpParity).toBe("memory_patch_evidence");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("autostarts and uses the daemon-backed lifecycle backend on first top-level call", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-daemon-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "harness-daemon",
        MEMORY_AUTO_DREAM: "false"
      };
      const health = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "health",
        "--require-daemon",
        "--user",
        "harness-daemon",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(health.ok).toBe(true);
      expect(health.backend.kind).toBe("daemon");
      expect(health.type).toBe("health");
      expect(health.mcpParity).toBe("memory_health");
    } finally {
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("sends auth headers for daemon-backed lifecycle calls", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-auth-daemon-"));
    try {
      const {
        MEMORY_API_KEY,
        COGNIBRAIN_API_KEY,
        COGNIBRAIN_API_TOKEN,
        MEMORY_BEARER_TOKEN,
        MEMORY_ACTOR_ID,
        COGNIBRAIN_ACTOR_ID,
        MEMORY_API_URL,
        COGNIBRAIN_API_URL,
        COGNIBRAIN_URL,
        COGNIBRAIN_CLI_BACKEND,
        COGNIBRAIN_HARNESS_BACKEND,
        ...baseEnv
      } = process.env;
      const env = {
        ...baseEnv,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "harness-auth",
        MEMORY_AUTO_DREAM: "false",
        MEMORY_REQUIRE_AUTH: "true",
        MEMORY_API_KEYS: "dev-secret"
      };
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "start"], { cwd: dir, env, encoding: "utf8" });
      const denied = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "context",
        "--require-daemon",
        "--user",
        "harness-auth",
        "--task",
        "prepare authenticated lifecycle context",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" });
      expect(denied.status).toBe(4);
      expect(JSON.parse(denied.stdout).errors[0].code).toBe("auth_required");

      const context = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "context",
        "--require-daemon",
        "--api-key",
        "dev-secret",
        "--user",
        "harness-auth",
        "--task",
        "prepare authenticated lifecycle context",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(context.ok).toBe(true);
      expect(context.backend.kind).toBe("daemon");
      expect(context.type).toBe("context");
      expect(context.mcpParity).toBe("memory_coding_context_pack");
    } finally {
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("fails with exit code 5 when a required daemon is unavailable", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-require-daemon-"));
    try {
      const result = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "health",
        "--require-daemon",
        "--no-autostart",
        "--json"
      ], {
        cwd: dir,
        env: {
          ...process.env,
          MEMORY_API_URL: "http://127.0.0.1:45999",
          MEMORY_AUTO_DREAM: "false"
        },
        encoding: "utf8"
      });
      expect(result.status).toBe(5);
      const payload = JSON.parse(result.stdout);
      expect(payload.ok).toBe(false);
      expect(payload.errors[0].code).toBe("daemon_unavailable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("does not silently use local-direct fallback in production security mode", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-production-daemon-"));
    try {
      const result = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "health",
        "--no-autostart",
        "--json"
      ], {
        cwd: dir,
        env: {
          ...process.env,
          MEMORY_API_URL: "http://127.0.0.1:45999",
          MEMORY_SECURITY_MODE: "production",
          MEMORY_AUTO_DREAM: "false"
        },
        encoding: "utf8"
      });
      expect(result.status).toBe(5);
      const payload = JSON.parse(result.stdout);
      expect(payload.ok).toBe(false);
      expect(payload.backend.kind).toBe("daemon");
      expect(payload.errors[0].code).toBe("daemon_unavailable");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("rejects explicit local-direct lifecycle mode in production without break-glass override", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-production-local-direct-"));
    try {
      const result = spawnSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "health",
        "--local-direct",
        "--json"
      ], {
        cwd: dir,
        env: {
          ...process.env,
          MEMORY_SECURITY_MODE: "production",
          MEMORY_AUTO_DREAM: "false"
        },
        encoding: "utf8"
      });
      expect(result.status).toBe(6);
      const payload = JSON.parse(result.stdout);
      expect(payload.ok).toBe(false);
      expect(payload.backend.kind).toBe("local-direct");
      expect(payload.backend.disabled).toBe(true);
      expect(payload.errors[0].code).toBe("local_direct_disabled_in_production");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("rejects local-direct MCP runtime mode in production without break-glass override", async () => {
    const previousEnv = {
      COGNIBRAIN_MCP_BACKEND: process.env.COGNIBRAIN_MCP_BACKEND,
      MEMORY_SECURITY_MODE: process.env.MEMORY_SECURITY_MODE,
      COGNIBRAIN_ALLOW_LOCAL_DIRECT_IN_PROD: process.env.COGNIBRAIN_ALLOW_LOCAL_DIRECT_IN_PROD
    };
    try {
      process.env.COGNIBRAIN_MCP_BACKEND = "local-direct";
      process.env.MEMORY_SECURITY_MODE = "production";
      delete process.env.COGNIBRAIN_ALLOW_LOCAL_DIRECT_IN_PROD;
      expect(() => createMcpRuntimeToolHandlers()).toThrow(/local-direct MCP backend is disabled in production/);
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("runs every harness lifecycle command against the daemon backend with the stable JSON envelope", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-all-daemon-"));
    const env = {
      ...process.env,
      MEMORY_DB_PATH: join(dir, "memory.json"),
      MEMORY_USER_ID: "harness-all-daemon",
      MEMORY_AUTO_DREAM: "false"
    };
    const envelopeKeys = [
      "schemaVersion",
      "ok",
      "type",
      "id",
      "decision",
      "data",
      "warnings",
      "errors",
      "nextRecommendedCommands",
      "backend",
      "schema",
      "mcpParity",
      "durationMs"
    ];
    const run = (args: string[]) => {
      const result = spawnSync(process.execPath, [cli, "--runtime-root", dir, ...args, "--require-daemon", "--json"], { cwd: dir, env, encoding: "utf8" });
      expect(result.stdout).toBeTruthy();
      return JSON.parse(result.stdout);
    };
    const percentile95 = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0;
    };
    try {
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "start"], { cwd: dir, env, encoding: "utf8" });
      const correction = run(["harness", "correction", "--user", "harness-all-daemon", "--text", "Use npm test, not pnpm in this repo.", "--wrong-action", "pnpm test", "--correct-action", "npm test", "--repo", "demo/harness-all"]);
      const outputs = [
        correction,
        run(["harness", "context", "--user", "harness-all-daemon", "--task", "prepare daemon parity patch", "--repo", "demo/harness-all"]),
        run(["harness", "guard", "--user", "harness-all-daemon", "--action", "npm test", "--repo", "demo/harness-all"]),
        run(["harness", "outcome", "--user", "harness-all-daemon", "--command", "npm test", "--exit-code", "0", "--summary", "daemon lifecycle passed"]),
        run(["harness", "patch-evidence", "--user", "harness-all-daemon", "--task", "daemon parity patch", "--files", "src/example.ts", "--commands", "npm test", "--memory-ids", correction.data.id]),
        run(["harness", "session-end", "--user", "harness-all-daemon"]),
        run(["harness", "handoff", "--user", "harness-all-daemon"]),
        run(["harness", "release-prepare", "--user", "harness-all-daemon", "--repo", "demo/harness-all"]),
        run(["harness", "dream-plan", "--user", "harness-all-daemon"]),
        run(["harness", "source-revalidate", "--user", "harness-all-daemon", "--limit", "5"]),
        run(["harness", "conflicts"]),
        run(["harness", "health", "--user", "harness-all-daemon"])
      ];
      expect(outputs.map((output) => output.schema.command)).toEqual([
        "correction",
        "context",
        "guard",
        "outcome",
        "patch-evidence",
        "session-end",
        "handoff",
        "release-prepare",
        "dream-plan",
        "source-revalidate",
        "conflicts",
        "health"
      ]);
      for (const output of outputs) {
        const command = output.schema.command as keyof typeof harnessCommandSchemas;
        expect(Object.keys(output)).toEqual(envelopeKeys);
        expect(output.backend.kind).toBe("daemon");
        expect(output.schemaVersion).toBe("1.0");
        expect(output.errors).toEqual([]);
        expect(output.schema.input).toEqual(harnessCommandSchemas[command]);
        expect(output.mcpParity).toBe(harnessMcpParity[command]);
      }
      expect(outputs.at(-1)?.mcpParity).toBe("memory_health");

      const latencySamples = {
        context: [
          outputs[1],
          run(["harness", "context", "--user", "harness-all-daemon", "--task", "latency budget context sample 1", "--repo", "demo/harness-all"]),
          run(["harness", "context", "--user", "harness-all-daemon", "--task", "latency budget context sample 2", "--repo", "demo/harness-all"]),
          run(["harness", "context", "--user", "harness-all-daemon", "--task", "latency budget context sample 3", "--repo", "demo/harness-all"]),
          run(["harness", "context", "--user", "harness-all-daemon", "--task", "latency budget context sample 4", "--repo", "demo/harness-all"])
        ],
        guard: [
          outputs[2],
          run(["harness", "guard", "--user", "harness-all-daemon", "--action", "npm test -- latency sample 1", "--repo", "demo/harness-all"]),
          run(["harness", "guard", "--user", "harness-all-daemon", "--action", "npm test -- latency sample 2", "--repo", "demo/harness-all"]),
          run(["harness", "guard", "--user", "harness-all-daemon", "--action", "npm test -- latency sample 3", "--repo", "demo/harness-all"]),
          run(["harness", "guard", "--user", "harness-all-daemon", "--action", "npm test -- latency sample 4", "--repo", "demo/harness-all"])
        ],
        outcome: [
          outputs[3],
          run(["harness", "outcome", "--user", "harness-all-daemon", "--command", "npm test -- latency sample 1", "--exit-code", "0", "--summary", "latency sample 1"]),
          run(["harness", "outcome", "--user", "harness-all-daemon", "--command", "npm test -- latency sample 2", "--exit-code", "0", "--summary", "latency sample 2"]),
          run(["harness", "outcome", "--user", "harness-all-daemon", "--command", "npm test -- latency sample 3", "--exit-code", "0", "--summary", "latency sample 3"]),
          run(["harness", "outcome", "--user", "harness-all-daemon", "--command", "npm test -- latency sample 4", "--exit-code", "0", "--summary", "latency sample 4"])
        ],
        correction: [
          outputs[0],
          run(["harness", "correction", "--user", "harness-all-daemon", "--text", "Latency sample 1 prefers npm test.", "--wrong-action", "pnpm test", "--correct-action", "npm test", "--repo", "demo/harness-all"]),
          run(["harness", "correction", "--user", "harness-all-daemon", "--text", "Latency sample 2 prefers npm test.", "--wrong-action", "pnpm test", "--correct-action", "npm test", "--repo", "demo/harness-all"]),
          run(["harness", "correction", "--user", "harness-all-daemon", "--text", "Latency sample 3 prefers npm test.", "--wrong-action", "pnpm test", "--correct-action", "npm test", "--repo", "demo/harness-all"]),
          run(["harness", "correction", "--user", "harness-all-daemon", "--text", "Latency sample 4 prefers npm test.", "--wrong-action", "pnpm test", "--correct-action", "npm test", "--repo", "demo/harness-all"])
        ]
      };
      expect(percentile95(latencySamples.context.map((output) => output.durationMs))).toBeLessThan(500);
      expect(percentile95(latencySamples.guard.map((output) => output.durationMs))).toBeLessThan(250);
      expect(percentile95(latencySamples.outcome.map((output) => output.durationMs))).toBeLessThan(300);
      expect(percentile95(latencySamples.correction.map((output) => output.durationMs))).toBeLessThan(300);
    } finally {
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("validates daemon-backed golden lifecycle fixtures for every harness command", () => {
    const manifestPath = join(root, "fixtures", "harness", "v1", "golden-lifecycle.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      schemaVersion: string;
      contract: string;
      fixtures: Array<{
        command: keyof typeof harnessCommandSchemas;
        args: string[];
        input: Record<string, unknown>;
        daemonResponse: { requiredPaths: string[] };
        cliOutput: { ok: boolean; type: string; decision: string; mcpParity: string };
        exitCode: number;
      }>;
    };
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-golden-"));
    const env = {
      ...process.env,
      MEMORY_DB_PATH: join(dir, "memory.json"),
      MEMORY_USER_ID: "harness-golden",
      MEMORY_AUTO_DREAM: "false"
    };
    const seenCommands: string[] = [];
    const run = (args: string[], expectedExitCode: number) => {
      const result = spawnSync(process.execPath, [cli, "--runtime-root", dir, ...args, "--require-daemon", "--json"], { cwd: dir, env, encoding: "utf8" });
      expect(result.status).toBe(expectedExitCode);
      expect(result.stdout).toBeTruthy();
      return JSON.parse(result.stdout);
    };
    const materialize = (value: unknown, replacements: Record<string, string>): unknown => {
      if (typeof value === "string") return replacements[value] ?? value;
      if (Array.isArray(value)) return value.map((item) => materialize(item, replacements));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materialize(item, replacements)]));
      return value;
    };

    try {
      expect(manifest.schemaVersion).toBe("1.0");
      expect(manifest.contract).toBe(harnessLifecycleContractVersion);
      expect([...manifest.fixtures.map((fixture) => fixture.command)].sort()).toEqual(Object.keys(harnessCommandSchemas).sort());
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "start"], { cwd: dir, env, encoding: "utf8" });

      const replacements: Record<string, string> = {};
      for (const fixture of manifest.fixtures) {
        const args = materialize(fixture.args, replacements) as string[];
        const input = materialize(fixture.input, replacements) as Record<string, unknown>;
        const output = run(args, fixture.exitCode);
        seenCommands.push(output.schema.command);

        for (const required of harnessCommandSchemas[fixture.command].required) {
          expect(input[required]).not.toBeUndefined();
        }
        for (const key of Object.keys(input)) {
          expect(harnessCommandSchemas[fixture.command].properties).toContain(key);
        }
        expect(output).toMatchObject({
          schemaVersion: "1.0",
          ok: fixture.cliOutput.ok,
          type: fixture.cliOutput.type,
          decision: fixture.cliOutput.decision,
          errors: [],
          backend: { kind: "daemon" },
          schema: {
            command: fixture.command,
            input: harnessCommandSchemas[fixture.command]
          },
          mcpParity: fixture.cliOutput.mcpParity
        });
        expect(output.mcpParity).toBe(harnessMcpParity[fixture.command]);
        expect(output.durationMs).toEqual(expect.any(Number));
        for (const path of fixture.daemonResponse.requiredPaths) {
          expect(valueAtPath(output.data, path), `${fixture.command} missing ${path}`).not.toBeUndefined();
        }
        if (fixture.command === "correction") replacements["${correctionId}"] = output.data.id;
        if (fixture.command === "context") {
          expect(output.schema.input.apiMapping).toEqual({
            endpoint: "/coding-context-pack",
            fields: { task: "query" }
          });
          expect(output.data.query).toBe(input.task);
        }
      }
      expect([...seenCommands].sort()).toEqual(Object.keys(harnessCommandSchemas).sort());
    } finally {
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("uses the daemon-backed runtime path for MCP lifecycle parity handlers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-mcp-daemon-parity-"));
    const previousEnv = {
      COGNIBRAIN_RUNTIME_ROOT: process.env.COGNIBRAIN_RUNTIME_ROOT,
      MEMORY_DB_PATH: process.env.MEMORY_DB_PATH,
      MEMORY_API_URL: process.env.MEMORY_API_URL,
      COGNIBRAIN_API_URL: process.env.COGNIBRAIN_API_URL,
      COGNIBRAIN_URL: process.env.COGNIBRAIN_URL,
      COGNIBRAIN_MCP_BACKEND: process.env.COGNIBRAIN_MCP_BACKEND,
      COGNIBRAIN_MCP_AUTOSTART: process.env.COGNIBRAIN_MCP_AUTOSTART,
      MEMORY_AUTO_DREAM: process.env.MEMORY_AUTO_DREAM
    };
    try {
      const env = {
        ...process.env,
        COGNIBRAIN_RUNTIME_ROOT: dir,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "mcp-daemon",
        MEMORY_AUTO_DREAM: "false"
      };
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "start"], { cwd: dir, env, encoding: "utf8" });
      const correction = JSON.parse(execFileSync(process.execPath, [
        cli,
        "--runtime-root",
        dir,
        "correction",
        "--require-daemon",
        "--user",
        "mcp-daemon",
        "--text",
        "Use npm test, not pnpm in this repo.",
        "--wrong-action",
        "pnpm test",
        "--correct-action",
        "npm test",
        "--repo",
        "demo/mcp-daemon",
        "--json"
      ], { cwd: dir, env, encoding: "utf8" }));
      expect(correction.backend.kind).toBe("daemon");

      process.env.COGNIBRAIN_RUNTIME_ROOT = dir;
      process.env.MEMORY_DB_PATH = join(dir, "memory.json");
      process.env.MEMORY_AUTO_DREAM = "false";
      delete process.env.MEMORY_API_URL;
      delete process.env.COGNIBRAIN_API_URL;
      delete process.env.COGNIBRAIN_URL;
      delete process.env.COGNIBRAIN_MCP_BACKEND;
      const mcpRuntime = new DaemonRuntimeClient({ root, runtimeRoot: dir });
      expect(mcpRuntime.client).toBeInstanceOf(RuntimeDaemonClient);
      const handlers = createMcpRuntimeToolHandlers({ root, runtimeRoot: dir });
      const guard = await handlers.actionGuard({
        userId: "mcp-daemon",
        action: "pnpm test",
        codebaseScope: { repo: "demo/mcp-daemon" }
      }) as { severity?: string };
      expect(guard.severity).toBe("block");
      const health = await handlers.health({ userId: "mcp-daemon" }) as { active?: number };
      expect(health.active).toBeGreaterThan(0);
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("shares state between a spawned MCP process and the HTTP daemon", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-mcp-process-parity-"));
    const env = {
      ...process.env,
      COGNIBRAIN_RUNTIME_ROOT: dir,
      MEMORY_DB_PATH: join(dir, "memory.json"),
      MEMORY_USER_ID: "mcp-process",
      MEMORY_AUTO_DREAM: "false"
    };
    let client: Client | undefined;
    try {
      execFileSync(process.execPath, [cli, "--runtime-root", dir, "start"], { cwd: dir, env, encoding: "utf8" });
      const runtime = JSON.parse(readFileSync(join(dir, ".cognibrain", "local-runtime.json"), "utf8"));
      const apiUrl = runtime.api.url as string;
      client = new Client({ name: "cognibrain-cli-test", version: "1.0.0" });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [cli, "--runtime-root", dir, "mcp"],
        cwd: dir,
        env,
        stderr: "pipe"
      });
      await client.connect(transport);

      const mcpWrite = await client.callTool({
        name: "memory_add",
        arguments: {
          userId: "mcp-process",
          content: "MCP process writes are visible through the HTTP daemon.",
          sourceKind: "tool",
          sourceConfidence: 0.91
        }
      });
      const mcpCreated = mcpJson(mcpWrite) as { id: string };
      const httpSearch = await httpJson(`${apiUrl}/search`, {
        userId: "mcp-process",
        query: "MCP process HTTP daemon",
        limit: 5
      });
      expect(searchMemoryIds(httpSearch)).toContain(mcpCreated.id);

      const httpCreated = await httpJson(`${apiUrl}/memories`, {
        userId: "mcp-process",
        content: "HTTP daemon writes are visible through the MCP process.",
        source: { kind: "tool", confidence: 0.92 }
      });
      const mcpRead = await client.callTool({
        name: "memory_search",
        arguments: {
          userId: "mcp-process",
          query: "HTTP daemon MCP process",
          limit: 5
        }
      });
      const mcpResults = mcpJson(mcpRead) as Array<{ id: string }>;
      expect(searchMemoryIds(mcpResults)).toContain((httpCreated as { id: string }).id);
    } finally {
      await client?.close();
      try {
        execFileSync(process.execPath, [cli, "--runtime-root", dir, "stop"], { cwd: dir, env, encoding: "utf8" });
      } catch {
        // best-effort cleanup
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("generates reviewable harness packages for all supported connector targets", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-"));
    const codexHome = join(dir, ".codex");
    try {
      execFileSync(process.execPath, [cli, "setup", "--all-harnesses", "--no-start", "--no-doctor"], {
        cwd: dir,
        env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
        encoding: "utf8"
      });

      const expected = [
        join(codexHome, "skills", "cognibrain", "SKILL.md"),
        join(codexHome, "config.toml"),
        join(dir, "AGENTS.md"),
        join(dir, ".mcp.json"),
        join(dir, ".claude", "settings.json"),
        join(dir, ".github", "copilot-instructions.md"),
        join(dir, ".github", "instructions", "cognibrain.instructions.md"),
        join(dir, ".cursor", "mcp.json"),
        join(dir, ".cursor", "rules", "open-memory.mdc"),
        join(dir, ".vscode", "mcp.json"),
        join(dir, ".vscode", "settings.json"),
        join(dir, ".opencode", "cognibrain.md"),
        join(dir, ".openclaw", "cognibrain.md"),
        join(dir, "langgraph.cognibrain.json"),
        join(dir, "langgraph-cognibrain.ts"),
        join(dir, "crewai.cognibrain.json"),
        join(dir, "crewai_cognibrain.py"),
        join(dir, ".windsurf", "rules", "cognibrain.md"),
        join(dir, ".continue", "rules", "cognibrain.md"),
        join(dir, ".aider.conf.yml"),
        join(dir, ".aider", "cognibrain.md"),
        join(dir, ".roo", "mcp.json"),
        join(dir, ".clinerules", "cognibrain.md"),
        join(dir, ".goose", "config.yaml"),
        join(dir, ".goose", "cognibrain.md"),
        join(dir, ".amp", "cognibrain.md"),
        join(dir, ".devin", "cognibrain.json"),
        join(dir, ".devin", "cognibrain.md"),
        join(dir, ".cognibrain-harness-package.json")
      ];
      for (const path of expected) expect(existsSync(path), path).toBe(true);

      expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(readFileSync(join(root, "templates", "codex", "AGENTS.md"), "utf8"));
      expect(readFileSync(join(dir, ".cursor", "rules", "open-memory.mdc"), "utf8")).toBe(readFileSync(join(root, "templates", "cursor", "open-memory.mdc"), "utf8"));
      expect(readFileSync(join(dir, ".github", "copilot-instructions.md"), "utf8")).toBe(readFileSync(join(root, "templates", "copilot", "copilot-instructions.md"), "utf8"));
      expect(readFileSync(join(dir, ".opencode", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "opencode", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".openclaw", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "openclaw", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, "langgraph-cognibrain.ts"), "utf8")).toBe(readFileSync(join(root, "templates", "langgraph", "langgraph-cognibrain.ts"), "utf8"));
      expect(readFileSync(join(dir, "crewai_cognibrain.py"), "utf8")).toBe(readFileSync(join(root, "templates", "crewai", "crewai_cognibrain.py"), "utf8"));
      expect(readFileSync(join(dir, "langgraph-cognibrain.ts"), "utf8")).toContain("/coding-context-pack");
      expect(readFileSync(join(dir, "langgraph-cognibrain.ts"), "utf8")).toContain("/code/action-guard");
      expect(readFileSync(join(dir, "langgraph-cognibrain.ts"), "utf8")).toContain("/patch-evidence");
      expect(readFileSync(join(dir, "crewai_cognibrain.py"), "utf8")).toContain("/coding-context-pack");
      expect(readFileSync(join(dir, "crewai_cognibrain.py"), "utf8")).toContain("/code/action-guard");
      expect(readFileSync(join(dir, "crewai_cognibrain.py"), "utf8")).toContain("/patch-evidence");
      expect(readFileSync(join(dir, ".windsurf", "rules", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "windsurf", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".continue", "rules", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "continue", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".aider", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "aider", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".clinerules", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "roo-cline", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".goose", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "goose", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".amp", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "sourcegraph-amp", "cognibrain.md"), "utf8"));
      expect(readFileSync(join(dir, ".devin", "cognibrain.md"), "utf8")).toBe(readFileSync(join(root, "templates", "devin-style", "cognibrain.md"), "utf8"));
      const claude = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
      expect(claude).toContain(root);
      expect(claude).not.toContain("/ABSOLUTE/PATH/TO/cognibrain");
      const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
      expect(Object.keys(manifest.harnesses)).toEqual(["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "roo-cline", "goose", "sourcegraph-amp", "devin-style"]);
      expect(manifest.harnesses.copilot.feedback).toContain("accepted_change");
      expect(manifest.harnesses.langgraph.feedback).toContain("tool outcome telemetry");
      expect(manifest.harnesses.crewai.feedback).toContain("tool outcome telemetry");
      expect(manifest.harnesses.windsurf.protocol).toBe("cli-lifecycle");
      expect(manifest.harnesses.windsurf.feedback).toContain("cognibrain guard");
      expect(manifest.harnesses.opencode.mcpConfig).toBeUndefined();
      expect(manifest.harnesses.continue.mcpConfig).toBeUndefined();
      expect(manifest.harnesses["roo-cline"].feedback).toContain("correction capture");
      const vscodeMcp = JSON.parse(readFileSync(join(dir, ".vscode", "mcp.json"), "utf8"));
      expect(vscodeMcp.servers.cognibrain.args.join(" ")).toContain("lightweightMcpServer.mjs");
      const vscodeSettings = JSON.parse(readFileSync(join(dir, ".vscode", "settings.json"), "utf8"));
      const heavyGeneratedExcludes = [
        "**/.cognibrain/**",
        "**/.memory-harness.json",
        "**/.venv/**",
        "**/__pycache__/**",
        "**/.pytest_cache/**",
        "**/.next/**",
        "**/artifacts/**",
        "**/coverage/**",
        "**/data/benchmarks/**",
        "**/node_modules/**",
        "**/operator-ui/.next/**",
        "**/playwright-report/**",
        "**/test-results/**"
      ];
      for (const pattern of heavyGeneratedExcludes) {
        expect(vscodeSettings["files.watcherExclude"][pattern], pattern).toBe(true);
        expect(vscodeSettings["search.exclude"][pattern], pattern).toBe(true);
      }
      expect(vscodeSettings["typescript.disableAutomaticTypeAcquisition"]).toBe(true);
      expect(vscodeSettings["typescript.preferences.includePackageJsonAutoImports"]).toBe("off");
      expect(vscodeSettings["typescript.suggest.autoImports"]).toBe(false);
      expect(vscodeSettings["javascript.suggest.autoImports"]).toBe(false);
      expect(vscodeSettings["npm.autoDetect"]).toBe("off");
      expect(vscodeSettings["task.autoDetect"]).toBe("off");
      expect(vscodeSettings["python.analysis.indexing"]).toBe(false);
      expect(vscodeSettings["python.analysis.autoImportCompletions"]).toBe(false);
      expect(vscodeSettings["python.analysis.exclude"]).toEqual(expect.arrayContaining([
        "**/.cognibrain/**",
        "**/artifacts/**",
        "**/data/benchmarks/**",
        "**/node_modules/**"
      ]));
      expect(vscodeSettings["typescript.tsserver.maxTsServerMemory"]).toBe(1024);
      expect(vscodeSettings["typescript.tsserver.experimental.enableProjectDiagnostics"]).toBe(false);
      expect(vscodeSettings["typescript.tsserver.watchOptions"].excludeDirectories).toEqual(expect.arrayContaining([
        "**/.cognibrain",
        "**/artifacts",
        "**/data/benchmarks",
        "**/dist",
        "**/node_modules",
        "**/operator-ui/.next"
      ]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("writes reviewable sidecars when refreshing existing cognibrain integration instructions", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-harness-refresh-"));
    const codexHome = join(dir, ".codex");
    try {
      writeFileSync(join(dir, "AGENTS.md"), "# cognibrain\n\nOld cognibrain instructions.\n");
      execFileSync(process.execPath, [cli, "config", "codex"], {
        cwd: dir,
        env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
        encoding: "utf8"
      });

      expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain("Old cognibrain instructions");
      expect(readFileSync(join(dir, "AGENTS.md.cognibrain"), "utf8")).toContain("context --task");
      execFileSync(process.execPath, [cli, "config", "codex", "--refresh"], {
        cwd: dir,
        env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
        encoding: "utf8"
      });
      expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toContain("context --task");
      const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
      expect(manifest.harnesses.codex).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("offers an npx-style connector installer for individual harnesses", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-connect-"));
    const codexHome = join(dir, ".codex");
    try {
      const output = execFileSync(process.execPath, [connectCli, "claude-code", "--no-start", "--no-doctor"], {
        cwd: dir,
        env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
        encoding: "utf8"
      });

      expect(output).toContain("cognibrain connector package ready for claude-code");
      expect(output).toContain("doctor --publish");
      expect(existsSync(join(dir, ".mcp.json"))).toBe(true);
      expect(existsSync(join(dir, ".claude", "settings.json"))).toBe(true);
      const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
      expect(manifest.harnesses.claude.feedback).toContain("memory feedback-injection");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("offers package-style installers for OpenCode, OpenClaw, LangGraph, CrewAI, and common coding harnesses", () => {
    for (const target of ["opencode", "openclaw", "langgraph", "crewai", "windsurf", "continue", "aider", "roo-cline", "goose", "sourcegraph-amp", "devin-style"]) {
      const dir = mkdtempSync(join(tmpdir(), `cognibrain-connect-${target}-`));
      const codexHome = join(dir, ".codex");
      try {
        const output = execFileSync(process.execPath, [connectCli, target, "--no-start", "--no-doctor"], {
          cwd: dir,
          env: { ...process.env, CODEX_HOME: codexHome, MEMORY_AUTO_DREAM: "false" },
          encoding: "utf8"
        });

        expect(output).toContain(`cognibrain connector package ready for ${target}`);
        expect(output).toContain("doctor --publish");
        const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
        expect(manifest.harnesses[target]).toBeDefined();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }, slowCliTimeout);
});

function mcpJson(result: Awaited<ReturnType<Client["callTool"]>>): unknown {
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("MCP result did not include text content");
  return JSON.parse(text);
}

function searchMemoryIds(result: unknown): string[] {
  return (result as Array<{ id?: string; memory?: { id?: string } }>).map((item) => item.id ?? item.memory?.id).filter(Boolean) as string[];
}

async function httpJson(url: string, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response.json();
}
