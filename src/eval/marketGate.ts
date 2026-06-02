import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface BenchmarkReport {
  generatedAt?: string;
  source?: { name?: string; metric?: string; repository?: string; paper?: string; split?: string };
  config?: { split?: string };
  proof?: string;
  proofLevel?: string;
  qualityClaimAllowed?: boolean;
  judge?: { kind?: string; status?: string };
  ours: { name: string; accuracy: number; correct: number; total: number; details?: BenchmarkDetail[]; judge?: { kind?: string; status?: string } };
  baselines: Array<{ name: string; accuracy: number; correct: number; total: number }>;
}

interface BenchmarkDetail {
  id: string;
  question?: string;
  questionType?: string;
  passed?: boolean;
  score?: number;
  expected?: string[];
  expectedEvidence?: string[];
  retrieved?: string[];
  retrievedEvidence?: string[];
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
  diagnosticPassed: boolean;
  scoreable: boolean;
  proof: "local-diagnostic" | "llm-harness" | "public-benchmark";
  saturated: boolean;
  ours: { correct: number; total: number; accuracy: number };
  bestBaseline: { name: string; correct: number; total: number; accuracy: number };
  margin: number;
  questions: GateQuestionRow[];
}

interface GateQuestionRow {
  id: string;
  question?: string;
  questionType?: string;
  passed: boolean;
  score?: number;
  expected: string[];
  retrieved: string[];
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
  questions?: CompetitorQuestionRow[];
}

