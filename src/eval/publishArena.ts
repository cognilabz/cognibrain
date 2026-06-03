import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type CheckKey =
  | "correctionCarryover"
  | "repeatedMistakeAvoided"
  | "procedureRecall"
  | "patchCorrectness"
  | "evidenceCompleteness"
  | "wrongMemorySuppression";

interface ArenaScenario {
  id: string;
  score: number;
  checks: Record<CheckKey, boolean>;
  evidence: Record<string, unknown>;
}

interface ArenaSystem {
  displayName: string;
  score: number;
  proofLevel: string;
  adapterMode?: string;
  scenarioCount: number;
  metrics: {
    repeatedMistakeRate: number;
    correctionCarryover: number;
    procedureRecall: number;
    patchCorrectness: number;
    evidenceCompleteness: number;
    wrongMemorySuppression: number;
  };
  capabilityGaps: string[];
  scenarios?: ArenaScenario[];
}

interface ArenaReport {
  schemaVersion: string;
  generatedAt: string;
  benchmark: string;
  benchmarkInput: string;
  adapterContract: {
    proofLevels: Record<string, string>;
  };
  systems: ArenaSystem[];
  leaderboard: Array<{ system: string; score: number; proofLevel: string; repeatedMistakeRate: number; gaps: number }>;
  winner: string;
  passed: boolean;
}

interface PublicBenchmarkGate {
  generatedAt?: string;
  proofLevel?: string;
  passed?: boolean;
  diagnosticPassed?: boolean;
  claimAllowed?: boolean;
  claimBlockers?: string[];
  benchmarks: Array<{
    dataset: string;
    metric: string;
    passed: boolean;
    diagnosticPassed: boolean;
    scoreable: boolean;
    proof: string;
    ours: { correct: number; total: number; accuracy: number };
    bestBaseline: { name: string; correct: number; total: number; accuracy: number };
    margin: number;
    questionCount: number;
  }>;
}

interface PublishedArenaReport extends ArenaReport {
  publicBenchmarkGate?: PublicBenchmarkGate;
  publication: {
    publishedAt: string;
    channel: string;
    claimScope: string;
    proofLevel: string;
    claimAllowed: boolean;
    diagnosticPassed: boolean;
  };
}

const CHECK_LABELS: Array<{ key: CheckKey; label: string }> = [
  { key: "correctionCarryover", label: "Correction carryover" },
  { key: "repeatedMistakeAvoided", label: "Mistake avoided" },
  { key: "procedureRecall", label: "Procedure recall" },
  { key: "patchCorrectness", label: "Patch correctness" },
  { key: "evidenceCompleteness", label: "Evidence completeness" },
  { key: "wrongMemorySuppression", label: "Wrong-memory suppression" }
];

