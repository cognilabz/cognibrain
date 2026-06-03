import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runBeamBenchmark } from "./beam";
import { runLocomoBenchmark } from "./locomo";
import { runLongMemEvalBenchmark } from "./longmemeval";

type ExternalHardRow = {
  id: string;
  dataset: string;
  metric: string;
  config: Record<string, unknown>;
  outputPath: string;
  passed: boolean;
  diagnosticPassed: boolean;
  scoreable: boolean;
  proof: "local-diagnostic" | "llm-harness" | "public-benchmark";
  cognibrain: number;
  bestBaseline: number;
  gapToBestBaseline: number;
  strongestBaseline: string;
  claimBlockers: string[];
};

type BenchmarkReport = {
  passed?: boolean;
  diagnosticPassed?: boolean;
  proof?: string;
  proofLevel?: string;
  qualityClaimAllowed?: boolean;
  judge?: { kind?: string; status?: string };
  claimBoundary?: { scorer?: string; claimBlockers?: string[] };
  ours?: { accuracy?: number };
  baselines?: Array<{ name: string; accuracy?: number }>;
};

export async function runExternalHardBenchmarks(options: { out?: string; markdown?: string; strict?: boolean } = {}) {
  const outputPath = options.out ?? "artifacts/external-hard-summary.json";
  const markdownPath = options.markdown ?? "artifacts/docs/external-hard.md";
  const rows: ExternalHardRow[] = [];

  rows.push(summarize("locomo-top1-no-summaries", "LoCoMo", "evidence_recall_at_1", {
    topK: 1,
    includeSummaries: false
  }, "artifacts/external-hard/locomo-top1-no-summaries.json", runLocomoBenchmark({
    topK: 1,
    includeSummaries: false,
    outputPath: "artifacts/external-hard/locomo-top1-no-summaries.json"
  })));

  rows.push(summarize("longmemeval-top1", "LongMemEval-S", "answer_session_recall_at_1", {
    topK: 1
  }, "artifacts/external-hard/longmemeval-top1.json", runLongMemEvalBenchmark({
    topK: 1,
    outputPath: "artifacts/external-hard/longmemeval-top1.json"
  })));

  rows.push(summarize("beam-100k-top5", "BEAM 100K", "retrieval_nugget_score_at_5", {
    split: "100K",
    topK: 5
  }, "artifacts/external-hard/beam-100k-top5.json", await runBeamBenchmark({
    split: "100K",
    topK: 5,
    outputPath: "artifacts/external-hard/beam-100k-top5.json"
  })));

  rows.push(summarize("beam-500k-top5", "BEAM 500K", "retrieval_nugget_score_at_5", {
    split: "500K",
    topK: 5
  }, "artifacts/external-hard/beam-500k-top5.json", await runBeamBenchmark({
    split: "500K",
    topK: 5,
    outputPath: "artifacts/external-hard/beam-500k-top5.json"
  })));

  rows.push(summarize("beam-1m-top5", "BEAM 1M", "retrieval_nugget_score_at_5", {
    split: "1M",
    topK: 5
  }, "artifacts/external-hard/beam-1m-top5.json", await runBeamBenchmark({
    split: "1M",
    topK: 5,
    outputPath: "artifacts/external-hard/beam-1m-top5.json"
  })));

  const report = buildExternalHardSummary(rows, {
    generatedAt: new Date().toISOString(),
    strict: Boolean(options.strict)
  });

  writeJson(outputPath, report);
  writeMarkdown(markdownPath, report);
  return report;
}

export function buildExternalHardSummary(rows: ExternalHardRow[], options: { generatedAt?: string; strict?: boolean } = {}) {
  const claimBlockers = rows.flatMap((row) => row.claimBlockers);
  return {
    schemaVersion: "1.0",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    mode: "external-hard",
    description: "Public dataset stress run with stricter retrieval budgets than the default docs snapshot.",
    strictGate: Boolean(options.strict),
    proofLevel: rows.every((row) => row.scoreable) ? "scoreable-public-dataset-stress" : "diagnostic-public-dataset-stress",
    passed: rows.every((row) => row.passed),
    diagnosticPassed: rows.every((row) => row.diagnosticPassed),
    claimAllowed: rows.every((row) => row.passed),
    limitations: [
      "External-hard public dataset stress rows are diagnostics unless their child benchmark artifact carries LLM/harness or comparable public-benchmark proof.",
      "Local evidence-id, session-id, deterministic or rubric recall wins may guide engineering work but must not be presented as quality or market claims."
    ],
    claimBlockers,
    rows
  };
}

