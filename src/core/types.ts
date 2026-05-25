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

export type EngineeringMemoryKind =
  | "repo_policy"
  | "architecture_decision"
  | "review_correction"
  | "tool_outcome"
  | "procedure"
  | "forbidden_action"
  | "migration_note"
  | "test_strategy"
  | "dependency_rule"
  | "generated_file_rule";

export interface CodebaseScope {
  org?: string;
  orgId?: string;
  repo?: string;
  repository?: string;
  branch?: string;
  commit?: string;
  commitRange?: string;
  packageName?: string;
  workspace?: string;
  directory?: string;
  filePattern?: string;
  language?: string;
  framework?: string;
  harness?: string;
  currentPath?: string;
}

export interface EngineeringMemoryMetadata {
  kind: EngineeringMemoryKind;
  codebase: CodebaseScope;
  confidence: number;
  correctionOfMemoryId?: string;
  previousWrongAction?: string;
  correctAction?: string;
  forbiddenAction?: string;
  command?: string;
  cwd?: string;
  envRequirements?: string[];
  exitCode?: number;
  failureReason?: string;
  successPattern?: string;
  filesChanged?: string[];
  testOutputSummary?: string;
  evidenceIds?: string[];
  verificationDueAt?: Date | string;
}

export interface CodingContextPack {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  query: string;
  userId: string;
  scope?: Partial<MemoryScope> & { codebase?: CodebaseScope };
  tokenBudget: number;
  context: string;
  sections: Array<{
    id:
      | "repo_policies"
      | "procedures_before_action"
      | "previous_corrections"
      | "known_pitfalls"
      | "architecture_decisions"
      | "tool_commands"
      | "forbidden_actions"
      | "graph_temporal_notes";
    title: string;
    evidence: Array<{
      memoryId: string;
      kind?: EngineeringMemoryKind;
      content: string;
      score: number;
      trust: number;
      source: Provenance;
      stale: boolean;
      graphPaths?: string[];
    }>;
  }>;
  excludedStaleRules: Array<{ memoryId: string; reason: string; kind?: EngineeringMemoryKind }>;
  evidencePackId?: string;
}

export interface ActionGuardReport {
  schemaVersion: "1.0";
  generatedAt: string;
  userId: string;
  action: string;
  allowed: boolean;
  severity: "allow" | "warn" | "block";
  warnings: string[];
  blockedBy: Array<{ memoryId: string; kind?: EngineeringMemoryKind; reason: string }>;
  alternatives: string[];
  evidenceIds: string[];
}

export interface PatchEvidenceTrail {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  userId: string;
  task: string;
  memoryIds: string[];
  correctionIds: string[];
  procedureIds: string[];
  toolOutcomeIds: string[];
  graphPaths: string[];
  excludedStaleRules: Array<{ memoryId: string; reason: string }>;
  summary: {
    filesChanged: string[];
    commandsRun: string[];
    evidenceCount: number;
  };
}

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
  }>;
  excludedResults?: Array<{
    memoryId: string;
    reason: string;
    decision?: SearchResult["decision"];
    policyDecision?: PolicyDecision;
    score?: number;
  }>;
  policyDecisions?: PolicyDecision[];
  graphPaths?: string[];
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

