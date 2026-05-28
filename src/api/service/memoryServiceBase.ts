import { COGNIBRAIN_VERSION, EntityRegistry, IdentityResolver, InMemoryMemoryRepository, JsonFilePersistenceAdapter, MemoryStore, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, claimStateForMemory, compactLiveSourceContent, contentDigest, createRepositoryFromEnv, defaultSourceResolverDecision, liveSourceVersion, loadRuntimeConfig, memoryStoreForRepository, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeRetrievalWeights, officialConnectorManifests, officialMarketplaceModules, providerFromEnv, redactionModeFromEnv, repositoryFromStorage, sourceRefMatchesVendorItem, stringFromCandidate, syntheticEventForMemory } from './memoryServiceDeps';
import type { AgentRegistration, AuditEvent, Brain, ClaimRecord, CodingContextPack, ConflictSet, ConnectorAuthSession, ConnectorListResult, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, DecryptionKeyMaterial, DomainEvaluationReport, DomainModule, DreamJob, EngineeringMemoryClassifier, EntityRegistry as EntityRegistryType, EpisodeRecord, EvidencePack, FeedbackEvent, LifecyclePolicy, ManagedTenant, MarketplaceModule, MarketplaceSubmission, MemoryExtractor, MemoryMaintenanceStatus, MemoryPersistenceAdapter, MemoryPolicyRule, MemoryRepository, MemoryServiceOptions, MemorySource, MemoryStorageAdapter, MetricsReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, QueryExpander, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RetentionRule, RetrievalProfile, RetrievalTrainingSample, SearchOptions, SourceResolver, TranslationProvider, WebhookDelivery, WebhookRegistration } from './memoryServiceDeps';

export class MemoryServiceBase {
  [key: string]: any;
  readonly repository: MemoryRepository;
  readonly store: MemoryStore;
  readonly storage: MemoryStorageAdapter;
  readonly retrieval: RetrievalEngine;
  readonly reflection: ReflectionEngine;
  readonly identities = new IdentityResolver();
  readonly entities: EntityRegistry;

  protected readonly persistence?: MemoryPersistenceAdapter;
  protected readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  protected readonly redactionPolicy: RedactionPolicy;
  protected readonly domainModule?: DomainModule;
  protected readonly sourceQuality: Record<string, number>;
  protected maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  protected feedbackEvents: FeedbackEvent[] = [];
  protected claims = new Map<string, ClaimRecord>();
  protected conflictSets = new Map<string, ConflictSet>();
  protected retrievalProfiles = new Map<string, RetrievalProfile>();
  protected domainEvaluations: DomainEvaluationReport[] = [];
  protected trainingSamples: RetrievalTrainingSample[] = [];
  protected episodes = new Map<string, EpisodeRecord>();
  protected brains = new Map<string, Brain>();
  protected sources = new Map<string, MemorySource>();
  protected agents = new Map<string, AgentRegistration>();
  protected personas = new Map<string, PersonaProfile>();
  protected auditEvents: AuditEvent[] = [];
  protected webhooks = new Map<string, WebhookRegistration>();
  protected webhookDeliveries: WebhookDelivery[] = [];
  protected marketplaceModules = new Map<string, MarketplaceModule>();
  protected marketplaceSubmissions = new Map<string, MarketplaceSubmission>();
  protected managedTenants = new Map<string, ManagedTenant>();
  protected offlineOperations: OfflineOperation[] = [];
  protected connectorManifests = new Map<string, ConnectorManifest>();
  protected connectorAuthSessions = new Map<string, ConnectorAuthSession>();
  protected connectorSyncRecords: ConnectorSyncRecord[] = [];
  protected connectorSyncStates = new Map<string, ConnectorSyncState>();
  protected sourceResolvers = new Map<string, SourceResolver>();
  protected dreamJobs = new Map<string, DreamJob>();
  protected evidencePacks = new Map<string, EvidencePack>();
  protected codingContextPacks = new Map<string, CodingContextPack>();
  protected patchEvidenceTrails = new Map<string, PatchEvidenceTrail>();
  protected policyRules = new Map<string, MemoryPolicyRule>();
  protected retentionRules = new Map<string, RetentionRule>();
  protected searchEvents: Array<{
    timestamp: string;
    userId: string;
    sessionId?: string;
    projectId?: string;
    resultCount: number;
    lowConfidence: boolean;
    queryHash: string;
  }> = [];
  protected metrics: MetricsReport = {
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
  protected dreaming = false;

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
      summarizer: provider.summarizer,
      evaluator: provider.evaluator
    });
    this.defaultReranker = provider.reranker;
    this.defaultVerifier = provider.verifier;
    this.defaultExtractor = provider.extractor;
    this.defaultSummarizer = provider.summarizer;
    this.defaultQueryExpander = provider.queryExpander;
    this.defaultTranslator = provider.translator;
    this.defaultEngineeringClassifier = provider.engineeringClassifier;
    for (const manifest of officialConnectorManifests()) this.connectorManifests.set(manifest.id, manifest);
    for (const module of officialMarketplaceModules()) this.marketplaceModules.set(module.id, module);
    this.registerDefaultSourceResolvers();
    this.load();
  }

  protected readonly defaultReranker?: SearchOptions["reranker"];
  protected readonly defaultVerifier?: SearchOptions["verifier"];
  protected readonly defaultExtractor?: MemoryExtractor;
  protected readonly defaultSummarizer?: ReflectionSummarizer;
  protected readonly defaultQueryExpander?: QueryExpander;
  protected readonly defaultTranslator?: TranslationProvider;
  protected readonly defaultEngineeringClassifier?: EngineeringMemoryClassifier;
}
