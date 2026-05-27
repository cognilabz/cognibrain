import type { FeedbackKind, MemoryScope, Provenance, SourceRef } from "./base";
import type { Memory, MemoryInput, SearchResult } from "./memory";
import type { LearnedProfileReport, RetrievalTrainingSample, RetrievalWeights } from "./retrieval";

export interface MemoryExtractionEvent {
  role: "user" | "assistant" | "tool" | "system" | "operator";
  content: string;
  timestamp?: Date | string;
  source?: Provenance;
  mediaType?: "text" | "code" | "document" | "audio" | "image" | "video";
  language?: string;
  uri?: string;
  mimeType?: string;
  sourceRef?: SourceRef;
  metadata?: Record<string, unknown>;
}

export interface TranslationReport {
  original: string;
  sourceLanguage?: string;
  targetLanguage: string;
  translated: string;
  provider: "deterministic" | "json-command";
  confidence: number;
}

export interface ExtractionStage {
  stage: "rules" | "provider" | "enrichment";
  inputEvents: number;
  extracted: number;
  confidence: number;
  reason?: string;
}

export interface ExtractionFailure {
  eventIndex: number;
  stage: "rules" | "provider" | "enrichment";
  reason: string;
  mediaType?: MemoryExtractionEvent["mediaType"];
  language?: string;
  contentPreview: string;
}

export interface EnrichmentCandidate {
  entity: string;
  mentionCount: number;
  attention: number;
  suggestedAction: "stub" | "enrich" | "full_pipeline";
  reason: string;
  memoryIds: string[];
}

export interface ExtractionRuleSuggestion {
  kind: "regex" | "provider" | "translation";
  pattern?: string;
  reason: string;
  examples: string[];
  confidence: number;
}

export type MemoryClaimDurability = "durable" | "ephemeral" | "session_only" | "ask_user";
export type MemorySensitivity = "none" | "personal" | "secret" | "regulated";

export interface MemoryClaim {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: Record<string, string>;
  time?: Date | string;
  source: Provenance;
  confidence: number;
  durability: MemoryClaimDurability;
  sensitivity: MemorySensitivity;
  scope: Partial<MemoryScope>;
}

export type ClaimState = "active" | "superseded" | "contradicted" | "needs_verification" | "retracted";

export interface ClaimRecord {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  qualifiers: Record<string, unknown>;
  sourceMemoryId: string;
  sourceRef?: SourceRef;
  validFrom?: Date | string;
  validUntil?: Date | string;
  confidence: number;
  trust: number;
  state: ClaimState;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ConflictSet {
  id: string;
  claimIds: string[];
  detectedAt: Date | string;
  status: "open" | "resolved" | "operator_review";
  resolution?: {
    selectedClaimId: string;
    reason: string;
    resolvedBy: "system" | "operator" | "source_revalidation";
    resolvedAt: Date | string;
  };
}

export interface CurrentTruthDecision {
  subject: string;
  predicate: string;
  selectedClaimId?: string;
  selectedMemoryId?: string;
  state: "selected" | "uncertain" | "missing";
  reason: string;
  suppressedClaimIds: string[];
  conflictSetId?: string;
  scoreBreakdown?: Record<string, number>;
}

export interface DurabilityDecision {
  contentPreview: string;
  action: "store" | "ignore" | "session_only" | "working_memory" | "ask_user";
  reason: string;
  durability: MemoryClaimDurability;
  sensitivity: MemorySensitivity;
  confidence: number;
}

export interface EntityMergeSuggestion {
  canonical: string;
  alias: string;
  confidence: number;
  reason: string;
  memoryIds: string[];
}

export interface ExtractionReport {
  memories: Memory[];
  entityLinks: Record<string, string[]>;
  stages: ExtractionStage[];
  failures: ExtractionFailure[];
  claims?: MemoryClaim[];
  durabilityDecisions?: DurabilityDecision[];
  enrichmentCandidates: EnrichmentCandidate[];
  learnedRules: ExtractionRuleSuggestion[];
}

export interface FeedbackEvent {
  memoryId: string;
  userId?: string;
  kind: FeedbackKind;
  note?: string;
  timestamp?: Date | string;
}

export interface InjectionFeedbackEvent {
  userId: string;
  query: string;
  injectedMemoryIds: string[];
  acceptedMemoryIds?: string[];
  rejectedMemoryIds?: string[];
  outcome: "helpful" | "wrong" | "accepted" | "rejected";
  sessionId?: string;
  profileId?: string;
  note?: string;
  signals?: Partial<RetrievalWeights>;
  timestamp?: Date | string;
}

export interface InjectionFeedbackReport {
  event: InjectionFeedbackEvent;
  updatedMemories: Memory[];
  trainingSample: RetrievalTrainingSample;
  learnedProfile: LearnedProfileReport;
}

export interface AdaptiveDreamPolicyReport {
  userId: string;

  generatedAt: Date | string;
  recommended: {
    intervalHours: number;
    writeThreshold: number;
    summaryDepth: number;
    fadeAfterDays: number;
    archiveAfterDays: number;
  };
  signals: {
    healthScore: number;
    activeMemories: number;
    reviewMemories: number;
    feedbackVolume: number;
    negativeFeedback: number;
    writesSinceDream: number;
    searches: number;
  };
  rationale: string[];
}
