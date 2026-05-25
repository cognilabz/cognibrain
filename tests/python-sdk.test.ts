import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("cognibrain Python SDK", () => {
  it("passes the stdlib Python client contract tests", () => {
    const result = spawnSync("python3", ["-m", "unittest", "discover", "-s", "sdk/python/tests"], {
      cwd: root,
      encoding: "utf8"
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(0);
    expect(output).toContain("OK");
  });
});
