import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "cognibrain.mjs");
const connectCli = join(root, "bin", "cognibrain-connect.mjs");

describe("cognibrain CLI", () => {
  it("prints the one-command surface", () => {
    const output = execFileSync(process.execPath, [cli, "help"], { cwd: root, encoding: "utf8" });
    expect(output).toContain("cognibrain setup");
    expect(output).toContain("cognibrain doctor");
    expect(output).toContain("cognibrain memory search");
  });

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
  });

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
  });

  it("generates reviewable harness packages for all nextplan connector targets", () => {
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
  });

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
  });

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
  });
});