export interface RetrievalWeights {
  semantic: number;
  keyword: number;
  entity: number;
  temporal: number;
  behavioral: number;
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

export interface MemoryExtractor {
  extract(input: {
    events: MemoryExtractionEvent[];
    scope: Partial<MemoryScope> & Pick<MemoryScope, "userId">;
    existing: Memory[];
    now: Date;
  }): MemoryInput[];
}

export interface EpisodeRecord {
  id: string;
  userId: string;
  scope: MemoryScope;
  rawConversation: MemoryExtractionEvent[];
  toolCalls: Array<{ name?: string; input?: unknown; output?: unknown; timestamp?: Date | string }>;
  filesTouched: string[];
  source?: Provenance;
  hash: string;
  memoryIds: string[];
  createdAt: Date | string;
  retention?: {
    action: "archive" | "delete";
    at: Date | string;
    ruleId?: string;
    reason: string;
    memoryIds: string[];
  };
}

export interface EpisodeInput {
  scope: MemoryScope;
  events: MemoryExtractionEvent[];
  toolCalls?: EpisodeRecord["toolCalls"];
  filesTouched?: string[];
  source?: Provenance;
}

export interface HarnessActionInput {
  userId: string;
  agentId?: string;
  sessionId?: string;
  appId?: string;
  orgId?: string;
  projectId?: string;
  command?: string;
  cwd?: string;
  envRequirements?: string[];
  exitCode?: number;
  failureReason?: string;
  benchmarkScenarioId?: string;
  evidencePackId?: string;
  filesChanged?: string[];
  tests?: Array<{ name: string; status: "passed" | "failed" | "skipped"; output?: string }>;
  pullRequest?: string;
  errorFixed?: string;
  content?: string;
  timestamp?: Date | string;
}

export interface QueryExpander {
  expand(input: { query: string; userId: string; now: Date; memories?: Memory[] }): string[];
}

export interface TranslationProvider {
  translate(input: { text: string; sourceLanguage?: string; targetLanguage: string }): {
    translated: string;
    confidence?: number;
    provider?: string;
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
  periods: Array<{ period: string; granularity: "hour" | "day" | "week" | "month"; memoryIds: string[]; summary?: string }>;
}

export interface TimelineSummaryReport {
  userId: string;
  generatedAt: Date | string;
  granularity: "hour" | "day" | "week" | "month" | "all";
  persisted: boolean;
  summaries: Array<{
    period: string;
    granularity: "hour" | "day" | "week" | "month";
    content: string;
    memoryIds: string[];
    summaryMemoryId?: string;
    confidence: number;
    mode: "deterministic" | "provider";
  }>;
}

export interface TemporalQueryReport {
  userId: string;
  after?: Date | string;
  before?: Date | string;
  events: TimelineReport["events"];
  changedEntities: Array<{ entity: string; memoryIds: string[]; firstAt: Date | string; lastAt: Date | string }>;
}

export interface BehavioralPatternReport {
  userId: string;
  patterns: Array<{
    key: string;
    label: string;
    support: number;
    memoryIds: string[];
    confidence: number;
    cadence?: string;
    pendingReview: boolean;
    lastObservedAt: Date | string;
    falsePositiveRisk?: number;
  }>;
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

export interface Brain {
  id: string;
  name: string;
  ownerUserId: string;
  memberUserIds?: string[];
  allowedAgentIds?: string[];
  orgId?: string;
  visibility: "private" | "team" | "org" | "public";
  createdAt: Date | string;
  updatedAt: Date | string;
  consentRequired?: boolean;
}

export interface MemorySource {
  id: string;
  brainId: string;
  name: string;
  kind: "manual" | "chat" | "code" | "docs" | "calendar" | "connector" | "import";
  uri?: string;
  defaultConsent?: Partial<ConsentPolicy>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AgentRegistration {
  id: string;
  name: string;
  namespace: string;
  brainIds: string[];
  permissions: Array<"read" | "write" | "share" | "admin">;
  personaId?: string;
  subscriptions?: {
    events?: AuditEvent["type"][];
    brainIds?: string[];
    sourceIds?: string[];
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  kind: "email" | "chat" | "project_management" | "docs" | "code" | "calendar" | "cloud_storage" | "custom";
  version: string;
  direction: "ingest" | "export" | "two_way";
  capabilities: Array<"ingest" | "export" | "webhook" | "poll" | "writeback" | "media" | "translation">;
  auth: "none" | "api_key" | "oauth" | "token";
  defaultSourceKind: SourceKind;
  metadataMapping: Record<string, string>;
  privacyPolicy?: "personal" | "project" | "team" | "never_store";
  list?: {
    endpoint?: string;
    method?: "GET" | "POST";
    authRef?: string;
  };
  poll?: {
    endpoint?: string;
    method?: "GET" | "POST";
    authRef?: string;
  };
  writeback?: {
    endpoint?: string;
    method?: "POST" | "PUT" | "PATCH";
    authRef?: string;
    operations?: Array<"tag" | "comment" | "status" | "summary" | "memory_link">;
  };
  oauth?: {
    authorizeUrl: string;
    tokenUrl?: string;
    clientIdRef?: string;
    scopes?: string[];
    redirectUri?: string;
  };
  vendor?: {
    provider: "github" | "slack" | "discord";
    docsUrl: string;
    requiredEnv: string[];
    realSmokeEnv?: string[];
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ConnectorAuthSession {
  id: string;
  connectorId: string;
  state: string;
  status: "pending" | "authorized" | "failed" | "revoked";
  authorizeUrl: string;
  redirectUri?: string;
  scopes: string[];
  tokenRef?: string;
  tokenHash?: string;
  error?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  expiresAt?: Date | string;
}

export interface ConnectorSyncRecord {
  id: string;
  connectorId: string;
  direction: "ingest" | "export";
  status: "queued" | "applied" | "failed";
  memoryIds: string[];
  externalIds: string[];
  timestamp: Date | string;
  error?: string;
  operation?: "tag" | "comment" | "status" | "summary" | "memory_link";
  target?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  adapter?: string;
  request?: {
    method: "GET" | "POST" | "PUT" | "PATCH";
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  responseStatusCode?: number;
}

export interface PersonaProfile {
  id: string;
  label: string;
  summaryStyle: "concise" | "descriptive" | "narrative";
  retrievalWeights?: Partial<RetrievalWeights>;
  privacyDefault?: ConsentVisibility;
  domain?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface AuditEvent {
  id: string;
  type:
    | "memory.write"
    | "memory.update"
    | "memory.delete"
    | "memory.share"
    | "memory.share.request"
    | "memory.share.revoke"
    | "memory.revert"
    | "memory.consent"
    | "agent.register"
    | "persona.set"
    | "connector.register"
    | "connector.auth"
    | "connector.sync"
    | "provider.call"
    | "extract.run"
    | "reflect.run"
    | "search.run"
    | "sync.queue"
    | "sync.run"
    | "webhook.register"
    | "marketplace.submit"
    | "marketplace.scan"
    | "marketplace.review"
    | "marketplace.publish"
    | "marketplace.install"
    | "managed.tenant"
    | "inference.run"
    | "entity.merge"
    | "entity.split"
    | "policy.violation"
    | "retention.enforce"
    | "security.key.rotate"
    | "privacy.insights"
    | "privacy.compute";
  journalType?: AuditJournalEventType;
  sequence?: number;
  previousHash?: string;
  hash?: string;
  payloadHash?: string;
  actorId?: string;
  userId?: string;
  brainId?: string;
  sourceId?: string;
  memoryId?: string;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
}

export type AuditJournalEventType =
  | "memory.created"
  | "memory.updated"
  | "memory.deleted"
  | "memory.archived"
  | "memory.retracted"
  | "memory.superseded"
  | "memory.retrieved"
  | "context_pack.created"
  | "policy.denied"
  | "dream.action"
  | "connector.ingested"
  | "system.event";

export interface AuditJournalEvent extends AuditEvent {
  journalType: AuditJournalEventType;
  sequence: number;
  hash: string;
  payloadHash: string;
}

export interface AuditReplayMemoryState {
  exists: boolean;
  archived: boolean;
  retracted: boolean;
  superseded: boolean;
  userId?: string;
  brainId?: string;
  sourceId?: string;
  lastEventId: string;
  lastHash: string;
  versions: number;
}

export interface AuditReplayReport {
  valid: boolean;
  eventsApplied: number;
  memories: Record<string, AuditReplayMemoryState>;
  contextPacks: Record<string, { createdAt: Date | string; query?: string; memoryCount?: number; hash: string }>;
  denied: Array<{ eventId: string; operation?: unknown; memoryId?: string; reason?: string }>;
  connectorEvents: Array<{ eventId: string; connectorId?: unknown; status?: unknown; hash: string }>;
  dreamEvents: Array<{ eventId: string; action?: unknown; hash: string }>;
  errors: string[];
}

export interface AuditChainExport {
  schemaVersion: "1.0";
  generatedAt: Date | string;
  eventCount: number;
  headHash?: string;
  valid: boolean;
  events: AuditJournalEvent[];
  replay: AuditReplayReport;
}

export interface StorageBackendStatus {
  active: string;
  adapters: Array<{
    kind: string;
    durable: boolean;
    distributedReady: boolean;
    transactional: boolean;
    appendOnly?: boolean;
    sql?: boolean;
    encryptedAtRest?: boolean;
    migrationSafe?: boolean;
    lexical?: {
      strategy: "none" | "sqlite-fts5" | "postgres-tsvector" | "bm25-fallback";
      indexed: boolean;
      notes: string[];
    };
    vector?: {
      strategy: "none" | "in-memory" | "pgvector";
      indexed: boolean;
      notes: string[];
    };
    encryptedAppendLog?: boolean;
    replication?: "none" | "logical" | "quorum" | "external";
    sharding?: "none" | "hash" | "range" | "external";
    notes: string[];
  }>;
}

export interface OfflineOperation {
  id: string;
  type: "add" | "update" | "delete" | "consent";
  userId: string;
  memoryId?: string;
  clientMutationId?: string;
  occurredAt: Date | string;
  status: "queued" | "applied" | "conflict" | "failed";
  conflictResolution?: "add_only" | "last_write_wins" | "delete_wins" | "manual_review";
  input?: MemoryInput;
  patch?: Partial<MemoryInput>;
  consent?: Partial<ConsentPolicy>;
  reason?: string;
  appliedMemoryId?: string;
}

export interface SyncReport {
  generatedAt: Date | string;
  applied: OfflineOperation[];
  conflicts: OfflineOperation[];
  failed: OfflineOperation[];
  remaining: OfflineOperation[];
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: AuditEvent["type"][];
  secretRef?: string;
  createdAt: Date | string;
  disabledAt?: Date | string;
}

export interface FederatedSearchReport {
  query: string;
  userId: string;
  requestedBrainIds: string[];
  searchedBrainIds: string[];
  blockedBrainIds: string[];
  results: SearchResult[];
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: "queued" | "delivered" | "failed";
  attempts: number;
  nextAttemptAt?: Date | string;
  lastAttemptAt?: Date | string;
  lastError?: string;
  lastStatusCode?: number;
}

export interface ProviderAdapterStatus {
  active: boolean;
  command?: string;
  timeoutMs: number;
  tasks: Array<"contradiction" | "rerank" | "verify" | "summarize" | "extract" | "expand" | "translate">;
  fallback: "deterministic";
}

export interface MarketplaceModule {
  id: string;
  kind: "connector" | "domain" | "persona" | "retrieval_profile";
  name: string;
  version: string;
  description: string;
  installState?: "available" | "installed";
  signature?: {
    signer: string;
    algorithm: "sha256" | "ed25519";
    digest: string;
    status?: "verified" | "invalid" | "unverified";
    verifiedAt?: Date | string;
  };
  compatibility?: {
    minCognibrainVersion?: string;
    maxCognibrainVersion?: string;
    engines?: string[];
  };
  security?: {
    scannedAt: Date | string;
    status: "passed" | "warning" | "blocked";
    permissions: string[];
    risks: string[];
  };
  manifest: Record<string, unknown>;
  trustSignals?: MarketplaceTrustSignals;
}

export interface MarketplaceTrustSignals {
  ratingAverage?: number;
  ratingCount?: number;
  reviewCount?: number;
  installCount?: number;
  securityStatus?: "passed" | "warning" | "blocked";
  publisher?: string;
  publishedAt?: Date | string;
  sourceUrl?: string;
  lastReviewedAt?: Date | string;
}

export interface MarketplaceReview {
  reviewer: string;
  rating: number;
  comment?: string;
  createdAt: Date | string;
}

export interface MarketplaceSubmission {
  id: string;
  module: MarketplaceModule;
  submitter: string;
  sourceUrl?: string;
  status: "submitted" | "scanned" | "changes_requested" | "approved" | "published" | "rejected";
  submittedAt: Date | string;
  scannedAt?: Date | string;
  reviewedAt?: Date | string;
  publishedAt?: Date | string;
  scan?: MarketplaceModule["security"];
  reviewNotes: string[];
  reviews: MarketplaceReview[];
}

export interface MarketplaceInstallPlan {
  moduleId: string;
  valid: boolean;
  actions: string[];
  risks: string[];
}

export interface ManagedMigrationBundle {
  generatedAt: Date | string;
  target: "self_hosted" | "managed" | "backup";
  counts: {
    memories: number;
    episodes?: number;
    profiles: number;
    personas: number;
    connectors: number;
    policyRules?: number;
    retentionRules: number;
  };
  backup: {
    recommended: boolean;
    encryptionKeyIds: string[];
    backupRef?: string;
  };
  placeholders: {
    sso: { required: boolean; provider?: string; note: string };
    secretManager: { required: boolean; provider?: string; note: string };
  };
  deployment?: ManagedDeploymentPlan;
  manifest: Record<string, unknown>;
}

export interface ManagedDeploymentPlan {
  mode: "self_hosted" | "managed" | "backup";
  artifacts: {
    dockerfile: string;
    dockerCompose: string;
    kubernetes: string;
  };
  environment: string[];
  secretManager?: string;
  ssoProvider?: string;
  importWorkflow: string[];
  transport: TransportSecurityReport;
}

export interface ManagedTenant {
  id: string;
  name: string;
  orgId: string;
  plan: "developer" | "team" | "enterprise";
  region: string;
  status: "provisioning" | "active" | "paused";
  ssoProvider?: string;
  secretManager?: string;
  dataResidency?: string;
  autoscaling?: {
    minReplicas: number;
    maxReplicas: number;
    targetCpuUtilization: number;
  };
  backup?: {
    enabled: boolean;
    backupRef?: string;
    lastVerifiedAt?: Date | string;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ManagedControlPlaneReport {
  generatedAt: Date | string;
  deploymentMode: "local" | "self_hosted" | "managed" | "production";
  tenants: {
    total: number;
    active: number;
    provisioning: number;
    paused: number;
    regions: string[];
    plans: Record<ManagedTenant["plan"], number>;
  };
  readiness: {
    storage: boolean;
    backup: boolean;
    sso: boolean;
    secretManager: boolean;
    transport: boolean;
    migrationBundle: boolean;
  };
  autoscaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCpuUtilization: number;
  };
  storage: StorageBackendStatus;
  transport: TransportSecurityReport;
  keyProvider: KeyProviderReport;
  migration: Pick<ManagedMigrationBundle, "generatedAt" | "target" | "counts" | "backup" | "placeholders">;
  notes: string[];
}

export interface GraphPath {
  nodes: Array<{ id: string; kind: "memory" | "entity"; label: string; memoryId?: string }>;
  edges: Array<{
    from: string;
    to: string;
    type: RelationType | "mentions";
    confidence: number;
    memoryId?: string;
    trust?: number;
    timestamp?: Date | string;
    validFrom?: Date | string;
    validUntil?: Date | string;
    evidenceIds?: string[];
    createdBy?: SourceKind;
    source?: Provenance;
  }>;
  score: number;
  explanation: string[];
}

export interface GraphQueryResult {
  query: string;
  matches: Array<{ memoryId: string; content: string; relation?: MemoryRelation; entities: string[]; trust: number; createdAt?: Date | string; source?: Provenance }>;
  warnings: string[];
}

export interface GraphActivationResult {
  query: string;
  seeds: string[];
  ranked: Array<{ nodeId: string; label: string; kind: "memory" | "entity"; score: number; memoryId?: string; explanation: string[] }>;
}

export interface GraphExportOptions {
  userId?: string;
  relationTypes?: RelationType[];
  minTrust?: number;
  sourceKind?: SourceKind;
  after?: Date | string;
  before?: Date | string;
  validAt?: Date | string;
  format?: "json" | "graphml";
}

export interface GraphExplainReport {
  from: string;
  to: string;
  strategy: "shortest" | "strongest" | "most_recent" | "highest_trust";
  validAt?: Date | string;
  paths: GraphPath[];
}

export interface GraphExportResult {
  nodes: Array<{ id: string; kind: "memory" | "entity"; label: string; memoryId?: string }>;
  edges: GraphPath["edges"];
}

export interface InferenceRule {
  id: string;
  label: string;
  when: { left: RelationType; right: RelationType };
  then: RelationType;
  confidence?: number;
}

export interface InferenceReport {
  rulesEvaluated: number;
  inferred: Array<{ memoryId: string; relation: MemoryRelation; ruleId: string; evidence: string[] }>;
}

export interface ComplianceReport {
  generatedAt: Date | string;
  totals: { memories: number; auditEvents: number; brains: number; sources: number };
  consent: Record<ConsentVisibility, number>;
  encrypted: number;
  retentionExpired: number;
  deleteOnRequest: number;
  auditByType: Record<string, number>;
  policyRules?: MemoryPolicyRule[];
  retentionRules?: RetentionRule[];
  encryption?: {
    keyIds: Record<string, number>;
    keyVersions: Record<string, number>;
    rotated: number;
    missingKeyMetadata: number;
    backupRefs: string[];
  };
  keyProvider?: KeyProviderReport;
  backup?: BackupRecoveryReport;
  transportSecurity?: TransportSecurityReport;
  dataFlows?: Array<{ type: string; count: number; lastSeenAt?: Date | string }>;
  risks: string[];
}

export interface KeyProviderReport {
  provider: "local-env" | "external" | "unconfigured";
  scope: "local" | "user" | "org";
  activeKeyId?: string;
  activeKeyVersion?: string;
  encryptedMemories: number;
  knownKeyIds: string[];
  knownKeyVersions: string[];
  hasEncryptionMaterial: boolean;
  rotationPolicyDays?: number;
  backupRefs: string[];
  notes: string[];
}

export interface SecurityKeyReport {
  encrypted: number;
  keyIds: Record<string, number>;
  keyVersions: Record<string, number>;
  rotated: number;
  missingKeyMetadata: number;
  backupRefs: string[];
}

export interface KeyRotationReport {
  generatedAt: Date | string;
  rotated: string[];
  skipped: string[];
  keyId: string;
  keyVersion: string;
  backupRef?: string;
}

export interface BackupRecoveryReport {
  generatedAt: Date | string;
  backupRef?: string;
  encryptedMemories: number;
  recovered: string[];
  failed: Array<{ memoryId: string; reason: string }>;
  importedMemories?: number;
  verified: boolean;
}

export interface TransportSecurityReport {
  generatedAt: Date | string;
  mode: "local" | "self_hosted" | "managed" | "production";
  publicUrl?: string;
  tlsTerminatedBy?: string;
  inTransitEncrypted: boolean;
  warning?: string;
}

export interface DifferentialPrivacyReport {
  generatedAt: Date | string;
  epsilon: number;
  kAnonymity: number;
  suppressedGroups: number;
  aggregates: Array<{
    dimension: string;
    key: string;
    noisyCount: number;
    exactCount?: number;
    suppressed: boolean;
  }>;
  notes: string[];
}

export interface CrossBrainPrivacyComputeReport {
  generatedAt: Date | string;
  brainIds: string[];
  dimensions: Array<"entities" | "tags" | "relations">;
  minK: number;
  hashAlgorithm: "hmac-sha256";
  saltHash: string;
  noRawMemoryData: true;
  totals: {
    memoriesScanned: number;
    candidateHashes: number;
    releasedHashes: number;
    suppressedHashes: number;
  };
  brains: Array<{
    brainId: string;
    memoriesScanned: number;
    contributedHashes: number;
    releasedHashes: number;
    suppressedHashes: number;
  }>;
  intersections: Array<{
    hash: string;
    dimensions: Array<"entities" | "tags" | "relations">;
    participantBrainIds: string[];
    brainCount: number;
    memoryCount: number;
  }>;
  notes: string[];
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

export interface ObservationReport {
  userId: string;
  generatedAt: Date | string;
  style: "concise" | "descriptive" | "narrative";
  persisted: boolean;
  observations: Array<{
    content: string;
    memoryIds: string[];
    citations: string[];
    confidence: number;
    mode: "deterministic" | "provider";
    observationMemoryId?: string;
  }>;
}

export interface PredictionReport {
  userId: string;
  generatedAt: Date | string;
  predictions: Array<{
    label: string;
    confidence: number;
    reason: string;
    memoryIds: string[];
    suggestedQuery: string;
  }>;
  prefetch: SearchResult[];
  anomalies: Array<{
    kind: "missing_recent_confirmation" | "pending_pattern_review" | "low_trust_recent_memory";
    memoryId?: string;
    message: string;
  }>;
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
