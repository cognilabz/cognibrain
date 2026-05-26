import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateLeaderboardArtifact, type LeaderboardArtifact } from "./leaderboard";

export function publishLeaderboardArtifact(options: { inputPath?: string; outputDir?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/leaderboard.json";
  const outputDir = options.outputDir ?? "artifacts/public/leaderboard";
  const artifact = JSON.parse(readFileSync(inputPath, "utf8")) as LeaderboardArtifact;
  validateLeaderboardArtifact(artifact);
  mkdirSync(outputDir, { recursive: true });
  const publicArtifact = {
    ...artifact,
    publication: {
      ...artifact.publication,
      publishedAt: new Date().toISOString(),
      channel: "static-json"
    }
  };
  writeFileSync(join(outputDir, "leaderboard.json"), JSON.stringify(publicArtifact, null, 2));
  writeFileSync(join(outputDir, "index.html"), renderLeaderboardHtml(publicArtifact));
  return { inputPath, outputDir, entries: artifact.entries.length, anonymized: artifact.publication.anonymized };
}

function renderLeaderboardHtml(artifact: LeaderboardArtifact & { publication: LeaderboardArtifact["publication"] & { publishedAt?: string; channel?: string } }) {
  const rows = artifact.entries
    .map((entry) => `<tr><td>${escapeHtml(entry.suite)}</td><td>${escapeHtml(entry.category)}</td><td>${escapeHtml(entry.metric)}</td><td>${entry.score.toFixed(4)}</td><td>${escapeHtml(entry.proof)}</td></tr>`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cognibrain leaderboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #17201a; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d6ded8; padding: 0.6rem; text-align: left; }
    th { background: #eef4f0; }
  </style>
</head>
<body>
  <h1>cognibrain leaderboard</h1>
  <p>${escapeHtml(artifact.publication.claimScope)}</p>
  <table>
    <thead><tr><th>Suite</th><th>Category</th><th>Metric</th><th>Score</th><th>Proof</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
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
  console.log(JSON.stringify(publishLeaderboardArtifact({
    inputPath: inputIndex >= 0 ? process.argv[inputIndex + 1] : undefined,
    outputDir: outIndex >= 0 ? process.argv[outIndex + 1] : undefined
  }), null, 2));
}
