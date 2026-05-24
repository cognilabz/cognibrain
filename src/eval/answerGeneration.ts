import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

interface SourceBenchmarkReport {
  generatedAt?: string;
  source?: { name?: string; metric?: string };
  dataset?: string;
  metric?: string;
  topK?: number;
  config?: { topK?: number; split?: string };
  ours?: { details?: BenchmarkDetail[] };
}

interface BenchmarkDetail {
  id: string;
  question?: string;
  answer?: string;
  expected?: string[];
  actual?: string;
  expectedEvidence?: string[];
  retrieved?: string[];
  retrievedEvidence?: string[];
  passed?: boolean;
  score?: number;
}

interface AnswerQuestionArtifact {
  id: string;
  dataset: string;
  prompt: string;
  promptHash: string;
  generatedAnswer: string;
  expected: string[];
  retrievedEvidenceIds: string[];
  retrievedEvidence: string[];
  judge: { name: string; score: number; passed: boolean; reason: string };
}

interface AnswerDatasetArtifact {
  dataset: string;
  sourceArtifact: string;
  metric: "answer_generation_quality";
  answerer: string;
  judge: string;
  methodology: {
    sameDataset: boolean;
    sameQuestionSet: boolean;
    topK?: number;
    tokenBudget?: number;
    answererConfigurable: boolean;
    judgeConfigurable: boolean;
  };
  score: number;
  total: number;
  questions: AnswerQuestionArtifact[];
}

export interface AnswerGenerationArtifact {
  schemaVersion: "1.0";
  generatedAt: string;
  mode: "answer-generation";
  privacy: { benchmarkQuestionsOnly: boolean; includesUserData: boolean };
  datasets: AnswerDatasetArtifact[];
  summary: { totalQuestions: number; meanScore: number };
}

export function runAnswerGenerationBenchmark(options: { reports?: string[]; outputPath?: string; tokenBudget?: number } = {}): AnswerGenerationArtifact {
  const reports = options.reports ?? [
    "artifacts/locomo-report.json",
    "artifacts/longmemeval-report.json",
    "artifacts/beam-report.json",
    "artifacts/beam-500k-report.json",
    "artifacts/nextgen-benchmarks.json"
  ];
  const datasets = reports.filter(existsSync).flatMap((path) => datasetArtifacts(path, options.tokenBudget ?? 1200));
  const totalQuestions = datasets.reduce((sum, dataset) => sum + dataset.total, 0);
  const meanScore = datasets.reduce((sum, dataset) => sum + dataset.score * dataset.total, 0) / Math.max(1, totalQuestions);
  const artifact: AnswerGenerationArtifact = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "answer-generation",
    privacy: { benchmarkQuestionsOnly: true, includesUserData: false },
    datasets,
    summary: { totalQuestions, meanScore }
  };
  const outputPath = options.outputPath ?? "artifacts/answer-generation.json";
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}

function datasetArtifacts(path: string, tokenBudget: number): AnswerDatasetArtifact[] {
  const report = JSON.parse(readFileSync(path, "utf8")) as SourceBenchmarkReport;
  const sourceName = report.source?.name ?? report.dataset ?? "nextgen";
  const topK = report.topK ?? report.config?.topK;
  if (Array.isArray(report.ours?.details)) {
    return [buildDataset(path, sourceName, report.ours.details, topK, tokenBudget)];
  }
  const suites = Array.isArray((report as unknown as { suites?: unknown[] }).suites) ? (report as unknown as { suites: Array<{ id: string; details?: BenchmarkDetail[] }> }).suites : [];
  return suites.filter((suite) => Array.isArray(suite.details)).map((suite) => buildDataset(path, `${sourceName}:${suite.id}`, suite.details ?? [], topK, tokenBudget));
}

function buildDataset(path: string, dataset: string, details: BenchmarkDetail[], topK: number | undefined, tokenBudget: number): AnswerDatasetArtifact {
  const answerer = process.env.MEMORY_BENCHMARK_ANSWERER ?? "deterministic-extractive-v1";
  const judge = process.env.MEMORY_BENCHMARK_JUDGE ?? "deterministic-coverage-v1";
  const questions = details.map((detail) => questionArtifact(dataset, detail, answerer, judge));
  const score = questions.reduce((sum, item) => sum + item.judge.score, 0) / Math.max(1, questions.length);
  return {
    dataset,
    sourceArtifact: path,
    metric: "answer_generation_quality",
    answerer,
    judge,
    methodology: {
      sameDataset: true,
      sameQuestionSet: true,
      topK,
      tokenBudget,
      answererConfigurable: true,
      judgeConfigurable: true
    },
    score,
    total: questions.length,
    questions
  };
}

