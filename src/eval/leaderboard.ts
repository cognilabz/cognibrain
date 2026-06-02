import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface LeaderboardArtifact {
  schemaVersion: "1.0";
  generatedAt: string;
  project: "cognibrain";
  privacy: {
    anonymized: boolean;
    noRawPrompts: boolean;
    noRawEvidence: boolean;
  };
  entries: Array<{
    suite: string;
    category: "retrieval" | "answer_generation" | "vendor_claim" | "engineering_memory";
    metric: string;
    score: number;
    artifact: string;
    proof: "local-diagnostic" | "llm-harness" | "public-benchmark";
    claimAllowed: boolean;
    claimClass: "diagnostic-only" | "artifact-quality" | "market-comparison";
    methodology: Record<string, unknown>;
    notes: string[];
  }>;
  publication: {
    anonymized: boolean;
    claimScope: string;
  };
}

export function buildLeaderboardArtifact(options: { nextgenPath?: string; evaluationPath?: string; answerGenerationPath?: string; marketGatePath?: string; cognicodePath?: string; arenaPath?: string; outputPath?: string } = {}): LeaderboardArtifact {
  const nextgenPath = options.nextgenPath ?? "artifacts/nextgen-benchmarks.json";
  const evaluationPath = options.evaluationPath ?? "artifacts/evaluation-report.json";
  const answerGenerationPath = options.answerGenerationPath ?? "artifacts/answer-generation.json";
  const marketGatePath = options.marketGatePath ?? "artifacts/market-gate.json";
  const cognicodePath = options.cognicodePath ?? "artifacts/cognicodebench/run.json";
  const arenaPath = options.arenaPath ?? "artifacts/arena/run.json";
  const entries: LeaderboardArtifact["entries"] = [];
  if (existsSync(nextgenPath)) {
    const report = JSON.parse(readFileSync(nextgenPath, "utf8"));
    for (const suite of report.suites ?? []) {
      entries.push(diagnosticEntry({
        suite: String(suite.id),
        category: "retrieval",
        metric: "suite_score",
        score: Number(suite.score),
        artifact: nextgenPath,
        methodology: { dataset: "deterministic-fixture", topK: 3 },
        notes: ["Deterministic fixture suite; no user data included."]
      }));
    }
  }
  if (existsSync(evaluationPath)) {
    const report = JSON.parse(readFileSync(evaluationPath, "utf8"));
    entries.push(diagnosticEntry({
      suite: "synthetic-retrieval",
      category: "retrieval",
      metric: "accuracy",
      score: Number(report.ours?.accuracy ?? 0),
      artifact: evaluationPath,
      methodology: { dataset: "synthetic", topK: 4 },
      notes: ["Local synthetic gate calibrated for compact retrieval context."]
    }));
  }
  if (existsSync(answerGenerationPath)) {
    const artifact = JSON.parse(readFileSync(answerGenerationPath, "utf8"));
    for (const dataset of artifact.datasets ?? []) {
      const judgedByHarness = !String(dataset.judge ?? "").startsWith("deterministic-");
      entries.push({
        suite: String(dataset.dataset),
        category: "answer_generation",
        metric: String(dataset.metric ?? "answer_generation_quality"),
        score: Number(dataset.score ?? 0),
        artifact: answerGenerationPath,
        proof: judgedByHarness ? "llm-harness" : "local-diagnostic",
        claimAllowed: judgedByHarness,
        claimClass: judgedByHarness ? "artifact-quality" : "diagnostic-only",
        methodology: { ...(dataset.methodology ?? {}), judgeContract: judgedByHarness ? "external-provider-command" : "deterministic-coverage-diagnostic" },
        notes: [
          `answerer=${dataset.answerer}`,
          `judge=${dataset.judge}`,
          `${dataset.total ?? 0} per-question rows`,
          judgedByHarness ? "LLM/harness judged artifact score." : "Deterministic coverage diagnostic; not a quality claim."
        ]
      });
    }
  }
  if (existsSync(cognicodePath)) {
    const report = JSON.parse(readFileSync(cognicodePath, "utf8"));
    entries.push(diagnosticEntry({
      suite: "cognicodebench",
      category: "engineering_memory",
      metric: "engineering_memory_score",
      score: Number(report.ablation?.cognibrain_full?.score ?? averageCogniCodeScore(report)),
      artifact: cognicodePath,
      methodology: {
        dataset: "synthetic-codebase-scenarios",
        scenarios: Number(report.scenarioCount ?? 0),
        baselines: (report.methodology?.baselines ?? []).slice?.(0, 8) ?? []
      },
      notes: [
        "Measures whether coding agents carry corrections, procedures, tool outcomes, and codebase changes into the next patch.",
        `correctionCarryover=${Number(report.metrics?.correctionCarryoverRate ?? 0)}`,
        `repeatedMistakeRate=${Number(report.metrics?.repeatedMistakeRate ?? 1)}`
      ]
    }));
  }
  if (existsSync(arenaPath)) {
    const report = JSON.parse(readFileSync(arenaPath, "utf8"));
    const cognibrain = (report.systems ?? []).find((system: { system?: string }) => system.system === "cognibrain");
    entries.push(diagnosticEntry({
      suite: "benchmark-arena",
      category: "engineering_memory",
      metric: "same_scenario_score",
      score: Number(cognibrain?.score ?? 0),
      artifact: arenaPath,
      methodology: {
        dataset: "cognicodebench-scenario-stream",
        systems: (report.systems ?? []).map((system: { displayName?: string; proofLevel?: string }) => ({ system: system.displayName, proofLevel: system.proofLevel })),
        adapterContract: report.adapterContract?.lifecycle ?? []
      },
      notes: [
        "Cognibrain row is same-run-full.",
        "Competitor rows require their own proof levels; same-run-api-shape is not a vendor certification.",
        `winner=${report.winner ?? ""}`
      ]
    }));
  }
  if (existsSync(marketGatePath)) {
    const gate = JSON.parse(readFileSync(marketGatePath, "utf8"));
    for (const comparison of gate.directMarketComparison?.comparisons ?? []) {
      entries.push({
        suite: `${comparison.dataset}:${comparison.competitor}`,
        category: "vendor_claim",
        metric: String(comparison.metric),
        score: Number(comparison.ours),
        artifact: marketGatePath,
        proof: "public-benchmark",
        claimAllowed: true,
        claimClass: "market-comparison",
        methodology: { comparable: true, sourceUrl: comparison.sourceUrl },
        notes: [`competitor=${comparison.competitor}`, `margin=${comparison.margin}`]
      });
    }
  }
  const artifact: LeaderboardArtifact = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    project: "cognibrain",
    privacy: {
      anonymized: true,
      noRawPrompts: true,
      noRawEvidence: true
    },
    entries,
    publication: {
      anonymized: true,
      claimScope: "Diagnostic scores are not quality or market claims. Quality claims require LLM/harness proof; market comparisons require comparable public benchmark artifacts."
    }
  };
  validateLeaderboardArtifact(artifact);
  const outputPath = options.outputPath ?? "artifacts/leaderboard.json";
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}

