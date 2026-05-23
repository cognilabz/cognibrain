import type { ConsentPolicy, MemoryLayer, SourceKind, RetrievalWeights } from "./types";

export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalWeights = {
  semantic: 0.26,
  keyword: 0.24,
  entity: 0.16,
  temporal: 0.08,
  trust: 0.18,
  graph: 0.06,
  access: 0.02
};

export interface LifecyclePolicy {
  fadeAfterDays: number;
  archiveAfterDays: number;
  fadeUtilityThreshold: number;
  archiveUtilityThreshold: number;
  trustDecayRate: number;
  importanceDecayRate: number;
  accessBoostDivisor: number;
  verificationAfterDays: number;
  protectedLayers: MemoryLayer[];
  protectedTags: string[];
  protectedSourceKinds: SourceKind[];
  transcriptArchiveAfterDays: number;
}

export const DEFAULT_LIFECYCLE_POLICY: LifecyclePolicy = {
  fadeAfterDays: 45,
  archiveAfterDays: 90,
  fadeUtilityThreshold: 0.5,
  archiveUtilityThreshold: 0.34,
  trustDecayRate: 900,
  importanceDecayRate: 1200,
  accessBoostDivisor: 10,
  verificationAfterDays: 60,
  protectedLayers: ["procedural"],
  protectedTags: [],
  protectedSourceKinds: ["reviewed_code"],
  transcriptArchiveAfterDays: 30
};

export const DEFAULT_CONSENT: ConsentPolicy = {
  visibility: "user",
  allowTraining: false,
  deleteOnRequest: true
};

export function normalizeRetrievalWeights(input?: Partial<RetrievalWeights>): RetrievalWeights {
  const raw = { ...DEFAULT_RETRIEVAL_WEIGHTS, ...(input ?? {}) };
  const sanitized: RetrievalWeights = {
    semantic: Number.isFinite(raw.semantic) && raw.semantic > 0 ? raw.semantic : 0,
    keyword: Number.isFinite(raw.keyword) && raw.keyword > 0 ? raw.keyword : 0,
    entity: Number.isFinite(raw.entity) && raw.entity > 0 ? raw.entity : 0,
    temporal: Number.isFinite(raw.temporal) && raw.temporal > 0 ? raw.temporal : 0,
    trust: Number.isFinite(raw.trust) && raw.trust > 0 ? raw.trust : 0,
    graph: Number.isFinite(raw.graph) && raw.graph > 0 ? raw.graph : 0,
    access: Number.isFinite(raw.access) && raw.access > 0 ? raw.access : 0
  };
  const total = Object.values(sanitized).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return DEFAULT_RETRIEVAL_WEIGHTS;
  return {
    semantic: sanitized.semantic / total,
    keyword: sanitized.keyword / total,
    entity: sanitized.entity / total,
    temporal: sanitized.temporal / total,
    trust: sanitized.trust / total,
    graph: sanitized.graph / total,
    access: sanitized.access / total
  };
}

export function normalizeLifecyclePolicy(input?: Partial<LifecyclePolicy>): LifecyclePolicy {
  const policy = { ...DEFAULT_LIFECYCLE_POLICY, ...(input ?? {}) };
  return {
    fadeAfterDays: positive(policy.fadeAfterDays, DEFAULT_LIFECYCLE_POLICY.fadeAfterDays),
    archiveAfterDays: positive(policy.archiveAfterDays, DEFAULT_LIFECYCLE_POLICY.archiveAfterDays),
    fadeUtilityThreshold: bounded(policy.fadeUtilityThreshold, DEFAULT_LIFECYCLE_POLICY.fadeUtilityThreshold),
    archiveUtilityThreshold: bounded(policy.archiveUtilityThreshold, DEFAULT_LIFECYCLE_POLICY.archiveUtilityThreshold),
    trustDecayRate: positive(policy.trustDecayRate, DEFAULT_LIFECYCLE_POLICY.trustDecayRate),
    importanceDecayRate: positive(policy.importanceDecayRate, DEFAULT_LIFECYCLE_POLICY.importanceDecayRate),
    accessBoostDivisor: positive(policy.accessBoostDivisor, DEFAULT_LIFECYCLE_POLICY.accessBoostDivisor),
    verificationAfterDays: positive(policy.verificationAfterDays, DEFAULT_LIFECYCLE_POLICY.verificationAfterDays),
    protectedLayers: Array.isArray(policy.protectedLayers) ? policy.protectedLayers : DEFAULT_LIFECYCLE_POLICY.protectedLayers,
    protectedTags: Array.isArray(policy.protectedTags) ? policy.protectedTags : DEFAULT_LIFECYCLE_POLICY.protectedTags,
    protectedSourceKinds: Array.isArray(policy.protectedSourceKinds) ? policy.protectedSourceKinds : DEFAULT_LIFECYCLE_POLICY.protectedSourceKinds,
    transcriptArchiveAfterDays: positive(policy.transcriptArchiveAfterDays, DEFAULT_LIFECYCLE_POLICY.transcriptArchiveAfterDays)
  };
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function bounded(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}
