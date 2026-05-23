import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface BenchmarkReport {
  generatedAt?: string;
  source?: { name?: string; metric?: string; repository?: string; paper?: string; split?: string };
  config?: { split?: string };
  ours: { name: string; accuracy: number; correct: number; total: number };
  baselines: Array<{ name: string; accuracy: number; correct: number; total: number }>;
}

interface GateOptions {
  locomoPath: string;
  longMemEvalPath: string;
  beamPath?: string;
  beam500kPath?: string;
  competitorsPath?: string;
  outputPath: string;
}

interface GateBenchmarkSummary {
  dataset: string;
  metric: string;
  passed: boolean;
  ours: { correct: number; total: number; accuracy: number };
  bestBaseline: { name: string; correct: number; total: number; accuracy: number };
  margin: number;
}

interface CompetitorArtifact {
  generatedAt?: string;
  competitors: CompetitorResult[];
}

interface CompetitorResult {
  name: string;
  sourceUrl?: string;
  notes?: string;
  benchmarks: CompetitorBenchmarkResult[];
}

interface CompetitorBenchmarkResult {
  dataset: string;
  metric: string;
  accuracy: number;
  correct?: number;
  total?: number;
  topK?: number;
  meanTokens?: number;
  comparable: boolean;
  notes?: string;
}

export function runMarketGate(options: Partial<GateOptions> = {}) {
  const resolved: GateOptions = {
    locomoPath: options.locomoPath ?? "artifacts/locomo-report.json",
    longMemEvalPath: options.longMemEvalPath ?? "artifacts/longmemeval-report.json",
    beamPath: options.beamPath ?? "artifacts/beam-report.json",
    beam500kPath: options.beam500kPath ?? "artifacts/beam-500k-report.json",
    competitorsPath: options.competitorsPath,
    outputPath: options.outputPath ?? "artifacts/market-gate.json"
  };
  const locomo = summarizeBenchmark(readReport(resolved.locomoPath), "LoCoMo");
  const longMemEval = summarizeBenchmark(readReport(resolved.longMemEvalPath), "LongMemEval-S");
  const beam = resolved.beamPath && existsSync(resolved.beamPath) ? summarizeBenchmark(readReport(resolved.beamPath), "BEAM") : undefined;
  const beam500k =
    resolved.beam500kPath && existsSync(resolved.beam500kPath)
      ? summarizeBenchmark(readReport(resolved.beam500kPath), "BEAM 500K")
      : undefined;
  const benchmarks = [locomo, longMemEval, beam, beam500k].filter((benchmark): benchmark is GateBenchmarkSummary =>
    Boolean(benchmark)
  );
  const competitorArtifact = resolved.competitorsPath ? readCompetitors(resolved.competitorsPath) : undefined;
  const directMarketComparison = compareCompetitors(benchmarks, competitorArtifact);
  const report = {
    passed: benchmarks.every((benchmark) => benchmark.passed),
    generatedAt: new Date().toISOString(),
    proofLevel: directMarketComparison.passed
      ? "direct-comparable-market-superiority"
      : "certified-public-benchmark-baseline-superiority",
    limitations: [
      "This gate proves superiority over included local baselines on official public datasets.",
      "It does not claim direct superiority over commercial vendors unless their comparable artifacts are imported and evaluated with the same metric, top-K, and budget."
    ],
    benchmarks,
    directMarketComparison
  };
  mkdirSync(resolve(resolved.outputPath, ".."), { recursive: true });
  writeFileSync(resolved.outputPath, JSON.stringify(report, null, 2));
  return report;
}

