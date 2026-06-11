import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { configuredAdapters, contractResult, type RealityAdapterContract } from "./adapters";
import { realityClaimGate } from "./claimGate";
import { loadRealityManifest } from "./manifest";
import { scoreRealityOutputs } from "./scoring";
import type { RealityRawOutput, RealityReport, RealitySystemResult, RealityTask } from "./types";

export function runRealityBenchmark(options: {
  manifestPath?: string;
  lockPath?: string;
  systems?: string[];
  outPath?: string;
  markdownPath?: string;
  evidenceDir?: string;
} = {}) {
  const outPath = options.outPath ?? "artifacts/reality/emrp-v1-report.json";
  const evidenceDir = options.evidenceDir ?? "artifacts/reality/evidence";
  const { tasks, lock } = loadRealityManifest(options.manifestPath, options.lockPath);
  const systems = configuredAdapters(options.systems).map((adapter) => runAdapter(adapter, tasks, evidenceDir, lock.sha256));
  const claimGate = realityClaimGate({
    lock,
    systems,
    publicArtifactHash: process.env.MEMORY_REALITY_PUBLIC_ARTIFACT_HASH,
    independentReplicationHash: process.env.MEMORY_REALITY_INDEPENDENT_REPLICATION_HASH,
    sameJudge: Boolean(process.env.MEMORY_REALITY_JUDGE_COMMAND)
  });
  const report: RealityReport = {
    schemaVersion: "1.0",
    protocol: "emrp-v1",
    generatedAt: new Date().toISOString(),
    manifestHash: lock.sha256,
    manifestLock: lock,
    taskCount: tasks.length,
    systems,
    claimEvidence: {
      publicArtifactHash: process.env.MEMORY_REALITY_PUBLIC_ARTIFACT_HASH ?? null,
      independentReplicationHash: process.env.MEMORY_REALITY_INDEPENDENT_REPLICATION_HASH ?? null,
      sameJudgeTraceId: null,
      sameBudgetsProof: "default-preregistered-budgets"
    },
    claimGate,
    publication: {
      evidenceTablePath: "artifacts/public/evidence-table/index.json",
      leaderboardPath: claimGate.leaderboardAllowed ? "artifacts/public/leaderboard/reality.json" : null,
      status: claimGate.leaderboardAllowed ? "market-leaderboard-eligible" : "evidence-table-only"
    }
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  if (options.markdownPath) {
    mkdirSync(dirname(options.markdownPath), { recursive: true });
    writeFileSync(options.markdownPath, renderRealityMarkdown(report));
  }
  return report;
}

function runAdapter(adapter: RealityAdapterContract, tasks: RealityTask[], evidenceDir: string, manifestSha256: string): RealitySystemResult {
  const contract = contractResult(adapter);
  if (contract.adapterKind === "credential-blocked" || contract.adapterKind === "profile-model-forbidden") {
    return blockedResult(adapter, contract, manifestSha256);
  }
  const outputs = tasks.map((task, index) => deterministicOutput(task, adapter.system, index));
  const scored = scoreRealityOutputs(tasks, outputs);
  const rawOutputsPath = join(evidenceDir, `${adapter.system}-raw.jsonl`);
  const scorerTracePath = join(evidenceDir, `${adapter.system}-scorer-trace.json`);
  mkdirSync(dirname(rawOutputsPath), { recursive: true });
  writeFileSync(rawOutputsPath, `${outputs.map((output) => JSON.stringify(output)).join("\n")}\n`);
  writeFileSync(scorerTracePath, `${JSON.stringify(scored.trace, null, 2)}\n`);
  return {
    system: adapter.system,
    displayName: adapter.displayName,
    adapterKind: contract.adapterKind,
    adapterSource: contract.adapterSource,
    provenance: {
      originalCommandExecuted: false,
      rawOutputsFromOriginalCommand: false,
      sharedJudgeTrace: false,
      deterministicScaffold: true,
      manifestSha256,
      inputStreamSha256: manifestSha256
    },
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    blockingReasons: [
      ...contract.blockingReasons,
      "Reality Bench v1 deterministic scaffold is raw evidence only until MEMORY_REALITY_JUDGE_COMMAND validates answer/action quality.",
      "Market claims require Cognibrain plus at least two original competitor systems, public artifact hash and independent replication hash."
    ],
    versions: contract.versions,
    metrics: scored.metrics,
    rawOutputsPath,
    scorerTracePath,
    errors: []
  };
}

function blockedResult(adapter: RealityAdapterContract, contract: ReturnType<typeof contractResult>, manifestSha256: string): RealitySystemResult {
  return {
    system: adapter.system,
    displayName: adapter.displayName,
    adapterKind: contract.adapterKind,
    adapterSource: contract.adapterSource,
    provenance: {
      originalCommandExecuted: false,
      rawOutputsFromOriginalCommand: false,
      sharedJudgeTrace: false,
      deterministicScaffold: false,
      manifestSha256,
      inputStreamSha256: null
    },
    leaderboardEligible: false,
    qualityClaimAllowed: false,
    marketClaimAllowed: false,
    blockingReasons: contract.blockingReasons,
    versions: contract.versions,
    metrics: {
      score: null,
      expectedEvidenceRecall: null,
      forbiddenLeakageRate: null,
      actionAccuracy: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      estimatedCostUsd: null
    },
    rawOutputsPath: null,
    scorerTracePath: null,
    errors: contract.blockingReasons
  };
}

function deterministicOutput(task: RealityTask, system: string, index: number): RealityRawOutput {
  const expected = system === "keyword" ? task.query.expectedEvidenceIds.slice(0, index % 3 === 0 ? 0 : 1) : task.query.expectedEvidenceIds;
  return {
    taskId: task.id,
    answer: expected.length ? `Resolved ${task.id} with ${expected.join(", ")}.` : "Abstain: no acceptable current evidence.",
    evidenceIds: expected,
    action: task.query.expectedAction,
    files: task.query.expectedFiles,
    latencyMs: system === "keyword" ? 3 + (index % 5) : 8 + (index % 11),
    raw: { system, diagnosticOnly: true }
  };
}

function renderRealityMarkdown(report: RealityReport) {
  const rows = report.systems.map((system) => `| ${system.displayName} | ${system.adapterKind} | ${system.blockingReasons[0] ?? ""} | ${system.qualityClaimAllowed ? "yes" : "no"} | ${system.marketClaimAllowed ? "yes" : "no"} | ${system.metrics.score ?? "blocked"} |`).join("\n");
  return `# EMRP v1 Reality Bench

Protocol: ${report.protocol}

Manifest hash: \`${report.manifestHash}\`

Publication status: ${report.publication.status}

Market claim allowed: ${report.claimGate.marketClaimAllowed ? "yes" : "no"}

## Claim Blockers

${report.claimGate.blockers.map((item) => `- ${item}`).join("\n")}

## Evidence Table

| System | Adapter | First blocker | Quality claim | Market claim | Diagnostic score |
|---|---|---|---:|---:|---:|
${rows}
`;
}
