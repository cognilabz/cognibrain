import type { BeliefState, ConsentPolicy, FeedbackKind, MemoryAuditEvent, MemoryLayer, MemoryPolicyRule, MemoryProvenance, MemoryRelation, MemorySchemaVersion, MemoryScope, MemoryType, PolicyDecision, Provenance, QueryIntent, QueryPlan, RelationType, RetrievalMode, SourceKind, SourceRef, TemporalMetadata } from "./base";
import type { CodebaseScope, EngineeringMemoryKind } from "./engineering";
import type { CurrentTruthDecision } from "./extraction";
import type { ContextReranker, ContextVerifier, RetrievalProfile, RetrievalWeights } from "./retrieval";

export interface MemoryInput {
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
  content: string;
  type?: MemoryType;
  layer?: MemoryLayer;
  source?: Provenance;
  tags?: string[];
  entities?: string[];
  relations?: MemoryRelation[];
  consent?: Partial<ConsentPolicy>;
  temporal?: TemporalMetadata;
  timestamp?: Date | string;
  pinned?: boolean;
  confidence?: number;
  beliefState?: BeliefState;
  metadata?: Record<string, unknown>;
  sourceRef?: SourceRef;
}

export interface Memory {
  schemaVersion: MemorySchemaVersion;
  brainId?: string;
  sourceId?: string;
  id: string;
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  deviceId?: string;
  runId?: string;
  content: string;
  type: MemoryType;
  layer: MemoryLayer;
  source: Provenance;
  tags: string[];
  entities: string[];
  metadata: Record<string, unknown>;
  relations: MemoryRelation[];
  consent: ConsentPolicy;
  temporal: TemporalMetadata;
  scope: MemoryScope;
  confidence: number;
  beliefState: BeliefState;
  provenance: MemoryProvenance;
  audit: MemoryAuditEvent[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  trust: number;
  importance: number;
  accessCount: number;
  lastAccessedAt?: Date;
  archivedAt?: Date;
  summaryOf?: string[];
}

export interface MemoryRecordV2 extends Memory {
  schemaVersion: "2.0";
}

export interface SearchOptions {
  brainId?: string;
  brainIds?: string[];
  sourceId?: string;
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  deviceId?: string;
  runId?: string;
  scopeMode?: "user" | "session" | "app" | "org" | "project" | "all";
  query: string;
  mode?: RetrievalMode;
  expandQuery?: boolean;
  queryExpansions?: string[];
  limit?: number;
  now?: Date;
  includeArchived?: boolean;
  weights?: Partial<RetrievalWeights>;
  includePrivate?: boolean;
  includeLinkedIdentities?: boolean;
  includeSharedBrains?: boolean;
  linkedUserIds?: string[];
  profileId?: string;
  verifier?: ContextVerifier;
  reranker?: ContextReranker;
  embeddingProvider?: EmbeddingProvider;
  disableEmbeddings?: boolean;
  lexicalProvider?: LexicalScoreProvider;
  codebaseScope?: CodebaseScope;
  filters?: {
    type?: MemoryType;
    layer?: MemoryLayer;
    tags?: string[];
    minTrust?: number;
    engineeringKind?: EngineeringMemoryKind;
    engineeringKinds?: EngineeringMemoryKind[];
  };
  graphDepth?: number;
  relationTypes?: RelationType[];
}

export interface EmbeddingProvider {
  readonly id?: string;
  embed(input: string): number[];
}

export interface LexicalScoreProvider {
  readonly id?: string;
  search(input: { query: string; memories: Memory[]; limit?: number }): Array<{ memoryId: string; score: number; explanation?: string }>;
}

export interface MemoryRouteReport {
  query: string;
  userId: string;
  selectedScopes: Array<{ kind: "user" | "session" | "app" | "project" | "org" | "brain" | "agent" | "persona"; id: string; reason: string }>;
  excludedScopes: Array<{ kind: "private" | "brain" | "org" | "agent"; id: string; reason: string }>;
  reasoning: string[];
  retrievalOptions: Partial<SearchOptions>;
}

export interface QueryIntentReport {
  query: string;
  intent: QueryIntent;
  confidence: number;
  recommendedMode: RetrievalMode;
  recommendedWeights?: Partial<RetrievalWeights>;
  reasons: string[];
  plan: QueryPlan;
}

export interface VerificationQueueReport {
  userId: string;
  generatedAt: Date | string;
  items: Array<{
    memoryId: string;
    content: string;
    beliefState: BeliefState;
    trust: number;
    importance: number;
    verificationDueAt?: Date | string;
    reason: string;
  }>;
}

export interface SearchResult {
  memory: Memory;
  score: number;
  confidence?: number;
  unsafeToInject?: boolean;
  initialScore?: number;
  decision?: "include" | "exclude" | "warn" | "review";
  explanation?: string[];
  retrievalMode?: RetrievalMode;
  expandedQueries?: string[];
  fusion?: {
    strategy: RetrievalMode;
    rank?: number;
    scoreBeforeFusion?: number;
    components?: Partial<Record<keyof RetrievalWeights, number>>;
  };
  contradiction?: {
    memoryId: string;
    reason: string;
    action: "exclude" | "review";
  };
  signals: {
    semantic: number;
    keyword: number;
    entity: number;
    temporal: number;
    behavioral?: number;
    trust: number;
    graph: number;
    access?: number;
  };
  graphPaths?: string[];
  citation: string;
  stale: boolean;
  queryPlan?: QueryPlan;
  truth?: {
    selectedClaimId?: string;
    selectedMemoryId?: string;
    currentTruthState: "selected" | "uncertain" | "missing";
    suppressedClaimIds: string[];
    reason: string;
    conflictSetId?: string;
  };
  risk?: {
    riskLevel: "low" | "medium" | "high" | "release-critical" | "destructive";
    warnings: string[];
    verificationRequests: string[];
    actionGuardBlock?: boolean;
    truthReason?: string;
  };
}

export interface EvidencePack {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  query: string;
  actor?: Partial<MemoryScope> & { permissions?: string[] };
  userId: string;
  scope?: Partial<MemoryScope>;
  profileId?: string;
  retrievalProfile?: RetrievalProfile;
  queryIntent?: QueryIntentReport;
  tokenBudget: number;
  hash?: string;
  context: string;
  results: Array<{
    memoryId: string;
    content: string;
    source: Provenance;
    scope: MemoryScope;
    consent: ConsentPolicy;
    trust: number;
    confidence: number;
    importance: number;
    beliefState: BeliefState;
    provenance: MemoryProvenance;
    validity: {
      eventAt?: string;
      validFrom?: string;
      validUntil?: string;
      lastConfirmedAt?: string;
      verificationDueAt?: string;
      stale: boolean;
      decision?: SearchResult["decision"];
    };
    retrieval: {
      score: number;
      confidence?: number;
      unsafeToInject?: boolean;
      initialScore?: number;
      mode?: RetrievalMode;
      signals: SearchResult["signals"];
      scoreBreakdown?: SearchResult["signals"] & { finalScore: number; initialScore?: number; confidence?: number };
      explanation: string[];
      whyIncluded: string[];
      whyNotExcluded: string[];
      graphPaths: string[];
      citation: string;
      contradiction?: SearchResult["contradiction"];
      plan?: QueryPlan;
    };
    policyDecision?: PolicyDecision;
    contradictionWarnings?: string[];
    truthDecision?: CurrentTruthDecision;
  }>;
  excludedResults?: Array<{
    memoryId: string;
    reason: string;
    decision?: SearchResult["decision"];
    policyDecision?: PolicyDecision;
    score?: number;
    truthDecision?: CurrentTruthDecision;
  }>;
  policyDecisions?: PolicyDecision[];
  graphPaths?: string[];
  truthDecisions?: CurrentTruthDecision[];
  temporalState?: {
    generatedAt: string;
    stale: number;
    valid: number;
    needsVerification: number;
    contradicted: number;
  };
  summary: {
    included: number;
    warnings: number;
    excluded: number;
    stale: number;
    contradictions: number;
  };
}
