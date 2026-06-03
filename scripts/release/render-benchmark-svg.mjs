#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const outputPath = process.argv[2] ?? "docs/assets/benchmark-results.svg";

const artifacts = {
  cognicode: readJson("artifacts/cognicodebench/run.json"),
  arena: readJson("artifacts/arena/run.json"),
  locomo: readJson("artifacts/locomo-report.json"),
  longmemeval: readJson("artifacts/longmemeval-report.json"),
  beam100k: readJson("artifacts/beam-report.json"),
  beam500k: readJson("artifacts/beam-500k-report.json"),
  beam1m: readJson("artifacts/beam-1m-report.json")
};

const publicBenchmarks = [
  publicRow("LoCoMo", artifacts.locomo),
  publicRow("LongMemEval-S", artifacts.longmemeval),
  publicRow("BEAM 100K", artifacts.beam100k),
  publicRow("BEAM 500K", artifacts.beam500k),
  publicRow("BEAM 1M", artifacts.beam1m)
].filter(Boolean);

const diagnosticRows = [
  {
    label: "CogniCode integrity",
    value: artifacts.cognicode?.diagnostics?.integrity?.score,
    detail: `local diagnostic · claim ${artifacts.cognicode?.qualityClaimAllowed ? "allowed" : "blocked"}`,
    kind: artifacts.cognicode?.qualityClaimAllowed ? "comparison" : "blocked"
  },
  ...cognicodeWeaknessRows(),
  ...beamWeaknessRows("BEAM 100K", artifacts.beam100k),
  ...beamWeaknessRows("BEAM 500K", artifacts.beam500k),
  ...beamWeaknessRows("BEAM 1M", artifacts.beam1m)
].filter((row) => Number.isFinite(Number(row.value)));

const arenaRows = [...(artifacts.arena?.leaderboard ?? [])].map((row) => ({
  label: row.system,
  value: Number(row.score ?? 0),
  detail: arenaProofDetail(row.proofLevel),
  kind: row.proofLevel === "same-run-full" ? "cognibrain" : "blocked"
}));

const ablationRows = [
  { label: "Cognibrain full", value: artifacts.cognicode?.ablation?.cognibrain_full?.score, detail: "internal diagnostic · claim blocked", kind: "blocked" },
  { label: "Without temporal", value: artifacts.cognicode?.ablation?.cognibrain_without_temporal?.score, detail: "ablation diagnostic · claim blocked", kind: "blocked" },
  { label: "Procedure only", value: baselineScore("procedure_only"), detail: "baseline diagnostic · claim blocked", kind: "blocked" },
  { label: "Keyword only", value: baselineScore("keyword_only"), detail: "baseline diagnostic · claim blocked", kind: "blocked" },
  { label: "Graph only", value: baselineScore("graph_only"), detail: "baseline diagnostic · claim blocked", kind: "blocked" },
  { label: "Without corrections", value: artifacts.cognicode?.ablation?.cognibrain_without_corrections?.score, detail: "ablation diagnostic · claim blocked", kind: "blocked" },
  { label: "Temporal only", value: baselineScore("temporal_only"), detail: "baseline diagnostic · claim blocked", kind: "blocked" },
  { label: "Vector only", value: baselineScore("vector_only"), detail: "baseline diagnostic · claim blocked", kind: "blocked" },
  { label: "No memory", value: baselineScore("no_memory"), detail: "baseline diagnostic · claim blocked", kind: "blocked" }
].filter((row) => Number.isFinite(Number(row.value)));

