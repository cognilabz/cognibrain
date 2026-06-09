import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pythonSdkContractTimeout = 30_000;

describe("cognibrain Python SDK", () => {
  it("passes the stdlib Python client contract tests", () => {
    const result = spawnSync("python3", ["sdk/python/tests/test_cognibrain_client.py"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, PYTHONPATH: resolve(root, "sdk/python") }
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("OK");
  }, pythonSdkContractTimeout);
});
