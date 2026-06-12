#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outputJsonPath = "artifacts/public/benchmark-summary.json";
const outputMarkdownPath = "artifacts/docs/benchmark-summary.md";
const outputDocsPath = "docs/benchmarks.md";
const outputSvgPath = "docs/assets/benchmark-summary.svg";

const artifacts = {
  cognicode: readJson("artifacts/cognicodebench/run.json"),
  locomo: readJson("artifacts/locomo-report.json"),
  longmemeval: readJson("artifacts/longmemeval-report.json"),
  beam100k: readJson("artifacts/beam-report.json"),
  beam500k: readJson("artifacts/beam-500k-report.json"),
  beam1m: readJson("artifacts/beam-1m-report.json"),
  realworld: readJson("artifacts/realworld-blackbox.json"),
  reality: readJson("artifacts/public/evidence-table/index.json")
};

const summary = buildSummary();
writeJson(outputJsonPath, summary);
const markdown = renderMarkdown(summary);
writeText(outputMarkdownPath, markdown);
writeText(outputDocsPath, markdown);
writeText(outputSvgPath, renderSvg(summary));

console.log(JSON.stringify({
  generatedAt: summary.generatedAt,
  claimLevel: summary.claimLevel,
  marketLeaderboardAllowed: summary.marketLeaderboardAllowed,
  outputs: [outputJsonPath, outputMarkdownPath, outputDocsPath, outputSvgPath]
}, null, 2));

