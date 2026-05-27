import { createHash, createHmac } from "node:crypto";
import { listExternalVendorItems, shouldUseExternalVendor } from "../connectors/vendorConnectors";
import { applyRedactionPolicy, decryptMemoryContent, type DecryptionKeyMaterial, type RedactionPolicy } from "../core/privacy";
import { createJsonCommandIntelligenceFromEnv } from "../core/providers";
import { loadRuntimeConfig } from "../core/runtimeConfig";
import { buildApiDescription } from "./apiDescription";
import {
  enrichmentCandidatesFor,
  extractionConfidence,
  hasLocalMediaExtraction,
  learnedRuleSuggestions,
  markExtractionStage,
  normalizeMediaExtractionEvent,
  ruleExtractionFailures
} from "./extractionPipeline";
import {
  createPersistenceFromEnv,
  AppendOnlyLogPersistenceAdapter,
  CassandraCompatiblePersistenceAdapter,
  CassandraRemotePersistenceAdapter,
  JsonFilePersistenceAdapter,
  PostgresRemotePersistenceAdapter,
  PostgresCompatiblePersistenceAdapter,
  SQLitePersistenceAdapter,
  type MemoryPersistenceAdapter,
  sqliteAvailable,
  type PersistedMemoryFile
} from "./persistence";
import { AsyncPostgresMemoryRepository, PostgresMemoryRepository, SQLiteMemoryRepository, sqliteRepositoryAvailable } from "./repositories";
import {
  EntityRegistry,
  activateGraph,
  buildCodingContextPackFromResults,
  buildPatchEvidenceTrail,
  citationFor,
  classifyDurability,
  engineeringQueryWeights,
  evaluateForbiddenAction,
  extractAddOnlyMemories,
  extractClaim,
  exportMemoryGraph,
  findGraphPaths,
  getEngineeringMetadata,
  healthReport,
  IdentityResolver,
  InMemoryMemoryRepository,
  InMemoryStorageAdapter,
  inferGraphRelations,
  MemoryStore,
  normalizeLifecyclePolicy,
  normalizeRetrievalWeights,
  RepositoryBackedStorageAdapter,
  queryMemoryGraph,
  runDomainEvaluation,
  DOMAIN_MODULES,
  ReflectionEngine,
  RetrievalEngine,
  withEngineeringMemoryMetadata,
  type LifecyclePolicy,
  type DomainModule,
  type MemoryRepository,
  type RepositoryStatePersistence,
  type MemoryStorageAdapter
} from "../core";
import {
  setRetentionRule as setRetentionRuleImpl,
  listRetentionRules as listRetentionRulesImpl,
  enforceRetention as enforceRetentionImpl,
  retentionReview as retentionReviewImpl,
  securityKeyReport as securityKeyReportImpl,
  keyProviderReport as keyProviderReportImpl,
  setPolicyRule as setPolicyRuleImpl,
  listPolicyRules as listPolicyRulesImpl,
  evaluatePolicy as evaluatePolicyImpl,
  canRead as canReadImpl,
  canWrite as canWriteImpl,
  canDelete as canDeleteImpl,
  canPromote as canPromoteImpl,
  canUseInContext as canUseInContextImpl,
  transportSecurityReport as transportSecurityReportImpl
} from "./service/governanceRuntime";
import {
  installMarketplaceModule as installMarketplaceModuleImpl,
  installMarketplaceModuleById as installMarketplaceModuleByIdImpl,
  marketplaceInstallPlan as marketplaceInstallPlanImpl,
  listMarketplaceModules as listMarketplaceModulesImpl,
  submitMarketplaceModule as submitMarketplaceModuleImpl,
  scanMarketplaceSubmission as scanMarketplaceSubmissionImpl,
  reviewMarketplaceSubmission as reviewMarketplaceSubmissionImpl,
  publishMarketplaceSubmission as publishMarketplaceSubmissionImpl,
  listMarketplaceSubmissions as listMarketplaceSubmissionsImpl,
  rateMarketplaceModule as rateMarketplaceModuleImpl
} from "./service/marketplaceRuntime";
import {
  registerConnectorManifest as registerConnectorManifestImpl,
  beginConnectorOAuth as beginConnectorOAuthImpl,
  completeConnectorOAuth as completeConnectorOAuthImpl,
  revokeConnectorAuth as revokeConnectorAuthImpl,
  refreshConnectorOAuth as refreshConnectorOAuthImpl,
  connectorAuthStatus as connectorAuthStatusImpl,
  listConnectorManifests as listConnectorManifestsImpl,
  syncConnectorEvents as syncConnectorEventsImpl,
  listConnectorItems as listConnectorItemsImpl,
  pollConnector as pollConnectorImpl,
  connectorHealth as connectorHealthImpl,
  writebackConnector as writebackConnectorImpl,
  listConnectorSyncRecords as listConnectorSyncRecordsImpl,
  connectorSyncState as connectorSyncStateImpl,
  recordConnectorFeedback as recordConnectorFeedbackImpl,
  recordConnectorTelemetry as recordConnectorTelemetryImpl,
  providerStatus as providerStatusImpl,
  type ConnectorHealthItem
} from "./service/connectorRuntime";
import {
  registerAgent as registerAgentImpl,
  listAgents as listAgentsImpl,
  assignAgentPersona as assignAgentPersonaImpl,
  setPersona as setPersonaImpl,
  listPersonas as listPersonasImpl,
  promoteSharedMemory as promoteSharedMemoryImpl,
  reviewSharedMemory as reviewSharedMemoryImpl,
  requestSharedMemory as requestSharedMemoryImpl,
  revokeSharedMemory as revokeSharedMemoryImpl,
  registerWebhook as registerWebhookImpl,
  eventFeed as eventFeedImpl
} from "./service/agentSharingRuntime";
import {
  exportUser as exportUserImpl,
  deleteUser as deleteUserImpl,
  createBrain as createBrainImpl,
  listBrains as listBrainsImpl,
  createSource as createSourceImpl,
  listSources as listSourcesImpl,
  deleteSource as deleteSourceImpl
} from "./service/adminRuntime";
import {
  verificationQueue as verificationQueueImpl,
  revalidateMemory as revalidateMemoryImpl,
  resolveVerificationQueue as resolveVerificationQueueImpl,
  confirmMemory as confirmMemoryImpl,
  recordHarnessAction as recordHarnessActionImpl,
  recordHarnessLifecycleEvent as recordHarnessLifecycleEventImpl,
  retractMemory as retractMemoryImpl,
  feedback as feedbackImpl,
  recordInjectionFeedback as recordInjectionFeedbackImpl
} from "./service/lifecycleRuntime";
import {
  reflect as reflectImpl,
  dream as dreamImpl,
  dreamPlan as dreamPlanImpl,
  prepareDream as prepareDreamImpl,
  runDreamCycle as runDreamCycleImpl,
  runDreamCycleAsync as runDreamCycleAsyncImpl,
  startDreamJob as startDreamJobImpl,
  dreamJobStatus as dreamJobStatusImpl
} from "./service/dreamRuntime";
import {
  add as addImpl,
  createEpisode as createEpisodeImpl,
  listEpisodes as listEpisodesImpl,
  getEpisode as getEpisodeImpl,
  extract as extractImpl,
  list as listImpl,
  get as getImpl,
  update as updateImpl,
  archive as archiveImpl,
  deleteMemory as deleteImpl,
  listMemories as listMemoriesImpl,
  ingestMedia as ingestMediaImpl
} from "./service/storeRuntime";
import {
  recordCodeCorrection as recordCodeCorrectionImpl,
  derivedCorrectionMemories as derivedCorrectionMemoriesImpl,
  guardAction as guardActionImpl,
  patchEvidenceTrail as patchEvidenceTrailImpl
} from "./service/engineeringRuntime";
import { enrichContext as enrichContextImpl } from "./service/contextRuntime";
import {
  search as searchImpl,
  classifyQueryIntent as classifyQueryIntentImpl,
  routeMemory as routeMemoryImpl,
  evidencePack as evidencePackImpl,
  getEvidencePack as getEvidencePackImpl,
  codingContextPack as codingContextPackImpl,
  getCodingContextPack as getCodingContextPackImpl,
  federatedSearch as federatedSearchImpl
} from "./service/searchRuntime";
import {
  translateText as translateTextImpl,
  deliverWebhookQueue as deliverWebhookQueueImpl,
  deliverWebhookQueueHttp as deliverWebhookQueueHttpImpl,
  storageStatus as storageStatusImpl,
  auditTrail as auditTrailImpl,
  auditChain as auditChainImpl,
  replayAuditState as replayAuditStateImpl,
  updateConsent as updateConsentImpl,
  revertMemory as revertMemoryImpl,
  queueOfflineOperation as queueOfflineOperationImpl,
  syncOfflineOperations as syncOfflineOperationsImpl,
  syncStatus as syncStatusImpl
} from "./service/operationsRuntime";
import {
  addTrainingSample as addTrainingSampleImpl,
  setRetrievalProfile as setRetrievalProfileImpl,
  getRetrievalProfiles as getRetrievalProfilesImpl,
  learnRetrievalProfile as learnRetrievalProfileImpl,
  linkIdentity as linkIdentityImpl,
  unlinkIdentity as unlinkIdentityImpl
} from "./service/profileRuntime";
import {
  graph as graphImpl,
  entityCatalog as entityCatalogImpl,
  runEntityEnrichment as runEntityEnrichmentImpl,
  mergeEntity as mergeEntityImpl,
  splitEntity as splitEntityImpl,
  lifecyclePreview as lifecyclePreviewImpl,
  runDomainEvaluation as runDomainEvaluationImpl
} from "./service/entityRuntime";
import {
  timeline as timelineImpl,
  summarizeTimeline as summarizeTimelineImpl,
  temporalQuery as temporalQueryImpl,
  behavioralPatterns as behavioralPatternsImpl,
  adaptiveDreamPolicy as adaptiveDreamPolicyImpl,
  generateObservations as generateObservationsImpl,
  predictionReport as predictionReportImpl
} from "./service/timelineRuntime";
import {
  apiDescription as apiDescriptionImpl,
  managedMigrationBundle as managedMigrationBundleImpl,
  importMigrationBundle as importMigrationBundleImpl,
  verifyBackupRecovery as verifyBackupRecoveryImpl,
  verifyBackupReplay as verifyBackupReplayImpl,
  managedDeploymentPlan as managedDeploymentPlanImpl,
  createManagedTenant as createManagedTenantImpl,
  listManagedTenants as listManagedTenantsImpl,
  managedControlPlaneReport as managedControlPlaneReportImpl,
  rotateEncryptionKeyMetadata as rotateEncryptionKeyMetadataImpl,
  privacyInsights as privacyInsightsImpl,
  privacyPreservingCrossBrainCompute as privacyPreservingCrossBrainComputeImpl,
  complianceReport as complianceReportImpl,
  metricsReport as metricsReportImpl
} from "./service/opsRuntime";
import {
  graphPaths as graphPathsImpl,
  graphExplain as graphExplainImpl,
  graphQuery as graphQueryImpl,
  graphActivation as graphActivationImpl,
  graphExport as graphExportImpl,
  runInference as runInferenceImpl
} from "./service/graphRuntime";
import {
  dreamInputForHarnessEvent,
  sourceEvidenceTime,
  sourceRefChanged,
  sourceRefsMatch,
  sourceRevalidationSummary
} from "./service/dreamHelpers";
import {
  redactionModeFromEnv,
  deploymentModeFromEnv,
  feedbackDelta,
  clamp01,
  rollingAverage,
  uniqueStrings,
  modeForTrigger,
  triggerForMode,
  budgetForTrigger,
  contentHash,
  syntheticExtractionEvent,
  auditEventForHash,
  stableStringify,
  canonicalAuditJournalType,
  applyMemoryJournalEvent,
  safeGet,
  detectContextReferences,
  parseReferenceUrl,
  contextConnectorPlan,
  rankContextItems,
  contextEvidenceForItem,
  referenceMatchesItem,
  compactContextItemText,
  buildEnrichedContext,
  dedupeExternalEvidence,
  csv,
  tokenSet,
  firstString,
  truncateText,
  normalizeUrl,
  connectorReviewRequired,
  connectorEventVisibility,
  connectorEventTags,
  connectorWritebackPayload,
  connectorWritebackRequest,
  connectorAdapterRequest,
  connectorWritebackOperations,
  interpolateConnectorEndpoint,
  linkStateChange,
  providerFromEnv,
  inferCorrectionKind,
  inferCorrectActionFromCorrection,
  inferForbiddenActionFromCorrection,
  repoPolicyFromCorrection,
  normalizeActionPhrase,
  codingActionOverlap,
  withProceduralMetadata,
  inferProcedureTriggers,
  officialConnectorManifests,
  officialMarketplaceModules,
  marketplaceRisks,
  securityScanFor,
  compareVersions,
  clampRating,
  averageRating,
  validateConnectorManifest,
  deterministicTranslate,
  baseSignalTemplate,
  profileLoss,
  dot,
  memoryMatchesProfileScope,
  sampleMatchesProfileScope,
  buildQueryPlan,
  deterministicQueryExpansions,
  mineRecurringPatterns,
  mineRecurringSequences,
  sequenceAnchor,
  dedupeMemories,
  observationClusters,
  policyRuleMatches,
  productionPolicyMode,
  retentionRuleMatches,
  deterministicLaplaceNoise,
  privacyComputeTokens,
  deterministicObservation,
  groupedPeriods,
  deterministicTimelineSummary,
  intervalOverlaps,
  evidenceDate,
  roundMetric,
  newestPathTime,
  averagePathTrust,
  isoHour,
  isoDay,
  isoMonth,
  isoWeek
} from "./service/helpers";
import type {
  DomainEvaluationReport,
  AgentRegistration,
  AuditChainExport,
  AuditEvent,
  AuditJournalEvent,
  AuditReplayMemoryState,
  Brain,
  ComplianceReport,
  ContradictionDetector,
  ConnectorManifest,
  ConnectorAuthSession,
  ConnectorSyncRecord,
  ContextEnrichmentReport,
  ContextReference,
  EnrichmentCandidate,
  ExternalContextEvidence,
  ActionGuardReport,
  DreamBudget,
  DreamCycleInput,
  DreamCycleMode,
  DreamCycleReport,
  DreamCycleTrigger,
  DreamConnectorRefreshReport,
  DreamJob,
  DreamPlanReport,
  DreamPreparationReport,
  ConnectorSyncState,
  HarnessLifecycleEventInput,
  HarnessLifecycleEventReport,
  SourceRevalidationReport,
  SourceRevalidationResult,
  SourceRevalidationStatus,
  SourceResolver,
  SourceRecord,
  SourceValidationDecision,
  VerificationResolutionReport,
  EpisodeInput,
  EpisodeRecord,
  CodebaseScope,
  CodingContextPack,
  EntityMergeSuggestion,
  EntityRecord,
  EvidencePack,
  ExtractionReport,
  DurabilityDecision,
  FeedbackKind,
  FeedbackEvent,
  FederatedSearchReport,
  EngineeringMemoryKind,
  GraphReport,
  GraphActivationResult,
  GraphExplainReport,
  GraphExportOptions,
  GraphExportResult,
  HarnessActionInput,
  IdentityLink,
  LearnedProfileReport,
  Memory,
  MemoryClaim,
  ClaimRecord,
  ConflictSet,
  CurrentTruthDecision,
  MemoryExtractionEvent,
  MemoryExtractor,
  MemoryInput,
  MemoryPolicyOperation,
  MemoryPolicyRule,
  MemoryRouteReport,
  MemoryScope,
  MemorySource,
  MarketplaceModule,
  MarketplaceInstallPlan,
  MarketplaceSubmission,
  MarketplaceReview,
  MetricsReport,
  ManagedControlPlaneReport,
  ManagedMigrationBundle,
  ManagedDeploymentPlan,
  ManagedTenant,
  OfflineOperation,
  PersonaProfile,
  PolicyDecision,
  PatchEvidenceTrail,
  ProceduralMemoryMetadata,
  RelationType,
  RetrievalProfile,
  RetrievalTrainingSample,
  RetrievalWeights,
  RetentionEnforcementReport,
  RetentionRule,
  RetentionReviewReport,
  SearchOptions,
  SearchResult,
  SecurityKeyReport,
  ReflectionSummarizer,
  StorageBackendStatus,
  SyncReport,
  ConsentPolicy,
  ConsentVisibility,
  CrossBrainPrivacyComputeReport,
  QueryExpander,
  QueryIntentReport,
  QueryPlan,
  QueryPlanStrategy,
  TranslationProvider,
  ProviderAdapterStatus,
  TranslationReport,
  VerificationQueueReport,
  InjectionFeedbackEvent,
  InjectionFeedbackReport,
  AdaptiveDreamPolicyReport,
  DifferentialPrivacyReport,
  BackupRecoveryReport,
  KeyRotationReport,
  KeyProviderReport,
  TransportSecurityReport,
  ObservationReport,
  PredictionReport,
  BehavioralPatternReport,
  TemporalQueryReport,
  TimelineSummaryReport,
  TimelineReport,
  WebhookDelivery,
  WebhookRegistration
} from "../core";

