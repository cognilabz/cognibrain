import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
});
