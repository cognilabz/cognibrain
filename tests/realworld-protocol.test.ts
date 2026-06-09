import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("real-world benchmark protocol", () => {
  it("publishes concrete market proof blockers instead of stale broad leaderboard language", () => {
    const dir = join("artifacts", `tmp-realworld-protocol-${process.pid}-${Date.now()}`);
    const out = join(dir, "realworld-benchmark-protocol.json");
    const markdown = join(dir, "realworld-benchmark-protocol.md");
    try {
      execFileSync(process.execPath, [
        "scripts/benchmark/benchmark-realworld-protocol.mjs",
        "--out",
        out,
        "--markdown",
        markdown
      ], { cwd: process.cwd(), encoding: "utf8" });

      const report = JSON.parse(readFileSync(join(process.cwd(), out), "utf8"));
    expect(report.marketProofGate).toMatchObject({
      minThirdPartyTasks: 30,
      runtimeGate: "src/eval/realworldBlackbox.ts"
    });
    expect(report.marketProofGate.required).toEqual(expect.arrayContaining([
      "public immutable artifact hash for the exact judged run",
      "independent replication artifact hash",
      "third-party protocol with at least 30 tasks",
      "preregistered latency and cost budgets"
    ]));
    expect(report.marketProofGate.sourceEnv).toEqual(expect.arrayContaining([
      "MEMORY_REALWORLD_PUBLIC_ARTIFACT_HASH",
      "MEMORY_REALWORLD_INDEPENDENT_REPLICATION_HASH",
      "MEMORY_REALWORLD_THIRD_PARTY_TASK_COUNT"
    ]));
    expect(report.thirdPartyOssSourceEvidence).toMatchObject({
      present: true,
      eventCount: 3,
      queryCount: 30,
      sourceCount: 3
    });
    expect(report.currentArtifacts.find((artifact: any) => artifact.path === "artifacts/realworld-blackbox.json")?.missingForLeaderboard).toEqual(expect.arrayContaining(report.marketProofGate.required));
      expect(readFileSync(join(process.cwd(), markdown), "utf8")).toContain("public immutable artifact hash");
    } finally {
      rmSync(join(process.cwd(), dir), { recursive: true, force: true });
    }
  });
});
