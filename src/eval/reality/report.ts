import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isRealityClaimPublishableSystem, isRealityIsoTimestamp, isRealityProofHash, realityClaimGate } from "./claimGate";
import type { RealityReport } from "./types";

export function publishRealityEvidenceTable(options: { inputPath?: string; outputDir?: string } = {}) {
  const inputPath = options.inputPath ?? "artifacts/reality/emrp-v1-report.json";
  const outputDir = options.outputDir ?? "artifacts/public/evidence-table";
  const report = JSON.parse(readFileSync(inputPath, "utf8")) as RealityReport;
  const verifiedManifestHash = report.manifestLock.sha256;
  if (!isRealityProofHash(report.manifestHash) || !isRealityProofHash(verifiedManifestHash) || report.manifestHash !== verifiedManifestHash) {
    throw new Error("Reality report manifestHash must be a SHA-256 hash matching manifestLock.sha256; refusing to publish.");
  }
  if (!isRealityIsoTimestamp(report.generatedAt) || !isRealityIsoTimestamp(report.manifestLock.frozenAt) || Date.parse(report.manifestLock.frozenAt) > Date.parse(report.generatedAt)) {
    throw new Error("Reality report manifestLock.frozenAt must be an ISO timestamp at or before generatedAt; refusing to publish.");
  }
  const verifiedClaimGate = realityClaimGate({
    lock: report.manifestLock,
    systems: report.systems,
    publicArtifactHash: report.claimEvidence?.publicArtifactHash ?? null,
    independentReplicationHash: report.claimEvidence?.independentReplicationHash ?? null,
    sameJudge: isRealityProofHash(report.claimEvidence?.sameJudgeTraceId),
    sameJudgeProof: report.claimEvidence?.sameJudgeTraceId ?? null,
    sameBudgets: isRealityProofHash(report.claimEvidence?.sameBudgetsProof),
    sameBudgetsProof: report.claimEvidence?.sameBudgetsProof ?? null
  });
  const validatedClaimEvidence = {
    publicArtifactHash: isRealityProofHash(report.claimEvidence?.publicArtifactHash) ? report.claimEvidence?.publicArtifactHash ?? null : null,
    independentReplicationHash: isRealityProofHash(report.claimEvidence?.independentReplicationHash) ? report.claimEvidence?.independentReplicationHash ?? null : null,
    sameJudgeTraceId: isRealityProofHash(report.claimEvidence?.sameJudgeTraceId) ? report.claimEvidence?.sameJudgeTraceId ?? null : null,
    sameBudgetsProof: isRealityProofHash(report.claimEvidence?.sameBudgetsProof) ? report.claimEvidence?.sameBudgetsProof ?? null : null
  };
  const publication = {
    evidenceTablePath: report.publication.evidenceTablePath,
    leaderboardPath: verifiedClaimGate.leaderboardAllowed ? "artifacts/public/leaderboard/reality.json" : null,
    status: verifiedClaimGate.leaderboardAllowed ? "market-leaderboard-eligible" : "evidence-table-only"
  } satisfies RealityReport["publication"];
  mkdirSync(outputDir, { recursive: true });
  const artifact = {
    schemaVersion: "1.0",
    protocol: report.protocol,
    publishedAt: new Date().toISOString(),
    manifestHash: verifiedManifestHash,
    claimEvidence: validatedClaimEvidence,
    claimGate: verifiedClaimGate,
    publication,
    systems: report.systems.map((system) => {
      const rowClaimPublishable = isRealityClaimPublishableSystem(system, verifiedManifestHash);
      const blockingReasons = rowClaimPublishable
        ? system.blockingReasons
        : [...system.blockingReasons, "Row failed revalidated per-system provenance/eligibility gates."];
      return {
        system: system.system,
        displayName: system.displayName,
        adapterKind: system.adapterKind,
        score: system.metrics.score,
        rawOutputsPath: system.rawOutputsPath,
        scorerTracePath: system.scorerTracePath,
        qualityClaimAllowed: verifiedClaimGate.qualityClaimAllowed && rowClaimPublishable && system.qualityClaimAllowed,
        marketClaimAllowed: verifiedClaimGate.marketClaimAllowed && rowClaimPublishable && system.marketClaimAllowed,
        leaderboardEligible: verifiedClaimGate.leaderboardAllowed && rowClaimPublishable && system.leaderboardEligible,
        blockingReasons
      };
    })
  };
  writeFileSync(join(outputDir, "index.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  writeFileSync(join(outputDir, "index.md"), renderEvidenceMarkdown(artifact));
  if (verifiedClaimGate.leaderboardAllowed) {
    mkdirSync("artifacts/public/leaderboard", { recursive: true });
    writeFileSync("artifacts/public/leaderboard/reality.json", `${JSON.stringify(artifact, null, 2)}\n`);
  }
  return { outputDir, systems: artifact.systems.length, marketClaimAllowed: verifiedClaimGate.marketClaimAllowed };
}

function renderEvidenceMarkdown(artifact: {
  manifestHash: string;
  claimEvidence: NonNullable<RealityReport["claimEvidence"]>;
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
  const rows = artifact.systems.map((system) => `| ${system.displayName} | ${system.adapterKind} | ${system.blockingReasons[0] ?? ""} | ${system.qualityClaimAllowed ? "yes" : "no"} | ${system.marketClaimAllowed ? "yes" : "no"} | ${system.score ?? "blocked"} |`).join("\n");
  return `# EMRP v1 Evidence Table

Manifest hash: \`${artifact.manifestHash}\`

Public artifact hash: ${artifact.claimEvidence.publicArtifactHash ? `\`${artifact.claimEvidence.publicArtifactHash}\`` : "not validated"}

Independent replication hash: ${artifact.claimEvidence.independentReplicationHash ? `\`${artifact.claimEvidence.independentReplicationHash}\`` : "not validated"}

Same judge proof: ${artifact.claimEvidence.sameJudgeTraceId ? `\`${artifact.claimEvidence.sameJudgeTraceId}\`` : "not validated"}

Same budgets proof: ${artifact.claimEvidence.sameBudgetsProof ? `\`${artifact.claimEvidence.sameBudgetsProof}\`` : "not validated"}

Market claim allowed: ${artifact.claimGate.marketClaimAllowed ? "yes" : "no"}

${artifact.claimGate.blockers.map((blocker) => `- ${blocker}`).join("\n")}

| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |
|---|---|---|---:|---:|---:|
${rows}
`;
}