function buildSummary() {
  const cognicode = artifacts.cognicode ?? {};
  const fullScore = number(cognicode.ablation?.cognibrain_full?.score ?? cognicode.diagnostics?.integrity?.metrics?.fullScore);
  const strongestAblation = strongestAblationRow(cognicode);
  const keyword = cognicode.baselines?.find((baseline) => baseline.name === "keyword_only");
  const locomo = publicDatasetRow("LoCoMo diagnostic delta", artifacts.locomo, "artifacts/locomo-report.json");
  const longmemeval = publicDatasetRow("LongMemEval-S diagnostic delta", artifacts.longmemeval, "artifacts/longmemeval-report.json");
  const beam = publicDatasetRow("BEAM 1M diagnostic delta", artifacts.beam1m, "artifacts/beam-1m-report.json");
  const abstention = beamWeakness("BEAM abstention", artifacts.beam1m, "abstention");
  const realityGate = artifacts.reality?.claimGate;
  const realworldBoundary = artifacts.realworld?.claimBoundary;
  const generatedAt = newestIso([
    cognicode.generatedAt,
    artifacts.locomo?.generatedAt,
    artifacts.longmemeval?.generatedAt,
    artifacts.beam100k?.generatedAt,
    artifacts.beam500k?.generatedAt,
    artifacts.beam1m?.generatedAt,
    artifacts.realworld?.generatedAt,
    artifacts.reality?.generatedAt
  ]);

  const evidence = [
    {
      question: "Can Cognibrain prevent repeated coding-agent mistakes in controlled repo-like workflows?",
      evidence: "CogniCodeBench",
      artifact: "artifacts/cognicodebench/run.json",
      result: `${integer(cognicode.scenarioCount)} scenarios; ${percent(fullScore)} diagnostic score; ${percent(cognicode.diagnostics?.integrity?.score)} integrity`,
      claimLevel: "L1 Local diagnostic",
      limitation: "Synthetic/internal; not market comparison"
    },
    {
      question: "Can it retrieve relevant memory on public-style long-memory tasks?",
      evidence: "LoCoMo / LongMemEval-S / BEAM stress",
      artifact: "artifacts/locomo-report.json, artifacts/longmemeval-report.json, artifacts/beam-1m-report.json",
      result: `${datasetResult(artifacts.locomo)}; ${datasetResult(artifacts.longmemeval)}; ${datasetResult(artifacts.beam1m)}`,
      claimLevel: "L2 Public stress diagnostic",
      limitation: "Retrieval signal only; not answer quality or competitor proof"
    },
    {
      question: "Does it have known weaknesses?",
      evidence: "BEAM weakness analysis",
      artifact: "artifacts/beam-report.json, artifacts/beam-500k-report.json, artifacts/beam-1m-report.json",
      result: "Abstention 0.0%; temporal and knowledge-update categories remain weak",
      claimLevel: "Diagnostic weakness",
      limitation: "Needs unsupported-question and temporal freshness work"
    },
    {
      question: "Is a fair market benchmark ready?",
      evidence: "Reality Bench / EMRP gate and real-world black-box harness",
      artifact: "artifacts/public/evidence-table/index.json, artifacts/realworld-blackbox.json",
      result: `${artifacts.realworld?.systems?.length ?? 0} harness slots; raw outputs and telemetry path present; market gate closed`,
      claimLevel: "L0 Gate closed",
      limitation: "Missing same judge, original competitor command outputs, public hash, and replication"
    },
    {
      question: "Is market leadership claimable?",
      evidence: "Reality/EMRP claim gate",
      artifact: "artifacts/public/evidence-table/index.json",
      result: realityGate?.marketClaimAllowed ? "Yes" : "No",
      claimLevel: "L0 Gate closed",
      limitation: "Requires original competitor runs, shared judge traces, hashes, and independent replication"
    }
  ];

  return {
    schemaVersion: "1.0",
    generatedAt,
    claimLevel: "local-diagnostic",
    claimLevelLabel: "Local diagnostic evidence",
    marketLeaderboardAllowed: Boolean(realityGate?.marketClaimAllowed && realworldBoundary?.marketClaimAllowed),
    statusCards: [
      { label: "Current claim level", value: "Local diagnostic evidence" },
      { label: "What is supported", value: "Strong local evidence for coding-agent engineering-memory workflows." },
      { label: "What is not supported", value: "No public best-product claim, no market leaderboard, no BEAM quality claim." },
      { label: "Next gate", value: "Same-protocol judged runs with original competitor systems, raw outputs, hashes, and replication." }
    ],
    safeClaims: [
      "Cognibrain has reproducible local diagnostics for engineering-memory workflows.",
      "Cognibrain has public-style retrieval stress evidence that is useful as a diagnostic signal.",
      "The current benchmark surface blocks market and broad quality claims until stricter evidence gates pass."
    ],
    forbiddenClaims: [
      "Cognibrain is the best memory product on the market.",
      "Cognibrain beats original competitor systems.",
      "BEAM rows prove answer quality."
    ],
    evidence,
    keyResults: [
      {
        label: "CogniCodeBench full system",
        value: fullScore,
        display: percent(fullScore),
        detail: "Full local engineering-memory diagnostic",
        artifact: "artifacts/cognicodebench/run.json"
      },
      {
        label: `Strongest ablation: ${strongestAblation.label}`,
        value: strongestAblation.value,
        display: percent(strongestAblation.value),
        detail: "Internal ablation diagnostic",
        artifact: "artifacts/cognicodebench/run.json"
      },
      {
        label: "Keyword baseline",
        value: number(keyword?.score),
        display: percent(keyword?.score),
        detail: "Internal baseline diagnostic",
        artifact: "artifacts/cognicodebench/run.json"
      },
      locomo,
      longmemeval,
      beam,
      {
        label: abstention.label,
        value: abstention.value,
        display: percent(abstention.value),
        detail: "Known weakness marker",
        artifact: abstention.artifact
      }
    ].filter((row) => Number.isFinite(row.value)).slice(0, 7),
    knownWeaknesses: [
      "No market leaderboard yet: no same-protocol judged original-competitor run.",
      "BEAM abstention is currently 0.0% across tested splits.",
      "Temporal reasoning and knowledge-update retrieval are weak.",
      "Public dataset stress is retrieval evidence, not answer-quality proof.",
      "Arena/API-shape rows are internal capability diagnostics, not competitor results."
    ],
    claimLevels: [
      ["L0", "Not run / blocked", "No result. Show the reason and next gate only."],
      ["L1", "Local diagnostic", "Regression/product diagnostic; no market claim."],
      ["L2", "Public stress diagnostic", "Public or public-style data; no fair competitor comparison."],
      ["L3", "Quality-judged evidence", "Same judge, raw outputs, reproducible scoring traces."],
      ["L4", "Market-comparable", "Original systems, same protocol and budgets, public hash, independent replication."]
    ],
    marketGate: {
      allowed: Boolean(realityGate?.marketClaimAllowed),
      requirements: [
        gateRow("Frozen manifest", realityGate?.gates?.manifestFrozenBeforeRun, "Required before any market run."),
        gateRow("Same input stream", realityGate?.gates?.sameInputStream, "Every eligible system must use the same manifest input stream."),
        gateRow("Same judge traces", realityGate?.gates?.sameJudge, "Missing for the current public status."),
        gateRow("Original competitor command outputs", realityGate?.gates?.atLeastTwoMajorCompetitorsEligible, "Need at least two eligible original competitor systems."),
        gateRow("Raw outputs retained", realityGate?.gates?.rawOutputsRetained, "Required for audit and replication."),
        gateRow("Cost and latency recorded", realityGate?.gates?.costLatencyRecorded, "Required for budget fairness."),
        gateRow("Public artifact hash", realityGate?.gates?.publicArtifactHashPresent, "Missing for the current public status."),
        gateRow("Independent replication hash", realityGate?.gates?.independentReplicationHashPresent, "Missing for the current public status."),
        { requirement: "Market leaderboard", status: realityGate?.leaderboardAllowed ? "Open" : "Closed", note: "Claim gate opens only when all evidence gates pass." }
      ],
      blockers: realityGate?.blockers ?? realworldBoundary?.claimBlockers ?? []
    },
    reproduce: [
      "npm test",
      "npm run build",
      "npm run release:check",
      "npm run benchmark:reality:run",
      "npm run benchmark:reality:publish",
      "npm run internal -- benchmark:summary"
    ],
    artifacts: [
      outputJsonPath,
      outputMarkdownPath,
      outputSvgPath,
      "artifacts/cognicodebench/run.json",
      "artifacts/public/evidence-table/index.json",
      "artifacts/realworld-blackbox.json",
      "artifacts/locomo-report.json",
      "artifacts/longmemeval-report.json",
      "artifacts/beam-report.json",
      "artifacts/beam-500k-report.json",
      "artifacts/beam-1m-report.json"
    ]
  };
}

