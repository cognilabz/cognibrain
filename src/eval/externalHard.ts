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
  cognibrain: number;
  bestBaseline: number;
  gapToBestBaseline: number;
  strongestBaseline: string;
};

type BenchmarkReport = {
  passed?: boolean;
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

  const report = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    mode: "external-hard",
    description: "Public dataset stress run with stricter retrieval budgets than the default docs snapshot.",
    strictGate: Boolean(options.strict),
    passed: rows.every((row) => row.passed),
    rows
  };

  writeJson(outputPath, report);
  writeMarkdown(markdownPath, report);
  return report;
}

function summarize(id: string, dataset: string, metric: string, config: Record<string, unknown>, outputPath: string, report: BenchmarkReport): ExternalHardRow {
  const cognibrain = report.ours?.accuracy ?? 0;
  const strongest = (report.baselines ?? []).reduce((best, baseline) => (baseline.accuracy ?? 0) > (best.accuracy ?? 0) ? baseline : best, { name: "none", accuracy: 0 });
  const bestBaseline = strongest.accuracy ?? 0;
  return {
    id,
    dataset,
    metric,
    config,
    outputPath,
    passed: Boolean(report.passed),
    cognibrain,
    bestBaseline,
    gapToBestBaseline: Number((cognibrain - bestBaseline).toFixed(4)),
    strongestBaseline: strongest.name
  };
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeMarkdown(path: string, report: { generatedAt: string; passed: boolean; rows: ExternalHardRow[] }): void {
  const lines = [
    "# External Hard Benchmark",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Dataset | Metric | Cognibrain | Strongest baseline | Gap | Result |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...report.rows.map((row) =>
      `| ${row.dataset} | \`${row.metric}\` | ${percent(row.cognibrain)} | ${row.strongestBaseline} ${percent(row.bestBaseline)} | ${signedPercent(row.gapToBestBaseline)} | ${row.passed ? "Pass" : "Needs work"} |`
    )
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
    rows: report.rows.map((row) => ({
      dataset: row.dataset,
      metric: row.metric,
      cognibrain: row.cognibrain,
      strongestBaseline: row.strongestBaseline,
      bestBaseline: row.bestBaseline,
      gapToBestBaseline: row.gapToBestBaseline,
      passed: row.passed
    }))
  }, null, 2));
  process.exit(report.passed || !args.has("--strict") ? 0 : 1);
}