export function summarize(id: string, dataset: string, metric: string, config: Record<string, unknown>, outputPath: string, report: BenchmarkReport): ExternalHardRow {
  const cognibrain = report.ours?.accuracy ?? 0;
  const strongest = (report.baselines ?? []).reduce((best, baseline) => (baseline.accuracy ?? 0) > (best.accuracy ?? 0) ? baseline : best, { name: "none", accuracy: 0 });
  const bestBaseline = strongest.accuracy ?? 0;
  const proof = benchmarkProof(report);
  const scoreable = proof !== "local-diagnostic";
  const diagnosticPassed = Boolean(report.diagnosticPassed ?? report.passed);
  const scorer = report.claimBoundary?.scorer ? ` (${report.claimBoundary.scorer})` : "";
  return {
    id,
    dataset,
    metric,
    config,
    outputPath,
    passed: scoreable && diagnosticPassed,
    diagnosticPassed,
    scoreable,
    proof,
    cognibrain,
    bestBaseline,
    gapToBestBaseline: Number((cognibrain - bestBaseline).toFixed(4)),
    strongestBaseline: strongest.name,
    claimBlockers: scoreable ? [] : [
      `${dataset} ${metric} is local-diagnostic${scorer}; require LLM/harness or comparable public-benchmark proof before quality or market claims.`
    ]
  };
}

function benchmarkProof(report: BenchmarkReport): ExternalHardRow["proof"] {
  const kind = report.ours && "judge" in report.ours ? (report.ours as { judge?: { kind?: string } }).judge?.kind : report.judge?.kind;
  const proof = report.proof ?? report.proofLevel;
  if (report.qualityClaimAllowed === true && (kind === "llm" || kind === "harness" || kind === "provider-evidence-support" || proof === "llm-harness" || proof === "public-benchmark")) {
    return proof === "public-benchmark" ? "public-benchmark" : "llm-harness";
  }
  if (kind === "llm" || kind === "harness" || kind === "provider-evidence-support" || proof === "llm-harness") return "llm-harness";
  if (proof === "public-benchmark") return "public-benchmark";
  return "local-diagnostic";
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeMarkdown(path: string, report: { generatedAt: string; passed: boolean; diagnosticPassed?: boolean; claimAllowed?: boolean; proofLevel?: string; rows: ExternalHardRow[]; claimBlockers?: string[] }): void {
  const lines = [
    "# External Hard Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Proof level: \`${report.proofLevel ?? "unknown"}\`. Claim allowed: ${report.claimAllowed ? "yes" : "no"}. Diagnostic passed: ${report.diagnosticPassed ? "yes" : "no"}.`,
    "",
    "| Dataset | Metric | Cognibrain | Strongest baseline | Gap | Proof | Claim | Diagnostic |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | --- |",
    ...report.rows.map((row) =>
      `| ${row.dataset} | \`${row.metric}\` | ${percent(row.cognibrain)} | ${row.strongestBaseline} ${percent(row.bestBaseline)} | ${signedPercent(row.gapToBestBaseline)} | \`${row.proof}\` | ${row.passed ? "Pass" : "Blocked"} | ${row.diagnosticPassed ? "Pass" : "Needs work"} |`
    ),
    "",
    "Claim blockers:",
    ...(report.claimBlockers?.length ? report.claimBlockers.map((item) => `- ${item}`) : ["- none"])
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function signedPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${percent(value)}`;
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const report = await runExternalHardBenchmarks({
    out: args.get("--out") ?? undefined,
    markdown: args.get("--markdown") ?? undefined,
    strict: args.has("--strict")
  });
  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    passed: report.passed,
    diagnosticPassed: report.diagnosticPassed,
    claimAllowed: report.claimAllowed,
    proofLevel: report.proofLevel,
    claimBlockers: report.claimBlockers,
    rows: report.rows.map((row) => ({
      dataset: row.dataset,
      metric: row.metric,
      proof: row.proof,
      cognibrain: row.cognibrain,
      strongestBaseline: row.strongestBaseline,
      bestBaseline: row.bestBaseline,
      gapToBestBaseline: row.gapToBestBaseline,
      passed: row.passed,
      diagnosticPassed: row.diagnosticPassed
    }))
  }, null, 2));
  process.exit(report.passed || (!args.has("--strict") && report.diagnosticPassed) ? 0 : 1);
}
