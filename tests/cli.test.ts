import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const cli = join(root, "bin", "cognibrain.mjs");

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

  it("generates reviewable harness packages for Codex, Claude, Copilot, and Cursor", () => {
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
        join(dir, ".cognibrain-harness-package.json")
      ];
      for (const path of expected) expect(existsSync(path), path).toBe(true);

      expect(readFileSync(join(dir, "AGENTS.md"), "utf8")).toBe(readFileSync(join(root, "templates", "codex", "AGENTS.md"), "utf8"));
      expect(readFileSync(join(dir, ".cursor", "rules", "open-memory.mdc"), "utf8")).toBe(readFileSync(join(root, "templates", "cursor", "open-memory.mdc"), "utf8"));
      expect(readFileSync(join(dir, ".github", "copilot-instructions.md"), "utf8")).toBe(readFileSync(join(root, "templates", "copilot", "copilot-instructions.md"), "utf8"));
      const claude = readFileSync(join(dir, ".claude", "settings.json"), "utf8");
      expect(claude).toContain(root);
      expect(claude).not.toContain("/ABSOLUTE/PATH/TO/cognibrain");
      const manifest = JSON.parse(readFileSync(join(dir, ".cognibrain-harness-package.json"), "utf8"));
      expect(Object.keys(manifest.harnesses)).toEqual(["codex", "claude", "copilot", "cursor"]);
      expect(manifest.harnesses.copilot.feedback).toContain("accepted_change");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