interface CompetitorQuestionRow {
  id: string;
  passed?: boolean;
  score?: number;
  expected?: string[];
  retrieved?: string[];
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
  const methodologyFailures = competitorArtifact ? competitorMethodologyFailures(competitorArtifact) : [];
  const allBenchmarksScoreable = benchmarks.every((benchmark) => benchmark.scoreable);
  const diagnosticPassed = benchmarks.every((benchmark) => benchmark.diagnosticPassed) && methodologyFailures.length === 0;
  const directClaimAllowed = allBenchmarksScoreable && directMarketComparison.passed && methodologyFailures.length === 0;
  const baselineClaimAllowed = allBenchmarksScoreable && benchmarks.every((benchmark) => benchmark.passed) && methodologyFailures.length === 0;
  const report = {
    passed: directClaimAllowed || baselineClaimAllowed,
    diagnosticPassed,
    claimAllowed: directClaimAllowed || baselineClaimAllowed,
    generatedAt: new Date().toISOString(),
    proofLevel: directClaimAllowed
      ? "direct-comparable-market-superiority"
      : baselineClaimAllowed
        ? "certified-public-benchmark-baseline-superiority"
        : "diagnostic-public-benchmark-baseline",
    limitations: [
      "Local evidence-id or deterministic recall reports are diagnostics only until the benchmark artifact carries LLM/harness or comparable public-benchmark proof.",
      "Baseline and market superiority claims require every included benchmark row to be scoreable and any competitor artifact to use the same metric, top-K, budget, methodology metadata and per-question rows."
    ],
    claimBlockers: [
      ...benchmarks.filter((benchmark) => !benchmark.scoreable).map((benchmark) => `${benchmark.dataset} is ${benchmark.proof}; require LLM/harness or comparable public-benchmark proof before claim`),
      ...methodologyFailures.map((failure) => `${failure.competitor} ${failure.dataset}/${failure.metric}: ${failure.reason}`)
    ],
    benchmarks,
    directMarketComparison,
    methodologyFailures
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
        notes: stringField(row.notes),
        questions: normalizeQuestionRows(row.questions ?? row.details ?? row.perQuestion ?? row.per_question)
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
  const margin = report.ours.accuracy - bestBaseline.accuracy;
  const saturated = report.ours.accuracy === 1 && bestBaseline.accuracy === 1;
  const proof = benchmarkProof(report);
  const scoreable = proof !== "local-diagnostic";
  const diagnosticPassed = margin > 0 || saturated;
  return {
    dataset,
    metric: report.source?.metric ?? "unknown",
    passed: scoreable && diagnosticPassed,
    diagnosticPassed,
    scoreable,
    proof,
    saturated,
    ours: pickScore(report.ours),
    bestBaseline: { name: bestBaseline.name, ...pickScore(bestBaseline) },
    margin,
    questions: normalizeBenchmarkQuestions(report.ours.details ?? [])
  };
}

function benchmarkProof(report: BenchmarkReport): GateBenchmarkSummary["proof"] {
  const kind = report.ours?.judge?.kind ?? report.judge?.kind;
  const proof = report.proof ?? report.proofLevel;
  if (report.qualityClaimAllowed === true && (kind === "llm" || kind === "harness" || kind === "provider-evidence-support" || proof === "llm-harness" || proof === "public-benchmark")) {
    return kind === "provider-evidence-support" || proof === "llm-harness" ? "llm-harness" : proof === "public-benchmark" ? "public-benchmark" : "llm-harness";
  }
  if (kind === "provider-evidence-support" || kind === "llm" || kind === "harness" || proof === "llm-harness") return "llm-harness";
  if (proof === "public-benchmark") return "public-benchmark";
  return "local-diagnostic";
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
          notes: result.notes ?? competitor.notes,
          questions: compareQuestionRows(benchmark.questions, result.questions ?? [])
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

function competitorMethodologyFailures(artifact: CompetitorArtifact) {
  const failures: Array<{ competitor: string; dataset: string; metric: string; reason: string }> = [];
  for (const competitor of artifact.competitors) {
    for (const benchmark of competitor.benchmarks) {
      if (!benchmark.comparable) continue;
      if (!competitor.sourceUrl) failures.push({ competitor: competitor.name, dataset: benchmark.dataset, metric: benchmark.metric, reason: "comparable claim requires sourceUrl" });
      if (!benchmark.notes) failures.push({ competitor: competitor.name, dataset: benchmark.dataset, metric: benchmark.metric, reason: "comparable claim requires methodology notes" });
      if (benchmark.topK === undefined) failures.push({ competitor: competitor.name, dataset: benchmark.dataset, metric: benchmark.metric, reason: "comparable claim requires topK" });
      if (!benchmark.questions?.length) failures.push({ competitor: competitor.name, dataset: benchmark.dataset, metric: benchmark.metric, reason: "comparable claim requires per-question rows" });
    }
  }
  return failures;
}

function normalizeBenchmarkQuestions(details: BenchmarkDetail[]): GateQuestionRow[] {
  return details.map((detail) => ({
    id: detail.id,
    question: detail.question,
    questionType: detail.questionType,
    passed: detail.passed === true,
    score: detail.score,
    expected: [...(detail.expected ?? []), ...(detail.expectedEvidence ?? [])].map(String),
    retrieved: [...(detail.retrieved ?? []), ...(detail.retrievedEvidence ?? [])].map(String)
  }));
}

function normalizeQuestionRows(value: unknown): CompetitorQuestionRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(isRecord)
    .flatMap((row): CompetitorQuestionRow[] => {
      const id = stringField(row.id ?? row.question_id ?? row.questionId);
      if (!id) return [];
      return [{
        id,
        passed: typeof row.passed === "boolean" ? row.passed : undefined,
        score: numberField(row.score ?? row.accuracy),
        expected: arrayOfStrings(row.expected ?? row.expectedEvidence ?? row.expected_evidence),
        retrieved: arrayOfStrings(row.retrieved ?? row.retrievedEvidence ?? row.retrieved_evidence),
        notes: stringField(row.notes)
      }];
    });
}

function compareQuestionRows(ours: GateQuestionRow[], competitor: CompetitorQuestionRow[]) {
  const competitorById = new Map(competitor.map((row) => [row.id, row]));
  return ours.map((row) => {
    const other = competitorById.get(row.id);
    return {
      id: row.id,
      oursPassed: row.passed,
      competitorPassed: other?.passed,
      oursScore: row.score,
      competitorScore: other?.score,
      matched: Boolean(other)
    };
  });
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

function arrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(String);
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
  process.exit(report.passed || report.diagnosticPassed ? 0 : 1);
}
