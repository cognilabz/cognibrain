export type MemoryType = "user" | "feedback" | "project" | "reference" | "episodic" | "procedural";
export type MemoryLayer = "working" | "episodic" | "long_term" | "procedural" | "reflection";
export type SourceKind = "human" | "reviewed_code" | "tool" | "agent" | "transcript" | "import";
export type RelationType =
  | "mentions"
  | "calls"
  | "imports"
  | "defines"
  | "extends"
  | "depends_on"
  | "works_for"
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

export interface Provenance {
  kind: SourceKind;
  uri?: string;
  commit?: string;
  lineStart?: number;
  lineEnd?: number;
  confidence: number;
}

export interface MemoryScope {
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

export interface MemoryInput {
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
  metadata?: Record<string, unknown>;
}

export interface Memory {
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

export interface SearchOptions {
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
  limit?: number;
  now?: Date;
  includeArchived?: boolean;
  weights?: Partial<RetrievalWeights>;
  includePrivate?: boolean;
  includeLinkedIdentities?: boolean;
  linkedUserIds?: string[];
  profileId?: string;
  verifier?: ContextVerifier;
  reranker?: ContextReranker;
  filters?: {
    type?: MemoryType;
    layer?: MemoryLayer;
    tags?: string[];
    minTrust?: number;
  };
}

export interface SearchResult {
  memory: Memory;
  score: number;
  initialScore?: number;
  decision?: "include" | "exclude" | "warn" | "review";
  explanation?: string[];
  signals: {
    semantic: number;
    keyword: number;
    entity: number;
    temporal: number;
    trust: number;
    graph: number;
    access?: number;
  };
  graphPaths?: string[];
  citation: string;
  stale: boolean;
}

export interface RetrievalWeights {
  semantic: number;
  keyword: number;
  entity: number;
  temporal: number;
  trust: number;
  graph: number;
  access: number;
}

export interface RetrievalProfile {
  id: string;
  label: string;
  weights: RetrievalWeights;
  scope?: Partial<Pick<MemoryScope, "userId" | "projectId" | "appId" | "orgId" | "agentId">>;
  learned?: boolean;
  trainingSamples?: number;
  benchmarkDelta?: number;
  updatedAt: Date | string;
  provenance?: string;
}

export interface LearnedProfileReport {
  profile: RetrievalProfile;
  samples: number;
  positiveSignals: Partial<RetrievalWeights>;
  negativeSignals: Partial<RetrievalWeights>;
  lossBefore?: number;
  lossAfter?: number;
}

export interface RetrievalTrainingSample {
  query: string;
  userId: string;
  selectedMemoryId?: string;
  rejectedMemoryIds?: string[];
  profileId?: string;
  signals?: Partial<RetrievalWeights>;
  outcome: "helpful" | "wrong" | "accepted" | "rejected";
  timestamp?: Date | string;
}

export interface ContextVerifier {
  verify(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[];
}

export interface ContextReranker {
  rerank(input: { query: string; results: SearchResult[]; now: Date }): SearchResult[];
}

export interface ContradictionDetector {
  classify(input: { a: Memory; b: Memory; key?: string }): {
    label: "entailment" | "neutral" | "contradiction";
    confidence: number;
    reason?: string;
  };
}

export interface ReflectionSummarizer {
  summarize(input: { theme: string; memories: Memory[]; now: Date }): {
    content: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
  };
}

export interface HealthReport {
  total: number;
  active: number;
  archived: number;
  freshness: number;
  averageTrust: number;
  coverage: number;
  contradictions: number;
  healthScore: number;
}

export interface IdentityLink {
  id: string;
  primaryUserId: string;
  linkedUserId: string;
  hashedSubject: string;
  consent: "user" | "org";
  createdAt: Date | string;
  revokedAt?: Date | string;
}

export interface TimelineReport {
  userId: string;
  events: Array<{
    memoryId: string;
    content: string;
    eventAt: Date | string;
    validFrom?: Date | string;
    validUntil?: Date | string;
    supersededAt?: Date | string;
    entities: string[];
  }>;
  periods: Array<{ period: string; granularity: "day" | "week" | "month"; memoryIds: string[]; summary?: string }>;
}

export interface EntityRecord {
  id: string;
  canonical: string;
  aliases: string[];
  memoryIds: string[];
  firstSeenAt: Date | string;
  lastSeenAt: Date | string;
}

export interface GraphReport {
  entities: EntityRecord[];
  edges: Array<{
    sourceMemoryId: string;
    sourceEntity?: string;
    targetMemoryId?: string;
    targetEntity?: string;
    type: RelationType;
    direction?: "out" | "in" | "undirected";
    confidence: number;
    validFrom?: Date | string;
    validUntil?: Date | string;
  }>;
}

export interface DomainEvaluationCase {
  id: string;
  query: string;
  expected: string[];
  memories: MemoryInput[];
}

export interface DomainEvaluationReport {
  domainId: string;
  passed: boolean;
  accuracy: number;
  total: number;
  correct: number;
  generatedAt: Date | string;
  details: Array<{ id: string; passed: boolean; retrieved: string[]; expected: string[] }>;
}

export interface ReflectionReport {
  created: Memory[];
  demoted: Memory[];
  contradictions: Array<{ kept: Memory; demoted: Memory; reason: string; detector?: string; confidence?: number }>;
  lifecycle: {
    evaluated: number;
    summarized: number;
    faded: number;
    archived: number;
    reorganized: number;
    qualityScore: number;
    issues: string[];
    actions: string[];
  };
}

export interface MemoryExtractionEvent {
  role: "user" | "assistant" | "tool" | "system" | "operator";
  content: string;
  timestamp?: Date | string;
  source?: Provenance;
  metadata?: Record<string, unknown>;
}

export interface ExtractionReport {
  memories: Memory[];
  entityLinks: Record<string, string[]>;
}

export interface FeedbackEvent {
  memoryId: string;
  userId?: string;
  kind: FeedbackKind;
  note?: string;
  timestamp?: Date | string;
}

export interface MetricsReport {
  memoriesAdded: number;
  memoriesUpdated?: number;
  memoriesArchived?: number;
  searches: number;
  feedback: number;
  dreams: number;
  contradictionsResolved: number;
  contradictionsOpened?: number;
  noHitSearches: number;
  lowConfidenceSearches?: number;
  averageSearchResults: number;
  averageQualityScore: number;
  dreamActions?: Record<string, number>;
  benchmarkRuns?: number;
  sessions?: Record<string, { searches: number; noHitSearches: number; averageResults: number }>;
}

export interface BenchmarkCase {
  id: string;
  kind: "single-hop" | "multi-hop" | "temporal" | "contradiction" | "abstention";
  query: string;
  expectedIds: string[];
  disallowedIds?: string[];
}

export interface BenchmarkResult {
  name: string;
  accuracy: number;
  correct: number;
  total: number;
  meanTokens: number;
  meanLatencyMs: number;
  details: Array<{ id: string; passed: boolean; retrieved: string[]; expected: string[] }>;
}
