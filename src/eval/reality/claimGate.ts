import type { RealityAdapterKind, RealityClaimGate, RealityManifestLock, RealitySystemResult } from "./types";

const originalKinds: RealityAdapterKind[] = ["official-api", "official-sdk", "official-cli"];
export function realityClaimGate(input: {
  lock: RealityManifestLock;
  systems: RealitySystemResult[];
  publicArtifactHash?: string | null;
  independentReplicationHash?: string | null;
  sameJudge?: boolean;
  sameBudgets?: boolean;
}): RealityClaimGate {
  const eligibleOriginalSystems = input.systems.filter((system) => originalKinds.includes(system.adapterKind) && system.rawOutputsPath && system.scorerTracePath);
  const majorCompetitors = eligibleOriginalSystems.filter((system) => system.system !== "cognibrain");
  const commandProofCompetitors = majorCompetitors.filter(hasOriginalCommandProof);
  const cognibrainEligibleSystems = eligibleOriginalSystems.filter((system) => system.system === "cognibrain" && isRealityClaimPublishableSystem(system));
  const gates = {
    manifestFrozenBeforeRun: Boolean(input.lock.frozenAt && input.lock.sha256),
    allSystemsUseOriginalImplementation: input.systems.length > 0 && input.systems.every((system) => system.adapterKind === "local-baseline" || originalKinds.includes(system.adapterKind) || system.adapterKind === "credential-blocked"),
    noProfileAdapters: input.systems.every((system) => system.adapterKind !== "profile-model-forbidden"),
    sameInputStream: true,
    sameBudgets: input.sameBudgets ?? true,
    sameJudge: input.sameJudge ?? false,
    originalCompetitorCommandProofRecorded: commandProofCompetitors.length >= 2,
    rawOutputsFromOriginalCommands: commandProofCompetitors.length >= 2 && commandProofCompetitors.every(hasOriginalCommandRawOutputProof),
    sharedJudgeTracesRecorded: commandProofCompetitors.length >= 2 && eligibleOriginalSystems.every(hasSharedJudgeTraceProof),
    noDeterministicScaffoldOutputs: eligibleOriginalSystems.length > 0 && eligibleOriginalSystems.every((system) => !hasDeterministicScaffoldBlocker(system)),
    cognibrainEligibleSystemPresent: cognibrainEligibleSystems.length === 1,
    rawOutputsRetained: eligibleOriginalSystems.every((system) => Boolean(system.rawOutputsPath)),
    costLatencyRecorded: eligibleOriginalSystems.every((system) => system.metrics.estimatedCostUsd !== null && system.metrics.p95LatencyMs !== null),
    atLeastTwoMajorCompetitorsEligible: commandProofCompetitors.length >= 2,
    publicArtifactHashPresent: Boolean(input.publicArtifactHash),
    independentReplicationHashPresent: Boolean(input.independentReplicationHash)
  };
  const blockerMessages: Record<keyof typeof gates, string> = {
    manifestFrozenBeforeRun: "Manifest must be frozen and hash-locked before the run.",
    allSystemsUseOriginalImplementation: "Market claims require original API, SDK, or CLI implementations for compared systems.",
    noProfileAdapters: "Capability-profile adapters are forbidden for public comparison claims.",
    sameInputStream: "All systems must use the same input stream.",
    sameBudgets: "All systems must use the same preregistered budgets.",
    sameJudge: "All scoreable systems require the same LLM/harness judge.",
    originalCompetitorCommandProofRecorded: "At least two major original competitor command executions must be recorded.",
    rawOutputsFromOriginalCommands: "Raw outputs must come from recorded original competitor commands, not deterministic scaffold output.",
    sharedJudgeTracesRecorded: "Shared LLM/harness judge traces must be recorded for every scoreable original system.",
    noDeterministicScaffoldOutputs: "Deterministic scaffold outputs cannot open quality, market, or leaderboard claims.",
    cognibrainEligibleSystemPresent: "Cognibrain must have one eligible non-scaffold same-manifest row before market or leaderboard claims.",
    rawOutputsRetained: "Raw outputs must be retained for every eligible system.",
    costLatencyRecorded: "Cost and latency must be recorded for every eligible system.",
    atLeastTwoMajorCompetitorsEligible: "At least two major original competitor systems must be eligible.",
    publicArtifactHashPresent: "A public immutable artifact hash is required.",
    independentReplicationHashPresent: "An independent replication hash is required."
  };
  const blockers = Object.entries(gates)
    .filter(([, passed]) => !passed)
    .map(([key]) => blockerMessages[key as keyof typeof gates]);
  const marketClaimAllowed = blockers.length === 0;
  const qualityClaimAllowed = gates.sameJudge
    && gates.rawOutputsRetained
    && gates.costLatencyRecorded
    && gates.rawOutputsFromOriginalCommands
    && gates.sharedJudgeTracesRecorded
    && gates.noDeterministicScaffoldOutputs;
  return {
    marketClaimAllowed,
    qualityClaimAllowed,
    leaderboardAllowed: marketClaimAllowed,
    gates,
    blockers
  };
}

function hasOriginalCommandProof(system: RealitySystemResult) {
  return system.provenance?.originalCommandExecuted === true;
}

function hasSharedJudgeTraceProof(system: RealitySystemResult) {
  return Boolean(system.scorerTracePath) && system.provenance?.sharedJudgeTrace === true;
}

function hasOriginalCommandRawOutputProof(system: RealitySystemResult) {
  return Boolean(system.rawOutputsPath) && system.provenance?.rawOutputsFromOriginalCommand === true;
}

function hasDeterministicScaffoldBlocker(system: RealitySystemResult) {
  return system.provenance?.deterministicScaffold !== false
    || system.blockingReasons.some((reason) => /deterministic scaffold/i.test(reason));
}

export function isRealityClaimPublishableSystem(system: RealitySystemResult) {
  return originalKinds.includes(system.adapterKind)
    && Boolean(system.rawOutputsPath)
    && Boolean(system.scorerTracePath)
    && hasOriginalCommandProof(system)
    && hasOriginalCommandRawOutputProof(system)
    && hasSharedJudgeTraceProof(system)
    && !hasDeterministicScaffoldBlocker(system)
    && system.metrics.estimatedCostUsd !== null
    && system.metrics.p95LatencyMs !== null;
}
