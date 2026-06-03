import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateLeaderboardArtifact, type LeaderboardArtifact } from "./leaderboard";

type PublicLeaderboardArtifact = LeaderboardArtifact & {
  publication: LeaderboardArtifact["publication"] & {
    publishedAt: string;
    channel: "static-json-html";
    claimAllowed: boolean;
    proofLevel: "claim-eligible" | "diagnostic-publication";
    claimSummary: {
      totalEntries: number;
      claimedEntries: number;
      diagnosticEntries: number;
      claimClasses: Record<string, number>;
    };
  };
};

export function publishLeaderboardArtifact(options: { inputPath?: string; outputDir?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/leaderboard.json";
  const outputDir = options.outputDir ?? "artifacts/public/leaderboard";
  const artifact = JSON.parse(readFileSync(inputPath, "utf8")) as LeaderboardArtifact;
  validateLeaderboardArtifact(artifact);
  mkdirSync(outputDir, { recursive: true });
  const claimedEntries = artifact.entries.filter((entry) => entry.claimAllowed).length;
  const diagnosticEntries = artifact.entries.length - claimedEntries;
  const claimAllowed = artifact.entries.length > 0 && artifact.entries.every((entry) => entry.claimAllowed);
  const publicArtifact: PublicLeaderboardArtifact = {
    ...artifact,
    publication: {
      ...artifact.publication,
      publishedAt: new Date().toISOString(),
      channel: "static-json-html",
      claimAllowed,
      proofLevel: claimAllowed ? "claim-eligible" : "diagnostic-publication",
      claimSummary: {
        totalEntries: artifact.entries.length,
        claimedEntries,
        diagnosticEntries,
        claimClasses: countBy(artifact.entries.map((entry) => entry.claimClass))
      }
    }
  };
  writeFileSync(join(outputDir, "leaderboard.json"), JSON.stringify(publicArtifact, null, 2));
  writeFileSync(join(outputDir, "index.html"), renderLeaderboardHtml(publicArtifact));
  return { inputPath, outputDir, entries: artifact.entries.length, anonymized: artifact.publication.anonymized, claimAllowed, proofLevel: publicArtifact.publication.proofLevel };
}

function renderLeaderboardHtml(artifact: PublicLeaderboardArtifact) {
  const rows = artifact.entries
    .map((entry) => `<tr><td>${escapeHtml(entry.suite)}</td><td>${escapeHtml(entry.category)}</td><td>${escapeHtml(entry.metric)}</td><td>${entry.score.toFixed(4)}</td><td>${escapeHtml(entry.proof)}</td><td>${entry.claimAllowed ? "Yes" : "No"}</td><td>${escapeHtml(entry.claimClass)}</td></tr>`)
    .join("\n");
  const claimStatus = artifact.publication.claimAllowed ? "yes" : "no";
  const claimNote = artifact.publication.claimAllowed
    ? "All entries are backed by LLM/harness or comparable public benchmark proof."
    : "Diagnostic publication only; local diagnostic entries are not quality or market proof.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>cognibrain diagnostic leaderboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #17201a; }
    .summary { border: 1px solid #d6ded8; border-radius: 8px; padding: 1rem; margin: 1rem 0 1.5rem; background: #f7faf8; }
    .summary dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.75rem; margin: 0.75rem 0 0; }
    .summary div { min-width: 0; }
    .summary dt { color: #56635b; font-size: 0.8rem; text-transform: uppercase; }
    .summary dd { margin: 0.15rem 0 0; font-size: 1.2rem; font-weight: 700; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d6ded8; padding: 0.6rem; text-align: left; }
    th { background: #eef4f0; }
  </style>
</head>
<body>
  <h1>cognibrain diagnostic leaderboard</h1>
  <p>${escapeHtml(artifact.publication.claimScope)}</p>
  <section class="summary" aria-label="Publication claim boundary">
    <strong>Claim allowed: ${claimStatus}</strong>
    <p>${escapeHtml(claimNote)}</p>
    <dl>
      <div><dt>Proof level</dt><dd>${escapeHtml(artifact.publication.proofLevel)}</dd></div>
      <div><dt>Claimed entries</dt><dd>${artifact.publication.claimSummary.claimedEntries}</dd></div>
      <div><dt>Diagnostic entries</dt><dd>${artifact.publication.claimSummary.diagnosticEntries}</dd></div>
      <div><dt>Total entries</dt><dd>${artifact.publication.claimSummary.totalEntries}</dd></div>
    </dl>
  </section>
  <table>
    <thead><tr><th>Suite</th><th>Category</th><th>Metric</th><th>Diagnostic/claim score</th><th>Proof</th><th>Claim</th><th>Class</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
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
