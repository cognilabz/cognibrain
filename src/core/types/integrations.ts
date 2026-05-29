import type { ConsentPolicy, ConsentVisibility, MemoryPolicyRule, RetentionRule, SourceKind } from "./base";
import type { MemoryInput, SearchResult } from "./memory";
import type { RetrievalWeights } from "./retrieval";
import type { BackupRecoveryReport, KeyProviderReport, TransportSecurityReport } from "./security";

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
    clientSecretRef?: string;
    scopes?: string[];
    redirectUri?: string;
    refreshUrl?: string;
    revokeUrl?: string;
  };
  vendor?: {
    provider:
      | "github"
      | "slack"
      | "discord"
      | "jira"
      | "confluence"
      | "notion"
      | "linear"
      | "gitlab"
      | "azure-devops"
      | "teams"
      | "gmail"
      | "google-drive"
      | "google-calendar"
      | "asana"
      | "clickup"
      | "sentry"
      | "datadog"
      | "pagerduty"
      | "posthog";
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
  refreshTokenRef?: string;
  tokenHash?: string;
  refreshTokenHash?: string;
  accessTokenExpiresAt?: Date | string;
  revokedAt?: Date | string;
  error?: string;
  metadata?: Record<string, unknown>;
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
  tasks: Array<"contradiction" | "rerank" | "verify" | "evidence" | "summarize" | "extract" | "expand" | "translate">;
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
