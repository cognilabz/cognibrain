import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freezeRealityManifest, loadRealityManifest } from "../src/eval/reality/manifest";
import { publishRealityEvidenceTable } from "../src/eval/reality/report";
import { runRealityBenchmark } from "../src/eval/reality/runner";

describe("EMRP Reality Bench", () => {
  it("freezes and verifies a hash-locked manifest", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-reality-manifest-"));
    try {
      const manifestPath = join(dir, "emrp-v1.jsonl");
      const lockPath = join(dir, "emrp-v1.lock.json");
      const frozen = freezeRealityManifest({ manifestPath, lockPath, count: 16, frozenAt: "2026-06-11T00:00:00.000Z" });
      const loaded = loadRealityManifest(manifestPath, lockPath);

      expect(frozen.lock.protocol).toBe("emrp-v1");
      expect(loaded.tasks).toHaveLength(16);
      expect(loaded.lock.sha256).toBe(frozen.lock.sha256);
      expect(Object.values(loaded.lock.taskBuckets).reduce((sum, count) => sum + count, 0)).toBe(16);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps Reality Bench evidence-table-only until strict market gates pass", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-reality-run-"));
    try {
      const reportPath = join(dir, "report.json");
      const markdownPath = join(dir, "report.md");
      const evidenceDir = join(dir, "evidence");
      const publicDir = join(dir, "public");
      const report = runRealityBenchmark({
        outPath: reportPath,
        markdownPath,
        evidenceDir,
        systems: ["cognibrain", "mem0", "keyword", "profile-model"]
      });
      const published = publishRealityEvidenceTable({ inputPath: reportPath, outputDir: publicDir });

      expect(report.taskCount).toBe(60);
      expect(report.claimGate.marketClaimAllowed).toBe(false);
      expect(report.publication.status).toBe("evidence-table-only");
      expect(report.systems.find((system) => system.system === "mem0")?.adapterKind).toBe("credential-blocked");
      expect(report.systems.find((system) => system.system === "profile-model")?.adapterKind).toBe("profile-model-forbidden");
      expect(report.systems.find((system) => system.system === "profile-model")?.blockingReasons[0]).toContain("capability-modeled");
      expect(report.systems.find((system) => system.system === "cognibrain")?.rawOutputsPath).toBeTruthy();
      expect(report.claimGate.blockers).toEqual(expect.arrayContaining([
        "Capability-profile adapters are forbidden for public comparison claims.",
        "At least two major original competitor systems must be eligible."
      ]));
      expect(published.marketClaimAllowed).toBe(false);
      expect(existsSync(join(publicDir, "index.json"))).toBe(true);
      expect(report.publication.leaderboardPath).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
