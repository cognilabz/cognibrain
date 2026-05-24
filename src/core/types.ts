export type MemoryType = "user" | "feedback" | "project" | "reference" | "episodic" | "procedural";
export type MemoryLayer = "working" | "episodic" | "long_term" | "procedural" | "reflection";
export type SourceKind = "human" | "reviewed_code" | "tool" | "agent" | "transcript" | "import";
export type MemorySchemaVersion = "2.0";
export type BeliefState = "active" | "stale" | "superseded" | "contradicted" | "needs_verification" | "retracted";
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
  rulesMatched: Record<string, number>;
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
}

export interface MemoryAuditEvent {
  type: "created" | "updated" | "accessed" | "archived" | "state_changed";
  at: Date | string;
  actor?: string;
  reason?: string;
  previousState?: BeliefState;
  nextState?: BeliefState;
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
  filters?: {
    type?: MemoryType;
    layer?: MemoryLayer;
    tags?: string[];
    minTrust?: number;
  };
  graphDepth?: number;
  relationTypes?: RelationType[];
}

export interface MemoryRouteReport {
  query: string;
  userId: string;
  selectedScopes: Array<{ kind: "user" | "session" | "app" | "project" | "org" | "brain" | "agent" | "persona"; id: string; reason: string }>;
  excludedScopes: Array<{ kind: "private" | "brain" | "org" | "agent"; id: string; reason: string }>;
  reasoning: string[];
  retrievalOptions: Partial<SearchOptions>;
}

export interface SearchResult {
  memory: Memory;
  score: number;
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
}

export interface EvidencePack {
  schemaVersion: "1.0";
  id: string;
  generatedAt: string;
  query: string;
  userId: string;
  profileId?: string;
  tokenBudget: number;
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
      initialScore?: number;
      mode?: RetrievalMode;
      signals: SearchResult["signals"];
      explanation: string[];
      graphPaths: string[];
      citation: string;
      contradiction?: SearchResult["contradiction"];
    };
  }>;
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
    | "retention.enforce"
    | "security.key.rotate"
    | "privacy.insights"
    | "privacy.compute";
  actorId?: string;
  userId?: string;
  brainId?: string;
  sourceId?: string;
  memoryId?: string;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
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
    profiles: number;
    personas: number;
    connectors: number;
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
