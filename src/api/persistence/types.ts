import type {
  DomainEvaluationReport,
  EpisodeRecord,
  EvidencePack,
  EntityRecord,
  FeedbackEvent,
  AgentRegistration,
  AuditEvent,
  Brain,
  ConnectorManifest,
  ConnectorAuthSession,
  ConnectorSyncRecord,
  ConnectorSyncState,
  DreamJob,
  IdentityLink,
  MarketplaceSubmission,
  MarketplaceModule,
  ManagedTenant,
  Memory,
  MemorySource,
  MetricsReport,
  OfflineOperation,
  PersonaProfile,
  MemoryPolicyRule,
  RetentionRule,
  RetrievalProfile,
  RetrievalTrainingSample,
  WebhookDelivery,
  WebhookRegistration
} from "../../core";
import type { ClaimRecord, ConflictSet } from "../../core";

export interface LexicalSearchOptions {
  memoryIds?: string[];
  limit?: number;
}

export interface LexicalSearchHit {
  memoryId: string;
  score: number;
  explanation?: string;
}

export interface PersistedMemoryFile {
  version: 1 | 2;
  memories: Memory[];
  episodes?: EpisodeRecord[];
  maintenance: {
    users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
  };
  metrics?: MetricsReport;
  feedback?: FeedbackEvent[];
  claims?: ClaimRecord[];
  conflictSets?: ConflictSet[];
  retrievalProfiles?: RetrievalProfile[];
  identityLinks?: IdentityLink[];
  domainEvaluations?: DomainEvaluationReport[];
  entityRecords?: EntityRecord[];
  trainingSamples?: RetrievalTrainingSample[];
  brains?: Brain[];
  sources?: MemorySource[];
  agents?: AgentRegistration[];
  personas?: PersonaProfile[];
  auditEvents?: AuditEvent[];
  webhooks?: WebhookRegistration[];
  webhookDeliveries?: WebhookDelivery[];
  marketplaceModules?: MarketplaceModule[];
  marketplaceSubmissions?: MarketplaceSubmission[];
  managedTenants?: ManagedTenant[];
  offlineOperations?: OfflineOperation[];
  connectorManifests?: ConnectorManifest[];
  connectorAuthSessions?: ConnectorAuthSession[];
  connectorSyncRecords?: ConnectorSyncRecord[];
  connectorSyncStates?: ConnectorSyncState[];
  dreamJobs?: DreamJob[];
  evidencePacks?: EvidencePack[];
  policyRules?: MemoryPolicyRule[];
  retentionRules?: RetentionRule[];
}

export interface MemoryPersistenceAdapter {
  readonly kind: string;
  load(): PersistedMemoryFile | Memory[] | undefined;
  save(payload: PersistedMemoryFile): void;
  capabilities?(): PersistenceCapabilities;
  lexicalSearch?(query: string, options?: LexicalSearchOptions): LexicalSearchHit[];
}

export interface PersistenceCapabilities {
  durable: boolean;
  distributedReady: boolean;
  transactional: boolean;
  appendOnly: boolean;
  sql: boolean;
  encryptedAtRest: boolean;
  migrationSafe: boolean;
  replication?: "none" | "logical" | "quorum" | "external";
  sharding?: "none" | "hash" | "range" | "external";
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
  notes: string[];
}
