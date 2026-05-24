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
    metric: string;
    score: number;
    artifact: string;
    proof: "local-deterministic" | "public-benchmark";
    notes: string[];
  }>;
  publication: {
    anonymized: boolean;
    claimScope: string;
  };
}

export function buildLeaderboardArtifact(options: { nextgenPath?: string; evaluationPath?: string; outputPath?: string } = {}): LeaderboardArtifact {
  const nextgenPath = options.nextgenPath ?? "artifacts/nextgen-benchmarks.json";
  const evaluationPath = options.evaluationPath ?? "artifacts/evaluation-report.json";
  const entries: LeaderboardArtifact["entries"] = [];
  if (existsSync(nextgenPath)) {
    const report = JSON.parse(readFileSync(nextgenPath, "utf8"));
    for (const suite of report.suites ?? []) {
      entries.push({ suite: String(suite.id), metric: "suite_score", score: Number(suite.score), artifact: nextgenPath, proof: "local-deterministic", notes: ["Deterministic fixture suite; no user data included."] });
    }
  }
  if (existsSync(evaluationPath)) {
    const report = JSON.parse(readFileSync(evaluationPath, "utf8"));
    entries.push({ suite: "synthetic-retrieval", metric: "accuracy", score: Number(report.ours?.accuracy ?? 0), artifact: evaluationPath, proof: "local-deterministic", notes: ["Local synthetic gate calibrated for compact retrieval context."] });
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
      claimScope: "Scores describe the listed artifact and metric only; direct vendor comparisons require comparable imported artifacts."
    }
  };
  validateLeaderboardArtifact(artifact);
  const outputPath = options.outputPath ?? "artifacts/leaderboard.json";
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}

export function validateLeaderboardArtifact(artifact: LeaderboardArtifact): true {
  if (artifact.schemaVersion !== "1.0") throw new Error("Unsupported leaderboard schema.");
  if (!artifact.privacy?.anonymized || !artifact.privacy?.noRawPrompts || !artifact.privacy?.noRawEvidence) throw new Error("Leaderboard privacy metadata is incomplete.");
  if (!artifact.publication.anonymized) throw new Error("Leaderboard artifacts must be anonymized.");
  assertNoRawDataKeys(artifact);
  for (const entry of artifact.entries) {
    if (!entry.suite || !entry.metric || !Number.isFinite(entry.score)) throw new Error("Invalid leaderboard entry.");
    if (entry.score < 0 || entry.score > 1) throw new Error(`Leaderboard score out of range for ${entry.suite}.`);
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
