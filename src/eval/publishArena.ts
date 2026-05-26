import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

export function publishArenaReport(options: { inputPath?: string; outputDir?: string; markdownPath?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/arena/run.json";
  const outputDir = options.outputDir ?? "public/benchmark-arena";
  const markdownPath = options.markdownPath ?? "docs/benchmarks/latest-arena.md";
  if (!existsSync(inputPath)) throw new Error(`Arena artifact missing: ${inputPath}`);
  const report = JSON.parse(readFileSync(inputPath, "utf8")) as ArenaReport;
  validateArenaReport(report);
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(markdownPath), { recursive: true });
  const publicReport = {
    ...report,
    publication: {
      publishedAt: new Date().toISOString(),
      channel: "static-json-html-md",
      claimScope: "Synthetic same-scenario engineering-memory benchmark with explicit proof levels."
    }
  };
  writeFileSync(join(outputDir, "results.json"), `${JSON.stringify(publicReport, null, 2)}\n`);
  writeFileSync(join(outputDir, "index.html"), renderArenaHtml(publicReport));
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

function renderArenaMarkdown(report: ArenaReport & { publication: { publishedAt: string; claimScope: string } }) {
  const rows = [...report.leaderboard]
    .map((row) => `| ${row.system} | ${row.score.toFixed(4)} | ${row.proofLevel} | ${row.repeatedMistakeRate.toFixed(4)} | ${row.gaps} |`)
    .join("\n");
  const proofRows = Object.entries(report.adapterContract.proofLevels)
    .map(([level, meaning]) => `| ${level} | ${meaning} |`)
    .join("\n");
  return `# Latest Benchmark Arena

Generated from \`artifacts/arena/run.json\` at ${report.publication.publishedAt}.

Recall is not enough. The next code change has to prove the memory worked.

| System | Score | Proof level | Repeated mistake rate | Gaps |
| --- | ---: | --- | ---: | ---: |
${rows}

Boundary: competitor rows are only as strong as their proof level. \`same-run-api-shape\` is a local compatibility model. \`same-run-native\`, \`same-run-cloud-api\` and \`same-run-cli\` require configured external runners.

## Proof Levels

| Level | Meaning |
| --- | --- |
${proofRows}

Reproduce:

\`\`\`bash
npm run benchmark:arena
npm run benchmark:arena:publish
\`\`\`
`;
}

function renderArenaHtml(report: ArenaReport & { publication: { publishedAt: string; claimScope: string } }) {
  const rows = [...report.leaderboard]
    .map((row) => `<tr><td>${escapeHtml(row.system)}</td><td>${row.score.toFixed(4)}</td><td><span class="badge">${escapeHtml(row.proofLevel)}</span></td><td>${row.repeatedMistakeRate.toFixed(4)}</td><td>${row.gaps}</td></tr>`)
    .join("\n");
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
    :root { color-scheme: light; --ink:#17201a; --muted:#56635b; --line:#d9e2dc; --wash:#f5f8f5; --accent:#166447; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #fff; }
    main { max-width: 1080px; margin: 0 auto; padding: 48px 24px 72px; }
    h1 { font-size: clamp(2rem, 5vw, 4rem); line-height: 1; margin: 0 0 16px; letter-spacing: 0; }
    p { color: var(--muted); font-size: 1.05rem; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; margin: 28px 0; font-size: 0.96rem; }
    th, td { border-bottom: 1px solid var(--line); padding: 12px 10px; text-align: left; vertical-align: top; }
    th { background: var(--wash); color: var(--ink); }
    .badge { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; background: #fff; color: var(--accent); font-weight: 650; }
    .callout { border-left: 4px solid var(--accent); padding: 12px 16px; background: var(--wash); margin: 28px 0; }
    code { background: var(--wash); padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Benchmark Arena</h1>
    <p>Recall is not enough. The next code change has to prove the memory worked.</p>
    <div class="callout">Generated at ${escapeHtml(report.publication.publishedAt)} from <code>artifacts/arena/run.json</code>. ${escapeHtml(report.publication.claimScope)}</div>
    <table>
      <thead><tr><th>System</th><th>Score</th><th>Proof level</th><th>Repeated mistake rate</th><th>Gaps</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputIndex = process.argv.indexOf("--input");
  const outIndex = process.argv.indexOf("--out");
  const markdownIndex = process.argv.indexOf("--markdown");
  console.log(JSON.stringify(publishArenaReport({
    inputPath: inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined,
    outputDir: outIndex >= 0 ? process.argv[outIndex + 1] : undefined,
    markdownPath: markdownIndex >= 0 ? process.argv[markdownIndex + 1] : undefined
  }), null, 2));
}
