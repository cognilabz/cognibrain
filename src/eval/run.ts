import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryStore, ReflectionEngine, RetrievalEngine } from "../core";
import { benchmarkCases, benchmarkMemories } from "./fixtures";
import { evaluateRetriever, keywordOnly, recencyOnly, vectorOnly } from "./baselines";

export function runEvaluation() {
  const store = new MemoryStore();
  store.seed(benchmarkMemories);
  new ReflectionEngine(store).run("bench");
  const retrieval = new RetrievalEngine(store);
  const memories = store.list("bench");
  const ours = evaluateRetriever("cognibrain", benchmarkCases, (query, limit) =>
    retrieval.search({ userId: "bench", query, limit }).map((result) => result.memory)
  );
  const baselines = [
    evaluateRetriever("vector-only", benchmarkCases, vectorOnly(memories)),
    evaluateRetriever("keyword-only", benchmarkCases, keywordOnly(memories)),
    evaluateRetriever("recency-only", benchmarkCases, recencyOnly(memories))
  ];
  const bestBaseline = Math.max(...baselines.map((item) => item.accuracy));
  const marketGate = {
    name: "synthetic-token-efficiency-threshold",
    reference: "Local synthetic diagnostic calibrated for high retrieval accuracy with a compact context budget. Direct market claims live in benchmark:market and require LLM/harness or comparable public-benchmark proof.",
    requiredAccuracy: 0.94,
    requiredMeanTokensUnder: 900
  };
  const diagnosticPassed = ours.accuracy > bestBaseline && ours.accuracy >= marketGate.requiredAccuracy && ours.meanTokens < marketGate.requiredMeanTokensUnder;
  const claimBoundary = {
    proof: "local-diagnostic" as const,
    scorer: "deterministic-expected-id-substring-diagnostic",
    judge: { kind: "missing" as const, requiredForQualityClaim: true },
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    claimBlockers: [
      "Synthetic fixture expected-id substring scoring is diagnostic only.",
      "Set a neutral LLM/harness judge or comparable public-benchmark artifact before quality or market claims."
    ]
  };
  const report = {
    passed: diagnosticPassed,
    diagnosticPassed,
    generatedAt: new Date().toISOString(),
    marketGate,
    claimBoundary,
    ours,
    baselines
  };
  mkdirSync(resolve("artifacts"), { recursive: true });
  writeFileSync(resolve("artifacts/evaluation-report.json"), JSON.stringify(report, null, 2));
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runEvaluation();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
