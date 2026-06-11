import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRealityClaimPublishableSystem, realityClaimGate } from "../src/eval/reality/claimGate";
import { freezeRealityManifest, loadRealityManifest } from "../src/eval/reality/manifest";
import { publishRealityEvidenceTable } from "../src/eval/reality/report";
import { runRealityBenchmark } from "../src/eval/reality/runner";
import type { RealityManifestLock, RealityReport, RealitySystemResult } from "../src/eval/reality/types";

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
      publicArtifactHash: publicArtifactHash,
      independentReplicationHash: independentReplicationHash,
      sameJudge: true,
      sameJudgeProof: sameJudgeTraceId
    });
    const provenBudgetGate = realityClaimGate({
      lock: manifestLock,
      systems,
      publicArtifactHash: publicArtifactHash,
      independentReplicationHash: independentReplicationHash,
      sameJudge: true,
      sameJudgeProof: sameJudgeTraceId,
      sameBudgets: true,
      sameBudgetsProof: sameBudgetsProof
    });

    expect(missingBudgetGate.gates.sameBudgets).toBe(false);
    expect(missingBudgetGate.marketClaimAllowed).toBe(false);
    expect(missingBudgetGate.qualityClaimAllowed).toBe(false);
    expect(missingBudgetGate.blockers).toContain("All systems must use the same preregistered budgets.");
    expect(provenBudgetGate.gates.sameBudgets).toBe(true);
    expect(provenBudgetGate.marketClaimAllowed).toBe(true);
    expect(provenBudgetGate.qualityClaimAllowed).toBe(true);
  });

  it("requires proof hashes to be SHA-256 shaped before market claims can open", () => {
    const systems = [
      publishableRealitySystem("cognibrain", "Cognibrain"),
      publishableRealitySystem("mem0", "Mem0"),
      publishableRealitySystem("langmem", "LangMem")
    ];
    const invalidProofGate = realityClaimGate({
      lock: manifestLock,
      systems,
      publicArtifactHash: "artifact-sha256",
      independentReplicationHash: "replication-sha256",
      sameJudge: true,
      sameJudgeProof: sameJudgeTraceId,
      sameBudgets: true,
      sameBudgetsProof: sameBudgetsProof
    });

    expect(invalidProofGate.gates.publicArtifactHashPresent).toBe(false);
    expect(invalidProofGate.gates.independentReplicationHashPresent).toBe(false);
    expect(invalidProofGate.marketClaimAllowed).toBe(false);
    expect(invalidProofGate.blockers).toEqual(expect.arrayContaining([
      "A public immutable artifact hash is required.",
      "An independent replication hash is required."
    ]));
  });

  it("requires judge and budget proof ids to be SHA-256 shaped before claims can open", () => {
    const systems = [
      publishableRealitySystem("cognibrain", "Cognibrain"),
      publishableRealitySystem("mem0", "Mem0"),
      publishableRealitySystem("langmem", "LangMem")
    ];
    const invalidOperationalProofGate = realityClaimGate({
      lock: manifestLock,
      systems,
      publicArtifactHash,
      independentReplicationHash,
      sameJudge: true,
      sameJudgeProof: "judge-trace-sha256",
      sameBudgets: true,
      sameBudgetsProof: "budget-proof-sha256"
    });

    expect(invalidOperationalProofGate.gates.sameJudge).toBe(false);
    expect(invalidOperationalProofGate.gates.sameBudgets).toBe(false);
    expect(invalidOperationalProofGate.qualityClaimAllowed).toBe(false);
    expect(invalidOperationalProofGate.marketClaimAllowed).toBe(false);
    expect(invalidOperationalProofGate.leaderboardAllowed).toBe(false);
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

  it("refuses to publish reports with mismatched manifest hashes", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-reality-mismatch-"));
    try {
      const reportPath = join(dir, "report.json");
      const markdownPath = join(dir, "report.md");
      const evidenceDir = join(dir, "evidence");
      const publicDir = join(dir, "public");
      const report = runRealityBenchmark({ outPath: reportPath, markdownPath, evidenceDir, systems: ["cognibrain", "keyword"] });
      report.manifestHash = "stale-report-manifest-hash";
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      expect(() => publishRealityEvidenceTable({ inputPath: reportPath, outputDir: publicDir })).toThrow(
        "Reality report manifestHash must be a SHA-256 hash matching manifestLock.sha256"
      );
      expect(existsSync(join(publicDir, "index.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed manifest hashes even when provenance repeats them", () => {
    const fakeLock: RealityManifestLock = { ...manifestLock, sha256: "manifest-sha256" };
    const systems = [
      publishableRealitySystem("cognibrain", "Cognibrain", {}, fakeLock.sha256),
      publishableRealitySystem("mem0", "Mem0", {}, fakeLock.sha256),
      publishableRealitySystem("langmem", "LangMem", {}, fakeLock.sha256)
    ];
    const malformedManifestGate = realityClaimGate({
      lock: fakeLock,
      systems,
      publicArtifactHash,
      independentReplicationHash,
      sameJudge: true,
      sameJudgeProof: sameJudgeTraceId,
      sameBudgets: true,
      sameBudgetsProof
    });

    expect(malformedManifestGate.gates.manifestFrozenBeforeRun).toBe(false);
    expect(malformedManifestGate.qualityClaimAllowed).toBe(false);
    expect(malformedManifestGate.marketClaimAllowed).toBe(false);
    expect(malformedManifestGate.leaderboardAllowed).toBe(false);
  });

  it("rejects malformed or future frozen manifest timestamps", () => {
    const systems = [
      publishableRealitySystem("cognibrain", "Cognibrain"),
      publishableRealitySystem("mem0", "Mem0"),
      publishableRealitySystem("langmem", "LangMem")
    ];
    const malformedFrozenGate = realityClaimGate({
      lock: { ...manifestLock, frozenAt: "not-a-timestamp" },
      systems,
      publicArtifactHash,
      independentReplicationHash,
      sameJudge: true,
      sameJudgeProof: sameJudgeTraceId,
      sameBudgets: true,
      sameBudgetsProof
    });

    expect(malformedFrozenGate.gates.manifestFrozenBeforeRun).toBe(false);
    expect(malformedFrozenGate.qualityClaimAllowed).toBe(false);
    expect(malformedFrozenGate.marketClaimAllowed).toBe(false);
    expect(malformedFrozenGate.leaderboardAllowed).toBe(false);
  });

  it("refuses to publish reports frozen after generation time", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-reality-future-freeze-"));
    try {
      const reportPath = join(dir, "report.json");
      const publicDir = join(dir, "public");
      const report = {
        schemaVersion: "1.0",
        protocol: "emrp-v1",
        generatedAt: "2026-06-11T00:00:00.000Z",
        manifestHash: manifestLock.sha256,
        manifestLock: { ...manifestLock, frozenAt: "2026-06-12T00:00:00.000Z" },
        taskCount: manifestLock.taskCount,
        systems: [publishableRealitySystem("cognibrain", "Cognibrain")],
        claimEvidence: {
          publicArtifactHash,
          independentReplicationHash,
          sameJudgeTraceId,
          sameBudgetsProof
        },
        claimGate: realityClaimGate({
          lock: { ...manifestLock, frozenAt: "2026-06-12T00:00:00.000Z" },
          systems: [publishableRealitySystem("cognibrain", "Cognibrain")],
          publicArtifactHash,
          independentReplicationHash,
          sameJudge: true,
          sameJudgeProof: sameJudgeTraceId,
          sameBudgets: true,
          sameBudgetsProof
        }),
        publication: {
          evidenceTablePath: join(publicDir, "index.json"),
          leaderboardPath: null,
          status: "evidence-table-only"
        }
      } satisfies RealityReport;
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      expect(() => publishRealityEvidenceTable({ inputPath: reportPath, outputDir: publicDir })).toThrow(
        "Reality report manifestLock.frozenAt must be an ISO timestamp at or before generatedAt"
      );
      expect(existsSync(join(publicDir, "index.json"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("publishes validated market-proof hashes in Reality artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-reality-proof-hashes-"));
    try {
      const reportPath = join(dir, "report.json");
      const publicDir = join(dir, "public");
      const report = {
        schemaVersion: "1.0",
        protocol: "emrp-v1",
        generatedAt: "2026-06-11T00:00:00.000Z",
        manifestHash: manifestLock.sha256,
        manifestLock,
        taskCount: manifestLock.taskCount,
        systems: [publishableRealitySystem("cognibrain", "Cognibrain")],
        claimEvidence: {
          publicArtifactHash,
          independentReplicationHash,
          sameJudgeTraceId,
          sameBudgetsProof
        },
        claimGate: realityClaimGate({
          lock: manifestLock,
          systems: [publishableRealitySystem("cognibrain", "Cognibrain")],
          publicArtifactHash,
          independentReplicationHash,
          sameJudge: true,
          sameJudgeProof: sameJudgeTraceId,
          sameBudgets: true,
          sameBudgetsProof
        }),
        publication: {
          evidenceTablePath: join(publicDir, "index.json"),
          leaderboardPath: null,
          status: "evidence-table-only"
        }
      } satisfies RealityReport;
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

      publishRealityEvidenceTable({ inputPath: reportPath, outputDir: publicDir });
      const artifact = JSON.parse(readFileSync(join(publicDir, "index.json"), "utf8"));
      const markdown = readFileSync(join(publicDir, "index.md"), "utf8");

      expect(artifact.claimEvidence.publicArtifactHash).toBe(publicArtifactHash);
      expect(artifact.claimEvidence.independentReplicationHash).toBe(independentReplicationHash);
      expect(artifact.claimEvidence.sameJudgeTraceId).toBe(sameJudgeTraceId);
      expect(artifact.claimEvidence.sameBudgetsProof).toBe(sameBudgetsProof);
      expect(markdown).toContain(`Public artifact hash: \`${publicArtifactHash}\``);
      expect(markdown).toContain(`Independent replication hash: \`${independentReplicationHash}\``);
      expect(markdown).toContain(`Same judge proof: \`${sameJudgeTraceId}\``);
      expect(markdown).toContain(`Same budgets proof: \`${sameBudgetsProof}\``);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

const publicArtifactHash = `sha256:${"a".repeat(64)}`;
const independentReplicationHash = "b".repeat(64);
const sameJudgeTraceId = "c".repeat(64);
const sameBudgetsProof = `sha256:${"d".repeat(64)}`;

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
  sha256: "e".repeat(64)
};

function publishableRealitySystem(
  system: string,
  displayName: string,
  overrides: Partial<Pick<RealitySystemResult, "blockingReasons" | "errors">> = {},
  manifestSha256 = manifestLock.sha256
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
      manifestSha256,
      inputStreamSha256: manifestSha256
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
