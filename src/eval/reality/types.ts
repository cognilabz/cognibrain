export type RealityBucket =
  | "repeat-mistake"
  | "stale-update"
  | "forbidden-action"
  | "patch-evidence"
  | "source-citation"
  | "privacy-deletion"
  | "abstention"
  | "public-memory-qa";

export type RealityAdapterKind =
  | "official-api"
  | "official-sdk"
  | "official-cli"
  | "local-baseline"
  | "credential-blocked"
  | "repaired-diagnostic"
  | "profile-model-forbidden";

export interface RealityCorpusEvent {
  id: string;
  source: string;
  occurredAt: string;
  content: string;
  tags: string[];
  private?: boolean;
  deleteTargetId?: string;
}

export interface RealityTask {
  schemaVersion: "1.0";
  id: string;
  bucket: RealityBucket;
  corpusEvents: RealityCorpusEvent[];
  query: {
    text: string;
    expectedEvidenceIds: string[];
    forbiddenEvidenceIds: string[];
    expectedAction: "answer" | "abstain" | "block-action" | "cite-source" | "propose-patch";
    expectedFiles?: string[];
  };
  scoring: {
    deterministicChecks: Array<"expected-evidence" | "forbidden-evidence" | "abstention" | "action" | "source-citation" | "patch-files">;
    judgeRubric: "answer-quality-v1" | "engineering-action-v1" | "privacy-boundary-v1";
  };
}

export interface RealityManifestLock {
  schemaVersion: "1.0";
  protocol: "emrp-v1";
  manifestPath: string;
  frozenAt: string;
  taskCount: number;
  taskBuckets: Record<RealityBucket, number>;
  sha256: string;
}

export interface RealityRawOutput {
  taskId: string;
  answer: string;
  evidenceIds: string[];
  action: RealityTask["query"]["expectedAction"];
  files?: string[];
  latencyMs: number;
  raw: unknown;
}

export interface RealitySystemResult {
  system: string;
  displayName: string;
  adapterKind: RealityAdapterKind;
  adapterSource: string;
  leaderboardEligible: boolean;
  qualityClaimAllowed: boolean;
  marketClaimAllowed: boolean;
  blockingReasons: string[];
  versions: Record<string, string>;
  metrics: {
    score: number | null;
    expectedEvidenceRecall: number | null;
    forbiddenLeakageRate: number | null;
    actionAccuracy: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    estimatedCostUsd: number | null;
  };
  rawOutputsPath: string | null;
  scorerTracePath: string | null;
  errors: string[];
}

export interface RealityClaimGate {
  marketClaimAllowed: boolean;
  qualityClaimAllowed: boolean;
  leaderboardAllowed: boolean;
  gates: {
    manifestFrozenBeforeRun: boolean;
    allSystemsUseOriginalImplementation: boolean;
    noProfileAdapters: boolean;
    sameInputStream: boolean;
    sameBudgets: boolean;
    sameJudge: boolean;
    rawOutputsRetained: boolean;
    costLatencyRecorded: boolean;
    atLeastTwoMajorCompetitorsEligible: boolean;
    publicArtifactHashPresent: boolean;
    independentReplicationHashPresent: boolean;
  };
  blockers: string[];
}

export interface RealityReport {
  schemaVersion: "1.0";
  protocol: "emrp-v1";
  generatedAt: string;
  manifestHash: string;
  manifestLock: RealityManifestLock;
  taskCount: number;
  systems: RealitySystemResult[];
  claimGate: RealityClaimGate;
  publication: {
    evidenceTablePath: string;
    leaderboardPath: string | null;
    status: "evidence-table-only" | "market-leaderboard-eligible";
  };
}
