import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOperatorMemoryBenchmark } from "../src/eval/operatorMemoryBenchmark";

const operatorMemoryBenchmarkTimeout = 30_000;

describe("operator-memory market proof boundary", () => {
  it("runs the operator memory dream benchmark and blocks unsupported market claims", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-"));
    const report = await runOperatorMemoryBenchmark({
      out: join(dir, "operator-memory-benchmark.json"),
      markdown: join(dir, "operator-memory-benchmark.md")
    });
    expect(report.passed).toBe(true);
    expect(report.diagnosticPassed).toBe(true);
    expect(report.proof).toBe("local-diagnostic");
    expect(report.qualityClaimAllowed).toBe(false);
    expect(report.marketClaimAllowed).toBe(false);
    expect(report.claimBoundary.scorer).toBe("operator-memory-local-check-diagnostic");
    expect(report.claimBoundary.claimBlockers[0]).toContain("deterministic diagnostics only");
    expect(report.judge.kind).toBe("missing");
    expect(report.summary.localBaselineSuperiority).toBe(true);
    expect(report.summary.cognibrainScore).toBeGreaterThan(report.summary.bestBaselineScore);
    expect(report.summary.cognibrainScore).toBeGreaterThanOrEqual(0.55);
    expect(report.summary.marketSuperiorityClaimAllowed).toBe(false);
    expect(report.summary.marketSuperiorityBlockers.length).toBeGreaterThan(0);
    expect(report.marketProofGate.status).toBe("blocked");
    expect(report.marketProofGate.checks.publicArtifactHash).toBe(false);
    expect(report.marketProofGate.checks.liveConnectorProofHash).toBe(false);
    expect(report.marketProofGate.checks.vendorOrIndependentProof).toBe(false);
    expect(report.marketProofGate.blockers.join(" ")).toContain("MEMORY_OPERATOR_MEMORY_PUBLIC_ARTIFACT_HASH");
    const markdown = readFileSync(join(dir, "operator-memory-benchmark.md"), "utf8");
    expect(markdown).toContain("Operator Memory Dream Benchmark");
    expect(markdown).toContain("Quality claim allowed: no");
    expect(markdown).toContain("Market proof gate: `blocked`");
    expect(markdown).toContain("Local operator-memory scores are diagnostics only");
  }, operatorMemoryBenchmarkTimeout);

  it("operator-memory market proof gate requires artifact hashes instead of boolean proof flags", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-operator-memory-market-gate-"));
    const previousIndependent = process.env.MEMORY_OPERATOR_MEMORY_INDEPENDENT_PROOF;
    const previousLive = process.env.MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF;
    const previousPublicHash = process.env.MEMORY_OPERATOR_MEMORY_PUBLIC_ARTIFACT_HASH;
    const previousReplicationHash = process.env.MEMORY_OPERATOR_MEMORY_INDEPENDENT_REPLICATION_HASH;
    const previousLiveHash = process.env.MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF_HASH;
    const previousVendorHash = process.env.MEMORY_OPERATOR_MEMORY_VENDOR_SIGNED_ARTIFACT_HASH;
    const previousProtocol = process.env.MEMORY_OPERATOR_MEMORY_THIRD_PARTY_PROTOCOL;
    const previousBudgets = process.env.MEMORY_OPERATOR_MEMORY_PREREGISTERED_BUDGETS;
    try {
      process.env.MEMORY_OPERATOR_MEMORY_INDEPENDENT_PROOF = "true";
      process.env.MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF = "true";
      delete process.env.MEMORY_OPERATOR_MEMORY_PUBLIC_ARTIFACT_HASH;
      delete process.env.MEMORY_OPERATOR_MEMORY_INDEPENDENT_REPLICATION_HASH;
      delete process.env.MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF_HASH;
      delete process.env.MEMORY_OPERATOR_MEMORY_VENDOR_SIGNED_ARTIFACT_HASH;
      delete process.env.MEMORY_OPERATOR_MEMORY_THIRD_PARTY_PROTOCOL;
      delete process.env.MEMORY_OPERATOR_MEMORY_PREREGISTERED_BUDGETS;

      const report = await runOperatorMemoryBenchmark({
        out: join(dir, "operator-memory-market-gate.json"),
        markdown: join(dir, "operator-memory-market-gate.md")
      });

      expect(report.marketClaimAllowed).toBe(false);
      expect(report.marketProofGate.status).toBe("blocked");
      expect(report.marketProofGate.inputs.publicArtifactHash).toBeUndefined();
      expect(report.marketProofGate.inputs.independentReplicationHash).toBeUndefined();
      expect(report.marketProofGate.inputs.liveConnectorProofHash).toBeUndefined();
      expect(report.marketProofGate.checks.publicArtifactHash).toBe(false);
      expect(report.marketProofGate.checks.liveConnectorProofHash).toBe(false);
      expect(report.marketProofGate.checks.vendorOrIndependentProof).toBe(false);
      expect(report.marketProofGate.blockers).toEqual(expect.arrayContaining([
        "MEMORY_OPERATOR_MEMORY_PUBLIC_ARTIFACT_HASH must be a 64-character artifact hash",
        "MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF_HASH must identify a credentialed GitHub/Jira/Confluence/Notion tenant proof artifact",
        "MEMORY_OPERATOR_MEMORY_INDEPENDENT_REPLICATION_HASH or MEMORY_OPERATOR_MEMORY_VENDOR_SIGNED_ARTIFACT_HASH must be a 64-character proof hash"
      ]));
    } finally {
      restoreEnv("MEMORY_OPERATOR_MEMORY_INDEPENDENT_PROOF", previousIndependent);
      restoreEnv("MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF", previousLive);
      restoreEnv("MEMORY_OPERATOR_MEMORY_PUBLIC_ARTIFACT_HASH", previousPublicHash);
      restoreEnv("MEMORY_OPERATOR_MEMORY_INDEPENDENT_REPLICATION_HASH", previousReplicationHash);
      restoreEnv("MEMORY_OPERATOR_MEMORY_LIVE_CONNECTOR_PROOF_HASH", previousLiveHash);
      restoreEnv("MEMORY_OPERATOR_MEMORY_VENDOR_SIGNED_ARTIFACT_HASH", previousVendorHash);
      restoreEnv("MEMORY_OPERATOR_MEMORY_THIRD_PARTY_PROTOCOL", previousProtocol);
      restoreEnv("MEMORY_OPERATOR_MEMORY_PREREGISTERED_BUDGETS", previousBudgets);
    }
  }, operatorMemoryBenchmarkTimeout);
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
