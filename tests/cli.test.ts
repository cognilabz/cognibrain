import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "cognibrain.mjs");
const connectCli = join(root, "bin", "cognibrain-connect.mjs");
const slowCliTimeout = 30_000;

describe("cognibrain CLI", () => {
  it("prints the one-command surface", () => {
    const output = execFileSync(process.execPath, [cli, "help"], { cwd: root, encoding: "utf8" });
    expect(output).toContain("cognibrain\n      Open the React/Ink CLI home");
    expect(output).toContain("cognibrain setup");
    expect(output).toContain("cognibrain doctor");
    expect(output).toContain("cognibrain memories");
    expect(output).toContain("cognibrain connections");
    expect(output).toContain("cognibrain proof|truth");
    expect(output).toContain("cognibrain service");
    expect(output).toContain("cognibrain memory search");
    expect(output).toContain("React/Ink guided");
    expect(output).toContain("azure-devops");
    expect(output).toContain("cognibrain adapter list");
    expect(output).toContain("cognibrain skill install|status|doctor|path");
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

      const home = execFileSync(process.execPath, [cli, "--runtime-root", dir], { cwd: dir, env, encoding: "utf8" });
      const homeJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "--json"], { cwd: dir, env, encoding: "utf8" }));
      const status = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "status", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const memoriesJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const connectionsJson = JSON.parse(execFileSync(process.execPath, [cli, "--runtime-root", dir, "connections", "--json"], { cwd: dir, env, encoding: "utf8" }));
      const memories = execFileSync(process.execPath, [cli, "--runtime-root", dir, "memories"], { cwd: dir, env, encoding: "utf8" });
      const connections = execFileSync(process.execPath, [cli, "--runtime-root", dir, "connections"], { cwd: dir, env, encoding: "utf8" });

      expect(home).toContain("COGNIBRAIN");
      expect(home).toContain("WORKBENCHES");
      expect(home).toContain("One-command control plane");
      expect(home).toContain("ACTION PALETTE");
      expect(home).toContain("Snapshot mode");
      expect(memories).toContain("cognibrain memories");
      expect(memories).toContain("primary product surface");
      expect(connections).toContain("cognibrain connections");
      expect(connections).toContain("github");
      expect(status.package.name).toBe("@cognilabz/cognibrain");
      expect(homeJson.service.manager).toBeTruthy();
      expect(homeJson.commands).toContain("cognibrain service plan");
      expect(homeJson.commands).toContain("cognibrain proof");
      expect(status.dashboard.optional).toBe(true);
      expect(status.runtime.dashboard.optional).toBe(true);
      expect(memoriesJson.recent.length).toBeGreaterThan(0);
      expect(connectionsJson.connectors.configured).toContain("github");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, slowCliTimeout);

  it("renders graphical Ink workbenches for the product surfaces", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-ink-"));
    try {
      const env = { ...process.env, COGNIBRAIN_FORCE_INK: "true", MEMORY_AUTO_DREAM: "false" };
      const surfaces = [
        { args: ["config", "show"], title: "cognibrain config" },
        { args: ["connector", "list"], title: "cognibrain connectors" },
        { args: ["adapter", "list"], title: "cognibrain adapters" },
        { args: ["sdk", "list"], title: "cognibrain SDK" },
        { args: ["proof", "--no-refresh"], title: "cognibrain proof" },
        { args: ["skill", "status"], title: "cognibrain skill" },
        { args: ["doctor", "--no-start", "--no-skill"], title: "cognibrain doctor" }
      ];
      for (const surface of surfaces) {
        const output = execFileSync(process.execPath, [cli, "--runtime-root", dir, ...surface.args], { cwd: dir, env, encoding: "utf8" });
        expect(output).toContain("╭");
        expect(output).toContain("╰");
        expect(output).toContain(surface.title);
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
      const adapterDoctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "adapter", "doctor", "storage-sqlite"], { cwd: dir, env, encoding: "utf8" });
      const connectorDoctor = execFileSync(process.execPath, [cli, "--runtime-root", dir, "connector", "doctor", "sentry"], { cwd: dir, env, encoding: "utf8" });

      expect(connectorList).toContain("sentry");
      expect(connectorList).toContain("posthog");
      expect(adapterList).toContain("storage-sqlite");
      expect(adapterList).toContain("mcp-remote");
      expect(config.setupState.profile).toBe("solo-dev");
      expect(config.connectors.some((item: { provider: string }) => item.provider === "sentry")).toBe(true);
      expect(config.adapters.some((item: { adapter: string }) => item.adapter === "storage-sqlite")).toBe(true);
      expect(skill.installed).toBe(false);
      expect(skill.path).toContain(codexHome);
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
      expect(readFileSync(join(out, "acme.connector.json"), "utf8")).toContain("\"kind\": \"project_management\"");
      expect(readFileSync(join(out, ".env.example"), "utf8")).toContain("MEMORY_ACME_TOKEN");
      expect(readFileSync(join(out, "README.md"), "utf8")).toContain("connector-register");
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

  it("records coding corrections, guards actions, and exports patch evidence through the CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-cli-code-"));
    try {
      const env = {
        ...process.env,
        MEMORY_DB_PATH: join(dir, "memory.json"),
        MEMORY_USER_ID: "cli-code",
        MEMORY_PROJECT_ID: "atlas",
        MEMORY_REPO: "atlas",
        MEMORY_AUTO_DREAM: "false"
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
          MEMORY_PREVIOUS_MEMORY_ID: wrong.id,
          MEMORY_PREVIOUS_WRONG_ACTION: "pnpm test",
          MEMORY_CORRECT_ACTION: "npm test",
          MEMORY_ENGINEERING_KIND: "repo_policy"
        },
        encoding: "utf8"
      }));
      expect(correction.metadata.correctionPipeline.derivedMemoryIds.length).toBeGreaterThanOrEqual(2);
      const guard = JSON.parse(execFileSync(process.execPath, [cli, "memory", "action-guard", "pnpm test"], { cwd: root, env, encoding: "utf8" }));
      expect(guard.severity).not.toBe("allow");
      const trail = JSON.parse(execFileSync(process.execPath, [cli, "memory", "patch-evidence", "release validation"], {
        cwd: root,
        env: {
          ...env,
          MEMORY_MEMORY_IDS: [wrong.id, correction.id, ...correction.metadata.correctionPipeline.derivedMemoryIds].join(","),
          MEMORY_COMMANDS_RUN: "npm test"
        },
        encoding: "utf8"
      }));
      expect(trail.correctionsApplied.some((item: { memoryId: string }) => item.memoryId === correction.id)).toBe(true);
      expect(trail.forbiddenActionsAvoided.length).toBeGreaterThan(0);
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
        join(dir, ".opencode", "mcp.json"),
        join(dir, ".opencode", "cognibrain.md"),
        join(dir, ".openclaw", "mcp.json"),
        join(dir, ".openclaw", "cognibrain.md"),
        join(dir, "langgraph.cognibrain.json"),
        join(dir, "langgraph-cognibrain.ts"),
        join(dir, "crewai.cognibrain.json"),
        join(dir, "crewai_cognibrain.py"),
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
      const claude = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
      expect(claude).toContain(root);
      expect(claude).not.toContain("/ABSOLUTE/PATH/TO/cognibrain");
      const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
      expect(Object.keys(manifest.harnesses)).toEqual(["codex", "claude", "copilot", "cursor", "vscode", "opencode", "openclaw", "langgraph", "crewai"]);
      expect(manifest.harnesses.copilot.feedback).toContain("accepted_change");
      expect(manifest.harnesses.langgraph.feedback).toContain("tool outcome telemetry");
      expect(manifest.harnesses.crewai.feedback).toContain("tool outcome telemetry");
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

  it("offers package-style installers for OpenCode, OpenClaw, LangGraph, and CrewAI", () => {
    for (const target of ["opencode", "openclaw", "langgraph", "crewai"]) {
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
