import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RealityReport } from "./types";

export function publishRealityEvidenceTable(options: { inputPath?: string; outputDir?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/reality/emrp-v1-report.json";
  const outputDir = options.outputDir ?? "artifacts/public/evidence-table";
  const report = JSON.parse(readFileSync(inputPath, "utf8")) as RealityReport;
  mkdirSync(outputDir, { recursive: true });
  const artifact = {
    schemaVersion: "1.0",
    protocol: report.protocol,
    publishedAt: new Date().toISOString(),
    manifestHash: report.manifestHash,
    claimGate: report.claimGate,
    publication: report.publication,
    systems: report.systems.map((system) => ({
      system: system.system,
      displayName: system.displayName,
      adapterKind: system.adapterKind,
      score: system.metrics.score,
      rawOutputsPath: system.rawOutputsPath,
      scorerTracePath: system.scorerTracePath,
      qualityClaimAllowed: system.qualityClaimAllowed,
      marketClaimAllowed: system.marketClaimAllowed,
      leaderboardEligible: system.leaderboardEligible,
      blockingReasons: system.blockingReasons
    }))
  };
  writeFileSync(join(outputDir, "index.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(join(outputDir, "index.md"), renderEvidenceMarkdown(artifact));
  if (report.claimGate.leaderboardAllowed) {
    mkdirSync("artifacts/public/leaderboard", { recursive: true });
    writeFileSync("artifacts/public/leaderboard/reality.json", `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return { outputDir, systems: artifact.systems.length, marketClaimAllowed: report.claimGate.marketClaimAllowed };
}

function renderEvidenceMarkdown(artifact: {
  manifestHash: string;
  claimGate: RealityReport["claimGate"];
  systems: Array<{
    displayName: string;
    adapterKind: string;
    score: number | null;
    qualityClaimAllowed: boolean;
    marketClaimAllowed: boolean;
    blockingReasons: string[];
  }>;
}) {
  const rows = artifact.systems.map((system) => `| ${system.displayName} | ${system.adapterKind} | ${system.score ?? "blocked"} | ${system.qualityClaimAllowed ? "yes" : "no"} | ${system.marketClaimAllowed ? "yes" : "no"} | ${system.blockingReasons[0] ?? ""} |`).join("\n");
  return `# EMRP v1 Evidence Table

Manifest hash: \`${artifact.manifestHash}\`

Market claim allowed: ${artifact.claimGate.marketClaimAllowed ? "yes" : "no"}

${artifact.claimGate.blockers.map((blocker) => `- ${blocker}`).join("\n")}

| System | Adapter | Diagnostic score | Quality claim | Market claim | First blocker |
|---|---:|---:|---:|---:|---|
${rows}
`;
}