function readReport(path: string): BenchmarkReport {
  if (!existsSync(path)) throw new Error(`Missing benchmark artifact: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as BenchmarkReport;
}

function readCompetitors(path: string): CompetitorArtifact {
  if (!existsSync(path)) throw new Error(`Missing competitor artifact: ${path}`);
  const artifact = normalizeCompetitorArtifact(JSON.parse(readFileSync(path, "utf8")));
  if (!Array.isArray(artifact.competitors)) throw new Error(`Invalid competitor artifact: ${path}`);
  return artifact;
}

function normalizeCompetitorArtifact(raw: unknown): CompetitorArtifact {
  if (isRecord(raw) && Array.isArray(raw.competitors)) return raw as unknown as CompetitorArtifact;
  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.results)
      ? raw.results
      : isRecord(raw) && Array.isArray(raw.benchmarks)
        ? raw.benchmarks
        : [];
  const byCompetitor = new Map<string, CompetitorBenchmarkResult[]>();
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const dataset = stringField(row.dataset ?? row.benchmark ?? row.name);
    const metric = stringField(row.metric ?? row.eval_metric ?? row.evaluationMetric);
    const accuracy = numberField(row.accuracy ?? row.score ?? row.recall ?? row.f1);
    if (!dataset || !metric || accuracy === undefined) continue;
    const competitor = stringField(row.competitor ?? row.provider ?? row.system ?? row.method) ?? "imported-vendor";
    byCompetitor.set(competitor, [
      ...(byCompetitor.get(competitor) ?? []),
      {
        dataset,
        metric,
        accuracy,
        correct: numberField(row.correct),
        total: numberField(row.total),
        topK: numberField(row.topK ?? row.top_k ?? row.k),
        meanTokens: numberField(row.meanTokens ?? row.mean_tokens),
        comparable: row.comparable === true,
        notes: stringField(row.notes)
      }
    ]);
  }
  return {
    generatedAt: isRecord(raw) ? stringField(raw.generatedAt ?? raw.generated_at) : undefined,
    competitors: [...byCompetitor.entries()].map(([name, benchmarks]) => ({ name, benchmarks }))
  };
}

function summarizeBenchmark(report: BenchmarkReport, fallbackDataset: string): GateBenchmarkSummary {
  const bestBaseline = report.baselines.reduce((best, current) => (current.accuracy > best.accuracy ? current : best));
  const split = report.source?.split ?? report.config?.split;
  const dataset = report.source?.name === "BEAM" && split ? `BEAM ${split}` : report.source?.name ?? fallbackDataset;
  return {
    dataset,
    metric: report.source?.metric ?? "unknown",
    passed: report.ours.accuracy > bestBaseline.accuracy,
    ours: pickScore(report.ours),
    bestBaseline: { name: bestBaseline.name, ...pickScore(bestBaseline) },
    margin: report.ours.accuracy - bestBaseline.accuracy
  };
}

function pickScore(score: { correct: number; total: number; accuracy: number }) {
  return {
    correct: score.correct,
    total: score.total,
    accuracy: score.accuracy
  };
}

function compareCompetitors(benchmarks: GateBenchmarkSummary[], artifact?: CompetitorArtifact) {
  if (!artifact) {
    return {
      configured: false,
      passed: false,
      reason: "No competitor artifact was provided.",
      comparisons: []
    };
  }

  const comparisons = [];
  for (const benchmark of benchmarks) {
    const comparable = artifact.competitors.flatMap((competitor) =>
      competitor.benchmarks
        .filter((result) => result.comparable && result.dataset === benchmark.dataset && result.metric === benchmark.metric)
        .map((result) => ({
          dataset: benchmark.dataset,
          metric: benchmark.metric,
          competitor: competitor.name,
          sourceUrl: competitor.sourceUrl,
          ours: benchmark.ours.accuracy,
          competitorAccuracy: result.accuracy,
          margin: benchmark.ours.accuracy - result.accuracy,
          passed: benchmark.ours.accuracy > result.accuracy,
          notes: result.notes ?? competitor.notes
        }))
    );
    comparisons.push(...comparable);
  }

  if (comparisons.length === 0) {
    return {
      configured: true,
      passed: false,
      reason: "Competitor artifacts were provided, but none matched the same dataset and metric with comparable=true.",
      comparisons
    };
  }

  return {
    configured: true,
    passed: comparisons.every((comparison) => comparison.passed),
    reason: comparisons.every((comparison) => comparison.passed)
      ? "cognibrain beats every imported comparable competitor result."
      : "At least one imported comparable competitor result is not beaten.",
    comparisons
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
  }
  const report = runMarketGate({
    locomoPath: args.get("--locomo") ?? undefined,
    longMemEvalPath: args.get("--longmemeval") ?? undefined,
    beamPath: args.get("--beam") ?? undefined,
    beam500kPath: args.get("--beam-500k") ?? undefined,
    competitorsPath: args.get("--competitors") ?? undefined,
    outputPath: args.get("--out") ?? undefined
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.passed ? 0 : 1);
}