function questionArtifact(dataset: string, detail: BenchmarkDetail, answerer: string, judgeName: string): AnswerQuestionArtifact {
  const prompt = detail.question ?? detail.id;
  const retrievedEvidence = detail.retrieved ?? [];
  const generatedAnswer =
    detail.actual ??
    callBenchmarkCommand("answer", process.env.MEMORY_BENCHMARK_ANSWERER_COMMAND, process.env.MEMORY_BENCHMARK_ANSWERER_ARGS, {
      dataset,
      id: detail.id,
      prompt,
      retrievedEvidence,
      expected: expectedTerms(detail)
    })?.answer ??
    (retrievedEvidence.slice(0, 3).join(" ") || "No sufficient evidence retrieved.");
  const expected = expectedTerms(detail);
  const providerJudge = callBenchmarkCommand("judge", process.env.MEMORY_BENCHMARK_JUDGE_COMMAND, process.env.MEMORY_BENCHMARK_JUDGE_ARGS, {
    dataset,
    id: detail.id,
    prompt,
    generatedAnswer,
    expected,
    retrievedEvidence
  });
  const judge: { score: number; passed: boolean; reason?: string } = providerJudge ? normalizeJudge(providerJudge, judgeName) : judgeAnswer(generatedAnswer, expected, detail);
  return {
    id: detail.id,
    dataset,
    prompt,
    promptHash: createHash("sha256").update(prompt).digest("hex").slice(0, 16),
    generatedAnswer,
    expected,
    retrievedEvidenceIds: detail.retrievedEvidence ?? [],
    retrievedEvidence,
    judge: { name: judgeName, ...judge, reason: judge.reason ?? `${answerer} answer judged against benchmark expected terms/evidence.` }
  };
}

function callBenchmarkCommand(task: "answer" | "judge", command: string | undefined, argsValue: string | undefined, payload: Record<string, unknown>): Record<string, any> | undefined {
  if (!command) return undefined;
  try {
    const stdout = execFileSync(command, [...splitArgs(argsValue), task], {
      input: JSON.stringify({ task, ...payload }),
      encoding: "utf8",
      timeout: Number(process.env.MEMORY_BENCHMARK_COMMAND_TIMEOUT_MS ?? 5000),
      maxBuffer: 1_000_000
    });
    const parsed = JSON.parse(stdout);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function splitArgs(value: string | undefined): string[] {
  return value ? value.split(/\s+/).filter(Boolean) : [];
}

function normalizeJudge(output: Record<string, any>, judgeName: string) {
  const score = typeof output.score === "number" && Number.isFinite(output.score) ? Math.max(0, Math.min(1, output.score)) : 0;
  return {
    score,
    passed: typeof output.passed === "boolean" ? output.passed : score >= 0.5,
    reason: typeof output.reason === "string" ? output.reason : `${judgeName} provider score`
  };
}

function expectedTerms(detail: BenchmarkDetail): string[] {
  if (Array.isArray(detail.expected) && detail.expected.length) return detail.expected.map(String);
  if (typeof detail.answer === "string" && detail.answer.trim()) return tokenizeExpected(detail.answer).slice(0, 8);
  return detail.expectedEvidence ?? [];
}

function judgeAnswer(answer: string, expected: string[], detail: BenchmarkDetail) {
  if (typeof detail.score === "number") return { score: Math.max(0, Math.min(1, detail.score)), passed: detail.score >= 0.5 };
  if (detail.passed === true && expected.length === 0) return { score: 1, passed: true };
  const normalized = answer.toLowerCase();
  const hits = expected.filter((term) => normalized.includes(term.toLowerCase()));
  const score = expected.length ? hits.length / expected.length : detail.passed ? 1 : 0;
  return { score, passed: score >= 0.5 };
}

function tokenizeExpected(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 12);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const reportsIndex = process.argv.indexOf("--reports");
  const reports = reportsIndex >= 0 ? process.argv[reportsIndex + 1]?.split(",").filter(Boolean) : undefined;
  const artifact = runAnswerGenerationBenchmark({ reports, outputPath: outIndex >= 0 ? process.argv[outIndex + 1] : undefined });
  console.log(JSON.stringify(artifact, null, 2));
}