function renderMarkdown(summary) {
  return `# Benchmark Evidence

_Last generated: ${summary.generatedAt} UTC_  
_Current claim level: ${summary.claimLevelLabel}_  
_Market leaderboard: ${summary.marketLeaderboardAllowed ? "Open" : "Not open"}_

Honest evidence for Cognibrain's engineering-memory loop. Current public status: local diagnostic evidence, no market leaderboard claim yet.

| Status | Current answer |
| --- | --- |
${summary.statusCards.map((card) => `| ${card.label} | ${card.value} |`).join("\n")}

## Current Verdict

Cognibrain currently has strong local diagnostic evidence for engineering-memory workflows: repeated-mistake prevention, correction carry-over, patch evidence, source-aware recall, stale-memory suppression, and guard behavior.

It does not yet publish a fair market leaderboard against original competitor systems. The current page proves a focused engineering-memory loop, not market leadership.

## Evidence Matrix

| Question | Best current evidence | Result | Claim status | Limitation |
| --- | --- | --- | --- | --- |
${summary.evidence.map((row) => `| ${row.question} | ${row.evidence} | ${row.result} | ${row.claimLevel} | ${row.limitation} |`).join("\n")}

## What The Numbers Mean

| Badge | Meaning | Can be used publicly as |
| --- | --- | --- |
| Claimable | Passed quality or market gate. | The exact bounded claim. |
| Diagnostic | Useful regression or stress evidence. | Internal/local evidence with the stated proof boundary. |
| Blocked / not scored | Setup, judge, credential, or protocol gate missing. | No result. It belongs in a gate or coverage table, not a score chart. |

Public labels are intentionally simple:

| Level | Public label | Meaning |
| --- | --- | --- |
${summary.claimLevels.map(([level, label, meaning]) => `| ${level} | ${label} | ${meaning} |`).join("\n")}

## Key Results

![Benchmark evidence summary](assets/benchmark-summary.svg)

Only scored diagnostic values appear in the chart. Closed gates and missing judge/setup states are represented below as requirements, not bars.

| Result | Value | Evidence | Boundary |
| --- | ---: | --- | --- |
${summary.keyResults.map((row) => `| ${row.label} | ${row.display} | \`${row.artifact}\` | ${row.detail} |`).join("\n")}

## Known Limits And Failures

${summary.knownWeaknesses.map((item) => `- ${item}`).join("\n")}

## Market Gate Status

| Requirement | Current state | Note |
| --- | --- | --- |
${summary.marketGate.requirements.map((row) => `| ${row.requirement} | ${row.status} | ${row.note} |`).join("\n")}

## Reproduce / Artifacts

Minimal commands:

\`\`\`bash
${summary.reproduce.join("\n")}
\`\`\`

Generated summary artifacts:

${summary.artifacts.map((artifact) => `- \`${artifact}\``).join("\n")}

Each visible number above is backed by a generated timestamp and artifact path. Raw outputs, scorer traces, manifest hashes, and full setup diagnostics stay in the generated artifacts until the market gate opens.

## Appendix

The former artifact snapshot, maintainer refresh map, Arena API-shape rows, native competitor smoke rows, original public benchmark blockers, and full raw tables are maintainer diagnostics. They remain available in \`artifacts/\` and generated benchmark reports, but they are not part of the public score surface while the market gate is closed.
`;
}