const svg = renderSvg({ publicBenchmarks, diagnosticRows, arenaRows, ablationRows });
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${svg}\n`);

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function publicRow(label, report) {
  if (!report?.ours) return null;
  const baselines = report.baselines ?? [];
  const bestBaseline = baselines.reduce((best, candidate) => {
    const accuracy = Number(candidate.accuracy ?? 0);
    return accuracy > best.accuracy ? { name: candidate.name, accuracy } : best;
  }, { name: "baseline", accuracy: 0 });
  return {
    label,
    value: Number(report.ours.accuracy ?? 0),
    detail: `${report.ours.correct ?? 0}/${report.ours.total ?? 0}`,
    proof: publicProof(report),
    claimAllowed: publicClaimAllowed(report),
    diagnosticPassed: Boolean(report.diagnosticPassed ?? report.passed),
    claimDetail: publicClaimDetail(report),
    baselineLabel: formatLabel(bestBaseline.name),
    baseline: bestBaseline.accuracy
  };
}

function publicProof(report) {
  return String(report?.proof ?? report?.claimBoundary?.scorer ?? "boundary-missing");
}

function publicClaimAllowed(report) {
  const proof = publicProof(report);
  return report?.qualityClaimAllowed === true && (proof === "llm-harness" || proof === "public-benchmark");
}

function publicClaimDetail(report) {
  if (publicClaimAllowed(report)) return "claim allowed";
  if (report?.claimBoundary?.claimBlockers?.length) return "claim blocked";
  return "claim blocked";
}

function arenaProofDetail(proofLevel) {
  if (proofLevel === "same-run-full") return "local full · not market proof";
  if (proofLevel === "credential-blocked") return "blocked · no scoreable claim";
  if (proofLevel === "same-run-api-shape") return "api-shape diagnostic · claim blocked";
  if (proofLevel === "same-run-native" || proofLevel === "same-run-cloud-api" || proofLevel === "same-run-cli") return `${proofLevel} · judge required`;
  return `${proofLevel ?? "unknown"} · claim blocked`;
}

function baselineScore(name) {
  return artifacts.cognicode?.baselines?.find((baseline) => baseline.name === name)?.score;
}

function cognicodeWeaknessRows() {
  const severityScore = { high: 0.25, medium: 0.5, low: 0.75 };
  return (artifacts.cognicode?.diagnostics?.weaknesses ?? []).slice(0, 3).map((weakness) => ({
    label: `CogniCode ${weakness.area}`,
    value: severityScore[weakness.severity] ?? 0.5,
    detail: `${weakness.severity} severity`,
    kind: "blocked"
  }));
}

function beamWeaknessRows(label, report) {
  return (report?.ours?.weaknesses ?? []).slice(0, 2).map((weakness) => ({
    label: `${label} ${formatLabel(weakness.category)}`,
    value: Number(weakness.accuracy ?? 0),
    detail: `gap ${(Number(weakness.gapToBestCategory ?? 0) * 100).toFixed(1)}pp`,
    kind: "blocked"
  }));
}

function renderSvg(sections) {
  const width = 1180;
  const publicHeight = 82 + sections.publicBenchmarks.length * 62 + 34;
  const diagnosticHeight = 82 + sections.diagnosticRows.length * 40 + 34;
  const arenaHeight = 82 + sections.arenaRows.length * 40 + 34;
  const ablationHeight = 82 + sections.ablationRows.length * 40 + 34;
  const height = 128 + publicHeight + 26 + diagnosticHeight + 26 + arenaHeight + 26 + ablationHeight + 36;
  const margin = 36;
  const axis = { x: 260, width: 760 };
  let y = 128;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">Cognibrain benchmark results</title>`,
    `<desc id="desc">Percent charts comparing current Cognibrain results with proof and claim boundaries for public benchmark diagnostics, Benchmark Arena systems, and CogniCodeBench artifacts.</desc>`,
    `<style>
      text { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #152033; }
      .title { font-size: 30px; font-weight: 760; }
      .subtitle { font-size: 14px; fill: #586273; }
      .section-title { font-size: 18px; font-weight: 760; }
      .section-note { font-size: 12px; fill: #667085; }
      .label { font-size: 13px; font-weight: 620; }
      .detail { font-size: 11px; fill: #667085; }
      .tick { font-size: 11px; fill: #748094; }
      .value { font-size: 12px; font-weight: 720; }
      .grid { stroke: #dfe5ed; stroke-width: 1; }
      .axis { stroke: #b8c2d0; stroke-width: 1; }
      .panel { fill: #ffffff; stroke: #d9e0ea; stroke-width: 1; }
      .bar-cognibrain { fill: #087f8c; }
      .bar-comparison { fill: #61748a; }
      .bar-baseline { fill: #a7b3c2; }
      .bar-blocked { fill: #d7dde6; }
      .marker { fill: #f59e0b; }
    </style>`,
    `<rect width="${width}" height="${height}" fill="#f6f8fb"/>`,
    `<text class="title" x="${margin}" y="46">Benchmark Results</text>`,
    `<text class="subtitle" x="${margin}" y="72">Fresh local run, percent scale. Diagnostic rows are not quality or market proof unless LLM/harness claim status says so.</text>`,
    `<text class="subtitle" x="${margin}" y="94">Generated ${escapeText(generatedAtSummary())}</text>`
  ];

  y = renderPanel(parts, {
    x: margin,
    y,
    width: width - margin * 2,
    title: "Public Benchmark Datasets",
    note: "Cognibrain compared with the strongest local baseline; each row carries proof and claim status.",
    axis,
    rows: sections.publicBenchmarks,
    rowRenderer: renderPublicRow
  });

  y = renderPanel(parts, {
    x: margin,
    y: y + 26,
    width: width - margin * 2,
    title: "Benchmark Integrity And Weaknesses",
    note: "Lower bars identify overfit risk or weak categories that should drive the next improvement loop.",
    axis,
    rows: sections.diagnosticRows,
    rowRenderer: renderSingleBarRow
  });

  y = renderPanel(parts, {
    x: margin,
    y: y + 26,
    width: width - margin * 2,
    title: "Benchmark Arena Systems",
    note: "Synthetic Cognibrain scenario stream; API-shape and blocked rows are diagnostic, not market proof.",
    axis,
    rows: sections.arenaRows,
    rowRenderer: renderSingleBarRow
  });

  y = renderPanel(parts, {
    x: margin,
    y: y + 26,
    width: width - margin * 2,
    title: "CogniCodeBench Ablation",
    note: "Internal regression and ablation diagnostics; baseline and ablation bars are not market or quality claims.",
    axis,
    rows: sections.ablationRows,
    rowRenderer: renderSingleBarRow
  });

  parts.push(`</svg>`);
  return parts.join("\n");
}