const COGNIBRAIN_VERSION = "0.1.0";
const SOURCE_QUALITY: Record<string, number> = {
  human: 1,
  reviewed_code: 0.95,
  tool: 0.9,
  import: 0.78,
  agent: 0.55,
  transcript: 0.42
};

function contentDigest(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function syntheticEventForMemory(memory: Memory): MemoryExtractionEvent {
  return {
    role: "user",
    content: memory.content,
    timestamp: memory.createdAt,
    source: memory.source,
    sourceRef: memory.provenance.sourceRef
  };
}

function claimStateForMemory(memory: Memory): ClaimRecord["state"] {
  if (memory.beliefState === "archived") return "needs_verification";
  if (memory.beliefState === "stale") return "needs_verification";
  if (memory.beliefState === "active") return "active";
  return memory.beliefState;
}

function defaultSourceResolverDecision(memory: Memory, sourceRecord: SourceRecord): SourceValidationDecision {
  if (sourceRecord.status === "missing") return { status: "source_missing", reason: "source resolver marked source as missing", sourceRecord };
  const previous = memory.provenance.sourceRef;
  const next = sourceRecord.sourceRef;
  if (previous && sourceRefChanged(previous, next)) return { status: "source_updated", reason: "source resolver detected version or hash change", sourceRecord };
  if (sourceRecord.version && previous?.version && sourceRecord.version !== previous.version) return { status: "source_updated", reason: "source resolver detected version change", sourceRecord };
  if (sourceRecord.hash && previous?.hash && sourceRecord.hash !== previous.hash) return { status: "source_updated", reason: "source resolver detected content hash change", sourceRecord };
  return { status: "confirmed", reason: "source resolver confirmed sourceRef", sourceRecord };
}

export interface MemoryServiceOptions {
  persistencePath?: string;
  persistence?: MemoryPersistenceAdapter;
  repository?: MemoryRepository;
  storage?: MemoryStorageAdapter;
  autoDream?: {
    enabled?: boolean;
    intervalHours?: number;
    writeThreshold?: number;
  };
  retrievalWeights?: Partial<RetrievalWeights>;
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  domainModule?: DomainModule;
  configPath?: string;
  entityAliases?: Record<string, string[]>;
  sourceQuality?: Partial<Record<string, number>>;
  intelligence?: {
    reranker?: SearchOptions["reranker"];
    verifier?: SearchOptions["verifier"];
    contradictionDetector?: ContradictionDetector;
    summarizer?: ReflectionSummarizer;
    extractor?: MemoryExtractor;
    queryExpander?: QueryExpander;
    translator?: TranslationProvider;
  };
}

export type ConnectorWritebackOperation = NonNullable<ConnectorSyncRecord["operation"]>;

export interface ConnectorWritebackInput {
  operation?: ConnectorWritebackOperation;
  memoryIds?: string[];
  externalId?: string;
  content?: string;
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

interface ConnectorListResult {
  connectorId: string;
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  responseStatusCode?: number;
  error?: string;
}

export interface ContextEnrichmentInput extends SearchOptions {
  tokenBudget?: number;
  primaryIssueStore?: string;
  primaryKnowledgeStore?: string;
  defaultSearchConnectors?: string[];
  fetchReferenced?: boolean;
  searchPrimaryStores?: boolean;
  persistFetched?: boolean;
  maxExternalFetches?: number;
  maxExternalResults?: number;
}

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

function repositoryFromStorage(storage?: MemoryStorageAdapter): MemoryRepository | undefined {
  if (!storage) return undefined;
  if (storage instanceof RepositoryBackedStorageAdapter) return storage.repository;
  if (storage instanceof InMemoryStorageAdapter) return new InMemoryMemoryRepository(storage.store);
  return undefined;
}

function createRepositoryFromEnv(defaultPath = ".memory-harness.json"): MemoryRepository | undefined {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if (backend === "sqlite" || backend === "sql" || backend === "sqlite-repository") {
    if (!sqliteRepositoryAvailable()) return undefined;
    return new SQLiteMemoryRepository(process.env.MEMORY_SQLITE_PATH ?? defaultPath.replace(/\.json$/i, ".sqlite"));
  }
  if ((backend === "postgres-repository" || backend === "postgres-db-primary" || backend === "postgres-production" || backend === "postgres-async") && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresMemoryRepository(process.env.MEMORY_POSTGRES_URL);
  }
  return undefined;
}

function sourceRefMatchesVendorItem(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, item: Record<string, unknown>): boolean {
  const externalId = stringFromCandidate(item, ["externalId", "id", "key", "issueKey", "identifier", "number", "iid", "gid"]);
  const uri = stringFromCandidate(item, ["url", "uri", "webUrl", "web_url", "html_url", "permalink_url"]);
  return Boolean(
    (sourceRef.externalId && externalId && String(sourceRef.externalId).toLowerCase() === externalId.toLowerCase()) ||
    (sourceRef.url && uri && normalizeComparableUrl(sourceRef.url) === normalizeComparableUrl(uri)) ||
    (sourceRef.externalId && uri && uri.toLowerCase().includes(String(sourceRef.externalId).toLowerCase()))
  );
}

function stringFromCandidate(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function liveSourceVersion(item: Record<string, unknown>): string | undefined {
  return stringFromCandidate(item, ["version", "updatedAt", "updated_at", "modifiedAt", "lastEditedTime", "last_edited_time", "etag"]);
}

function compactLiveSourceContent(item: Record<string, unknown>): string {
  return [
    stringFromCandidate(item, ["title", "name", "summary", "subject", "key", "identifier"]),
    stringFromCandidate(item, ["content", "body", "description", "text", "notes", "status", "state"]),
    stringFromCandidate(item, ["url", "uri", "webUrl", "web_url", "html_url", "permalink_url"])
  ].filter((value): value is string => Boolean(value)).join(" | ") || stableStringify(item).slice(0, 1200);
}

function normalizeComparableUrl(value: string): string {
  return value.replace(/\/+$/, "").toLowerCase();
}

function memoryStoreForRepository(repository: MemoryRepository): MemoryStore {
  if (repository instanceof InMemoryMemoryRepository) return repository.store;
  const maybeRepositoryStore = (repository as { store?: unknown }).store;
  if (maybeRepositoryStore instanceof MemoryStore) {
    repository.export();
    return maybeRepositoryStore;
  }
  const store = new MemoryStore();
  store.import(repository.export());
  return store;
}

export class MemoryService {
  readonly repository: MemoryRepository;
  readonly store: MemoryStore;
  readonly storage: MemoryStorageAdapter;
  readonly retrieval: RetrievalEngine;
  readonly reflection: ReflectionEngine;
  readonly identities = new IdentityResolver();
  readonly entities: EntityRegistry;

  private readonly persistence?: MemoryPersistenceAdapter;
  private readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  private readonly redactionPolicy: RedactionPolicy;
  private readonly domainModule?: DomainModule;
  private readonly sourceQuality: Record<string, number>;
  private maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  private feedbackEvents: FeedbackEvent[] = [];
  private claims = new Map<string, ClaimRecord>();
  private conflictSets = new Map<string, ConflictSet>();
  private retrievalProfiles = new Map<string, RetrievalProfile>();
  private domainEvaluations: DomainEvaluationReport[] = [];
  private trainingSamples: RetrievalTrainingSample[] = [];
  private episodes = new Map<string, EpisodeRecord>();
  private brains = new Map<string, Brain>();
  private sources = new Map<string, MemorySource>();
  private agents = new Map<string, AgentRegistration>();
  private personas = new Map<string, PersonaProfile>();
  private auditEvents: AuditEvent[] = [];
  private webhooks = new Map<string, WebhookRegistration>();
  private webhookDeliveries: WebhookDelivery[] = [];
  private marketplaceModules = new Map<string, MarketplaceModule>();
  private marketplaceSubmissions = new Map<string, MarketplaceSubmission>();
  private managedTenants = new Map<string, ManagedTenant>();
  private offlineOperations: OfflineOperation[] = [];
  private connectorManifests = new Map<string, ConnectorManifest>();
  private connectorAuthSessions = new Map<string, ConnectorAuthSession>();
  private connectorSyncRecords: ConnectorSyncRecord[] = [];
  private connectorSyncStates = new Map<string, ConnectorSyncState>();
  private sourceResolvers = new Map<string, SourceResolver>();
  private dreamJobs = new Map<string, DreamJob>();
  private evidencePacks = new Map<string, EvidencePack>();
  private codingContextPacks = new Map<string, CodingContextPack>();
  private patchEvidenceTrails = new Map<string, PatchEvidenceTrail>();
  private policyRules = new Map<string, MemoryPolicyRule>();
  private retentionRules = new Map<string, RetentionRule>();
  private searchEvents: Array<{
    timestamp: string;
    userId: string;
    sessionId?: string;
    projectId?: string;
    resultCount: number;
    lowConfidence: boolean;
    queryHash: string;
  }> = [];
  private metrics: MetricsReport = {
    memoriesAdded: 0,
    searches: 0,
    feedback: 0,
    dreams: 0,
    contradictionsResolved: 0,
    noHitSearches: 0,
    averageSearchResults: 0,
    averageQualityScore: 1,
    dreamActions: {},
    sessions: {}
  };
  private dreaming = false;

  constructor(options: MemoryServiceOptions = {}) {
    const runtimeConfig = loadRuntimeConfig(options.configPath);
    this.repository = options.repository ?? repositoryFromStorage(options.storage) ?? createRepositoryFromEnv(options.persistencePath ?? ".memory-harness.json") ?? new InMemoryMemoryRepository();
    this.store = memoryStoreForRepository(this.repository);
    this.storage = options.storage ?? new RepositoryBackedStorageAdapter(this.repository);
    this.persistence = options.persistence ?? (options.persistencePath ? new JsonFilePersistenceAdapter(options.persistencePath) : undefined);
    this.autoDream = {
      enabled: options.autoDream?.enabled ?? false,
      intervalHours: options.autoDream?.intervalHours ?? 6,
      writeThreshold: options.autoDream?.writeThreshold ?? 12
    };
    this.domainModule = options.domainModule;
    this.sourceQuality = { ...SOURCE_QUALITY };
    for (const [key, value] of Object.entries(options.sourceQuality ?? {})) {
      if (typeof value === "number") this.sourceQuality[key] = value;
    }
    const provider = options.intelligence ?? providerFromEnv();
    this.redactionPolicy = options.redactionPolicy ?? runtimeConfig.redactionPolicy ?? options.domainModule?.redactionPolicy ?? {
      mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE),
      encryptionKey: process.env.MEMORY_ENCRYPTION_KEY,
      encryptionKeyId: process.env.MEMORY_ENCRYPTION_KEY_ID,
      encryptionKeyVersion: process.env.MEMORY_ENCRYPTION_KEY_VERSION
    };
    this.entities = new EntityRegistry({ ...(runtimeConfig.entityAliases ?? {}), ...(options.domainModule?.aliases ?? {}), ...(options.entityAliases ?? {}) });
    const defaultWeights = normalizeRetrievalWeights({ ...runtimeConfig.retrievalWeights, ...options.domainModule?.retrievalWeights, ...options.retrievalWeights });
    this.retrievalProfiles.set("default", {
      id: "default",
      label: "Default benchmark profile",
      weights: defaultWeights,
      updatedAt: new Date().toISOString(),
      provenance: "constructor"
    });
    for (const profile of runtimeConfig.retrievalProfiles ?? []) this.retrievalProfiles.set(profile.id, { ...profile, weights: normalizeRetrievalWeights(profile.weights) });
    this.retrieval = new RetrievalEngine(this.store, defaultWeights);
    this.reflection = new ReflectionEngine(this.store, {
      ...normalizeLifecyclePolicy({ ...runtimeConfig.lifecyclePolicy, ...options.domainModule?.lifecyclePolicy, ...options.lifecyclePolicy }),
      contradictionDetector: provider.contradictionDetector,
      summarizer: provider.summarizer
    });
    this.defaultReranker = provider.reranker;
    this.defaultVerifier = provider.verifier;
    this.defaultExtractor = provider.extractor;
    this.defaultSummarizer = provider.summarizer;
    this.defaultQueryExpander = provider.queryExpander;
    this.defaultTranslator = provider.translator;
    for (const manifest of officialConnectorManifests()) this.connectorManifests.set(manifest.id, manifest);
    for (const module of officialMarketplaceModules()) this.marketplaceModules.set(module.id, module);
    this.registerDefaultSourceResolvers();
    this.load();
  }

  private readonly defaultReranker?: SearchOptions["reranker"];
  private readonly defaultVerifier?: SearchOptions["verifier"];
  private readonly defaultExtractor?: MemoryExtractor;
  private readonly defaultSummarizer?: ReflectionSummarizer;
  private readonly defaultQueryExpander?: QueryExpander;
  private readonly defaultTranslator?: TranslationProvider;

  add(input: MemoryInput): Memory {
    return addImpl(this, input);
  }

  createEpisode(input: EpisodeInput): EpisodeRecord {
    return createEpisodeImpl(this, input);
  }

  listEpisodes(userId?: string): EpisodeRecord[] {
    return listEpisodesImpl(this, userId);
  }

  getEpisode(id: string): EpisodeRecord {
    return getEpisodeImpl(this, id);
  }

  extract(
    events: MemoryExtractionEvent[],
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "deviceId" | "runId">
  ): ExtractionReport {
    return extractImpl(this, events, scope);
  }

  list(userId?: string): Memory[] {
    return listImpl(this, userId);
  }

  get(id: string): Memory {
    return getImpl(this, id);
  }

  update(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }): Memory {
    return updateImpl(this, id, patch);
  }

  archive(id: string): Memory {
    return archiveImpl(this, id);
  }

  registerMemoryClaim(memory: Memory): ClaimRecord | undefined {
    const rawClaim = memory.metadata?.claim as MemoryClaim | undefined;
    const claim = rawClaim ?? extractClaim(memory.content, syntheticEventForMemory(memory), memory.scope, memory.source, memory.entities);
    if (!claim.subject || !claim.predicate || !claim.object) return undefined;
    const now = new Date().toISOString();
    const existing = [...this.claims.values()].find((item) => item.sourceMemoryId === memory.id);
    const record: ClaimRecord = {
      id: existing?.id ?? `claim_${contentDigest(`${memory.id}:${claim.subject}:${claim.predicate}:${claim.object}`).slice(0, 16)}`,
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      qualifiers: claim.qualifiers ?? {},
      sourceMemoryId: memory.id,
      sourceRef: memory.provenance.sourceRef,
      validFrom: memory.temporal.validFrom ?? memory.createdAt,
      validUntil: memory.temporal.validUntil,
      confidence: claim.confidence,
      trust: memory.trust,
      state: claimStateForMemory(memory),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.claims.set(record.id, record);
    this.rebuildConflictSetFor(record.subject, record.predicate);
    return record;
  }

  currentTruthForMemory(memory: Memory): CurrentTruthDecision | undefined {
    const claim = [...this.claims.values()].find((item) => item.sourceMemoryId === memory.id) ?? this.registerMemoryClaim(memory);
    if (!claim) return undefined;
    return this.currentTruthForClaim(claim);
  }

  currentTruthForClaim(claim: ClaimRecord): CurrentTruthDecision {
    const candidates = [...this.claims.values()]
      .filter((item) => item.subject === claim.subject && item.predicate === claim.predicate)
      .filter((item) => item.state !== "retracted");
    if (!candidates.length) {
      return { subject: claim.subject, predicate: claim.predicate, state: "missing", reason: "no claim candidates available", suppressedClaimIds: [] };
    }
    const scored = candidates
      .map((item) => ({ claim: item, score: this.truthScore(item) }))
      .sort((a, b) => b.score - a.score);
    const selected = scored[0];
    const runnerUp = scored[1];
    const conflict = this.conflictSetFor(claim.subject, claim.predicate);
    const uncertain = Boolean(runnerUp && runnerUp.claim.object !== selected.claim.object && selected.score - runnerUp.score < 0.05);
    if (uncertain) {
      return {
        subject: claim.subject,
        predicate: claim.predicate,
        selectedClaimId: selected.claim.id,
        selectedMemoryId: selected.claim.sourceMemoryId,
        state: "uncertain",
        reason: `conflicting claims are too close to auto-resolve (${selected.score.toFixed(3)} vs ${runnerUp?.score.toFixed(3)})`,
        suppressedClaimIds: scored.slice(1).map((item) => item.claim.id),
        conflictSetId: conflict?.id,
        scoreBreakdown: { selected: selected.score, runnerUp: runnerUp?.score ?? 0 }
      };
    }
    const sourceReason = `selected by source quality ${this.sourceQualityForClaim(selected.claim).toFixed(2)}, trust ${selected.claim.trust.toFixed(2)}, confidence ${selected.claim.confidence.toFixed(2)}`;
    return {
      subject: claim.subject,
      predicate: claim.predicate,
      selectedClaimId: selected.claim.id,
      selectedMemoryId: selected.claim.sourceMemoryId,
      state: "selected",
      reason: runnerUp && runnerUp.claim.object !== selected.claim.object
        ? `${sourceReason}; suppressed conflicting claim ${runnerUp.claim.id}`
        : sourceReason,
      suppressedClaimIds: scored.slice(1).map((item) => item.claim.id),
      conflictSetId: conflict?.id,
      scoreBreakdown: { selected: selected.score, runnerUp: runnerUp?.score ?? 0 }
    };
  }

  listConflictSets(status?: ConflictSet["status"]): ConflictSet[] {
    return [...this.conflictSets.values()]
      .filter((conflictSet) => !status || conflictSet.status === status)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  resolveConflictSet(
    conflictSetId: string,
    input: { selectedClaimId: string; reason: string; resolvedBy?: "system" | "operator" | "source_revalidation" }
  ): ConflictSet {
    const conflictSet = this.conflictSets.get(conflictSetId);
    if (!conflictSet) throw new Error(`Conflict set not found: ${conflictSetId}`);
    if (!conflictSet.claimIds.includes(input.selectedClaimId)) throw new Error(`Claim ${input.selectedClaimId} is not part of conflict set ${conflictSetId}`);
    const selected = this.claims.get(input.selectedClaimId);
    if (!selected) throw new Error(`Claim not found: ${input.selectedClaimId}`);
    const now = new Date().toISOString();
    for (const claimId of conflictSet.claimIds) {
      const claim = this.claims.get(claimId);
      if (!claim) continue;
      const state = claim.id === selected.id ? "active" : "contradicted";
      this.claims.set(claim.id, { ...claim, state, updatedAt: now });
      const memory = safeGet(this.store, claim.sourceMemoryId);
      if (memory && memory.beliefState !== "retracted" && memory.beliefState !== "archived") {
        this.storage.update(memory.id, {
          beliefState: state === "active" ? "active" : "contradicted",
          metadata: {
            ...memory.metadata,
            conflictSetId,
            truthResolutionReason: input.reason,
            ...(state === "active" ? { selectedTruthClaimId: selected.id } : { suppressedByTruthClaimId: selected.id })
          }
        });
      }
    }
    const resolved: ConflictSet = {
      ...conflictSet,
      status: "resolved",
      resolution: {
        selectedClaimId: selected.id,
        reason: input.reason,
        resolvedBy: input.resolvedBy ?? "operator",
        resolvedAt: now
      }
    };
    this.conflictSets.set(conflictSetId, resolved);
    this.recordAudit("memory.update", { userId: safeGet(this.store, selected.sourceMemoryId)?.userId ?? "system", memoryId: selected.sourceMemoryId, metadata: { resource: "conflict-set", conflictSetId, selectedClaimId: selected.id, reason: input.reason } });
    this.persist();
    return resolved;
  }

  listConnectorReviewQueue(options: { connectorId?: string; userId?: string; status?: "pending" | "approved" | "rejected" } = {}): Memory[] {
    return this.store.list(options.userId)
      .filter((memory) => {
        const queue = memory.metadata?.reviewQueue as { status?: string; connectorId?: string } | undefined;
        if (!queue) return false;
        if (options.connectorId && queue.connectorId !== options.connectorId) return false;
        return (options.status ?? "pending") === queue.status;
      });
  }

  reviewConnectorMemory(
    memoryId: string,
    input: { decision: "approve" | "reject"; reviewerId?: string; reason?: string }
  ): Memory {
    const memory = this.store.get(memoryId);
    const queue = memory.metadata?.reviewQueue as { status?: string; connectorId?: string; reason?: string } | undefined;
    if (!queue) throw new Error(`Memory ${memoryId} is not in the connector review queue`);
    const status = input.decision === "approve" ? "approved" : "rejected";
    const reviewedAt = new Date().toISOString();
    const updated = this.update(memoryId, {
      beliefState: input.decision === "approve" ? "active" : "retracted",
      trust: input.decision === "approve" ? Math.max(memory.trust, 0.82) : 0,
      temporal: input.decision === "approve" ? { ...memory.temporal, lastConfirmedAt: reviewedAt } : memory.temporal,
      metadata: {
        ...memory.metadata,
        reviewQueue: {
          ...queue,
          status,
          reviewedAt,
          reviewerId: input.reviewerId,
          decisionReason: input.reason
        }
      }
    });
    this.recordAudit("memory.update", { userId: updated.userId, memoryId, metadata: { resource: "connector-review-queue", connectorId: queue.connectorId, decision: input.decision, reviewerId: input.reviewerId, reason: input.reason } });
    return updated;
  }

  private truthScore(claim: ClaimRecord): number {
    const sourceQuality = this.sourceQualityForClaim(claim);
    const validUntilPenalty = claim.validUntil && new Date(claim.validUntil).getTime() < Date.now() ? 0.25 : 0;
    const statePenalty = claim.state === "needs_verification" ? 0.1 : claim.state === "contradicted" ? 0.2 : claim.state === "superseded" ? 0.35 : 0;
    const recency = Math.max(0, Math.min(1, 1 - ((Date.now() - new Date(claim.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 365))));
    return Math.max(0, claim.trust * 0.4 + claim.confidence * 0.25 + sourceQuality * 0.25 + recency * 0.1 - statePenalty - validUntilPenalty);
  }

  private sourceQualityForClaim(claim: ClaimRecord): number {
    const memory = safeGet(this.store, claim.sourceMemoryId);
    if (!memory) return 0.35;
    if (memory.metadata?.engineeringKind === "review_correction") return 0.95;
    if (memory.metadata?.engineeringKind === "tool_outcome") return 0.9;
    if (memory.metadata?.engineeringKind === "architecture_decision") return 0.88;
    if (memory.provenance.sourceRef?.connectorId === "jira") return 0.78;
    if (memory.provenance.sourceRef?.connectorId === "slack") return 0.72;
    return this.sourceQuality[memory.source.kind] ?? 0.5;
  }

  private rebuildConflictSetFor(subject: string, predicate: string): ConflictSet | undefined {
    const candidates = [...this.claims.values()].filter((claim) => claim.subject === subject && claim.predicate === predicate && claim.state !== "retracted");
    const objects = new Set(candidates.map((claim) => claim.object));
    const existing = this.conflictSetFor(subject, predicate);
    if (objects.size <= 1) {
      if (existing && existing.status === "open") this.conflictSets.set(existing.id, { ...existing, status: "resolved", resolution: { selectedClaimId: candidates[0]?.id ?? "", reason: "claims converged to one object", resolvedBy: "system", resolvedAt: new Date().toISOString() } });
      return existing;
    }
    const id = existing?.id ?? `conflict_${contentDigest(`${subject}:${predicate}`).slice(0, 16)}`;
    const next: ConflictSet = {
      id,
      claimIds: candidates.map((claim) => claim.id),
      detectedAt: existing?.detectedAt ?? new Date().toISOString(),
      status: existing?.status === "resolved" ? "operator_review" : existing?.status ?? "open",
      resolution: existing?.status === "resolved" ? existing.resolution : undefined
    };
    this.conflictSets.set(id, next);
    return next;
  }

  private conflictSetFor(subject: string, predicate: string): ConflictSet | undefined {
    return [...this.conflictSets.values()].find((set) => set.id === `conflict_${contentDigest(`${subject}:${predicate}`).slice(0, 16)}` || set.claimIds.some((id) => {
      const claim = this.claims.get(id);
      return claim?.subject === subject && claim.predicate === predicate;
    }));
  }

  private applySupersession(memory: Memory): void {
    const supersedes = memory.relations.filter((relation) => relation.type === "supersedes" && relation.targetId);
    if (!supersedes.length) return;
    const validUntil = new Date(memory.temporal.validFrom ?? memory.createdAt).toISOString();
    for (const relation of supersedes) {
      const target = safeGet(this.store, relation.targetId!);
      if (!target || target.beliefState === "retracted") continue;
      const updated = this.store.update(target.id, {
        beliefState: "superseded",
        temporal: {
          ...target.temporal,
          validUntil,
          supersededAt: validUntil
        },
        metadata: {
          ...target.metadata,
          supersededBy: memory.id,
          supersessionReason: `Superseded by ${memory.id}`
        }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { action: "superseded", supersededBy: memory.id } });
    }
  }

  delete(id: string): boolean {
    return deleteImpl(this, id);
  }

  listMemories(userId: string, options: { limit?: number; includeArchived?: boolean } = {}): Memory[] {
    return listMemoriesImpl(this, userId, options);
  }

  search(options: SearchOptions): SearchResult[] {
    return searchImpl(this, options);
  }

  classifyQueryIntent(query: string): QueryIntentReport {
    return classifyQueryIntentImpl(this, query);
  }

  routeMemory(options: SearchOptions): MemoryRouteReport {
    return routeMemoryImpl(this, options);
  }

  evidencePack(options: SearchOptions & { tokenBudget?: number }): EvidencePack {
    return evidencePackImpl(this, options);
  }

  getEvidencePack(id: string): EvidencePack {
    return getEvidencePackImpl(this, id);
  }

  resourceAuthorizationScope(input: {
    resource?: string;
    path?: string;
    userId?: string;
    orgId?: string;
    projectId?: string;
    memoryId?: string;
    contextPackId?: string;
    evidencePackId?: string;
    dreamJobId?: string;
    connectorId?: string;
    policyRuleId?: string;
  }): { found: boolean; userId?: string; orgId?: string; projectId?: string; connectorId?: string; memoryId?: string; lookupReason?: string } | undefined {
    const memoryId = input.memoryId && safeGet(this.store, input.memoryId) ? input.memoryId : undefined;
    const memory = memoryId ? safeGet(this.store, memoryId) : undefined;
    if (memory) return { found: true, userId: memory.userId, orgId: memory.orgId, projectId: memory.projectId, memoryId: memory.id, lookupReason: "memory lookup" };
    const evidenceId = input.evidencePackId ?? input.contextPackId;
    const evidence = evidenceId ? this.evidencePacks.get(evidenceId) : undefined;
    if (evidence) return { found: true, userId: evidence.userId, orgId: evidence.scope?.orgId, projectId: evidence.scope?.projectId, lookupReason: "evidence pack lookup" };
    const context = input.contextPackId ? this.codingContextPacks.get(input.contextPackId) : undefined;
    if (context) return { found: true, userId: context.userId, orgId: context.scope?.orgId, projectId: context.scope?.projectId, lookupReason: "context pack lookup" };
    const dreamJob = input.dreamJobId ? this.dreamJobs.get(input.dreamJobId) : undefined;
    if (dreamJob) return { found: true, userId: dreamJob.userId, orgId: dreamJob.input?.scope?.orgId, projectId: dreamJob.input?.scope?.projectId, lookupReason: "dream job lookup" };
    const policy = input.policyRuleId ? this.policyRules.get(input.policyRuleId) ?? this.retentionRules.get(input.policyRuleId) : undefined;
    if (policy) return { found: true, userId: policy.scope && "userId" in policy.scope ? policy.scope.userId : undefined, orgId: policy.scope && "orgId" in policy.scope ? policy.scope.orgId : undefined, lookupReason: "policy rule lookup" };
    if (input.connectorId) {
      const review = this.listConnectorReviewQueue({ connectorId: input.connectorId })[0];
      const sync = this.connectorSyncStates.get(input.connectorId);
      return { found: Boolean(review || sync || this.connectorManifests.has(input.connectorId)), userId: review?.userId, orgId: review?.orgId, projectId: review?.projectId, connectorId: input.connectorId, lookupReason: "connector lookup" };
    }
    return undefined;
  }

  prometheusMetrics(): string {
    const metrics = this.metricsReport();
    const lines = [
      "# HELP cognibrain_memories_total Total memories by user scope.",
      "# TYPE cognibrain_memories_total gauge",
      `cognibrain_memories_total ${this.store.list().length}`,
      "# HELP cognibrain_searches_total Search requests handled.",
      "# TYPE cognibrain_searches_total counter",
      `cognibrain_searches_total ${metrics.searches}`,
      "# HELP cognibrain_no_hit_searches_total Searches with no hits.",
      "# TYPE cognibrain_no_hit_searches_total counter",
      `cognibrain_no_hit_searches_total ${metrics.noHitSearches}`,
      "# HELP cognibrain_connector_sync_records_total Connector sync records.",
      "# TYPE cognibrain_connector_sync_records_total gauge",
      `cognibrain_connector_sync_records_total ${this.connectorSyncRecords.length}`,
      "# HELP cognibrain_dream_jobs_total Dream jobs tracked.",
      "# TYPE cognibrain_dream_jobs_total gauge",
      `cognibrain_dream_jobs_total ${this.dreamJobs.size}`
    ];
    return `${lines.join("\n")}\n`;
  }

  async enrichContext(
    input: ContextEnrichmentInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
  ): Promise<ContextEnrichmentReport> {
    return enrichContextImpl(this, input, fetchImpl, timeoutMs);
  }

  recordCodeCorrection(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  }): Memory {
    return recordCodeCorrectionImpl(this, input);
  }

  private derivedCorrectionMemories(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  }, correction: Memory, previous?: Memory): Memory[] {
    return derivedCorrectionMemoriesImpl(this, input, correction, previous);
  }

  codingContextPack(options: SearchOptions & { tokenBudget?: number }): CodingContextPack {
    return codingContextPackImpl(this, options);
  }

  getCodingContextPack(id: string): CodingContextPack {
    return getCodingContextPackImpl(this, id);
  }

  guardAction(input: {
    userId: string;
    action: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
  }): ActionGuardReport {
    return guardActionImpl(this, input);
  }

  patchEvidenceTrail(input: {
    userId: string;
    task: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    codebaseScope?: CodebaseScope;
    filesChanged?: string[];
    commandsRun?: string[];
    memoryIds?: string[];
  }): PatchEvidenceTrail {
    return patchEvidenceTrailImpl(this, input);
  }

  federatedSearch(options: SearchOptions & { brainIds: string[] }): FederatedSearchReport {
    return federatedSearchImpl(this, options);
  }

  reflect(userId: string): DreamCycleReport {
    return reflectImpl(this, userId);
  }

  dream(userId: string): DreamCycleReport {
    return dreamImpl(this, userId);
  }

  dreamPlan(input: DreamCycleInput): DreamPlanReport {
    return dreamPlanImpl(this, input);
  }

  prepareDream(input: DreamCycleInput & { run?: boolean }): DreamPreparationReport {
    return prepareDreamImpl(this, input);
  }

  runDreamCycle(input: DreamCycleInput): DreamCycleReport {
    return runDreamCycleImpl(this, input);
  }

  async runDreamCycleAsync(
    input: DreamCycleInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
  ): Promise<DreamCycleReport> {
    return runDreamCycleAsyncImpl(this, input, fetchImpl, timeoutMs);
  }

  async startDreamJob(
    input: DreamCycleInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
    options: { wait?: boolean } = {}
  ): Promise<DreamJob> {
    return startDreamJobImpl(this, input, fetchImpl, timeoutMs, options);
  }

  private async executeDreamJob(
    job: DreamJob,
    input: DreamCycleInput,
    mode: DreamCycleMode,
    trigger: DreamCycleTrigger,
    fetchImpl: typeof fetch,
    timeoutMs: number
  ): Promise<void> {
    if (job.status === "cancelled") {
      this.persist();
      return;
    }
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.logs = [...(job.logs ?? []), { at: job.startedAt, level: "info", message: "dream job running" }];
    try {
      const report = await this.runDreamCycleAsync({ ...input, mode, trigger, connectorIds: job.plan.connectorIds, sourceRefresh: job.plan.sourceRefresh }, fetchImpl, timeoutMs);
      job.finishedAt = new Date().toISOString();
      job.report = report;
      job.logs = [...(job.logs ?? []), { at: job.finishedAt, level: "info", message: "dream job completed", payload: { releaseBlockers: report.dreamCycle.plan.releaseBlockers?.length ?? 0 } }];
      job.progress = {
        connectorPolls: report.dreamCycle.connectorRefresh?.attempted ?? 0,
        connectorPollFailures: report.dreamCycle.connectorRefresh?.failed ?? 0,
        connectorPollSkipped: report.dreamCycle.connectorRefresh?.skipped ?? 0,
        memoriesEvaluated: report.lifecycle.evaluated,
        contradictions: report.contradictions.length,
        sourceRevalidations: report.dreamCycle.sourceRevalidation?.evaluated ?? 0,
        verificationScheduled: report.dreamCycle.verificationScheduled
      };
      if (this.dreamJobs.get(job.jobId)?.status !== "cancelled") job.status = "done";
    } catch (error) {
      if (this.dreamJobs.get(job.jobId)?.status !== "cancelled") job.status = "failed";
      job.finishedAt = new Date().toISOString();
      job.logs = [...(job.logs ?? []), { at: job.finishedAt, level: "error", message: error instanceof Error ? error.message : "dream job failed" }];
      if (this.dreamJobs.get(job.jobId)?.status !== "cancelled") job.error = error instanceof Error ? error.message : "dream job failed";
    }
    this.recordAudit(job.status === "failed" ? "policy.violation" : "reflect.run", { userId: input.userId, metadata: { resource: "dream-job", jobId: job.jobId, status: job.status, trigger, mode, progress: job.progress, error: job.error } });
    this.persist();
  }

  dreamJobStatus(jobId?: string): DreamJob[] {
    return dreamJobStatusImpl(this, jobId);
  }

  cancelDreamJob(jobId: string, reason?: string): DreamJob {
    const job = this.dreamJobs.get(jobId);
    if (!job) throw new Error(`Dream job not found: ${jobId}`);
    if (job.status === "done" || job.status === "failed" || job.status === "cancelled") return job;
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    job.error = reason ?? "cancelled by operator";
    this.recordAudit("reflect.run", { userId: job.userId, metadata: { resource: "dream-job", jobId, status: job.status, reason: job.error } });
    this.persist();
    return job;
  }

  async retryDreamJob(
    jobId: string,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
    options: { wait?: boolean } = {}
  ): Promise<DreamJob> {
    const job = this.dreamJobs.get(jobId);
    if (!job) throw new Error(`Dream job not found: ${jobId}`);
    if (job.status !== "failed" && job.status !== "cancelled") throw new Error(`Dream job ${jobId} is not retryable from status ${job.status}`);
    job.status = "retrying";
    job.logs = [...(job.logs ?? []), { at: new Date().toISOString(), level: "info", message: "dream job retry queued" }];
    const input = { ...(job.input ?? { userId: job.userId }), trigger: job.trigger, mode: job.mode, budget: job.plan.budget, sourceRefresh: job.plan.sourceRefresh, connectorIds: job.plan.connectorIds };
    const retry = await this.startDreamJob(input, fetchImpl, timeoutMs, options);
    retry.retryOf = jobId;
    this.recordAudit("reflect.run", { userId: job.userId, metadata: { resource: "dream-job", jobId: retry.jobId, retryOf: jobId, status: retry.status } });
    this.persist();
    return retry;
  }

  private async refreshDreamSources(
    input: DreamCycleInput,
    plan: DreamPlanReport,
    fetchImpl: typeof fetch,
    timeoutMs: number
  ): Promise<DreamConnectorRefreshReport> {
    const selected = this.selectDreamConnectors(input, plan);
    const report: DreamConnectorRefreshReport = {
      generatedAt: new Date().toISOString(),
      attempted: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      records: [],
      skippedConnectors: []
    };
    for (const connectorId of selected) {
      const manifest = this.connectorManifests.get(connectorId);
      const skipReason = this.connectorDreamRefreshSkipReason(manifest);
      if (skipReason) {
        report.skipped += 1;
        report.skippedConnectors.push({ connectorId, reason: skipReason });
        continue;
      }
      report.attempted += 1;
      const record = await this.pollConnector(connectorId, {
        userId: input.userId,
        sessionId: input.scope?.sessionId,
        orgId: input.scope?.orgId,
        projectId: input.scope?.projectId
      }, fetchImpl, timeoutMs);
      if (record.status === "applied") report.applied += 1;
      if (record.status === "failed") report.failed += 1;
      report.records.push({
        connectorId,
        recordId: record.id,
        status: record.status,
        memoryIds: record.memoryIds,
        externalIds: record.externalIds,
        error: record.error,
        responseStatusCode: record.responseStatusCode
      });
    }
    return report;
  }

  private selectDreamConnectors(input: DreamCycleInput, plan: DreamPlanReport): string[] {
    const selected = new Set<string>([
      ...(input.connectorIds ?? []),
      ...plan.connectorIds,
      ...(input.scope?.connectorId ? [input.scope.connectorId] : [])
    ].filter(Boolean));
    if (!selected.size && (plan.budget === "deep" || plan.budget === "release")) {
      for (const manifest of this.connectorManifests.values()) {
        if (manifest.capabilities.includes("poll") && manifest.poll?.endpoint) selected.add(manifest.id);
      }
    }
    return [...selected].sort();
  }

  private connectorDreamRefreshSkipReason(manifest?: ConnectorManifest): string | undefined {
    if (!manifest) return "connector_manifest_missing";
    if (manifest.privacyPolicy === "never_store") return "privacy_policy_never_store";
    if (!manifest.capabilities.includes("poll")) return "poll_not_supported";
    if (!manifest.poll?.endpoint) return "poll_endpoint_missing";
    if (manifest.auth === "oauth") {
      const authorized = [...this.connectorAuthSessions.values()].some((session) => {
        if (session.connectorId !== manifest.id || session.status !== "authorized") return false;
        return !session.expiresAt || new Date(session.expiresAt).getTime() > Date.now();
      });
      if (!authorized && !shouldUseExternalVendor(manifest, manifest.poll.endpoint)) return "connector_not_authorized";
    }
    return undefined;
  }

  verificationQueue(userId: string): VerificationQueueReport {
    return verificationQueueImpl(this, userId);
  }

  revalidateSourceRefs(
    userId: string,
    options: { connectorIds?: string[]; scope?: DreamCycleInput["scope"]; onlyDue?: boolean; limit?: number } = {}
  ): SourceRevalidationReport {
    const now = new Date();
    const candidates = this.sourceRevalidationCandidates(userId, options);
    const results = candidates.map((memory) => this.revalidateMemorySourceRef(memory.id, userId));
    const report: SourceRevalidationReport = {
      userId,
      generatedAt: now.toISOString(),
      evaluated: candidates.length,
      results,
      summary: sourceRevalidationSummary(results)
    };
    if (results.length) {
      this.recordAudit("reflect.run", { userId, metadata: { resource: "source-revalidation", evaluated: report.evaluated, summary: report.summary } });
      this.persist();
    }
    return report;
  }

  async revalidateSourceRefsAsync(
    userId: string,
    options: { connectorIds?: string[]; scope?: DreamCycleInput["scope"]; onlyDue?: boolean; limit?: number } = {}
  ): Promise<SourceRevalidationReport> {
    const now = new Date();
    const candidates = this.sourceRevalidationCandidates(userId, options);
    const results: SourceRevalidationResult[] = [];
    for (const memory of candidates) {
      results.push(await this.revalidateMemorySourceRefAsync(memory.id, userId));
    }
    const report: SourceRevalidationReport = {
      userId,
      generatedAt: now.toISOString(),
      evaluated: candidates.length,
      results,
      summary: sourceRevalidationSummary(results)
    };
    if (results.length) {
      this.recordAudit("reflect.run", { userId, metadata: { resource: "source-revalidation", mode: "live", evaluated: report.evaluated, summary: report.summary } });
      this.persist();
    }
    return report;
  }

  revalidateMemory(memoryId: string, userId?: string): SourceRevalidationResult {
    return revalidateMemoryImpl(this, memoryId, userId);
  }

  async revalidateMemoryAsync(memoryId: string, userId?: string): Promise<SourceRevalidationResult> {
    return this.revalidateMemorySourceRefAsync(memoryId, userId);
  }

  registerSourceResolver(resolver: SourceResolver): SourceResolver {
    this.sourceResolvers.set(resolver.connectorId, resolver);
    return resolver;
  }

  listSourceResolvers(): SourceResolver[] {
    return [...this.sourceResolvers.values()];
  }

  private registerDefaultSourceResolvers(): void {
    const providers = ["github", "jira", "confluence", "notion", "sentry", "pagerduty"];
    for (const provider of providers) {
      const connectorIds = [`official-${provider}`, provider];
      for (const connectorId of connectorIds) {
        this.registerSourceResolver({
          id: `resolver:${connectorId}`,
          connectorId,
          supports: (sourceRef) => sourceRef.connectorId === connectorId || sourceRef.connectorId === provider,
          fetch: async (sourceRef, memory) => this.fetchLiveSourceRecord(sourceRef, memory),
          get: (sourceRef, memory) => this.latestSourceRecordFromMemories(sourceRef, memory),
          compare: (memory, sourceRecord) => defaultSourceResolverDecision(memory, sourceRecord)
        });
      }
    }
  }

  private latestSourceRecordFromMemories(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): SourceRecord | undefined {
    const candidates = this.store.list(memory.userId)
      .filter((item) => item.provenance.sourceRef?.connectorId === sourceRef.connectorId)
      .filter((item) => !sourceRef.externalId || item.provenance.sourceRef?.externalId === sourceRef.externalId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const current = candidates[0] ?? memory;
    return {
      sourceRef,
      content: current.content,
      title: typeof current.metadata?.title === "string" ? current.metadata.title : undefined,
      updatedAt: current.updatedAt,
      version: current.provenance.sourceRef?.version,
      hash: current.provenance.sourceRef?.hash,
      status: "found",
      metadata: { provider: sourceRef.connectorId, memoryId: current.id }
    };
  }

  private async fetchLiveSourceRecord(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): Promise<SourceRecord | { missing: true }> {
    const connectorId = sourceRef.connectorId;
    if (!connectorId) return this.latestSourceRecordFromMemories(sourceRef, memory) ?? { missing: true };
    const manifest = this.connectorManifests.get(connectorId)
      ?? this.connectorManifests.get(`official-${connectorId}`);
    if (!manifest) return this.latestSourceRecordFromMemories(sourceRef, memory) ?? { missing: true };
    const listed = await listExternalVendorItems(manifest, fetch, Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000));
    if (listed.status === "failed") {
      const local = this.latestSourceRecordFromMemories(sourceRef, memory);
      return local
        ? { ...local, metadata: { ...(local.metadata ?? {}), liveFetchSkipped: true, liveFetchError: listed.error } }
        : { missing: true };
    }
    const item = listed.items.find((candidate) => sourceRefMatchesVendorItem(sourceRef, candidate));
    if (!item) return { missing: true };
    const hash = contentHash(stableStringify(item));
    return {
      sourceRef: { ...sourceRef, version: liveSourceVersion(item), hash },
      content: compactLiveSourceContent(item),
      title: stringFromCandidate(item, ["title", "name", "summary", "key", "identifier", "externalId", "id"]),
      updatedAt: stringFromCandidate(item, ["updatedAt", "updated_at", "modifiedAt", "lastEditedTime", "last_edited_time"]) ?? new Date().toISOString(),
      version: liveSourceVersion(item),
      hash,
      status: "found",
      metadata: {
        provider: manifest.vendor?.provider,
        connectorId: manifest.id,
        liveFetch: true,
        responseStatusCode: listed.responseStatusCode
      }
    };
  }

  private sourceRevalidationCandidates(
    userId: string,
    options: { connectorIds?: string[]; scope?: DreamCycleInput["scope"]; onlyDue?: boolean; limit?: number } = {}
  ): Memory[] {
    const connectorIds = new Set(options.connectorIds ?? []);
    const dueMemoryIds = new Set(this.verificationQueue(userId).items.map((item) => item.memoryId));
    return this.store.list(userId)
      .filter((memory) => !memory.archivedAt)
      .filter((memory) => Boolean(memory.provenance.sourceRef))
      .filter((memory) => !connectorIds.size || connectorIds.has(memory.provenance.sourceRef?.connectorId ?? ""))
      .filter((memory) => this.memoryMatchesDreamScope(memory, options.scope))
      .filter((memory) => !options.onlyDue || dueMemoryIds.has(memory.id) || (memory.temporal.stalenessRisk ?? 0) >= 0.65)
      .slice(0, options.limit ?? 200);
  }

  resolveVerificationQueue(userId: string, options: { limit?: number; connectorIds?: string[] } = {}): VerificationResolutionReport {
    return resolveVerificationQueueImpl(this, userId, options);
  }

  confirmMemory(memoryId: string, userId?: string): Memory {
    return confirmMemoryImpl(this, memoryId, userId);
  }

  recordHarnessAction(input: HarnessActionInput): Memory {
    return recordHarnessActionImpl(this, input);
  }

  recordHarnessLifecycleEvent(input: HarnessLifecycleEventInput): HarnessLifecycleEventReport {
    return recordHarnessLifecycleEventImpl(this, input);
  }

  retractMemory(memoryId: string, userId?: string, reason?: string): Memory {
    return retractMemoryImpl(this, memoryId, userId, reason);
  }

  feedback(event: FeedbackEvent): Memory {
    return feedbackImpl(this, event);
  }

  recordInjectionFeedback(event: InjectionFeedbackEvent): InjectionFeedbackReport {
    return recordInjectionFeedbackImpl(this, event);
  }

  recordConnectorFeedback(input: {
    connectorId: string;
    userId: string;
    kind: "accepted_change" | "rejected_suggestion" | "failing_test" | "user_correction";
    content: string;
    memoryIds?: string[];
    externalId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return recordConnectorFeedbackImpl(this, input);
  }

  recordConnectorTelemetry(input: {
    connectorId: string;
    harnessId?: string;
    userId: string;
    kind: "accepted_suggestion" | "rejected_suggestion" | "context_pack_feedback" | "tool_outcome";
    content?: string;
    query?: string;
    memoryIds?: string[];
    acceptedMemoryIds?: string[];
    rejectedMemoryIds?: string[];
    command?: string;
    filesChanged?: string[];
    tests?: HarnessActionInput["tests"];
    externalId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return recordConnectorTelemetryImpl(this, input);
  }

  exportUser(userId: string): Memory[] {
    return exportUserImpl(this, userId);
  }

  deleteUser(userId: string): number {
    return deleteUserImpl(this, userId);
  }

  createBrain(input: Omit<Brain, "id" | "createdAt" | "updatedAt"> & { id?: string }): Brain {
    return createBrainImpl(this, input);
  }

  listBrains(): Brain[] {
    return listBrainsImpl(this);
  }

  createSource(input: Omit<MemorySource, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemorySource {
    return createSourceImpl(this, input);
  }

  listSources(brainId?: string): MemorySource[] {
    return listSourcesImpl(this, brainId);
  }

  deleteSource(sourceId: string, actorId = "system"): { sourceId: string; affectedMemoryIds: string[] } {
    return deleteSourceImpl(this, sourceId, actorId);
  }

  registerConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): ConnectorManifest {
    return registerConnectorManifestImpl(this, input);
  }

  beginConnectorOAuth(connectorId: string, input: { redirectUri?: string; scopes?: string[]; stateSalt?: string } = {}): ConnectorAuthSession {
    return beginConnectorOAuthImpl(this, connectorId, input);
  }

  completeConnectorOAuth(input: { connectorId: string; state: string; code?: string; tokenRef?: string; error?: string }): ConnectorAuthSession {
    return completeConnectorOAuthImpl(this, input);
  }

  revokeConnectorAuth(connectorId: string, actorId = "system"): ConnectorAuthSession[] {
    return revokeConnectorAuthImpl(this, connectorId, actorId);
  }

  refreshConnectorOAuth(connectorId: string): ConnectorAuthSession {
    return refreshConnectorOAuthImpl(this, connectorId);
  }

  connectorAuthStatus(connectorId?: string): ConnectorAuthSession[] {
    return connectorAuthStatusImpl(this, connectorId);
  }

  listConnectorManifests(kind?: ConnectorManifest["kind"]): ConnectorManifest[] {
    return listConnectorManifestsImpl(this, kind);
  }

  syncConnectorEvents(connectorId: string, events: Array<MemoryExtractionEvent & { externalId?: string }>, scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">): ConnectorSyncRecord {
    return syncConnectorEventsImpl(this, connectorId, events, scope);
  }

  async listConnectorItems(connectorId: string, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorListResult> {
    return listConnectorItemsImpl(this, connectorId, fetchImpl, timeoutMs);
  }

  async pollConnector(connectorId: string, scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorSyncRecord> {
    return pollConnectorImpl(this, connectorId, scope, fetchImpl, timeoutMs);
  }

  connectorHealth(connectorId?: string): ConnectorHealthItem[] {
    return connectorHealthImpl(this, connectorId);
  }

  async writebackConnector(connectorId: string, input: ConnectorWritebackInput, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorSyncRecord> {
    return writebackConnectorImpl(this, connectorId, input, fetchImpl, timeoutMs);
  }

  listConnectorSyncRecords(connectorId?: string): ConnectorSyncRecord[] {
    return listConnectorSyncRecordsImpl(this, connectorId);
  }

  connectorSyncState(connectorId?: string): ConnectorSyncState[] {
    return connectorSyncStateImpl(this, connectorId);
  }

  providerStatus(): ProviderAdapterStatus {
    return providerStatusImpl(this);
  }

  translateText(text: string, sourceLanguage?: string, targetLanguage = "en"): TranslationReport {
    return translateTextImpl(this, text, sourceLanguage, targetLanguage);
  }

  ingestMedia(
    event: MemoryExtractionEvent,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">
  ): ExtractionReport {
    return ingestMediaImpl(this, event, scope);
  }

  deliverWebhookQueue(handler?: (webhook: WebhookRegistration, event: AuditEvent) => { ok: boolean; error?: string }): { delivered: number; failed: number; queued: number } {
    return deliverWebhookQueueImpl(this, handler);
  }

  async deliverWebhookQueueHttp(fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_WEBHOOK_TIMEOUT_MS ?? 10_000)): Promise<{ delivered: number; failed: number; queued: number }> {
    return deliverWebhookQueueHttpImpl(this, fetchImpl, timeoutMs);
  }

  storageStatus(): StorageBackendStatus {
    return storageStatusImpl(this);
  }

  private lexicalProviderForPersistence(): SearchOptions["lexicalProvider"] | undefined {
    if (!this.persistence?.lexicalSearch) return undefined;
    return {
      id: `${this.persistence.kind}-fts`,
      search: ({ query, memories, limit }) =>
        this.persistence?.lexicalSearch?.(query, {
          memoryIds: memories.map((memory) => memory.id),
          limit: Math.max(limit ?? 8, Math.min(memories.length, 1000))
        }) ?? []
    };
  }

  auditTrail(filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditEvent[] {
    return auditTrailImpl(this, filter);
  }

  auditChain(filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditChainExport {
    return auditChainImpl(this, filter);
  }

  replayAuditState(events: AuditEvent[] = this.auditEvents): AuditChainExport["replay"] {
    return replayAuditStateImpl(this, events);
  }

  updateConsent(memoryId: string, consent: Partial<ConsentPolicy>): Memory {
    return updateConsentImpl(this, memoryId, consent);
  }

  revertMemory(memoryId: string, auditEventId?: string): Memory {
    return revertMemoryImpl(this, memoryId, auditEventId);
  }

  queueOfflineOperation(input: Omit<OfflineOperation, "id" | "occurredAt" | "status"> & { id?: string; occurredAt?: Date | string; status?: OfflineOperation["status"] }): OfflineOperation {
    return queueOfflineOperationImpl(this, input);
  }

  syncOfflineOperations(): SyncReport {
    return syncOfflineOperationsImpl(this);
  }

  syncStatus(): { queued: OfflineOperation[]; counts: Record<OfflineOperation["status"], number> } {
    return syncStatusImpl(this);
  }

  registerAgent(input: Omit<AgentRegistration, "createdAt" | "updatedAt">): AgentRegistration {
    return registerAgentImpl(this, input);
  }

  listAgents(): AgentRegistration[] {
    return listAgentsImpl(this);
  }

  assignAgentPersona(agentId: string, personaId: string): AgentRegistration {
    return assignAgentPersonaImpl(this, agentId, personaId);
  }

  setPersona(input: Omit<PersonaProfile, "createdAt" | "updatedAt">): PersonaProfile {
    return setPersonaImpl(this, input);
  }

  listPersonas(): PersonaProfile[] {
    return listPersonasImpl(this);
  }

  promoteSharedMemory(memoryId: string, orgId: string): Memory {
    return promoteSharedMemoryImpl(this, memoryId, orgId);
  }

  reviewSharedMemory(memoryId: string, input: { orgId: string; reviewerId: string; decision: "approve" | "reject"; note?: string }): Memory {
    return reviewSharedMemoryImpl(this, memoryId, input);
  }

  requestSharedMemory(memoryId: string, orgId: string, requestedBy?: string, note?: string): Memory {
    return requestSharedMemoryImpl(this, memoryId, orgId, requestedBy, note);
  }

  revokeSharedMemory(memoryId: string, actorId?: string, reason?: string): Memory {
    return revokeSharedMemoryImpl(this, memoryId, actorId, reason);
  }

  graphPaths(from: string, to: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }) {
    return graphPathsImpl(this, from, to, options);
  }

  graphExplain(from: string, to: string, options: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string; strategy?: GraphExplainReport["strategy"] } = {}): GraphExplainReport {
    return graphExplainImpl(this, from, to, options);
  }

  graphQuery(query: string, userId?: string) {
    return graphQueryImpl(this, query, userId);
  }

  graphActivation(query: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }): GraphActivationResult {
    return graphActivationImpl(this, query, options);
  }

  graphExport(options: GraphExportOptions = {}): GraphExportResult | string {
    return graphExportImpl(this, options);
  }

  runInference(rules?: Parameters<typeof inferGraphRelations>[1]): ReturnType<typeof inferGraphRelations> {
    return runInferenceImpl(this, rules);
  }

  registerWebhook(input: Omit<WebhookRegistration, "id" | "createdAt"> & { id?: string }): WebhookRegistration {
    return registerWebhookImpl(this, input);
  }

  eventFeed(filter: { agentId?: string; brainId?: string; sourceId?: string; type?: AuditEvent["type"] } = {}): { auditEvents: AuditEvent[]; deliveries: WebhookDelivery[] } {
    return eventFeedImpl(this, filter);
  }
  installMarketplaceModule(module: MarketplaceModule): MarketplaceModule {
    return installMarketplaceModuleImpl(this, module);
  }
  installMarketplaceModuleById(moduleId: string): MarketplaceModule {
    return installMarketplaceModuleByIdImpl(this, moduleId);
  }
  marketplaceInstallPlan(moduleOrId: MarketplaceModule | string): MarketplaceInstallPlan {
    return marketplaceInstallPlanImpl(this, moduleOrId);
  }
  listMarketplaceModules(): MarketplaceModule[] {
    return listMarketplaceModulesImpl(this);
  }
  submitMarketplaceModule(input: { module: MarketplaceModule; submitter: string; sourceUrl?: string }): MarketplaceSubmission {
    return submitMarketplaceModuleImpl(this, input);
  }
  scanMarketplaceSubmission(submissionId: string): MarketplaceSubmission {
    return scanMarketplaceSubmissionImpl(this, submissionId);
  }
  reviewMarketplaceSubmission(submissionId: string, review: { reviewer: string; rating: number; comment?: string; approve?: boolean; requestChanges?: boolean; reject?: boolean }): MarketplaceSubmission {
    return reviewMarketplaceSubmissionImpl(this, submissionId, review);
  }
  publishMarketplaceSubmission(submissionId: string): MarketplaceModule {
    return publishMarketplaceSubmissionImpl(this, submissionId);
  }
  listMarketplaceSubmissions(status?: MarketplaceSubmission["status"]): MarketplaceSubmission[] {
    return listMarketplaceSubmissionsImpl(this, status);
  }
  rateMarketplaceModule(moduleId: string, review: { reviewer: string; rating: number; comment?: string }): MarketplaceModule {
    return rateMarketplaceModuleImpl(this, moduleId, review);
  }

  private requireMarketplaceSubmission(submissionId: string): MarketplaceSubmission {
    const submission = this.marketplaceSubmissions.get(submissionId);
    if (!submission) throw new Error(`Marketplace submission not found: ${submissionId}`);
    return submission;
  }

  apiDescription(auth?: import("./apiDescription").ApiDescriptionAuth) {
    return apiDescriptionImpl(this, auth);
  }

  managedMigrationBundle(options: { target?: ManagedMigrationBundle["target"]; backupRef?: string; ssoProvider?: string; secretManager?: string } = {}): ManagedMigrationBundle {
    return managedMigrationBundleImpl(this, options);
  }

  importMigrationBundle(bundle: ManagedMigrationBundle): { importedMemories: number; importedEpisodes: number; importedProfiles: number; importedPersonas: number; importedConnectors: number; importedPolicyRules: number; importedRetentionRules: number } {
    return importMigrationBundleImpl(this, bundle);
  }

  verifyBackupRecovery(bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport {
    return verifyBackupRecoveryImpl(this, bundle, options);
  }

  verifyBackupReplay(bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport & { replay: ReturnType<MemoryService["replayAuditState"]> } {
    return verifyBackupReplayImpl(this, bundle, options);
  }
  setRetentionRule(input: Omit<RetentionRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): RetentionRule {
    return setRetentionRuleImpl(this, input);
  }
  listRetentionRules(): RetentionRule[] {
    return listRetentionRulesImpl(this);
  }
  enforceRetention(now = new Date(), userId?: string): RetentionEnforcementReport {
    return enforceRetentionImpl(this, now, userId);
  }
  retentionReview(now = new Date(), userId?: string): RetentionReviewReport {
    return retentionReviewImpl(this, now, userId);
  }

  private applyEpisodeRetention(memoryId: string, action: "archive" | "delete", reason: string, ruleId: string | undefined, now: Date, report: RetentionEnforcementReport): void {
    for (const episode of [...this.episodes.values()]) {
      if (!episode.memoryIds.includes(memoryId)) continue;
      if (action === "delete") {
        this.episodes.delete(episode.id);
        report.episodeDeleted.push(episode.id);
        this.recordAudit("retention.enforce", { userId: episode.userId, metadata: { resource: "episode", action, reason, ruleId, episodeId: episode.id, memoryId } });
        continue;
      }
      const updated: EpisodeRecord = {
        ...episode,
        retention: {
          action,
          at: now.toISOString(),
          ruleId,
          reason,
          memoryIds: [...new Set([...(episode.retention?.memoryIds ?? []), memoryId])]
        }
      };
      this.episodes.set(episode.id, updated);
      report.episodeArchived.push(episode.id);
      this.recordAudit("retention.enforce", { userId: episode.userId, metadata: { resource: "episode", action, reason, ruleId, episodeId: episode.id, memoryId } });
    }
  }
  securityKeyReport(): SecurityKeyReport {
    return securityKeyReportImpl(this);
  }
  keyProviderReport(): KeyProviderReport {
    return keyProviderReportImpl(this);
  }
  setPolicyRule(input: Omit<MemoryPolicyRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemoryPolicyRule {
    return setPolicyRuleImpl(this, input);
  }
  listPolicyRules(): MemoryPolicyRule[] {
    return listPolicyRulesImpl(this);
  }
  evaluatePolicy(operation: MemoryPolicyOperation, target: Memory | MemoryInput, actor: Partial<MemoryScope> = {}): PolicyDecision {
    return evaluatePolicyImpl(this, operation, target, actor);
  }
  canRead(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canReadImpl(this, memory, actor);
  }
  canWrite(input: MemoryInput, actor: Partial<MemoryScope> = {}): boolean {
    return canWriteImpl(this, input, actor);
  }
  canDelete(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canDeleteImpl(this, memory, actor);
  }
  canPromote(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canPromoteImpl(this, memory, actor);
  }
  canUseInContext(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canUseInContextImpl(this, memory, actor);
  }
  transportSecurityReport(options: { publicUrl?: string; mode?: TransportSecurityReport["mode"]; tlsTerminatedBy?: string } = {}): TransportSecurityReport {
    return transportSecurityReportImpl(this, options);
  }

  managedDeploymentPlan(options: { target?: ManagedMigrationBundle["target"]; ssoProvider?: string; secretManager?: string } = {}): ManagedDeploymentPlan {
    return managedDeploymentPlanImpl(this, options);
  }

  createManagedTenant(input: {
    id?: string;
    name: string;
    orgId: string;
    plan?: ManagedTenant["plan"];
    region?: string;
    status?: ManagedTenant["status"];
    ssoProvider?: string;
    secretManager?: string;
    dataResidency?: string;
    autoscaling?: ManagedTenant["autoscaling"];
    backup?: ManagedTenant["backup"];
  }): ManagedTenant {
    return createManagedTenantImpl(this, input);
  }

  listManagedTenants(): ManagedTenant[] {
    return listManagedTenantsImpl(this);
  }

  managedControlPlaneReport(): ManagedControlPlaneReport {
    return managedControlPlaneReportImpl(this);
  }

  rotateEncryptionKeyMetadata(input: { keyId: string; keyVersion: string; backupRef?: string; actorId?: string }): KeyRotationReport {
    return rotateEncryptionKeyMetadataImpl(this, input);
  }

  privacyInsights(options: { epsilon?: number; kAnonymity?: number; includeExact?: boolean } = {}): DifferentialPrivacyReport {
    return privacyInsightsImpl(this, options);
  }

  privacyPreservingCrossBrainCompute(options: {
    brainIds: string[];
    salt?: string;
    minK?: number;
    dimensions?: Array<"entities" | "tags" | "relations">;
  }): CrossBrainPrivacyComputeReport {
    return privacyPreservingCrossBrainComputeImpl(this, options);
  }

  complianceReport(now = new Date()): ComplianceReport {
    return complianceReportImpl(this, now);
  }

  metricsReport(): MetricsReport {
    return metricsReportImpl(this);
  }

  addTrainingSample(sample: RetrievalTrainingSample): RetrievalTrainingSample {
    return addTrainingSampleImpl(this, sample);
  }

  setRetrievalProfile(profile: Omit<RetrievalProfile, "updatedAt" | "weights"> & { weights: Partial<RetrievalWeights>; updatedAt?: string }): RetrievalProfile {
    return setRetrievalProfileImpl(this, profile);
  }

  getRetrievalProfiles(): RetrievalProfile[] {
    return getRetrievalProfilesImpl(this);
  }

  learnRetrievalProfile(id = "learned", label = "Learned feedback profile", options: { scope?: RetrievalProfile["scope"] } = {}): LearnedProfileReport {
    return learnRetrievalProfileImpl(this, id, label, options);
  }

  linkIdentity(primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    return linkIdentityImpl(this, primaryUserId, linkedUserId, consentToken, consent);
  }

  unlinkIdentity(id: string): IdentityLink {
    return unlinkIdentityImpl(this, id);
  }

  timeline(userId: string): TimelineReport {
    return timelineImpl(this, userId);
  }

  summarizeTimeline(
    userId: string,
    options: { granularity?: TimelineSummaryReport["granularity"]; persist?: boolean; style?: "concise" | "descriptive" | "narrative" } = {}
  ): TimelineSummaryReport {
    return summarizeTimelineImpl(this, userId, options);
  }

  temporalQuery(userId: string, options: { after?: Date | string; before?: Date | string } = {}): TemporalQueryReport {
    return temporalQueryImpl(this, userId, options);
  }

  behavioralPatterns(userId: string): BehavioralPatternReport {
    return behavioralPatternsImpl(this, userId);
  }

  adaptiveDreamPolicy(userId: string): AdaptiveDreamPolicyReport {
    return adaptiveDreamPolicyImpl(this, userId);
  }

  generateObservations(userId: string, options: { style?: ObservationReport["style"]; persist?: boolean; limit?: number } = {}): ObservationReport {
    return generateObservationsImpl(this, userId, options);
  }

  predictionReport(userId: string, options: { query?: string; limit?: number } = {}): PredictionReport {
    return predictionReportImpl(this, userId, options);
  }

  graph(userId?: string): GraphReport {
    return graphImpl(this, userId);
  }

  entityCatalog(userId?: string): { entities: EntityRecord[]; mergeSuggestions: EntityMergeSuggestion[]; enrichmentCandidates: EnrichmentCandidate[] } {
    return entityCatalogImpl(this, userId);
  }

  runEntityEnrichment(input: { userId: string; entity: string; approveExternal?: boolean; sourceUri?: string }) {
    return runEntityEnrichmentImpl(this, input);
  }

  mergeEntity(canonical: string, aliases: string[], userId?: string): EntityRecord {
    return mergeEntityImpl(this, canonical, aliases, userId);
  }

  splitEntity(canonical: string, aliases: string[], userId?: string): EntityRecord | undefined {
    return splitEntityImpl(this, canonical, aliases, userId);
  }

  lifecyclePreview(userId: string, policy?: Partial<LifecyclePolicy>) {
    return lifecyclePreviewImpl(this, userId, policy);
  }

  runDomainEvaluation(domain = this.domainModule): DomainEvaluationReport {
    return runDomainEvaluationImpl(this, domain);
  }

  health(userId?: string) {
    return healthReport(this.store, userId);
  }

  maintenanceStatus(): MemoryMaintenanceStatus {
    return {
      enabled: this.autoDream.enabled,
      intervalHours: this.autoDream.intervalHours,
      writeThreshold: this.autoDream.writeThreshold,
      users: Object.fromEntries(Object.entries(this.maintenance.users).map(([userId, status]) => [userId, { ...status }]))
    };
  }

  runDueDreams(now = new Date()): string[] {
    if (!this.autoDream.enabled) return [];
    const dreamed: string[] = [];
    for (const userId of new Set(this.store.list().map((memory) => memory.userId))) {
      if (!this.isDreamDue(userId, now)) continue;
      this.runAutoDream(userId);
      dreamed.push(userId);
    }
    return dreamed;
  }

  private afterWrite(userId: string): void {
    const status = this.userMaintenance(userId);
    status.writesSinceDream += 1;
    if (this.autoDream.enabled && this.isDreamDue(userId)) this.runAutoDream(userId);
    this.persist();
  }

  private runAutoDream(userId: string): void {
    if (this.dreaming) return;
    this.dreaming = true;
    try {
      this.runDreamCycle({
        userId,
        mode: "dream",
        trigger: this.autoDreamTrigger(userId)
      });
    } finally {
      this.dreaming = false;
    }
  }

  private recordDream(qualityScore: number, contradictions: number, actions: string[] = []): void {
    this.metrics.dreams += 1;
    this.metrics.contradictionsResolved += contradictions;
    this.metrics.averageQualityScore = rollingAverage(this.metrics.averageQualityScore, qualityScore, this.metrics.dreams);
    this.metrics.dreamActions ??= {};
    for (const action of actions) {
      const key = action.split(" ").slice(0, 2).join(" ");
      this.metrics.dreamActions[key] = (this.metrics.dreamActions[key] ?? 0) + 1;
    }
  }

  private recordSessionMetrics(options: SearchOptions, resultCount: number): void {
    const key = options.sessionId ?? options.projectId ?? "global";
    this.metrics.sessions ??= {};
    const current = this.metrics.sessions[key] ?? { searches: 0, noHitSearches: 0, averageResults: 0 };
    const searches = current.searches + 1;
    this.metrics.sessions[key] = {
      searches,
      noHitSearches: current.noHitSearches + (resultCount === 0 ? 1 : 0),
      averageResults: rollingAverage(current.averageResults, resultCount, searches)
    };
  }

  private profileFor(options: SearchOptions): RetrievalProfile | undefined {
    return [...this.retrievalProfiles.values()].find((profile) => {
      if (!profile.scope) return false;
      return (
        (!profile.scope.userId || profile.scope.userId === options.userId) &&
        (!profile.scope.projectId || profile.scope.projectId === options.projectId) &&
        (!profile.scope.appId || profile.scope.appId === options.appId) &&
        (!profile.scope.orgId || profile.scope.orgId === options.orgId) &&
        (!profile.scope.agentId || profile.scope.agentId === options.agentId)
      );
    }) ?? this.retrievalProfiles.get("default");
  }

  private isDreamDue(userId: string, now = new Date()): boolean {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return true;
    if (!status.lastDreamAt) return false;
    const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
    return ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0;
  }

  private autoDreamTrigger(userId: string, now = new Date()): DreamCycleTrigger {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return "auto_write_threshold";
    if (status.lastDreamAt) {
      const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
      if (ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0) return "auto_interval";
    }
    return "auto_interval";
  }

  private markDreamed(userId: string): void {
    const status = this.userMaintenance(userId);
    status.lastDreamAt = new Date().toISOString();
    status.writesSinceDream = 0;
  }

  private userMaintenance(userId: string): { lastDreamAt?: string; writesSinceDream: number } {
    this.maintenance.users[userId] ??= { writesSinceDream: 0 };
    return this.maintenance.users[userId];
  }

  private revalidateMemorySourceRef(memoryId: string, userId?: string): SourceRevalidationResult {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot revalidate memory ${memoryId}`);
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) {
      const updated = this.store.update(memory.id, {
        beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
        metadata: { verification: { status: "needs_operator_review", at: new Date().toISOString(), reason: "memory has no sourceRef" } }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "needs_operator_review", reason: "missing_source_ref" } });
      return { memoryId, status: "needs_operator_review", reason: "memory has no sourceRef" };
    }
    const resolver = sourceRef.connectorId ? this.sourceResolvers.get(sourceRef.connectorId) : undefined;
    if (resolver) {
      const sourceRecord = resolver.get(sourceRef, memory);
      const decision: SourceValidationDecision = sourceRecord
        ? resolver.compare?.(memory, sourceRecord) ?? defaultSourceResolverDecision(memory, sourceRecord)
        : { status: "source_missing" as const, reason: "source resolver returned no source record" };
      return this.applySourceResolverDecision(memory, sourceRef, decision);
    }
    return this.revalidateMemorySourceRefFallback(memory, sourceRef);
  }

  private async revalidateMemorySourceRefAsync(memoryId: string, userId?: string): Promise<SourceRevalidationResult> {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot revalidate memory ${memoryId}`);
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) {
      return this.revalidateMemorySourceRef(memoryId, userId);
    }
    const resolver = sourceRef.connectorId ? this.sourceResolvers.get(sourceRef.connectorId) : undefined;
    if (resolver) {
      const fetched = resolver.fetch ? await resolver.fetch(sourceRef, memory) : resolver.get(sourceRef, memory);
      const sourceRecord = fetched && !("missing" in fetched) ? fetched : undefined;
      const decision: SourceValidationDecision = sourceRecord
        ? resolver.compare?.(memory, sourceRecord) ?? defaultSourceResolverDecision(memory, sourceRecord)
        : { status: "source_missing" as const, reason: resolver.fetch ? "live source resolver returned missing" : "source resolver returned no source record" };
      return this.applySourceResolverDecision(memory, sourceRef, decision);
    }
    return this.revalidateMemorySourceRefFallback(memory, sourceRef);
  }

  private revalidateMemorySourceRefFallback(
    memory: Memory,
    sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>
  ): SourceRevalidationResult {
    if (memory.metadata.verificationReason === "source_deleted" || memory.metadata.sourceDeletedAt) {
      const updated = this.store.update(memory.id, {
        beliefState: "needs_verification",
        temporal: { ...memory.temporal, verificationDueAt: memory.temporal.verificationDueAt ?? new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.85) },
        metadata: { sourceRevalidation: { status: "source_missing", at: new Date().toISOString(), reason: "source deleted" } }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "source_missing" } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "source_missing",
        reason: "source was deleted or detached",
        previousHash: sourceRef.hash,
        previousVersion: sourceRef.version
      };
    }

    const latest = this.latestSourceMemory(memory);
    const latestRef = latest?.provenance.sourceRef;
    const syncRecord = this.latestSourceSyncRecord(sourceRef);
    const hasNewerEvidence = latest && latest.id !== memory.id && sourceEvidenceTime(latest) >= sourceEvidenceTime(memory);
    if (hasNewerEvidence && latestRef && sourceRefChanged(sourceRef, latestRef)) {
      const validUntil = new Date(latest.temporal.eventAt ?? latest.createdAt).toISOString();
      const updated = this.store.update(memory.id, {
        beliefState: "superseded",
        temporal: { ...memory.temporal, validUntil, supersededAt: validUntil, verificationDueAt: undefined, stalenessRisk: 0 },
        metadata: {
          sourceRevalidation: {
            status: "superseded",
            at: new Date().toISOString(),
            sourceMemoryId: latest.id,
            reason: "sourceRef changed in newer connector evidence"
          },
          supersededBy: latest.id
        }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "superseded", sourceMemoryId: latest.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "superseded",
        reason: "newer connector evidence changed the source version or hash",
        sourceMemoryId: latest.id,
        syncRecordId: syncRecord?.id,
        previousHash: sourceRef.hash,
        currentHash: latestRef.hash,
        previousVersion: sourceRef.version,
        currentVersion: latestRef.version
      };
    }

    const failedRecord = this.latestConnectorSyncRecord(sourceRef.connectorId, "failed");
    if (failedRecord && (!syncRecord || new Date(failedRecord.timestamp).getTime() > new Date(syncRecord.timestamp).getTime())) {
      const updated = this.store.update(memory.id, {
        beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
        temporal: { ...memory.temporal, verificationDueAt: memory.temporal.verificationDueAt ?? new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.7) },
        metadata: { sourceRevalidation: { status: "needs_operator_review", at: new Date().toISOString(), reason: failedRecord.error ?? "latest connector sync failed", syncRecordId: failedRecord.id } }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "needs_operator_review", syncRecordId: failedRecord.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "needs_operator_review",
        reason: failedRecord.error ?? "latest connector sync failed",
        syncRecordId: failedRecord.id,
        previousHash: sourceRef.hash,
        previousVersion: sourceRef.version
      };
    }

    if (latest && (!latestRef || !sourceRefChanged(sourceRef, latestRef) || latest.id === memory.id || sourceEvidenceTime(latest) >= sourceEvidenceTime(memory))) {
      const updated = this.store.update(memory.id, {
        beliefState: memory.beliefState === "contradicted" ? "needs_verification" : "active",
        temporal: { ...memory.temporal, lastConfirmedAt: new Date().toISOString(), verificationDueAt: undefined, stalenessRisk: 0 },
        metadata: {
          sourceRevalidation: {
            status: memory.beliefState === "contradicted" ? "needs_operator_review" : "confirmed",
            at: new Date().toISOString(),
            sourceMemoryId: latest.id,
            syncRecordId: syncRecord?.id
          },
          verification: memory.beliefState === "contradicted"
            ? { status: "needs_operator_review", at: new Date().toISOString(), reason: "confirmed source exists but memory was contradicted" }
            : { status: "confirmed", at: new Date().toISOString(), reason: "sourceRef revalidation" }
        }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: memory.beliefState === "contradicted" ? "needs_operator_review" : "confirmed", sourceMemoryId: latest.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: memory.beliefState === "contradicted" ? "needs_operator_review" : "confirmed",
        reason: memory.beliefState === "contradicted" ? "source exists but contradiction still requires operator review" : "sourceRef matches current connector evidence",
        sourceMemoryId: latest.id,
        syncRecordId: syncRecord?.id,
        previousHash: sourceRef.hash,
        currentHash: latestRef?.hash ?? sourceRef.hash,
        previousVersion: sourceRef.version,
      currentVersion: latestRef?.version ?? sourceRef.version
      };
    }

    const updated = this.store.update(memory.id, {
      beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
      temporal: { ...memory.temporal, verificationDueAt: memory.temporal.verificationDueAt ?? new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.65) },
      metadata: { sourceRevalidation: { status: "needs_operator_review", at: new Date().toISOString(), reason: "no current connector evidence found", syncRecordId: syncRecord?.id } }
    });
    this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "needs_operator_review" } });
    return {
      memoryId: memory.id,
      connectorId: sourceRef.connectorId,
      externalId: sourceRef.externalId,
      status: "needs_operator_review",
      reason: "no current connector evidence found",
      syncRecordId: syncRecord?.id,
      previousHash: sourceRef.hash,
      previousVersion: sourceRef.version
    };
  }

  private applySourceResolverDecision(
    memory: Memory,
    sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>,
    decision: SourceValidationDecision
  ): SourceRevalidationResult {
    const now = new Date().toISOString();
    const sourceRecord = decision.sourceRecord;
    const status = decision.status;
    const nextBeliefState = decision.beliefState ?? (
      status === "confirmed" ? "active" :
        status === "source_updated" || status === "source_missing" || status === "needs_operator_review" ? "needs_verification" :
          status === "superseded" ? "superseded" :
            status === "contradicted" ? "contradicted" :
              memory.beliefState
    );
    const updated = this.store.update(memory.id, {
      beliefState: nextBeliefState,
      temporal: {
        ...memory.temporal,
        lastConfirmedAt: status === "confirmed" ? now : memory.temporal.lastConfirmedAt,
        verificationDueAt: status === "confirmed" ? undefined : memory.temporal.verificationDueAt ?? now,
        stalenessRisk: status === "confirmed" ? 0 : Math.max(memory.temporal.stalenessRisk ?? 0, status === "source_missing" ? 0.85 : 0.7)
      },
      metadata: {
        ...memory.metadata,
        sourceRevalidation: {
          status,
          at: now,
          reason: decision.reason,
          resolver: sourceRef.connectorId,
          sourceRecord: sourceRecord ? {
            version: sourceRecord.version,
            hash: sourceRecord.hash,
            updatedAt: sourceRecord.updatedAt,
            status: sourceRecord.status
          } : undefined
        }
      }
    });
    this.registerMemoryClaim(updated);
    this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status, resolver: sourceRef.connectorId, reason: decision.reason } });
    return {
      memoryId: memory.id,
      connectorId: sourceRef.connectorId,
      externalId: sourceRef.externalId,
      status,
      reason: decision.reason,
      previousHash: sourceRef.hash,
      currentHash: sourceRecord?.hash ?? sourceRecord?.sourceRef.hash,
      previousVersion: sourceRef.version,
      currentVersion: sourceRecord?.version ?? sourceRecord?.sourceRef.version
    };
  }

  private memoryMatchesDreamScope(memory: Memory, scope?: DreamCycleInput["scope"]): boolean {
    if (!scope) return true;
    if (scope.sessionId && memory.sessionId !== scope.sessionId) return false;
    if (scope.projectId && memory.projectId !== scope.projectId) return false;
    if (scope.orgId && memory.orgId !== scope.orgId) return false;
    if (scope.connectorId && memory.provenance.sourceRef?.connectorId !== scope.connectorId) return false;
    if (scope.repo) {
      const engineering = getEngineeringMetadata(memory);
      const repo = engineering?.codebase?.repo ?? engineering?.codebase?.repository ?? memory.projectId;
      if (repo !== scope.repo) return false;
    }
    if (scope.branch) {
      const branch = getEngineeringMetadata(memory)?.codebase?.branch ?? String(memory.metadata.branch ?? "");
      if (branch !== scope.branch) return false;
    }
    return true;
  }

  private latestSourceMemory(memory: Memory): Memory | undefined {
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) return undefined;
    return this.store.list(memory.userId)
      .filter((candidate) => !candidate.archivedAt)
      .filter((candidate) => sourceRefsMatch(sourceRef, candidate.provenance.sourceRef))
      .sort((a, b) => sourceEvidenceTime(b) - sourceEvidenceTime(a) || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  private latestSourceSyncRecord(sourceRef: Memory["provenance"]["sourceRef"]): ConnectorSyncRecord | undefined {
    if (!sourceRef?.connectorId) return undefined;
    return this.connectorSyncRecords
      .filter((record) => record.connectorId === sourceRef.connectorId && record.status === "applied")
      .filter((record) => !sourceRef.externalId || record.externalIds.includes(sourceRef.externalId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  private appendConnectorSyncRecord(record: ConnectorSyncRecord): ConnectorSyncRecord {
    this.connectorSyncRecords.push(record);
    this.updateConnectorSyncState(record);
    return record;
  }

  private updateConnectorSyncState(record: ConnectorSyncRecord): void {
    const existing = this.connectorSyncStates.get(record.connectorId);
    const payload = record.payload ?? {};
    const isSuccessfulPoll = record.direction === "ingest" && record.status === "applied";
    this.connectorSyncStates.set(record.connectorId, {
      connectorId: record.connectorId,
      cursor: firstString(payload.cursorAfter, payload.nextCursor, payload.cursor) ?? existing?.cursor,
      lastSuccessfulPollAt: isSuccessfulPoll ? record.timestamp : existing?.lastSuccessfulPollAt,
      lastExternalUpdatedAt: firstString(payload.lastExternalUpdatedAt) ?? existing?.lastExternalUpdatedAt,
      etag: firstString(payload.etag) ?? existing?.etag,
      sourceVersion: firstString(payload.sourceVersion) ?? existing?.sourceVersion,
      lastRecordId: record.id,
      lastStatus: record.status,
      records: this.connectorSyncRecords.filter((item) => item.connectorId === record.connectorId).length
    });
  }

  private latestConnectorSyncRecord(connectorId?: string, status?: ConnectorSyncRecord["status"]): ConnectorSyncRecord | undefined {
    if (!connectorId) return undefined;
    return this.connectorSyncRecords
      .filter((record) => record.connectorId === connectorId)
      .filter((record) => !status || record.status === status)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  private ensureScopedAccess(input: MemoryInput): void {
    if (input.sourceId) {
      const source = this.sources.get(input.sourceId);
      if (!source) throw new Error(`Source not found: ${input.sourceId}`);
      if (input.brainId && source.brainId !== input.brainId) throw new Error(`Source ${input.sourceId} is not part of brain ${input.brainId}`);
    }
    if (input.brainId) {
      const brain = this.brains.get(input.brainId);
      if (!brain) throw new Error(`Brain not found: ${input.brainId}`);
      const member = brain.ownerUserId === input.userId || brain.memberUserIds?.includes(input.userId);
      const agentAllowed = Boolean(input.agentId && (brain.allowedAgentIds?.includes(input.agentId) || this.agents.get(input.agentId)?.permissions.includes("admin")));
      if (!member && !agentAllowed && brain.visibility !== "public") throw new Error(`User ${input.userId} cannot write to brain ${input.brainId}`);
    }
    if (input.agentId) {
      const agent = this.agents.get(input.agentId);
      if (agent && input.brainId && !agent.brainIds.includes(input.brainId) && !agent.permissions.includes("admin")) {
        throw new Error(`Agent ${input.agentId} cannot write to brain ${input.brainId}`);
      }
    }
  }

  private accessibleBrainIds(options: SearchOptions): string[] {
    const agent = options.agentId ? this.agents.get(options.agentId) : undefined;
    return [...this.brains.values()]
      .filter((brain) => {
        if (brain.ownerUserId === options.userId || brain.memberUserIds?.includes(options.userId)) return true;
        if (agent?.brainIds.includes(brain.id)) return true;
        if (options.agentId && brain.allowedAgentIds?.includes(options.agentId)) return true;
        if (brain.visibility === "org") return Boolean(options.orgId && brain.orgId === options.orgId);
        return brain.visibility === "public";
      })
      .map((brain) => brain.id);
  }

  private canReviewSharedMemory(memory: Memory, reviewerId: string, orgId: string): boolean {
    if (reviewerId === memory.userId) return true;
    const brain = memory.brainId ? this.brains.get(memory.brainId) : undefined;
    if (brain?.ownerUserId === reviewerId) return true;
    if (brain?.orgId && brain.orgId !== orgId) return false;
    const agent = this.agents.get(reviewerId);
    if (!agent) return false;
    if (agent.permissions.includes("admin")) return true;
    if (!agent.permissions.includes("share")) return false;
    if (memory.brainId && !agent.brainIds.includes(memory.brainId) && !brain?.allowedAgentIds?.includes(agent.id)) return false;
    return !brain?.orgId || brain.orgId === orgId;
  }

  private personaForAgent(agentId: string): PersonaProfile | undefined {
    const agent = this.agents.get(agentId);
    return agent?.personaId ? this.personas.get(agent.personaId) : undefined;
  }

  private expandSearchQuery(options: SearchOptions): string[] | undefined {
    const explicit = options.queryExpansions ?? [];
    if (!options.expandQuery) return explicit.length ? explicit : undefined;
    const provider = this.defaultQueryExpander?.expand({
      query: options.query,
      userId: options.userId,
      now: options.now ?? new Date(),
      memories: this.store.list(options.userId).slice(0, 50)
    }) ?? [];
    const deterministic = deterministicQueryExpansions(options.query);
    const expansions = [...new Set([...explicit, ...provider, ...deterministic].map((item) => item.trim()).filter(Boolean))].filter((item) => item.toLowerCase() !== options.query.toLowerCase());
    return expansions.slice(0, 10);
  }

  private scheduleVerificationFromDream(userId: string): number {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let scheduled = 0;
    for (const memory of this.store.list(userId)) {
      if (memory.archivedAt || memory.pinned || memory.temporal.verificationDueAt) continue;
      const risk = memory.temporal.stalenessRisk ?? 0;
      if (memory.beliefState === "contradicted" || memory.beliefState === "needs_verification" || (risk >= 0.65 && memory.importance >= 0.5)) {
        this.store.update(memory.id, {
          beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
          temporal: { ...memory.temporal, verificationDueAt: dueAt },
          metadata: { verification: { status: "queued", at: new Date().toISOString(), reason: "dream belief revision" } }
        });
        scheduled += 1;
      }
    }
    return scheduled;
  }

  private restoreMemorySnapshot(snapshot: Memory): Memory {
    const restored = {
      ...snapshot,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(),
      lastAccessedAt: snapshot.lastAccessedAt ? new Date(snapshot.lastAccessedAt) : undefined,
      archivedAt: snapshot.archivedAt ? new Date(snapshot.archivedAt) : undefined
    };
    this.store.import([restored]);
    const memory = this.store.get(restored.id);
    this.entities.ingest(memory);
    return memory;
  }

  private applyOfflineOperation(operation: OfflineOperation): OfflineOperation {
    try {
      if (operation.type === "add") {
        if (!operation.input) return { ...operation, status: "failed", reason: "add operation requires input" };
        const memory = this.add({ ...operation.input, userId: operation.input.userId ?? operation.userId });
        return { ...operation, status: "applied", appliedMemoryId: memory.id, conflictResolution: "add_only" };
      }
      if (!operation.memoryId) return { ...operation, status: "failed", reason: `${operation.type} operation requires memoryId` };
      const current = safeGet(this.store, operation.memoryId);
      if (!current) return { ...operation, status: "conflict", conflictResolution: "manual_review", reason: "target memory was not found" };
      const occurredAt = new Date(operation.occurredAt).getTime();
      if (new Date(current.updatedAt).getTime() > occurredAt && operation.type !== "delete") {
        return { ...operation, status: "conflict", conflictResolution: "manual_review", reason: "server memory changed after offline operation" };
      }
      if (operation.type === "update") {
        this.update(operation.memoryId, operation.patch ?? {});
        return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "last_write_wins" };
      }
      if (operation.type === "consent") {
        this.updateConsent(operation.memoryId, operation.consent ?? {});
        return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "last_write_wins" };
      }
      this.delete(operation.memoryId);
      return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "delete_wins" };
    } catch (error) {
      return { ...operation, status: "failed", reason: error instanceof Error ? error.message : "unknown sync failure" };
    }
  }

  recordSecurityEvent(input: { actorId?: string; userId?: string; path: string; method: string; status: number; code: string }): AuditEvent {
    const event = this.recordAudit("policy.violation", {
      actorId: input.actorId,
      userId: input.userId,
      metadata: {
        resource: "http-auth",
        path: input.path,
        method: input.method,
        status: input.status,
        code: input.code
      }
    });
    this.persist();
    return event;
  }

  private recordAudit(type: AuditEvent["type"], event: Partial<AuditEvent>): AuditEvent {
    const saved = this.sealAuditEvent({
      id: `audit_${contentHash(`${type}:${Date.now()}:${this.auditEvents.length}`).slice(2)}`,
      type,
      timestamp: new Date().toISOString(),
      ...event
    });
    this.auditEvents.push(saved);
    this.storage.auditWrite(saved);
    for (const webhook of this.webhooks.values()) {
      if (webhook.disabledAt || !webhook.events.includes(type)) continue;
      this.webhookDeliveries.push({
        id: `delivery_${contentHash(`${webhook.id}:${saved.id}`).slice(2)}`,
        webhookId: webhook.id,
        eventId: saved.id,
        status: "queued",
        attempts: 0
      });
    }
    return saved;
  }

  private sealAuditEvent(event: AuditEvent, previousEvent = this.auditEvents.at(-1), sequence = this.auditEvents.length + 1): AuditJournalEvent {
    const journalType = event.journalType ?? canonicalAuditJournalType(event);
    const previousHash = event.previousHash ?? previousEvent?.hash;
    const unsigned = auditEventForHash({ ...event, journalType, sequence, previousHash });
    const payloadHash = contentHash(stableStringify(unsigned));
    const hash = contentHash(stableStringify({
      id: event.id,
      type: event.type,
      journalType,
      sequence,
      previousHash,
      payloadHash
    }));
    return {
      ...event,
      journalType,
      sequence,
      previousHash,
      payloadHash,
      hash
    };
  }

  private rebuildAuditChain(events: AuditEvent[]): AuditJournalEvent[] {
    const rebuilt: AuditJournalEvent[] = [];
    for (const [index, event] of events.entries()) {
      rebuilt.push(this.sealAuditEvent(event, rebuilt.at(-1), index + 1));
    }
    return rebuilt;
  }

  private toJournalEvent(event: AuditEvent): AuditJournalEvent {
    if (event.journalType && event.sequence && event.hash && event.payloadHash) return event as AuditJournalEvent;
    return this.rebuildAuditChain([event])[0];
  }

  private replayAuditEvents(events: AuditJournalEvent[]): AuditChainExport["replay"] {
    const memories: AuditChainExport["replay"]["memories"] = {};
    const contextPacks: AuditChainExport["replay"]["contextPacks"] = {};
    const denied: AuditChainExport["replay"]["denied"] = [];
    const connectorEvents: AuditChainExport["replay"]["connectorEvents"] = [];
    const dreamEvents: AuditChainExport["replay"]["dreamEvents"] = [];
    const errors: string[] = [];
    let previous: AuditJournalEvent | undefined;

    for (const event of events) {
      const expectedPayloadHash = contentHash(stableStringify(auditEventForHash(event)));
      const expectedHash = contentHash(stableStringify({
        id: event.id,
        type: event.type,
        journalType: event.journalType,
        sequence: event.sequence,
        previousHash: event.previousHash,
        payloadHash: expectedPayloadHash
      }));
      if (event.payloadHash !== expectedPayloadHash) errors.push(`payload hash mismatch for ${event.id}`);
      if (event.hash !== expectedHash) errors.push(`chain hash mismatch for ${event.id}`);
      if (previous && event.sequence === previous.sequence + 1 && event.previousHash !== previous.hash) errors.push(`previous hash mismatch for ${event.id}`);

      if (event.memoryId && event.journalType.startsWith("memory.")) {
        const current = memories[event.memoryId] ?? {
          exists: false,
          archived: false,
          retracted: false,
          superseded: false,
          userId: event.userId,
          brainId: event.brainId,
          sourceId: event.sourceId,
          lastEventId: event.id,
          lastHash: event.hash,
          versions: 0
        };
        memories[event.memoryId] = applyMemoryJournalEvent(current, event);
      }

      if (event.journalType === "context_pack.created") {
        const contextPackId = typeof event.metadata?.contextPackId === "string" ? event.metadata.contextPackId : event.id;
        contextPacks[contextPackId] = {
          createdAt: event.timestamp,
          query: typeof event.metadata?.query === "string" ? event.metadata.query : undefined,
          memoryCount: typeof event.metadata?.memories === "number" ? event.metadata.memories : undefined,
          hash: event.hash
        };
      }

      if (event.journalType === "policy.denied") {
        denied.push({
          eventId: event.id,
          operation: event.metadata?.operation,
          memoryId: event.memoryId,
          reason: typeof event.metadata?.reason === "string" ? event.metadata.reason : undefined
        });
      }
      if (event.journalType === "connector.ingested") {
        connectorEvents.push({ eventId: event.id, connectorId: event.metadata?.connectorId, status: event.metadata?.status, hash: event.hash });
      }
      if (event.journalType === "dream.action") {
        dreamEvents.push({ eventId: event.id, action: event.metadata?.action ?? event.metadata?.resource, hash: event.hash });
      }
      previous = event;
    }

    return {
      valid: errors.length === 0,
      eventsApplied: events.length,
      memories,
      contextPacks,
      denied,
      connectorEvents,
      dreamEvents,
      errors
    };
  }

  private recanonicalizeMemory(memory: Memory): void {
    const entities = [...new Set(memory.entities.map((entity) => this.entities.canonicalize(entity)).filter(Boolean))];
    const relations = memory.relations.map((relation) => ({
      ...relation,
      sourceEntity: relation.sourceEntity ? this.entities.canonicalize(relation.sourceEntity) : relation.sourceEntity,
      targetEntity: relation.targetEntity ? this.entities.canonicalize(relation.targetEntity) : relation.targetEntity
    }));
    this.store.update(memory.id, { entities, relations });
  }

  private applyDomainEnrichment(input: MemoryInput): MemoryInput {
    const modules = [
      ...(this.domainModule ? [this.domainModule] : []),
      ...this.listMarketplaceModules()
        .filter((module) => module.kind === "domain" && module.installState === "installed")
        .map((module) => DOMAIN_MODULES.find((domain) => domain.id === (module.manifest as { id?: string }).id))
        .filter((domain): domain is DomainModule => Boolean(domain))
    ];
    return modules.reduce((current, domain) => domain.enrich ? domain.enrich(current) : current, input);
  }

  private memoriesDeniedForOperation(userId: string, operation: MemoryPolicyOperation): PolicyDecision[] {
    return this.store.list(userId)
      .filter((memory) => !memory.archivedAt)
      .map((memory) => this.evaluatePolicy(operation, memory, { userId }))
      .filter((decision) => !decision.allowed);
  }

  private blockedReflectionReport(userId: string, operation: "reflect" | "dream", blocked: PolicyDecision[]) {
    this.recordAudit("policy.violation", { userId, metadata: { operation, denied: blocked.length, decisions: blocked } });
    this.persist();
    return {
      created: [],
      demoted: [],
      contradictions: [],
      lifecycle: {
        evaluated: blocked.length,
        summarized: 0,
        faded: 0,
        archived: 0,
        reorganized: 0,
        qualityScore: 1,
        issues: [`${operation} blocked by policy for ${blocked.length} memories`],
        actions: blocked.map((decision) => `policy blocked ${operation} for ${decision.memoryId ?? "memory"}`)
      }
    };
  }

  importMemoryFile(raw: PersistedMemoryFile, options: { persist?: boolean } = {}): void {
    this.maintenance = raw.maintenance ?? { users: {} };
    this.metrics = raw.metrics ?? this.metrics;
    this.feedbackEvents = raw.feedback ?? [];
    this.claims = new Map((raw.claims ?? []).map((claim) => [claim.id, claim]));
    this.conflictSets = new Map((raw.conflictSets ?? []).map((conflictSet) => [conflictSet.id, conflictSet]));
    this.episodes = new Map((raw.episodes ?? []).map((episode) => [episode.id, episode]));
    this.retrievalProfiles = new Map((raw.retrievalProfiles ?? []).map((profile) => [profile.id, profile]));
    if (!this.retrievalProfiles.has("default")) {
      this.retrievalProfiles.set("default", {
        id: "default",
        label: "Default benchmark profile",
        weights: normalizeRetrievalWeights(),
        updatedAt: new Date().toISOString(),
        provenance: "migration"
      });
    }
    this.identities.import(raw.identityLinks ?? []);
    this.domainEvaluations = raw.domainEvaluations ?? [];
    this.entities.import(raw.entityRecords ?? []);
    this.trainingSamples = raw.trainingSamples ?? [];
    this.brains = new Map((raw.brains ?? []).map((brain) => [brain.id, brain]));
    this.sources = new Map((raw.sources ?? []).map((source) => [source.id, source]));
    this.agents = new Map((raw.agents ?? []).map((agent) => [agent.id, agent]));
    this.personas = new Map((raw.personas ?? []).map((persona) => [persona.id, persona]));
    this.auditEvents = this.rebuildAuditChain(raw.auditEvents ?? []);
    this.webhooks = new Map((raw.webhooks ?? []).map((webhook) => [webhook.id, webhook]));
    this.webhookDeliveries = raw.webhookDeliveries ?? [];
    this.marketplaceModules = new Map([...officialMarketplaceModules(), ...(raw.marketplaceModules ?? [])].map((module) => [module.id, module]));
    this.marketplaceSubmissions = new Map((raw.marketplaceSubmissions ?? []).map((submission) => [submission.id, submission]));
    this.managedTenants = new Map((raw.managedTenants ?? []).map((tenant) => [tenant.id, tenant]));
    this.offlineOperations = raw.offlineOperations ?? [];
    for (const manifest of raw.connectorManifests ?? []) this.connectorManifests.set(manifest.id, manifest);
    this.connectorAuthSessions = new Map((raw.connectorAuthSessions ?? []).map((session) => [session.id, session]));
    this.connectorSyncRecords = raw.connectorSyncRecords ?? [];
    this.connectorSyncStates = new Map((raw.connectorSyncStates ?? []).map((state) => [state.connectorId, state]));
    this.dreamJobs = new Map((raw.dreamJobs ?? []).map((job) => [job.jobId, job]));
    this.evidencePacks = new Map((raw.evidencePacks ?? []).map((pack) => [pack.id, pack]));
    this.policyRules = new Map((raw.policyRules ?? []).map((rule) => [rule.id, rule]));
    this.retentionRules = new Map((raw.retentionRules ?? []).map((rule) => [rule.id, rule]));
    this.repository.import(raw.memories ?? []);
    this.syncReadModelFromRepository();
    for (const memory of this.store.list()) this.entities.ingest(memory);
    if (!this.claims.size) for (const memory of this.store.list()) this.registerMemoryClaim(memory);
    if (options.persist !== false) this.persist();
  }

  private load(): void {
    const raw = this.persistence?.load() ?? this.loadRepositoryState();
    if (!raw) {
      this.syncReadModelFromRepository();
      if (!this.claims.size) for (const memory of this.store.list()) this.registerMemoryClaim(memory);
      return;
    }
    if (Array.isArray(raw)) {
      this.repository.import(raw);
      this.syncReadModelFromRepository();
      return;
    }
    this.importMemoryFile(raw, { persist: false });
  }

  private syncReadModelFromRepository(): void {
    if (this.repository instanceof InMemoryMemoryRepository) return;
    if ((this.repository as { store?: unknown }).store === this.store) return;
    this.store.clear();
    this.store.import(this.repository.export());
  }

  private repositorySharesReadModel(): boolean {
    return this.repository instanceof InMemoryMemoryRepository || (this.repository as { store?: unknown }).store === this.store;
  }

  private persist(): void {
    const memories = this.store.export();
    if (!this.repositorySharesReadModel()) {
      this.repository.import(memories);
    }
    const payload: PersistedMemoryFile = {
      version: 2,
      memories,
      episodes: [...this.episodes.values()],
      maintenance: this.maintenance,
      metrics: this.metrics,
      feedback: this.feedbackEvents,
      claims: [...this.claims.values()],
      conflictSets: [...this.conflictSets.values()],
      retrievalProfiles: [...this.retrievalProfiles.values()],
      identityLinks: this.identities.export(),
      domainEvaluations: this.domainEvaluations,
      entityRecords: this.entities.export(),
      trainingSamples: this.trainingSamples,
      brains: [...this.brains.values()],
      sources: [...this.sources.values()],
      agents: [...this.agents.values()],
      personas: [...this.personas.values()],
      auditEvents: this.auditEvents,
      webhooks: [...this.webhooks.values()],
      webhookDeliveries: this.webhookDeliveries,
      marketplaceModules: [...this.marketplaceModules.values()],
      marketplaceSubmissions: [...this.marketplaceSubmissions.values()],
      managedTenants: [...this.managedTenants.values()],
      offlineOperations: this.offlineOperations,
      connectorManifests: [...this.connectorManifests.values()],
      connectorAuthSessions: [...this.connectorAuthSessions.values()],
      connectorSyncRecords: this.connectorSyncRecords,
      connectorSyncStates: [...this.connectorSyncStates.values()],
      dreamJobs: [...this.dreamJobs.values()],
      evidencePacks: [...this.evidencePacks.values()],
      policyRules: [...this.policyRules.values()],
      retentionRules: [...this.retentionRules.values()]
    };
    if (this.persistence) this.persistence.save(payload);
    else this.saveRepositoryState(payload);
  }

  private loadRepositoryState(): PersistedMemoryFile | Memory[] | undefined {
    const state = (this.repository as MemoryRepository & RepositoryStatePersistence).loadState?.();
    if (!state) return undefined;
    if (Array.isArray(state)) return state as Memory[];
    return state as PersistedMemoryFile;
  }

  private saveRepositoryState(payload: PersistedMemoryFile): void {
    (this.repository as MemoryRepository & RepositoryStatePersistence).saveState?.(payload);
  }

  private defaultKeyring(): DecryptionKeyMaterial[] {
    const key = this.redactionPolicy.encryptionKey ?? process.env.MEMORY_ENCRYPTION_KEY;
    if (!key || key.length < 16) return [];
    return [{
      key,
      keyId: this.redactionPolicy.encryptionKeyId ?? process.env.MEMORY_ENCRYPTION_KEY_ID,
      keyVersion: this.redactionPolicy.encryptionKeyVersion ?? process.env.MEMORY_ENCRYPTION_KEY_VERSION
    }];
  }
}

export function createDefaultMemoryService() {
  const persistencePath = process.env.NODE_ENV === "test" ? undefined : process.env.MEMORY_DB_PATH ?? ".memory-harness.json";
  const autoDreamEnabled = process.env.MEMORY_AUTO_DREAM !== "false";
  const repository = persistencePath ? createRepositoryFromEnv(persistencePath) : undefined;
  const storageBackend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  const sqliteBackend = storageBackend === "sqlite" || storageBackend === "sql" || storageBackend === "sqlite-repository";
  return new MemoryService({
    repository,
    persistence: persistencePath && !repository ? (sqliteBackend ? new JsonFilePersistenceAdapter(persistencePath) : createPersistenceFromEnv(persistencePath)) : undefined,
    autoDream: {
      enabled: autoDreamEnabled,
      intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
      writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
    },
    configPath: process.env.MEMORY_CONFIG_PATH,
    redactionPolicy: {
      mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE),
      encryptionKey: process.env.MEMORY_ENCRYPTION_KEY,
      encryptionKeyId: process.env.MEMORY_ENCRYPTION_KEY_ID,
      encryptionKeyVersion: process.env.MEMORY_ENCRYPTION_KEY_VERSION
    }
  });
}

export async function createProductionMemoryService() {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if ((backend === "postgres-async" || backend === "postgres-production" || backend === "postgres-db-primary") && process.env.MEMORY_POSTGRES_URL) {
    const asyncRepository = new AsyncPostgresMemoryRepository(process.env.MEMORY_POSTGRES_URL, { enableRls: process.env.MEMORY_POSTGRES_RLS === "true" });
    await asyncRepository.initialize();
    const loadedState = await asyncRepository.loadStateAsync();
    const service = createDefaultMemoryService();
    Object.defineProperty(service, "productionAsyncRepository", { value: asyncRepository, enumerable: false });
    if (loadedState && typeof loadedState === "object" && !Array.isArray(loadedState)) {
      service.importMemoryFile(loadedState as PersistedMemoryFile);
    }
    return service;
  }
  return createDefaultMemoryService();
}

export let defaultService = createDefaultMemoryService();

export async function initializeDefaultMemoryService(): Promise<MemoryService> {
  defaultService = await createProductionMemoryService();
  return defaultService;
}
