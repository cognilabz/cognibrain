import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateRealWorldBlackBoxBenchmark } from "../src/eval/realworldBlackbox";

const marketEnv = [
  "MEMORY_REALWORLD_PUBLIC_ARTIFACT_HASH",
  "MEMORY_REALWORLD_INDEPENDENT_REPLICATION_HASH",
  "MEMORY_REALWORLD_THIRD_PARTY_PROTOCOL",
  "MEMORY_REALWORLD_THIRD_PARTY_TASK_COUNT",
  "MEMORY_REALWORLD_PREREGISTERED_COST_LATENCY_BUDGETS"
] as const;

describe("real-world market benchmark gate", () => {
  it("opens real-world market leaderboard eligibility only with public hash and independent replication proof", async () => {
    const previous = snapshotEnv([
      "MEMORY_REALWORLD_JUDGE_COMMAND",
      "MEMORY_REALWORLD_JUDGE_KIND",
      "MEMORY_REALWORLD_BASICMEMORY_COMMAND",
      "MEMORY_REALWORLD_LANGMEM_COMMAND",
      ...marketEnv
    ]);
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-realworld-market-open-"));
    const judgePath = join(dir, "judge.mjs");
    const competitorPath = join(dir, "competitor.mjs");
    writeFileSync(
      judgePath,
      `let input = ""; process.stdin.on("data", chunk => input += chunk); process.stdin.on("end", () => { const payload = JSON.parse(input); const decisions = payload.manifest.queries.map(query => ({ queryId: query.id, score: 1, passed: true, supportsAnswer: query.expectedEvidenceIds.length > 0, abstained: query.shouldAbstain === true, leakedForbiddenEvidence: false, reason: "fixture independent harness decision", confidence: 0.99 })); console.log(JSON.stringify({ decisions, judge: "fixture-market-open" })); });`
    );
    writeFileSync(
      competitorPath,
      `
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  const rawOutputs = payload.manifest.queries.map(query => {
    const ids = query.expectedEvidenceIds.slice(0, query.topK);
    return {
      queryId: query.id,
      retrievedEvidenceIds: ids,
      retrievedText: ids.map(id => "fixture independently replicated evidence " + id),
      latencyMs: 1,
      raw: { queryId: query.id, system: payload.system }
    };
  });
  console.log(JSON.stringify({
    schemaVersion: "1.0",
    system: payload.system,
    displayName: payload.system,
    qualityClaimAllowed: true,
    judge: { kind: "harness", status: "passed", reason: "fixture judged external command" },
    metrics: { score: 1, recall: 1, abstentionPrecision: 1, forbiddenLeakageRate: 0, p50LatencyMs: 1, p95LatencyMs: 1, ingestLatencyMs: 1, estimatedCostUsd: 0 },
    rawOutputs,
    setup: { runner: "fixture-original-command" }
  }));
});
`
    );
    try {
      process.env.MEMORY_REALWORLD_JUDGE_COMMAND = `${process.execPath} ${judgePath}`;
      process.env.MEMORY_REALWORLD_JUDGE_KIND = "harness";
      process.env.MEMORY_REALWORLD_BASICMEMORY_COMMAND = `${process.execPath} ${competitorPath}`;
      process.env.MEMORY_REALWORLD_LANGMEM_COMMAND = `${process.execPath} ${competitorPath}`;
      process.env.MEMORY_REALWORLD_PUBLIC_ARTIFACT_HASH = "a".repeat(64);
      process.env.MEMORY_REALWORLD_INDEPENDENT_REPLICATION_HASH = "b".repeat(64);
      process.env.MEMORY_REALWORLD_THIRD_PARTY_PROTOCOL = "true";
      process.env.MEMORY_REALWORLD_THIRD_PARTY_TASK_COUNT = "30";
      process.env.MEMORY_REALWORLD_PREREGISTERED_COST_LATENCY_BUDGETS = "true";

      const report = await generateRealWorldBlackBoxBenchmark({
        out: join(dir, "realworld-market-open.json"),
        systems: ["cognibrain", "basicmemory", "langmem", "keyword"]
      });

      expect(report.comparativeSmokeEligible).toBe(true);
      expect(report.leaderboardEligible).toBe(true);
      expect(report.marketClaimAllowed).toBe(true);
      expect(report.status).toBe("market-leaderboard-eligible");
      expect(report.eligibilityGate).toMatchObject({
        publicArtifactHashPresent: true,
        thirdPartyProtocolReady: true,
        independentReplicationPresent: true,
        preregisteredCostLatencyBudgets: true
      });
      expect(report.runProvenance.marketProof).toMatchObject({
        publicArtifactHash: "a".repeat(64),
        independentReplicationHash: "b".repeat(64),
        thirdPartyProtocol: true,
        thirdPartyTaskCount: 30,
        preregisteredCostLatencyBudgets: true
      });
      expect(report.leaderboardEligibleSystems).toEqual(expect.arrayContaining(["cognibrain", "basicmemory", "langmem"]));
      expect(report.systems.filter((system) => system.leaderboardEligible).map((system) => system.system)).toEqual(expect.arrayContaining(["cognibrain", "basicmemory", "langmem"]));
      expect(report.claimBoundary).toMatchObject({
        proof: "realworld-market-leaderboard-proof",
        claimAllowed: true,
        leaderboardEligible: true,
        marketClaimAllowed: true
      });
      expect(report.claimBoundary.claimBlockers).toEqual([]);
    } finally {
      restoreEnv(previous);
    }
  }, 30_000);
});

function snapshotEnv(names: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