function renderSvg(summary) {
  const width = 1040;
  const rowHeight = 58;
  const height = 148 + summary.keyResults.length * rowHeight + 54;
  const axis = { x: 354, width: 520 };
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    `<title id="title">Benchmark evidence summary</title>`,
    `<desc id="desc">Compact docs-visible diagnostic chart for Cognibrain benchmark evidence. Closed market gates are not rendered as scores.</desc>`,
    `<style>
      text { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #18212f; }
      .title { font-size: 28px; font-weight: 760; }
      .subtitle { font-size: 13px; fill: #5f6978; }
      .label { font-size: 13px; font-weight: 660; }
      .detail { font-size: 11px; fill: #687385; }
      .tick { font-size: 11px; fill: #748094; }
      .value { font-size: 12px; font-weight: 760; }
      .grid { stroke: #dfe5ed; stroke-width: 1; }
      .axis { stroke: #b8c2d0; stroke-width: 1; }
      .panel { fill: #fbfcfe; stroke: #d9e0ea; stroke-width: 1; }
      .bar-primary { fill: #087f8c; }
      .bar-secondary { fill: #60748a; }
      .bar-weakness { fill: #d6902f; }
    </style>`,
    `<rect width="${width}" height="${height}" fill="#f5f7fb"/>`,
    `<rect class="panel" x="28" y="26" width="${width - 56}" height="${height - 52}" rx="8"/>`,
    `<text class="title" x="54" y="66">Benchmark Evidence</text>`,
    `<text class="subtitle" x="54" y="92">Local diagnostic evidence; market leaderboard not open. Generated ${escapeText(summary.generatedAt)} UTC.</text>`,
    `<text class="subtitle" x="54" y="114">Only scored diagnostics are charted. Closed gates are listed as requirements, not score bars.</text>`
  ];
  const gridTop = 154;
  const gridBottom = 136 + summary.keyResults.length * rowHeight;
  for (const tick of [0, 25, 50, 75, 100]) {
    const x = axis.x + (axis.width * tick) / 100;
    parts.push(`<line class="grid" x1="${x}" y1="${gridTop}" x2="${x}" y2="${gridBottom}"/>`);
    parts.push(`<text class="tick" x="${x - 10}" y="${gridTop - 10}">${tick}%</text>`);
  }
  parts.push(`<line class="axis" x1="${axis.x}" y1="${gridBottom}" x2="${axis.x + axis.width}" y2="${gridBottom}"/>`);
  summary.keyResults.forEach((row, index) => {
    const y = 150 + index * rowHeight;
    const css = /weakness|abstention/i.test(row.detail) ? "bar-weakness" : index === 0 ? "bar-primary" : "bar-secondary";
    const width = Math.max(3, Math.min(axis.width, axis.width * number(row.value)));
    parts.push(`<text class="label" x="54" y="${y + 18}">${escapeText(row.label)}</text>`);
    parts.push(`<text class="detail" x="54" y="${y + 36}">${escapeText(row.detail)}</text>`);
    parts.push(`<rect class="${css}" x="${axis.x}" y="${y + 4}" width="${width}" height="18" rx="4"/>`);
    parts.push(`<text class="value" x="${axis.x + width + 10}" y="${y + 18}">${escapeText(row.display)}</text>`);
  });
  parts.push(`</svg>`);
  return `${parts.join("\n")}\n`;
}

function publicDatasetRow(label, report, artifact) {
  const ours = number(report?.ours?.accuracy);
  const baseline = bestBaseline(report);
  const delta = ours - baseline.accuracy;
  return {
    label,
    value: Math.max(0, delta),
    display: `${signedPercent(delta)} vs ${baseline.name}`,
    detail: "Public-style retrieval diagnostic",
    artifact
  };
}

function datasetResult(report) {
  const ours = number(report?.ours?.accuracy);
  const baseline = bestBaseline(report);
  return `${report?.ours?.dataset ?? "dataset"} ${percent(ours)} vs ${baseline.name} ${percent(baseline.accuracy)}`;
}

function bestBaseline(report) {
  return (report?.baselines ?? []).reduce((best, baseline) => {
    const accuracy = number(baseline.accuracy);
    return accuracy > best.accuracy ? { name: formatName(baseline.name), accuracy } : best;
  }, { name: "baseline", accuracy: 0 });
}

function beamWeakness(label, report, category) {
  const weakness = report?.ours?.weaknesses?.find((item) => item.category === category);
  return {
    label,
    value: number(weakness?.accuracy),
    artifact: "artifacts/beam-1m-report.json"
  };
}

function strongestAblationRow(report) {
  const rows = Object.entries(report?.ablation ?? {})
    .filter(([name]) => name !== "cognibrain_full")
    .map(([name, row]) => ({ label: formatName(name), value: number(row?.score) }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value);
  return rows[0] ?? { label: "none", value: 0 };
}

function gateRow(requirement, passed, note) {
  return { requirement, status: passed ? "Pass" : "Missing", note };
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function newestIso(values) {
  const newest = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return (newest ?? new Date()).toISOString();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value) {
  return `${(number(value) * 100).toFixed(1)}%`;
}

function signedPercent(value) {
  const parsed = number(value) * 100;
  return `${parsed >= 0 ? "+" : ""}${parsed.toFixed(1)}pp`;
}

function integer(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : "0";
}

function formatName(value) {
  return String(value ?? "")
    .replace(/^cognibrain_/, "")
    .split(/[-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeText(value) {
  return String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
}