export function publishArenaReport(options: { inputPath?: string; outputDir?: string; markdownPath?: string; marketGatePath?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/arena/run.json";
  const outputDir = options.outputDir ?? "artifacts/public/benchmark-arena";
  const markdownPath = options.markdownPath ?? "artifacts/docs/latest-arena.md";
  if (!existsSync(inputPath)) throw new Error(`Arena artifact missing: ${inputPath}`);
  const report = JSON.parse(readFileSync(inputPath, "utf8")) as ArenaReport;
  validateArenaReport(report);
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  const publicBenchmarkGate = readPublicBenchmarkSummary(options.marketGatePath ?? "artifacts/market-gate.json");
  const publicReport = {
    ...report,
    publicBenchmarkGate,
    publication: {
      publishedAt: new Date().toISOString(),
      channel: "static-json-html-md",
      claimScope: "Synthetic same-scenario engineering-memory diagnostic with explicit proof levels; market and quality claims require publicBenchmarkGate.claimAllowed=true.",
      proofLevel: publicBenchmarkGate?.proofLevel ?? "synthetic-diagnostic",
      claimAllowed: publicBenchmarkGate?.claimAllowed === true,
      diagnosticPassed: publicBenchmarkGate?.diagnosticPassed === true
    }
  } satisfies PublishedArenaReport;
  writeFileSync(join(outputDir, "results.json"), `${JSON.stringify(publicReport, null, 2)}\n`);
  writeFileSync(join(outputDir, "index.html"), renderArenaHtml(publicReport));
  writeFileSync(join(outputDir, "scorecard.html"), renderArenaHtml(publicReport));
  writeFileSync(markdownPath, renderArenaMarkdown(publicReport));
  return { inputPath, outputDir, markdownPath, systems: report.systems.length, winner: report.winner };
}

function validateArenaReport(report: ArenaReport): void {
  if (report.benchmark !== "BenchmarkArena") throw new Error("Expected BenchmarkArena artifact.");
  if (!Array.isArray(report.systems) || report.systems.length < 2) throw new Error("Arena artifact must include at least two systems.");
  if (!report.systems.some((system) => system.displayName === "Cognibrain" && system.proofLevel === "same-run-full")) {
    throw new Error("Arena artifact must include Cognibrain same-run-full row.");
  }
}

function systemClaimStatus(proofLevel: string): string {
  if (proofLevel === "same-run-full") return "local product proof only; not market-wide";
  if (proofLevel === "same-run-api-shape") return "api-shape diagnostic; claim blocked";
  if (proofLevel === "credential-blocked") return "credential blocked; no scoreable claim";
  if (proofLevel === "same-run-native" || proofLevel === "same-run-cloud-api" || proofLevel === "same-run-cli") return "native run; LLM/harness judge required";
  return "claim blocked until proof level is certified";
}

function renderArenaMarkdown(report: PublishedArenaReport) {
  const systems = orderedSystems(report);
  const rows = systems
    .map((system) => `| ${system.displayName} | ${systemClaimStatus(system.proofLevel)} | ${points(system.score)} / 1000 | ${system.score.toFixed(4)} | ${markdownBar(system.score, 18)} | ${system.proofLevel} | ${system.scenarioCount} | ${system.metrics.repeatedMistakeRate.toFixed(4)} | ${system.capabilityGaps.length} |`)
    .join("\n");
  const checkRows = systems
    .map((system) => {
      const checks = CHECK_LABELS.map(({ key }) => {
        const rate = checkRate(system, key);
        return `${rate.passed}/${rate.total} ${markdownBar(rate.value, 10)}`;
      }).join(" | ");
      return `| ${system.displayName} | ${checks} |`;
    })
    .join("\n");
  const scenarioRows = scenarioIds(systems)
    .map((scenarioId) => `| ${scenarioId} | ${systems.map((system) => scenarioCell(system, scenarioId)).join(" | ")} |`)
    .join("\n");
  const gapRows = systems
    .map((system) => `| ${system.displayName} | ${system.capabilityGaps.length ? system.capabilityGaps.join("; ") : "none"} |`)
    .join("\n");
  const publicRows = (report.publicBenchmarkGate?.benchmarks ?? [])
    .map((benchmark) => `| ${benchmark.dataset} | ${benchmark.metric} | ${benchmark.proof} | ${benchmark.passed ? "Yes" : "No"} | ${benchmark.diagnosticPassed ? "Yes" : "No"} | ${points(benchmark.ours.accuracy)} / 1000 | ${benchmark.ours.correct}/${benchmark.ours.total} | ${markdownBar(benchmark.ours.accuracy, 18)} | ${benchmark.bestBaseline.name} ${benchmark.bestBaseline.correct}/${benchmark.bestBaseline.total} | ${signed(benchmark.margin)} | ${benchmark.questionCount} |`)
    .join("\n");
  const publicClaimBlockers = report.publicBenchmarkGate?.claimBlockers?.length
    ? report.publicBenchmarkGate.claimBlockers.map((item) => `- ${item}`).join("\n")
    : "- none";
  const proofRows = Object.entries(report.adapterContract.proofLevels)
    .map(([level, meaning]) => `| ${level} | ${meaning} |`)
    .join("\n");
  return `# Latest Benchmark Arena Diagnostic

Generated from \`artifacts/arena/run.json\` at ${report.publication.publishedAt}.

Claim allowed: ${report.publication.claimAllowed ? "yes" : "no"}. Proof level: \`${report.publication.proofLevel}\`. Diagnostic passed: ${report.publication.diagnosticPassed ? "yes" : "no"}.

Recall is not enough. The next code change has to prove the memory worked. These synthetic scores are diagnostics unless the claim gate allows them.

## Synthetic Diagnostic Scorecard

| System | Claim status | Points | Score | Bar | Proof level | Scenarios | Repeated mistake rate | Gaps |
| --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: |
${rows}

## Capability Score Breakdown

| System | ${CHECK_LABELS.map((item) => item.label).join(" | ")} |
| --- | ${CHECK_LABELS.map(() => "---:").join(" | ")} |
${checkRows}

## Scenario Score Matrix

Each cell is points out of 1000 plus a compact bar from the checked scenario result.

| Scenario | ${systems.map((system) => system.displayName).join(" | ")} |
| --- | ${systems.map(() => "---:").join(" | ")} |
${scenarioRows}

## Capability Gaps

| System | Declared gaps |
| --- | --- |
${gapRows}

${publicRows ? `## Public Benchmark Gate

Generated from \`artifacts/market-gate.json\`${report.publicBenchmarkGate?.generatedAt ? ` at ${report.publicBenchmarkGate.generatedAt}` : ""}. Proof level: \`${report.publicBenchmarkGate?.proofLevel ?? "unknown"}\`. Claim allowed: ${report.publicBenchmarkGate?.claimAllowed ? "yes" : "no"}. Diagnostic passed: ${report.publicBenchmarkGate?.diagnosticPassed ? "yes" : "no"}.

| Dataset | Metric | Proof | Claim | Diagnostic | Points | Cognibrain | Bar | Best local baseline | Margin | Questions |
| --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
${publicRows}

Claim blockers:

${publicClaimBlockers}

` : ""}Boundary: competitor rows are only as strong as their proof level. \`same-run-api-shape\` is a local compatibility model. \`credential-blocked\` means the real runner exists but could not execute without required credentials or services. \`same-run-native\`, \`same-run-cloud-api\` and \`same-run-cli\` require configured external runners.

## Proof Levels

| Level | Meaning |
| --- | --- |
${proofRows}

Reproduce:

\`\`\`bash
npm run internal -- benchmark:arena
npm run internal -- benchmark:arena:publish
\`\`\`
`;
}

