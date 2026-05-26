import type { RetrievalWeights } from "./retrieval";

export type MemoryType = "user" | "feedback" | "project" | "reference" | "episodic" | "procedural";
export type MemoryLayer = "working" | "episodic" | "long_term" | "procedural" | "reflection";
export type SourceKind = "human" | "reviewed_code" | "tool" | "agent" | "transcript" | "import";
export type MemorySchemaVersion = "2.0";
export type BeliefState = "active" | "stale" | "superseded" | "contradicted" | "needs_verification" | "retracted" | "archived";
export type RelationType =
  | "mentions"
  | "calls"
  | "imports"
  | "defines"
  | "extends"
  | "depends_on"
  | "transitive_depends_on"
  | "works_for"
  | "advisor_of"
  | "supersedes"
  | "contradicts"
  | "confirmed_by"
  | "suggested_by"
  | "executed_by";
export type ConsentVisibility = "private" | "user" | "org" | "public";
export type FeedbackKind =
  | "helpful"
  | "wrong"
  | "stale"
  | "always_include"
  | "never_include"
  | "private"
  | "shareable"
  | "approve_pattern"
  | "reject_pattern";
export type RetrievalMode = "hybrid" | "rrf" | "graph" | "path";
export type QueryIntent =
  | "fact_lookup"
  | "temporal_question"
  | "multi_hop_question"
  | "preference_procedural"
  | "contradiction_check"
  | "project_context"
  | "personal_context"
  | "team_context"
  | "connection_explanation";

export type QueryPlanStrategy =
  | "semantic"
  | "keyword"
  | "graph_path"
  | "activation"
  | "temporal"
  | "procedure"
  | "pattern"
  | "contradiction"
  | "entity"
  | "project"
  | "team"
  | "personal"
  | "source"
  | "policy"
  | "trust"
  | "timeline"
  | "repo_policy"
  | "engineering_memory"
  | "tool_outcome"
  | "scope"
  | "guard"
  | "architecture"
  | "correction"
  | "evidence";

export interface QueryPlan {
  query: string;
  queryType: string;
  secondaryTypes: string[];
  intent: QueryIntent;
  recommendedMode: RetrievalMode;
  strategies: QueryPlanStrategy[];
  recommendedWeights?: Partial<RetrievalWeights>;
  explanation: string[];
  confidence: number;
}

export interface Provenance {
  kind: SourceKind;
  uri?: string;
  commit?: string;
  lineStart?: number;
  lineEnd?: number;
  confidence: number;
}

export interface MemoryScope {
  brainId?: string;
  sourceId?: string;
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  deviceId?: string;
  runId?: string;
}

export interface ConsentPolicy {
  visibility: ConsentVisibility;
  allowTraining?: boolean;
  retentionUntil?: Date | string;
  deleteOnRequest?: boolean;
}

export interface RetentionRule {
  id: string;
  label: string;
  retentionDays: number;
  action: "archive" | "delete";
  scope?: {
    userId?: string;
    brainId?: string;
    sourceId?: string;
    sourceKind?: SourceKind;
    visibility?: ConsentVisibility;
    entity?: string;
    relationType?: RelationType;
    tag?: string;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RetentionEnforcementReport {
  generatedAt: Date | string;
  evaluated: number;
  archived: string[];
  deleted: string[];
  episodeArchived: string[];
  episodeDeleted: string[];
  rulesMatched: Record<string, number>;
}

export interface RetentionReviewReport {
  generatedAt: Date | string;
  userId?: string;
  rules: RetentionRule[];
  expiredMemories: Array<{ memoryId: string; reason: string; ruleId?: string; action: "archive" | "delete" }>;
  episodeRisks: Array<{ episodeId: string; memoryIds: string[]; reason: string; action: "archive" | "delete" }>;
  summary: {
    memoriesAtRisk: number;
    episodesAtRisk: number;
    deleteActions: number;
    archiveActions: number;
  };
}

export type MemoryPolicyOperation = "write" | "retrieve" | "dream" | "export" | "delete" | "all";

export interface MemoryPolicyRule {
  id: string;
  label: string;
  effect: "allow" | "deny";
  operations: MemoryPolicyOperation[];
  scope?: {
    userId?: string;
    orgId?: string;
    brainId?: string;
    sourceId?: string;
    sourceKind?: SourceKind;
    tag?: string;
    memoryType?: MemoryType;
    connectorId?: string;
    visibility?: ConsentVisibility;
  };
  priority?: number;
  reason?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface PolicyDecision {
  operation: MemoryPolicyOperation;
  allowed: boolean;
  memoryId?: string;
  matchedRules: Array<{ id: string; label: string; effect: MemoryPolicyRule["effect"]; reason?: string }>;
  reasons: string[];
}

export interface MemoryRelation {
  type: RelationType;
  sourceEntity?: string;
  targetId?: string;
  targetEntity?: string;
  direction?: "out" | "in" | "undirected";
  confidence?: number;
  evidence?: string;
  validFrom?: Date | string;
  validUntil?: Date | string;
}

export interface TemporalMetadata {
  eventAt?: Date | string;
  validFrom?: Date | string;
  validUntil?: Date | string;
  supersededAt?: Date | string;
  lastConfirmedAt?: Date | string;
  verificationDueAt?: Date | string;
  stalenessRisk?: number;
}

export interface MemoryProvenance {
  source: Provenance;
  citations: string[];
  summaryOf?: string[];
  extractedFromEpisodeId?: string;
  sourceRef?: SourceRef;
}

export interface SourceRef {
  connectorId?: string;
  externalId?: string;
  url?: string;
  author?: string;
  timestamp?: Date | string;
  version?: string;
  hash?: string;
}

export interface MemoryAuditEvent {
  type: "created" | "updated" | "accessed" | "archived" | "state_changed";
  at: Date | string;
  actor?: string;
  reason?: string;
  previousState?: BeliefState;
  nextState?: BeliefState;
}

export interface ProceduralMemoryMetadata {

  triggerConditions: string[];
  applicabilityScope: Partial<MemoryScope>;
  confidence: number;
  lastOutcome: "success" | "failure" | "unknown";
  successCount: number;
  failureCount: number;
  lastSuccessAt?: Date | string;
  lastFailureAt?: Date | string;
  feedback: Array<{ kind: FeedbackKind | "observed"; at: Date | string; note?: string }>;
}