function renderPanel(parts, options) {
  const headerHeight = 82;
  const rowHeight = options.rowRenderer === renderPublicRow ? 74 : 40;
  const footer = 34;
  const height = headerHeight + options.rows.length * rowHeight + footer;
  const gridTop = options.y + headerHeight - 8;
  const gridBottom = options.y + height - footer + 8;
  parts.push(`<rect class="panel" x="${options.x}" y="${options.y}" width="${options.width}" height="${height}" rx="10"/>`);
  parts.push(`<text class="section-title" x="${options.x + 24}" y="${options.y + 34}">${escapeText(options.title)}</text>`);
  parts.push(`<text class="section-note" x="${options.x + 24}" y="${options.y + 56}">${escapeText(options.note)}</text>`);
  renderAxis(parts, options.axis, gridTop, gridBottom);
  options.rows.forEach((row, index) => options.rowRenderer(parts, row, options.axis, options.y + headerHeight + index * rowHeight));
  return options.y + height;
}

function renderAxis(parts, axis, y1, y2) {
  for (const tick of [0, 25, 50, 75, 100]) {
    const x = axis.x + (axis.width * tick) / 100;
    parts.push(`<line class="grid" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>`);
    parts.push(`<text class="tick" x="${x - 10}" y="${y1 - 8}">${tick}%</text>`);
  }
  parts.push(`<line class="axis" x1="${axis.x}" y1="${y2}" x2="${axis.x + axis.width}" y2="${y2}"/>`);
}