function renderArenaHtml(report: PublishedArenaReport) {
  const systems = orderedSystems(report);
  const rows = systems
    .map((system) => `<tr><td><strong>${escapeHtml(system.displayName)}</strong></td><td>${escapeHtml(systemClaimStatus(system.proofLevel))}</td><td class="numeric">${points(system.score)} / 1000</td><td>${barHtml(system.score)}</td><td><span class="badge">${escapeHtml(system.proofLevel)}</span></td><td class="numeric">${system.scenarioCount}</td><td class="numeric">${system.metrics.repeatedMistakeRate.toFixed(4)}</td><td class="numeric">${system.capabilityGaps.length}</td></tr>`)
    .join("\n");
  const checkRows = systems
    .map((system) => `<tr><td><strong>${escapeHtml(system.displayName)}</strong></td>${CHECK_LABELS.map(({ key }) => {
      const rate = checkRate(system, key);
      return `<td>${miniMetric(rate.value, `${rate.passed}/${rate.total}`)}</td>`;
    }).join("")}</tr>`)
    .join("\n");
  const scenarioRows = scenarioIds(systems)
    .map((scenarioId) => `<tr><td><code>${escapeHtml(scenarioId)}</code></td>${systems.map((system) => {
      const scenario = system.scenarios?.find((item) => item.id === scenarioId);
      return `<td>${scenario ? miniMetric(scenario.score, String(points(scenario.score))) : "<span class=\"muted\">n/a</span>"}</td>`;
    }).join("")}</tr>`)
    .join("\n");
  const gapRows = systems
    .map((system) => `<tr><td><strong>${escapeHtml(system.displayName)}</strong></td><td>${system.capabilityGaps.length ? system.capabilityGaps.map((gap) => `<span class="gap">${escapeHtml(gap)}</span>`).join(" ") : "<span class=\"ok\">none</span>"}</td></tr>`)
    .join("\n");
  const publicRows = (report.publicBenchmarkGate?.benchmarks ?? [])
    .map((benchmark) => `<tr><td><strong>${escapeHtml(benchmark.dataset)}</strong></td><td>${escapeHtml(benchmark.metric)}</td><td><span class="badge">${escapeHtml(benchmark.proof)}</span></td><td class="${benchmark.passed ? "ok" : "bad"}">${benchmark.passed ? "Yes" : "No"}</td><td class="${benchmark.diagnosticPassed ? "ok" : "bad"}">${benchmark.diagnosticPassed ? "Yes" : "No"}</td><td class="numeric">${points(benchmark.ours.accuracy)} / 1000</td><td class="numeric">${benchmark.ours.correct}/${benchmark.ours.total}</td><td>${barHtml(benchmark.ours.accuracy)}</td><td>${escapeHtml(benchmark.bestBaseline.name)} <span class="numeric">${benchmark.bestBaseline.correct}/${benchmark.bestBaseline.total}</span></td><td class="numeric ${benchmark.margin >= 0 ? "ok" : "bad"}">${signed(benchmark.margin)}</td><td class="numeric">${benchmark.questionCount}</td></tr>`)
    .join("\n");
  const publicClaimBlockers = report.publicBenchmarkGate?.claimBlockers?.length
    ? `<ul>${report.publicBenchmarkGate.claimBlockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p class=\"muted\">none</p>";
  const proofRows = Object.entries(report.adapterContract.proofLevels)
    .map(([level, meaning]) => `<tr><td><span class="badge">${escapeHtml(level)}</span></td><td>${escapeHtml(meaning)}</td></tr>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cognibrain Benchmark Arena</title>
  <style>
    :root { color-scheme: light; --ink:#162018; --muted:#5c655f; --line:#dce5de; --wash:#f6f8f3; --panel:#ffffff; --accent:#146a4d; --accent2:#d66a2d; --accent3:#245f8f; --bad:#a33a35; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: linear-gradient(180deg, #fbfcf8 0%, #eef5ef 100%); }
    main { max-width: 1240px; margin: 0 auto; padding: 48px 24px 72px; }
    h1 { font-size: clamp(2.4rem, 6vw, 5.2rem); line-height: 0.95; margin: 0 0 16px; letter-spacing: 0; max-width: 880px; }
    h2 { margin-top: 44px; font-size: 1.4rem; }
    p { color: var(--muted); font-size: 1.05rem; line-height: 1.6; max-width: 820px; }
    table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 18px 0 28px; font-size: 0.94rem; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    th, td { border-bottom: 1px solid var(--line); padding: 12px 10px; text-align: left; vertical-align: middle; }
    tr:last-child td { border-bottom: 0; }
    th { background: #edf4ee; color: var(--ink); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .hero-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 28px 0; }
    .stat { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 16px; box-shadow: 0 20px 60px rgba(33, 67, 48, 0.08); }
    .stat span { display:block; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .stat strong { display:block; margin-top: 8px; font-size: 1.6rem; }
    .badge { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; background: #fff; color: var(--accent); font-weight: 650; white-space: nowrap; }
    .callout { border-left: 4px solid var(--accent); padding: 12px 16px; background: var(--panel); margin: 28px 0; box-shadow: 0 16px 44px rgba(33, 67, 48, 0.07); }
    .bar { min-width: 150px; height: 12px; border-radius: 999px; background: #e6ece7; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 10px; border: 1px solid #d5ded7; }
    .bar > span { display:block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--accent3)); }
    .mini { display: grid; grid-template-columns: minmax(42px, auto) 1fr; gap: 8px; align-items: center; min-width: 118px; }
    .mini .bar { min-width: 70px; margin: 0; }
    .numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .table-scroll { overflow-x: auto; border-radius: 8px; }
    .scenario-table { min-width: 980px; }
    .scenario-table td:first-child, .scenario-table th:first-child { position: sticky; left: 0; background: var(--panel); z-index: 1; }
    .scenario-table th:first-child { background: #edf4ee; }
    .gap { display: inline-block; margin: 2px 4px 2px 0; padding: 3px 7px; border: 1px solid #ead6c6; background: #fff7ef; border-radius: 999px; color: #7a3d18; }
    .ok { color: var(--accent); font-weight: 700; }
    .bad { color: var(--bad); font-weight: 700; }
    .muted { color: var(--muted); }
    code { background: var(--wash); padding: 2px 5px; border-radius: 4px; }
    @media (max-width: 840px) { .hero-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } main { padding: 32px 14px 56px; } }
  </style>
</head>
<body>
  <main>
    <h1>Hard Benchmark Diagnostic</h1>
    <p>Recall is not enough. The next code change has to prove the memory worked. This page is generated from checked benchmark artifacts; synthetic scores remain diagnostics unless the claim gate allows them.</p>
    <section class="hero-grid">
      <div class="stat"><span>Winner</span><strong>${escapeHtml(report.winner)}</strong></div>
      <div class="stat"><span>Top diagnostic score</span><strong>${points(systems[0]?.score ?? 0)} / 1000</strong></div>
      <div class="stat"><span>Market claim</span><strong>${report.publication.claimAllowed ? "Allowed" : "Blocked"}</strong></div>
      <div class="stat"><span>Systems</span><strong>${systems.length}</strong></div>
      <div class="stat"><span>Scenarios</span><strong>${systems[0]?.scenarioCount ?? 0}</strong></div>
    </section>
    <div class="callout">Generated at ${escapeHtml(report.publication.publishedAt)} from <code>artifacts/arena/run.json</code>. Proof level: <code>${escapeHtml(report.publication.proofLevel)}</code>. Claim allowed: <strong>${report.publication.claimAllowed ? "yes" : "no"}</strong>. Diagnostic passed: <strong>${report.publication.diagnosticPassed ? "yes" : "no"}</strong>. ${escapeHtml(report.publication.claimScope)}</div>
    <h2>Synthetic Diagnostic Scorecard</h2>
    <table>
      <thead><tr><th>System</th><th>Claim status</th><th>Points</th><th>Bar</th><th>Proof level</th><th>Scenarios</th><th>Repeated mistake rate</th><th>Gaps</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>Capability Score Breakdown</h2>
    <div class="table-scroll">
      <table>
        <thead><tr><th>System</th>${CHECK_LABELS.map((item) => `<th>${escapeHtml(item.label)}</th>`).join("")}</tr></thead>
        <tbody>${checkRows}</tbody>
      </table>
    </div>
    <h2>Scenario Score Matrix</h2>
    <p>Every cell is one checked CogniCode scenario: points out of 1000 plus a visual score bar.</p>
    <div class="table-scroll">
      <table class="scenario-table">
        <thead><tr><th>Scenario</th>${systems.map((system) => `<th>${escapeHtml(system.displayName)}</th>`).join("")}</tr></thead>
        <tbody>${scenarioRows}</tbody>
      </table>
    </div>
    <h2>Capability Gaps</h2>
    <table>
      <thead><tr><th>System</th><th>Declared gaps</th></tr></thead>
      <tbody>${gapRows}</tbody>
    </table>
    ${publicRows ? `<h2>Public Benchmark Gate</h2>
    <p>Generated from <code>artifacts/market-gate.json</code>${report.publicBenchmarkGate?.generatedAt ? ` at ${escapeHtml(report.publicBenchmarkGate.generatedAt)}` : ""}. Proof level: <code>${escapeHtml(report.publicBenchmarkGate?.proofLevel ?? "unknown")}</code>. Claim allowed: <strong>${report.publicBenchmarkGate?.claimAllowed ? "yes" : "no"}</strong>. Diagnostic passed: <strong>${report.publicBenchmarkGate?.diagnosticPassed ? "yes" : "no"}</strong>.</p>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Dataset</th><th>Metric</th><th>Proof</th><th>Claim</th><th>Diagnostic</th><th>Points</th><th>Cognibrain</th><th>Bar</th><th>Best local baseline</th><th>Margin</th><th>Questions</th></tr></thead>
        <tbody>${publicRows}</tbody>
      </table>
    </div>
    <h3>Public benchmark claim blockers</h3>
    ${publicClaimBlockers}` : ""}
    <h2>Proof levels</h2>
    <table>
      <thead><tr><th>Level</th><th>Meaning</th></tr></thead>
      <tbody>${proofRows}</tbody>
    </table>
  </main>
</body>
</html>
`;
}

function readPublicBenchmarkSummary(path: string): PublicBenchmarkGate | undefined {
  if (!existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    generatedAt?: string;
    proofLevel?: string;
    passed?: boolean;
    diagnosticPassed?: boolean;
    claimAllowed?: boolean;
    claimBlockers?: string[];
    benchmarks?: Array<{
      dataset?: string;
      metric?: string;
      passed?: boolean;
      diagnosticPassed?: boolean;
      scoreable?: boolean;
      proof?: string;
      ours?: { correct?: number; total?: number; accuracy?: number };
      bestBaseline?: { name?: string; correct?: number; total?: number; accuracy?: number };
      margin?: number;
      questions?: unknown[];
    }>;
  };
  return {
    generatedAt: raw.generatedAt,
    proofLevel: raw.proofLevel,
    passed: raw.passed,
    diagnosticPassed: raw.diagnosticPassed,
    claimAllowed: raw.claimAllowed,
    claimBlockers: Array.isArray(raw.claimBlockers) ? raw.claimBlockers.map(String) : [],
    benchmarks: (raw.benchmarks ?? []).map((benchmark) => ({
      dataset: benchmark.dataset ?? "unknown",
      metric: benchmark.metric ?? "unknown",
      passed: Boolean(benchmark.passed),
      diagnosticPassed: Boolean(benchmark.diagnosticPassed ?? benchmark.passed),
      scoreable: benchmark.scoreable === true,
      proof: benchmark.proof ?? (benchmark.scoreable === true ? "llm-harness" : "local-diagnostic"),
      ours: {
        correct: Number(benchmark.ours?.correct ?? 0),
        total: Number(benchmark.ours?.total ?? 0),
        accuracy: Number(benchmark.ours?.accuracy ?? 0)
      },
      bestBaseline: {
        name: benchmark.bestBaseline?.name ?? "unknown",
        correct: Number(benchmark.bestBaseline?.correct ?? 0),
        total: Number(benchmark.bestBaseline?.total ?? 0),
        accuracy: Number(benchmark.bestBaseline?.accuracy ?? 0)
      },
      margin: Number(benchmark.margin ?? 0),
      questionCount: Array.isArray(benchmark.questions) ? benchmark.questions.length : 0
    }))
  };
}

function orderedSystems(report: ArenaReport): ArenaSystem[] {
  const rank = new Map(report.leaderboard.map((row, index) => [row.system, index]));
  return [...report.systems].sort((a, b) => (rank.get(a.displayName) ?? 999) - (rank.get(b.displayName) ?? 999));
}

function scenarioIds(systems: ArenaSystem[]): string[] {
  const firstWithScenarios = systems.find((system) => system.scenarios?.length);
  if (firstWithScenarios?.scenarios?.length) return firstWithScenarios.scenarios.map((scenario) => scenario.id);
  return [...new Set(systems.flatMap((system) => (system.scenarios ?? []).map((scenario) => scenario.id)))];
}

function scenarioCell(system: ArenaSystem, scenarioId: string): string {
  const scenario = system.scenarios?.find((item) => item.id === scenarioId);
  return scenario ? `${points(scenario.score)} ${markdownBar(scenario.score, 8)}` : "n/a";
}

function checkRate(system: ArenaSystem, key: CheckKey): { passed: number; total: number; value: number } {
  const scenarios = system.scenarios ?? [];
  const total = scenarios.length;
  const passed = scenarios.filter((scenario) => scenario.checks?.[key] === true).length;
  return { passed, total, value: total ? passed / total : 0 };
}

function markdownBar(value: number, width: number): string {
  const safe = clamp01(value);
  const filled = Math.round(safe * width);
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}]`;
}

function barHtml(value: number): string {
  return `<span class="bar" aria-label="${percent(value)}"><span style="width:${percent(value)}"></span></span><span class="numeric">${percent(value)}</span>`;
}

function miniMetric(value: number, label: string): string {
  return `<span class="mini"><span class="numeric">${escapeHtml(label)}</span>${barHtml(value)}</span>`;
}

function points(value: number): number {
  return Math.round(clamp01(value) * 1000);
}

function percent(value: number): string {
  return `${(clamp01(value) * 100).toFixed(1)}%`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function escapeHtml(value: unknown) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputIndex = process.argv.indexOf("--input");
  const outIndex = process.argv.indexOf("--out");
  const markdownIndex = process.argv.indexOf("--markdown");
  console.log(JSON.stringify(publishArenaReport({
    inputPath: inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined,
    outputDir: outIndex >= 0 ? process.argv[outIndex + 1] : undefined,
    markdownPath: markdownIndex >= 0 ? process.argv[markdownIndex + 1] : undefined,
    marketGatePath: process.argv.includes("--market-gate") ? process.argv[process.argv.indexOf("--market-gate") + 1] : undefined
  }), null, 2));
}
