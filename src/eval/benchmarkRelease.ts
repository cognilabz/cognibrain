import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface BenchmarkReleaseManifest {
  schemaVersion: "1.0";
  generatedAt: string;
  releases: Array<{
    id: "cognicodebench-v2.0" | "cognicodebench-realrepo-v1.0";
    generatorCommit: string;
    split: "public-dev" | "hidden-eval-placeholder" | "real-repo-track";
    datasetPath?: string;
    sha256?: string;
    scenarioCount?: number;
    proofLevel: "immutable-manifest" | "metadata-only" | "hidden-eval-placeholder";
    claimBoundary: {
      claimAllowed: false;
      qualityClaimAllowed: false;
      marketClaimAllowed: false;
      leaderboardEligible: false;
      proof: "dataset-manifest-only" | "hidden-eval-not-published" | "track-metadata-only";
      claimBlockers: string[];
    };
    metadata: Record<string, unknown>;
  }>;
  scorecardProofLevels: string[];
  publication: {
    claimScope: string;
    qualityClaimAllowed: false;
    marketClaimAllowed: false;
    leaderboardEligible: false;
  };
  passed: boolean;
}

export function generateBenchmarkRelease(options: { out?: string; markdown?: string; scenarioPath?: string } = {}): BenchmarkReleaseManifest {
  const scenarioPath = options.scenarioPath ?? "artifacts/cognicodebench/scenarios.json";
  const scenarioBody = existsSync(scenarioPath) ? readFileSync(scenarioPath, "utf8") : "";
  const manifest: BenchmarkReleaseManifest = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    releases: [
      {
        id: "cognicodebench-v2.0",
        generatorCommit: generatorCommit(),
        split: "public-dev",
        datasetPath: scenarioPath,
        sha256: scenarioBody ? sha256(scenarioBody) : undefined,
        scenarioCount: scenarioBody ? countScenarios(scenarioBody) : 0,
        proofLevel: scenarioBody ? "immutable-manifest" : "metadata-only",
        claimBoundary: releaseClaimBoundary("dataset-manifest-only", [
          "Immutable public-dev scenarios prove dataset availability, not answer quality.",
          "Quality claims require LLM/harness judging on a frozen evaluation run.",
          "Market claims require comparable same-protocol public benchmark artifacts."
        ]),
        metadata: {
          difficulty: "hard",
          noiseRatio: 0.5,
          sessions: 12,
          repos: 100,
          staleRatio: 0.25,
          connectorMix: ["github", "jira", "confluence", "notion", "slack"]
        }
      },
      {
        id: "cognicodebench-v2.0",
        generatorCommit: generatorCommit(),
        split: "hidden-eval-placeholder",
        proofLevel: "hidden-eval-placeholder",
        claimBoundary: releaseClaimBoundary("hidden-eval-not-published", [
          "Hidden evaluation hashes are withheld until release publication.",
          "No public score or leaderboard eligibility exists for this placeholder."
        ]),
        metadata: { publicClaimsAllowed: false, reason: "hidden eval hashes are withheld until release publication" }
      },
      {
        id: "cognicodebench-realrepo-v1.0",
        generatorCommit: generatorCommit(),
        split: "real-repo-track",
        proofLevel: "metadata-only",
        claimBoundary: releaseClaimBoundary("track-metadata-only", [
          "Real-repo track metadata describes the intended split but does not publish scored tasks.",
          "Human-reviewed subsets are not market proof without same-run LLM/harness judging."
        ]),
        metadata: {
          taskTypes: ["review correction", "test failure", "architecture rule", "generated file trap", "package migration", "branch-specific truth"],
          humanReviewedSubset: true
        }
      }
    ],
    scorecardProofLevels: ["local-baseline", "public-claim-only", "artifact-import", "credential-blocked", "same-run-api-shape", "same-run-native", "same-run-cloud-api", "same-run-cli", "same-run-full", "vendor-signed", "real-customer-field"],
    publication: {
      claimScope: "Benchmark release manifests prove dataset identity, split metadata and hashes only. They are not LLM/harness quality proof or market leaderboard proof.",
      qualityClaimAllowed: false,
      marketClaimAllowed: false,
      leaderboardEligible: false
    },
    passed: false
  };
  manifest.passed = validateBenchmarkReleaseManifest(manifest);
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, renderMarkdown(manifest));
  }
  return manifest;
}

