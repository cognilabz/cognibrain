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
    metadata: Record<string, unknown>;
  }>;
  scorecardProofLevels: string[];
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
        metadata: { publicClaimsAllowed: false, reason: "hidden eval hashes are withheld until release publication" }
      },
      {
        id: "cognicodebench-realrepo-v1.0",
        generatorCommit: generatorCommit(),
        split: "real-repo-track",
        proofLevel: "metadata-only",
        metadata: {
          taskTypes: ["review correction", "test failure", "architecture rule", "generated file trap", "package migration", "branch-specific truth"],
          humanReviewedSubset: true
        }
      }
    ],
    scorecardProofLevels: ["same-run-full", "same-run-native", "same-run-cloud-api", "same-run-cli", "artifact-import", "public-claim-only", "api-shape"],
    passed: true
  };
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
  const rows = manifest.releases.map((release) => `| ${release.id} | ${release.split} | ${release.proofLevel} | ${release.sha256 ?? "n/a"} | ${release.scenarioCount ?? "n/a"} |`).join("\n");
  return `# Immutable Benchmark Release

Generated at ${manifest.generatedAt}.

| Dataset | Split | Proof level | SHA256 | Scenarios |
| --- | --- | --- | --- | ---: |
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
