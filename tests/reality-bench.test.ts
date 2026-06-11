import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRealityClaimPublishableSystem, realityClaimGate } from "../src/eval/reality/claimGate";
import { freezeRealityManifest, loadRealityManifest } from "../src/eval/reality/manifest";
import { publishRealityEvidenceTable } from "../src/eval/reality/report";
import { runRealityBenchmark } from "../src/eval/reality/runner";
import type { RealityManifestLock, RealitySystemResult } from "../src/eval/reality/types";

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

  it("fails closed when shared budget proof is omitted", () => {
    const systems = [
      publishableRealitySystem("cognibrain", "Cognibrain"),
      publishableRealitySystem("mem0", "Mem0"),
      publishableRealitySystem("langmem", "LangMem")
    ];

    const missingBudgetGate = realityClaimGate({
      lock: manifestLock,
      systems,
      publicArtifactHash: "artifact-sha256",
      independentReplicationHash: "replication-sha256",
      sameJudge: true
    });
    const provenBudgetGate = realityClaimGate({
      lock: manifestLock,
      systems,
      publicArtifactHash: "artifact-sha256",
      independentReplicationHash: "replication-sha256",
      sameJudge: true,
      sameBudgets: true
    });

    expect(missingBudgetGate.gates.sameBudgets).toBe(false);
    expect(missingBudgetGate.marketClaimAllowed).toBe(false);
    expect(missingBudgetGate.qualityClaimAllowed).toBe(false);
    expect(missingBudgetGate.blockers).toContain("All systems must use the same preregistered budgets.");
    expect(provenBudgetGate.gates.sameBudgets).toBe(true);
    expect(provenBudgetGate.marketClaimAllowed).toBe(true);
    expect(provenBudgetGate.qualityClaimAllowed).toBe(true);
  });

  it("rejects publishable rows that still carry blockers or errors", () => {
    const clean = publishableRealitySystem("mem0", "Mem0");
    const staleBlocked = publishableRealitySystem("mem0", "Mem0", {
      blockingReasons: ["Stale report retained a blocker."],
      errors: ["Stale report retained an error."]
    });

    expect(isRealityClaimPublishableSystem(clean, manifestLock.sha256)).toBe(true);
    expect(isRealityClaimPublishableSystem(staleBlocked, manifestLock.sha256)).toBe(false);
  });
});

const manifestLock: RealityManifestLock = {
  schemaVersion: "1.0",
  protocol: "emrp-v1",
  manifestPath: "benchmarks/reality/emrp-v1.jsonl",
  frozenAt: "2026-06-11T00:00:00.000Z",
  taskCount: 3,
  taskBuckets: {
    "repeat-mistake": 1,
    "stale-update": 1,
    "forbidden-action": 1,
    "patch-evidence": 0,
    "source-citation": 0,
    "privacy-deletion": 0,
    abstention: 0,
    "public-memory-qa": 0
  },
  sha256: "manifest-sha256"
};

function publishableRealitySystem(
  system: string,
  displayName: string,
  overrides: Partial<Pick<RealitySystemResult, "blockingReasons" | "errors">> = {}
): RealitySystemResult {
  return {
    system,
    displayName,
    adapterKind: "official-cli",
    adapterSource: `${system}:test`,
    provenance: {
      originalCommandExecuted: true,
      rawOutputsFromOriginalCommand: true,
      sharedJudgeTrace: true,
      deterministicScaffold: false,
      manifestSha256: manifestLock.sha256,
      inputStreamSha256: manifestLock.sha256
    },
    leaderboardEligible: true,
    qualityClaimAllowed: true,
    marketClaimAllowed: true,
    blockingReasons: overrides.blockingReasons ?? [],
    versions: { cli: "1.0.0" },
    metrics: {
      score: 1,
      expectedEvidenceRecall: 1,
      forbiddenLeakageRate: 0,
      actionAccuracy: 1,
      p50LatencyMs: 10,
      p95LatencyMs: 20,
      estimatedCostUsd: 0.01
    },
    rawOutputsPath: `artifacts/reality/raw/${system}.jsonl`,
    scorerTracePath: `artifacts/reality/scorer/${system}.jsonl`,
    errors: overrides.errors ?? []
  };
}