function averageCogniCodeScore(report: { scenarios?: Array<{ score?: number }> }): number {
  const scores = (report.scenarios ?? []).map((scenario) => Number(scenario.score ?? 0));
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
}

function diagnosticEntry(input: Omit<LeaderboardArtifact["entries"][number], "proof" | "claimAllowed" | "claimClass">): LeaderboardArtifact["entries"][number] {
  return {
    ...input,
    proof: "local-diagnostic",
    claimAllowed: false,
    claimClass: "diagnostic-only",
    notes: [...input.notes, "Diagnostic-only local score; not a quality or market claim."]
  };
}

export function validateLeaderboardArtifact(artifact: LeaderboardArtifact): true {
  if (artifact.schemaVersion !== "1.0") throw new Error("Unsupported leaderboard schema.");
  if (!artifact.privacy?.anonymized || !artifact.privacy?.noRawPrompts || !artifact.privacy?.noRawEvidence) throw new Error("Leaderboard privacy metadata is incomplete.");
  if (!artifact.publication.anonymized) throw new Error("Leaderboard artifacts must be anonymized.");
  assertNoRawDataKeys(artifact);
  for (const entry of artifact.entries) {
    if (!entry.suite || !entry.metric || !Number.isFinite(entry.score)) throw new Error("Invalid leaderboard entry.");
    if (entry.score < 0 || entry.score > 1) throw new Error(`Leaderboard score out of range for ${entry.suite}.`);
    if (entry.proof === "local-diagnostic" && entry.claimAllowed) throw new Error(`Local diagnostic entry ${entry.suite} cannot allow quality claims.`);
    if (entry.claimAllowed && entry.proof !== "llm-harness" && entry.proof !== "public-benchmark") throw new Error(`Claimed entry ${entry.suite} lacks LLM/harness or public benchmark proof.`);
    if (entry.claimAllowed && entry.claimClass === "diagnostic-only") throw new Error(`Claimed entry ${entry.suite} is marked diagnostic-only.`);
    if (!entry.claimAllowed && entry.claimClass !== "diagnostic-only") throw new Error(`Unclaimed entry ${entry.suite} must be diagnostic-only.`);
    if (entry.category === "vendor_claim" && entry.methodology.comparable !== true) throw new Error(`Vendor claim ${entry.suite} lacks comparable methodology metadata.`);
  }
  return true;
}

function assertNoRawDataKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const isPrivacyFlag = /^noRaw(Prompts|Evidence)$/i.test(key);
    if (!isPrivacyFlag && /raw(prompt|query|evidence|transcript|memory|content)/i.test(key)) {
      throw new Error(`Leaderboard artifacts cannot include ${key}.`);
    }
    assertNoRawDataKeys(child);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const artifact = buildLeaderboardArtifact({ outputPath: outIndex >= 0 ? process.argv[outIndex + 1] : undefined });
  console.log(JSON.stringify(artifact, null, 2));
}