function renderPublicRow(parts, row, axis, y) {
  const main = percent(row.value);
  const baseline = percent(row.baseline);
  const mainClass = row.claimAllowed ? "bar-cognibrain" : "bar-blocked";
  parts.push(`<text class="label" x="60" y="${y + 18}">${escapeText(row.label)}</text>`);
  parts.push(`<text class="detail" x="60" y="${y + 38}">Cognibrain ${escapeText(row.detail)}</text>`);
  parts.push(`<text class="detail" x="60" y="${y + 55}">${escapeText(row.proof)} · ${escapeText(row.claimDetail)} · diagnostic ${row.diagnosticPassed ? "pass" : "fail"}</text>`);
  parts.push(`<rect class="bar-baseline" x="${axis.x}" y="${y + 30}" width="${barWidth(axis, row.baseline)}" height="14" rx="4"/>`);
  parts.push(`<rect class="${mainClass}" x="${axis.x}" y="${y + 4}" width="${barWidth(axis, row.value)}" height="18" rx="4"/>`);
  if (!row.claimAllowed) parts.push(`<circle class="marker" cx="${axis.x + 5}" cy="${y + 13}" r="5"/>`);
  parts.push(`<text class="value" x="${axis.x + barWidth(axis, row.value) + 10}" y="${y + 18}">${main}</text>`);
  parts.push(`<text class="detail" x="${axis.x + barWidth(axis, row.baseline) + 10}" y="${y + 42}">${escapeText(row.baselineLabel)} ${baseline}</text>`);
}

function renderSingleBarRow(parts, row, axis, y) {
  const cssClass = row.kind === "cognibrain" ? "bar-cognibrain" : row.kind === "blocked" ? "bar-blocked" : "bar-comparison";
  const value = Number(row.value ?? 0);
  parts.push(`<text class="label" x="60" y="${y + 17}">${escapeText(row.label)}</text>`);
  parts.push(`<text class="detail" x="60" y="${y + 32}">${escapeText(row.detail ?? "")}</text>`);
  parts.push(`<rect class="${cssClass}" x="${axis.x}" y="${y + 5}" width="${barWidth(axis, value)}" height="18" rx="4"/>`);
  if (row.kind === "blocked") parts.push(`<circle class="marker" cx="${axis.x + 5}" cy="${y + 14}" r="5"/>`);
  parts.push(`<text class="value" x="${axis.x + barWidth(axis, value) + 10}" y="${y + 19}">${percent(value)}</text>`);
}

function barWidth(axis, value) {
  return Math.max(4, Math.min(axis.width, axis.width * Number(value ?? 0)));
}

function percent(value) {
  return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

function formatLabel(value) {
  return String(value ?? "")
    .split(/[-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function generatedAtSummary() {
  const allTimes = [
    artifacts.arena?.generatedAt,
    artifacts.cognicode?.generatedAt,
    artifacts.locomo?.generatedAt,
    artifacts.longmemeval?.generatedAt,
    artifacts.beam100k?.generatedAt,
    artifacts.beam500k?.generatedAt,
    artifacts.beam1m?.generatedAt
  ].filter(Boolean);
  const date = shortDate(newestIso(allTimes) ?? new Date().toISOString());
  const publicTimes = [
    artifacts.locomo?.generatedAt,
    artifacts.longmemeval?.generatedAt,
    artifacts.beam100k?.generatedAt,
    artifacts.beam500k?.generatedAt,
    artifacts.beam1m?.generatedAt
  ].filter(Boolean).map(shortClock);
  return `${date} UTC; public datasets ${range(publicTimes)}, arena ${shortClock(artifacts.arena?.generatedAt)}, cognicode ${shortClock(artifacts.cognicode?.generatedAt)}`;
}

function newestIso(values) {
  return values
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString();
}

function shortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function shortClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return `${date.toISOString().slice(11, 16)}Z`;
}

function range(values) {
  if (!values.length) return "n/a";
  if (values.length === 1) return values[0];
  return `${values[0]}-${values[values.length - 1]}`;
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