export function validateBenchmarkReleaseManifest(manifest: BenchmarkReleaseManifest): boolean {
  if (manifest.schemaVersion !== "1.0") throw new Error("Unsupported benchmark release schema.");
  if (manifest.publication.qualityClaimAllowed || manifest.publication.marketClaimAllowed || manifest.publication.leaderboardEligible) {
    throw new Error("Benchmark release publication cannot allow quality, market, or leaderboard claims.");
  }
  const knownProofLevels = new Set(["local-baseline", "public-claim-only", "artifact-import", "credential-blocked", "same-run-api-shape", "same-run-native", "same-run-cloud-api", "same-run-cli", "same-run-full", "vendor-signed", "real-customer-field"]);
  for (const proofLevel of manifest.scorecardProofLevels) {
    if (!knownProofLevels.has(proofLevel)) throw new Error(`Unknown scorecard proof level: ${proofLevel}`);
  }
  for (const release of manifest.releases) {
    if (release.claimBoundary.claimAllowed || release.claimBoundary.qualityClaimAllowed || release.claimBoundary.marketClaimAllowed || release.claimBoundary.leaderboardEligible) {
      throw new Error(`${release.id}:${release.split} cannot allow quality, market, or leaderboard claims from release metadata.`);
    }
    if (!release.claimBoundary.claimBlockers.length) throw new Error(`${release.id}:${release.split} lacks claim blockers.`);
    if (release.proofLevel === "immutable-manifest" && release.claimBoundary.proof !== "dataset-manifest-only") throw new Error(`${release.id}:${release.split} immutable manifest proof must be dataset-manifest-only.`);
    if (release.split === "hidden-eval-placeholder" && release.claimBoundary.proof !== "hidden-eval-not-published") throw new Error(`${release.id}:${release.split} hidden eval split must be hidden-eval-not-published.`);
    if (release.split === "real-repo-track" && release.claimBoundary.proof !== "track-metadata-only") throw new Error(`${release.id}:${release.split} real repo track must be track-metadata-only.`);
  }
  return true;
}

function releaseClaimBoundary(proof: BenchmarkReleaseManifest["releases"][number]["claimBoundary"]["proof"], claimBlockers: string[]): BenchmarkReleaseManifest["releases"][number]["claimBoundary"] {
  return {
    claimAllowed: false,
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    leaderboardEligible: false,
    proof,
    claimBlockers
  };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function countScenarios(input: string): number {
  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed) ? parsed.length : Array.isArray((parsed as { scenarios?: unknown[] }).scenarios) ? (parsed as { scenarios: unknown[] }).scenarios.length : 0;
  } catch {
    return 0;
  }
}

function generatorCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function renderMarkdown(manifest: BenchmarkReleaseManifest): string {
  const rows = manifest.releases.map((release) => `| ${release.id} | ${release.split} | ${release.proofLevel} | ${release.claimBoundary.proof} | ${release.claimBoundary.claimAllowed ? "Yes" : "No"} | ${release.sha256 ?? "n/a"} | ${release.scenarioCount ?? "n/a"} |`).join("\n");
  return `# Immutable Benchmark Release

Generated at ${manifest.generatedAt}.

${manifest.publication.claimScope}

| Dataset | Split | Proof level | Claim proof | Claim allowed | SHA256 | Scenarios |
| --- | --- | --- | --- | --- | --- | ---: |
${rows}
`;
}

function cliOptions(argv: string[]): { out?: string; markdown?: string; scenarioPath?: string } {
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  const scenarioIndex = argv.indexOf("--scenarios");
  return {
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/public/cognicodebench-release.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/cognicodebench-release.md",
    scenarioPath: scenarioIndex >= 0 ? argv[scenarioIndex + 1] : undefined
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(generateBenchmarkRelease(cliOptions(process.argv.slice(2))), null, 2));
}
