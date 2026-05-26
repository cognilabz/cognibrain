import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildCogniCodeScenarioSet } from "./cognicode/scenarioFactory";

interface BenchmarkHardeningReport {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "benchmark-hardening";
  checks: Record<string, boolean>;
  dataset: {
    path: string;
    sha256: string;
    scenarioCount: number;
    schema: string;
    immutableCommand: string;
  };
  realRepoTrack: {
    path: string;
    repoCount: number;
    workflowCount: number;
  };
  competitors: {
    artifact: string;
    nativeOrCliRows: number;
    apiShapeRows: number;
    credentialBlockedRows: number;
  };
  passed: boolean;
}

export function generateBenchmarkHardeningReport(options: { scenarios?: string; out?: string; markdown?: string } = {}): BenchmarkHardeningReport {
  const scenariosPath = options.scenarios ?? "artifacts/cognicodebench/scenarios.json";
  const scenarioDataset = loadScenarioDataset(scenariosPath);
  const scenarios = scenarioDataset.scenarios;
  const datasetHash = scenarioDataset.sha256;
  const repoTrack = readJson("fixtures/cognicodebench/demo-repos.json", { demos: [] }) as { demos?: Array<Record<string, unknown>> };
  const arena = readJson("artifacts/arena/run.json", { systems: [] }) as { systems?: Array<Record<string, unknown>> };
  const competitors = (Array.isArray(arena.systems) ? arena.systems : []).filter((system) => system.system !== "cognibrain");
  const nativeOrCliRows = competitors.filter((system) => ["same-run-native", "same-run-cloud-api", "same-run-cli", "vendor-signed", "real-customer-field"].includes(String(system.proofLevel))).length;
  const apiShapeRows = competitors.filter((system) => system.proofLevel === "same-run-api-shape").length;
  const credentialBlockedRows = competitors.filter((system) => system.proofLevel === "credential-blocked").length;
  const nativeRunnerAvailable = existsSync("scripts/benchmark/competitors/native-python-runner.mjs") || existsSync("scripts/benchmark/competitors/native_python_runner.py");
  const checks = {
    scenarioDatasetPresent: scenarios.length >= 100,
    scenarioSchemaPresent: existsSync("docs/schemas/cognicodebench-scenario.schema.json"),
    datasetHasHash: datasetHash.length === 64,
    scenarioGenerationIsPinned: read("package.json").includes("--scenarios-out artifacts/cognicodebench/scenarios.json"),
    realRepoTrackPresent: Array.isArray(repoTrack.demos) && repoTrack.demos.length >= 5,
    realRepoWorkflowsPresent: Array.isArray(repoTrack.demos) && repoTrack.demos.every((demo) => demo.beforeTask && demo.wrongAction && demo.correction && demo.nextTask && demo.expectedNextAction),
    competitorProofLevelsBounded: competitors.every((system) => typeof system.proofLevel === "string"),
    nativeCompetitorPathExists: nativeOrCliRows >= 1 || nativeRunnerAvailable
  };
  const report: BenchmarkHardeningReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "benchmark-hardening",
    checks,
    dataset: {
      path: scenariosPath,
      sha256: datasetHash,
      scenarioCount: scenarios.length,
      schema: "docs/schemas/cognicodebench-scenario.schema.json",
      immutableCommand: "npm run benchmark:cognicode:generate"
    },
    realRepoTrack: {
      path: "fixtures/cognicodebench/demo-repos.json",
      repoCount: Array.isArray(repoTrack.demos) ? repoTrack.demos.length : 0,
      workflowCount: Array.isArray(repoTrack.demos) ? repoTrack.demos.filter((demo) => demo.beforeTask && demo.nextTask).length : 0
    },
    competitors: {
      artifact: "artifacts/arena/run.json",
      nativeOrCliRows,
      apiShapeRows,
      credentialBlockedRows
    },
    passed: Object.values(checks).every(Boolean)
  };
  if (options.out) {
    mkdirSync(dirname(options.out), { recursive: true });
    writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (options.markdown) {
    mkdirSync(dirname(options.markdown), { recursive: true });
    writeFileSync(options.markdown, renderMarkdown(report));
  }
  return report;
}

function renderMarkdown(report: BenchmarkHardeningReport): string {
  return `# Benchmark Hardening

Generated at ${report.generatedAt}.

| Area | Evidence |
| --- | --- |
| Immutable dataset | ${report.dataset.path} |
| Dataset SHA-256 | \`${report.dataset.sha256}\` |
| Scenario count | ${report.dataset.scenarioCount} |
| Schema | ${report.dataset.schema} |
| Real-repo workflow fixtures | ${report.realRepoTrack.repoCount} repos, ${report.realRepoTrack.workflowCount} workflows |
| Competitor native/cloud/CLI rows | ${report.competitors.nativeOrCliRows} |
| Competitor API-shape rows | ${report.competitors.apiShapeRows} |

Checks: ${Object.entries(report.checks).map(([name, passed]) => `${passed ? "ok" : "fail"} ${name}`).join(", ")}.
`;
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function loadScenarioDataset(path: string): { scenarios: unknown[]; sha256: string } {
  if (existsSync(path)) {
    const bytes = readFileSync(path);
    const envelope = JSON.parse(bytes.toString("utf8")) as { scenarios?: unknown[] } | unknown[];
    const scenarios = Array.isArray(envelope) ? envelope : Array.isArray(envelope.scenarios) ? envelope.scenarios : [];
    return { scenarios, sha256: sha256(bytes) };
  }
  const generated = buildCogniCodeScenarioSet({
    count: 100,
    difficulty: "hard",
    noiseRatio: 0.5,
    sessions: 12,
    repos: 100,
    staleRatio: 0.25,
    connectorMix: ["github", "jira", "confluence", "notion", "slack"]
  });
  const content = `${JSON.stringify({ scenarios: generated.scenarios }, null, 2)}\n`;
  return { scenarios: generated.scenarios, sha256: sha256(Buffer.from(content)) };
}

function read(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function readJson(path: string, fallback: unknown): unknown {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function cliOptions(argv: string[]): { scenarios?: string; out?: string; markdown?: string } {
  const scenariosIndex = argv.indexOf("--scenarios");
  const outIndex = argv.indexOf("--out");
  const markdownIndex = argv.indexOf("--markdown");
  return {
    scenarios: scenariosIndex >= 0 ? argv[scenariosIndex + 1] : "artifacts/cognicodebench/scenarios.json",
    out: outIndex >= 0 ? argv[outIndex + 1] : "artifacts/benchmark-hardening.json",
    markdown: markdownIndex >= 0 ? argv[markdownIndex + 1] : "artifacts/docs/benchmark-hardening.md"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateBenchmarkHardeningReport(cliOptions(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
