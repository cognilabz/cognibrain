import { createHmac } from "node:crypto";
import {
  externalVendorConfigured,
  externalVendorProvider,
  listExternalVendorItems,
  pollExternalVendorConnector,
  shouldUseExternalVendor,
  writebackExternalVendorConnector
} from "../connectors/vendorConnectors";
import { applyRedactionPolicy, decryptMemoryContent, type DecryptionKeyMaterial, type RedactionPolicy } from "../core/privacy";
import { createJsonCommandIntelligenceFromEnv } from "../core/providers";
import { loadRuntimeConfig } from "../core/runtimeConfig";
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
  InMemoryStorageAdapter,
  inferGraphRelations,
  MemoryStore,
  normalizeLifecyclePolicy,
  normalizeRetrievalWeights,
  queryMemoryGraph,
  runDomainEvaluation,
  DOMAIN_MODULES,
  ReflectionEngine,
  RetrievalEngine,
  withEngineeringMemoryMetadata,
  type LifecyclePolicy,
  type DomainModule,
  type MemoryStorageAdapter
} from "../core";
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
  EnrichmentCandidate,
  ActionGuardReport,
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

export interface MemoryServiceOptions {
  persistencePath?: string;
  persistence?: MemoryPersistenceAdapter;
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

type ConnectorWritebackOperation = NonNullable<ConnectorSyncRecord["operation"]>;

interface ConnectorWritebackInput {
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

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

export class MemoryService {
  readonly store = new MemoryStore();
  readonly storage: MemoryStorageAdapter = new InMemoryStorageAdapter(this.store);
  readonly retrieval: RetrievalEngine;
  readonly reflection: ReflectionEngine;
  readonly identities = new IdentityResolver();
  readonly entities: EntityRegistry;

  private readonly persistence?: MemoryPersistenceAdapter;
  private readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  private readonly redactionPolicy: RedactionPolicy;
  private readonly domainModule?: DomainModule;
  private maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  private feedbackEvents: FeedbackEvent[] = [];
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
    this.persistence = options.persistence ?? (options.persistencePath ? new JsonFilePersistenceAdapter(options.persistencePath) : undefined);
    this.autoDream = {
      enabled: options.autoDream?.enabled ?? false,
      intervalHours: options.autoDream?.intervalHours ?? 6,
      writeThreshold: options.autoDream?.writeThreshold ?? 12
    };
    this.domainModule = options.domainModule;
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
    this.load();
  }

  private readonly defaultReranker?: SearchOptions["reranker"];
  private readonly defaultVerifier?: SearchOptions["verifier"];
  private readonly defaultExtractor?: MemoryExtractor;
  private readonly defaultSummarizer?: ReflectionSummarizer;
  private readonly defaultQueryExpander?: QueryExpander;
  private readonly defaultTranslator?: TranslationProvider;

  add(input: MemoryInput) {
    const sourceDefaultConsent = input.sourceId ? this.sources.get(input.sourceId)?.defaultConsent : undefined;
    const agentPersona = input.agentId ? this.personaForAgent(input.agentId) : undefined;
    const personaConsent = agentPersona?.privacyDefault ? { visibility: agentPersona.privacyDefault } : undefined;
    const scopedInput = { ...input, consent: { ...personaConsent, ...sourceDefaultConsent, ...(input.consent ?? {}) } };
    const enriched = this.applyDomainEnrichment(scopedInput);
    const engineeringized = withEngineeringMemoryMetadata(enriched);
    const proceduralized = withProceduralMetadata(engineeringized);
    this.ensureScopedAccess(proceduralized);
    const writeDecision = this.evaluatePolicy("write", proceduralized);
    if (!writeDecision.allowed) {
      this.recordAudit("policy.violation", { userId: proceduralized.userId, brainId: proceduralized.brainId, sourceId: proceduralized.sourceId, metadata: { operation: "write", decision: writeDecision } });
      throw new Error(`Memory write denied by policy: ${writeDecision.reasons.join("; ")}`);
    }
    const checked = applyRedactionPolicy(proceduralized, this.redactionPolicy);
    if (checked.rejected || !checked.input) {
      throw new Error(`Memory rejected by redaction policy: ${checked.matches.map((match) => match.detector).join(", ")}`);
    }
    const memory = this.entities.ingest(this.storage.create(checked.input));
    if (memory.metadata.archivedOnWrite) this.storage.archive(memory.id);
    this.metrics.memoriesAdded += 1;
    this.recordAudit("memory.write", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    this.afterWrite(memory.userId);
    return memory;
  }

  createEpisode(input: EpisodeInput): EpisodeRecord {
    const now = new Date().toISOString();
    const hash = contentHash(JSON.stringify({ scope: input.scope, events: input.events, toolCalls: input.toolCalls ?? [], filesTouched: input.filesTouched ?? [] }));
    const episode: EpisodeRecord = {
      id: `ep_${hash.slice(2, 14)}`,
      userId: input.scope.userId,
      scope: input.scope,
      rawConversation: input.events,
      toolCalls: input.toolCalls ?? input.events.filter((event) => event.role === "tool").map((event) => ({ name: event.metadata?.toolName as string | undefined, output: event.content, timestamp: event.timestamp })),
      filesTouched: input.filesTouched ?? input.events.flatMap((event) => Array.isArray(event.metadata?.filesTouched) ? event.metadata.filesTouched.filter((item): item is string => typeof item === "string") : []),
      source: input.source ?? input.events.find((event) => event.source)?.source,
      hash,
      memoryIds: [],
      createdAt: now
    };
    this.episodes.set(episode.id, episode);
    this.recordAudit("memory.write", { userId: episode.userId, brainId: episode.scope.brainId, sourceId: episode.scope.sourceId, metadata: { resource: "episode", episodeId: episode.id, events: episode.rawConversation.length } });
    this.persist();
    return episode;
  }

  listEpisodes(userId?: string): EpisodeRecord[] {
    return [...this.episodes.values()].filter((episode) => !userId || episode.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getEpisode(id: string): EpisodeRecord {
    const episode = this.episodes.get(id);
    if (!episode) throw new Error(`Episode not found: ${id}`);
    return episode;
  }

  extract(
    events: MemoryExtractionEvent[],
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "deviceId" | "runId">
  ): ExtractionReport {
    const normalizedEvents = events.map(normalizeMediaExtractionEvent);
    const episode = this.createEpisode({ scope: scope as MemoryScope, events: normalizedEvents });
    const existing = this.store.list(scope.userId);
    const failures = ruleExtractionFailures(normalizedEvents);
    const ruleInputs = extractAddOnlyMemories(normalizedEvents, scope).map((input) => markExtractionStage(input, "rules"));
    const needsProvider = Boolean(this.defaultExtractor && (ruleInputs.length === 0 || failures.length > 0 || normalizedEvents.some((event) => event.mediaType && !["text", "code", "document"].includes(event.mediaType) && !hasLocalMediaExtraction(event))));
    const providerInputs = needsProvider ? this.defaultExtractor?.extract({ events: normalizedEvents, scope, existing, now: new Date() }).map((input) => markExtractionStage({ ...scope, ...input }, "provider")) ?? [] : [];
    const stages: ExtractionReport["stages"] = [
      { stage: "rules", inputEvents: normalizedEvents.length, extracted: ruleInputs.length, confidence: extractionConfidence(normalizedEvents, ruleInputs.length), reason: "single-pass add-only rules" },
      ...(needsProvider
        ? [{ stage: "provider" as const, inputEvents: normalizedEvents.length, extracted: providerInputs.length, confidence: providerInputs.length ? 0.78 : 0.2, reason: providerInputs.length ? "fallback extractor produced candidate memories" : "fallback extractor returned no candidates" }]
        : [])
    ];
    const claims: MemoryClaim[] = [];
    const durabilityDecisions: DurabilityDecision[] = [];
    const classifiedInputs = [...ruleInputs, ...providerInputs].flatMap((input) => {
      const event = syntheticExtractionEvent(input);
      const claim = (input.metadata?.claim as MemoryClaim | undefined) ?? extractClaim(input.content, event, scope, input.source, input.entities ?? []);
      const decision = (input.metadata?.durabilityDecision as DurabilityDecision | undefined) ?? classifyDurability(input.content, event, claim);
      claims.push(claim);
      durabilityDecisions.push(decision);
      if (decision.action === "ignore" || decision.action === "ask_user") return [];
      const next: MemoryInput = {
        ...input,
        layer: decision.action === "session_only" || decision.action === "working_memory" ? "working" as const : input.layer,
        tags: decision.action === "session_only" || decision.action === "working_memory" ? [...(input.tags ?? []), "session-only"] : input.tags,
        metadata: { ...(input.metadata ?? {}), claim, durabilityDecision: decision }
      };
      return [next];
    });
    const existingHashes = new Set(existing.map((memory) => memory.metadata.contentHash).filter(Boolean));
    const seenHashes = new Set<string>();
    const inputs = classifiedInputs.filter((input) => {
      const hash = contentHash(`${input.content}:${input.source?.kind ?? ""}:${input.timestamp ?? ""}`);
      input.metadata = { ...(input.metadata ?? {}), contentHash: hash, episodeId: episode.id };
      if (existingHashes.has(hash) || seenHashes.has(hash)) return false;
      seenHashes.add(hash);
      return true;
    });
    const memories = inputs.map((input) => this.add(linkStateChange(input, this.store.list(scope.userId))));
    for (const memory of memories) this.applySupersession(memory);
    this.episodes.set(episode.id, { ...episode, memoryIds: memories.map((memory) => memory.id) });
    this.persist();
    const enrichmentCandidates = enrichmentCandidatesFor(this.store.list(scope.userId));
    const learnedRules = learnedRuleSuggestions(normalizedEvents, failures);
    stages.push({
      stage: "enrichment",
      inputEvents: normalizedEvents.length,
      extracted: enrichmentCandidates.length,
      confidence: enrichmentCandidates.length ? 0.72 : 1,
      reason: enrichmentCandidates.length ? "entity attention threshold produced candidates" : "no entity crossed enrichment threshold"
    });
    this.recordAudit("extract.run", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { events: normalizedEvents.length, memories: memories.length, claims: claims.length, durabilityDecisions, stages, failures: failures.length, learnedRules: learnedRules.length } });
    const entityLinks: Record<string, string[]> = {};
    for (const memory of memories) {
      for (const entity of memory.entities) {
        entityLinks[entity] ??= [];
        entityLinks[entity].push(memory.id);
      }
    }
    return { memories, entityLinks, stages, failures, claims, durabilityDecisions, enrichmentCandidates, learnedRules };
  }

  list(userId?: string) {
    return this.storage.list(userId);
  }

  get(id: string) {
    return this.storage.get(id);
  }

  update(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }) {
    const before = this.storage.get(id);
    const memory = this.storage.update(id, patch);
    this.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before, after: memory } });
    this.afterWrite(memory.userId);
    return memory;
  }

  archive(id: string) {
    const before = this.storage.get(id);
    const memory = this.storage.archive(id);
    this.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", before, after: memory } });
    this.afterWrite(memory.userId);
    return memory;
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
      this.recordAudit("memory.update", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { action: "superseded", supersededBy: memory.id } });
    }
  }

  delete(id: string) {
    const memory = this.storage.get(id);
    const deleted = this.storage.delete(id);
    if (deleted) this.recordAudit("memory.delete", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before: memory } });
    if (deleted) this.afterWrite(memory.userId);
    return deleted;
  }

  search(options: SearchOptions) {
    const intent = this.classifyQueryIntent(options.query);
    const effectiveOptions = { ...options, mode: options.mode ?? intent.recommendedMode };
    this.enforceRetention(new Date(), effectiveOptions.userId);
    const persona = effectiveOptions.agentId ? this.personaForAgent(effectiveOptions.agentId) : undefined;
    const personaProfile = persona?.retrievalWeights
      ? {
          id: `persona:${persona.id}`,
          label: persona.label,
          weights: normalizeRetrievalWeights(persona.retrievalWeights),
          scope: { agentId: effectiveOptions.agentId },
          updatedAt: persona.updatedAt,
          provenance: "persona"
        }
      : undefined;
    const profile = effectiveOptions.profileId ? this.retrievalProfiles.get(effectiveOptions.profileId) : personaProfile ?? this.profileFor(effectiveOptions);
    const linkedUserIds = effectiveOptions.includeLinkedIdentities ? this.identities.resolve(effectiveOptions.userId).filter((id) => id !== effectiveOptions.userId) : [];
    const accessibleBrainIds = this.accessibleBrainIds(effectiveOptions);
    const requestedBrainIds = effectiveOptions.brainIds ?? (effectiveOptions.brainId ? [effectiveOptions.brainId] : undefined);
    const federatedBrainIds = effectiveOptions.includeSharedBrains
      ? (requestedBrainIds ? requestedBrainIds.filter((brainId) => accessibleBrainIds.includes(brainId)) : accessibleBrainIds)
      : effectiveOptions.brainIds;
    const queryExpansions = this.expandSearchQuery(effectiveOptions);
    const rawResults = this.retrieval.search({
      ...effectiveOptions,
      brainIds: federatedBrainIds,
      linkedUserIds,
      queryExpansions,
      weights: options.weights ?? profile?.weights ?? intent.recommendedWeights,
      reranker: effectiveOptions.reranker ?? this.defaultReranker,
      verifier: effectiveOptions.verifier ?? this.defaultVerifier,
      lexicalProvider: effectiveOptions.lexicalProvider ?? this.lexicalProviderForPersistence()
    });
    const plannedResults = rawResults.map((result) => ({ ...result, queryPlan: intent.plan }));
    const denied: PolicyDecision[] = [];
    const results = plannedResults.filter((result) => {
      const decision = this.evaluatePolicy("retrieve", result.memory, { userId: effectiveOptions.userId, orgId: effectiveOptions.orgId, agentId: effectiveOptions.agentId });
      if (decision.allowed) return true;
      denied.push(decision);
      return false;
    });
    this.metrics.searches += 1;
    this.metrics.noHitSearches += results.length === 0 ? 1 : 0;
    this.metrics.lowConfidenceSearches = (this.metrics.lowConfidenceSearches ?? 0) + (results.some((result) => result.decision === "warn" || result.decision === "review") ? 1 : 0);
    this.metrics.averageSearchResults = rollingAverage(this.metrics.averageSearchResults, results.length, this.metrics.searches);
    this.recordSessionMetrics(effectiveOptions, results.length);
    this.searchEvents.push({
      timestamp: new Date().toISOString(),
      userId: effectiveOptions.userId,
      sessionId: effectiveOptions.sessionId,
      projectId: effectiveOptions.projectId,
      resultCount: results.length,
      lowConfidence: results.some((result) => result.decision === "warn" || result.decision === "review"),
      queryHash: contentHash(effectiveOptions.query)
    });
    if (denied.length) this.recordAudit("policy.violation", { userId: effectiveOptions.userId, brainId: effectiveOptions.brainId, sourceId: effectiveOptions.sourceId, metadata: { operation: "retrieve", denied: denied.length, decisions: denied } });
    this.recordAudit("search.run", { userId: effectiveOptions.userId, brainId: effectiveOptions.brainId, sourceId: effectiveOptions.sourceId, metadata: { resultCount: results.length, deniedByPolicy: denied.length, profileId: profile?.id, intent: intent.intent } });
    this.persist();
    return results;
  }

  classifyQueryIntent(query: string): QueryIntentReport {
    const plan = buildQueryPlan(query);
    return {
      query,
      intent: plan.intent,
      confidence: plan.confidence,
      recommendedMode: plan.recommendedMode,
      recommendedWeights: plan.recommendedWeights,
      reasons: plan.explanation,
      plan
    };
  }

  routeMemory(options: SearchOptions): MemoryRouteReport {
    const selectedScopes: MemoryRouteReport["selectedScopes"] = [{ kind: "user", id: options.userId, reason: "request user is always the base memory scope" }];
    const excludedScopes: MemoryRouteReport["excludedScopes"] = [];
    const reasoning: string[] = [];
    if (options.sessionId) selectedScopes.push({ kind: "session", id: options.sessionId, reason: "sessionId was provided by the harness" });
    if (options.appId) selectedScopes.push({ kind: "app", id: options.appId, reason: "appId narrows recall to the current application" });
    if (options.projectId) selectedScopes.push({ kind: "project", id: options.projectId, reason: "projectId narrows recall to the current project or repository" });
    if (options.orgId) selectedScopes.push({ kind: "org", id: options.orgId, reason: "orgId enables approved org-visible memory" });
    if (options.agentId) {
      selectedScopes.push({ kind: "agent", id: options.agentId, reason: "agentId selects agent-specific memories and persona defaults" });
      const persona = this.personaForAgent(options.agentId);
      if (persona) selectedScopes.push({ kind: "persona", id: persona.id, reason: "agent persona contributes retrieval defaults" });
    }
    const accessibleBrains = this.accessibleBrainIds(options);
    for (const brainId of accessibleBrains) selectedScopes.push({ kind: "brain", id: brainId, reason: "brain is accessible to the user, org, agent, or public visibility" });
    const requestedBrainIds = new Set(options.brainIds ?? (options.brainId ? [options.brainId] : []));
    for (const brainId of requestedBrainIds) {
      if (!accessibleBrains.includes(brainId)) excludedScopes.push({ kind: "brain", id: brainId, reason: "brain was requested but is not accessible for this user/agent/org" });
    }
    const privateMatches = this.store.list().filter((memory) => memory.userId !== options.userId && memory.consent.visibility === "private").length;
    if (privateMatches) excludedScopes.push({ kind: "private", id: `${privateMatches}`, reason: "private memories from other users are never routed without explicit identity linking" });
    if (options.brainId || options.brainIds?.length) reasoning.push("Brain routing was requested explicitly.");
    if (options.includeSharedBrains) reasoning.push("Shared brain retrieval is enabled, but still constrained by consent and accessible brain membership.");
    if (!options.includePrivate) reasoning.push("Private memory remains limited to the requesting user.");
    if (options.scopeMode) reasoning.push(`Scope mode ${options.scopeMode} will be enforced during retrieval.`);
    if (!reasoning.length) reasoning.push("Default route uses user memory plus any matching session/app/project/org/agent scopes present on memories.");
    return {
      query: options.query,
      userId: options.userId,
      selectedScopes,
      excludedScopes,
      reasoning,
      retrievalOptions: {
        userId: options.userId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        brainId: options.brainId,
        brainIds: options.brainIds,
        includeSharedBrains: options.includeSharedBrains,
        includeLinkedIdentities: options.includeLinkedIdentities,
        scopeMode: options.scopeMode,
        profileId: options.profileId,
        mode: options.mode
      }
    };
  }

  evidencePack(options: SearchOptions & { tokenBudget?: number }): EvidencePack {
    const tokenBudget = options.tokenBudget ?? 900;
    const results = this.search(options);
    const context = this.retrieval.contextPack(results, tokenBudget);
    const includedResults = results.filter((result) => result.decision !== "exclude" && context.includes(`[${result.memory.id}]`));
    const id = `ctx_${contentHash(`${options.userId}:${options.query}:${includedResults.map((result) => result.memory.id).join(",")}:${tokenBudget}`).slice(2, 14)}`;
    const policyDecisions = results.map((result) => this.evaluatePolicy("retrieve", result.memory, { userId: options.userId, orgId: options.orgId, agentId: options.agentId }));
    const temporalState = {
      generatedAt: new Date().toISOString(),
      stale: includedResults.filter((result) => result.stale).length,
      valid: includedResults.filter((result) => !result.stale).length,
      needsVerification: includedResults.filter((result) => result.memory.beliefState === "needs_verification").length,
      contradicted: includedResults.filter((result) => result.memory.beliefState === "contradicted" || result.contradiction).length
    };
    const hash = contentHash(JSON.stringify({
      query: options.query,
      userId: options.userId,
      tokenBudget,
      resultIds: includedResults.map((result) => result.memory.id),
      policy: policyDecisions.map((decision) => ({ memoryId: decision.memoryId, allowed: decision.allowed, reasons: decision.reasons })),
      temporalState
    }));
    const pack: EvidencePack = {
      schemaVersion: "1.0",
      id,
      generatedAt: new Date().toISOString(),
      query: options.query,
      actor: { userId: options.userId, orgId: options.orgId, agentId: options.agentId },
      userId: options.userId,
      scope: {
        userId: options.userId,
        brainId: options.brainId,
        sourceId: options.sourceId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        deviceId: options.deviceId,
        runId: options.runId
      },
      profileId: options.profileId,
      retrievalProfile: options.profileId ? this.retrievalProfiles.get(options.profileId) : this.profileFor(options),
      queryIntent: this.classifyQueryIntent(options.query),
      tokenBudget,
      hash,
      context,
      results: includedResults.map((result) => {
        const policyDecision = policyDecisions.find((decision) => decision.memoryId === result.memory.id);
        const whyIncluded = [
          ...((result.explanation ?? []).length ? result.explanation ?? [] : [`final score ${roundMetric(result.score)} selected this memory`]),
          ...(result.graphPaths?.length ? [`graph path: ${result.graphPaths[0]}`] : []),
          ...(result.confidence !== undefined ? [`calibrated confidence ${roundMetric(result.confidence)}`] : [])
        ];
        const whyNotExcluded = [
          policyDecision?.allowed === false ? `policy denied: ${policyDecision.reasons.join("; ")}` : "policy allowed for actor and scope",
          result.unsafeToInject ? "unsafe-to-inject warning is present" : "above unsafe-to-inject threshold",
          result.stale ? "temporal state is stale but still surfaced with warning" : "temporal validity allows use",
          result.contradiction ? "contradiction warning requires review" : "no blocking contradiction"
        ];
        return {
        memoryId: result.memory.id,
        content: result.memory.content,
        source: result.memory.source,
        scope: {
          userId: result.memory.userId,
          brainId: result.memory.brainId,
          sourceId: result.memory.sourceId,
          agentId: result.memory.agentId,
          sessionId: result.memory.sessionId,
          appId: result.memory.appId,
          orgId: result.memory.orgId,
          projectId: result.memory.projectId,
          deviceId: result.memory.deviceId,
          runId: result.memory.runId
        },
        consent: result.memory.consent,
        trust: result.memory.trust,
        confidence: result.memory.confidence,
        importance: result.memory.importance,
        beliefState: result.memory.beliefState,
        provenance: result.memory.provenance,
        validity: {
          eventAt: evidenceDate(result.memory.temporal.eventAt),
          validFrom: evidenceDate(result.memory.temporal.validFrom),
          validUntil: evidenceDate(result.memory.temporal.validUntil),
          lastConfirmedAt: evidenceDate(result.memory.temporal.lastConfirmedAt),
          verificationDueAt: evidenceDate(result.memory.temporal.verificationDueAt),
          stale: result.stale,
          decision: result.decision
        },
        retrieval: {
          score: result.score,
          confidence: result.confidence,
          initialScore: result.initialScore,
          mode: result.retrievalMode,
          signals: result.signals,
          scoreBreakdown: {
            ...result.signals,
            finalScore: result.score,
            initialScore: result.initialScore,
            confidence: result.confidence
          },
          explanation: result.explanation ?? [],
          whyIncluded,
          whyNotExcluded,
          graphPaths: result.graphPaths ?? [],
          citation: result.citation,
          contradiction: result.contradiction,
          plan: result.queryPlan,
          unsafeToInject: result.unsafeToInject
        },
        policyDecision,
        contradictionWarnings: result.contradiction ? [result.contradiction.reason] : []
      }; }),
      excludedResults: results
        .filter((result) => result.decision === "exclude" || !context.includes(`[${result.memory.id}]`))
        .map((result) => ({
          memoryId: result.memory.id,
          reason: result.decision === "exclude"
            ? "retrieval decision excluded this memory"
            : (result.confidence ?? 1) < 0.5
              ? "calibrated confidence below injection threshold"
              : "token budget or reranking kept this memory outside the context body",
          decision: result.decision,
          policyDecision: policyDecisions.find((decision) => decision.memoryId === result.memory.id),
          score: result.score
        })),
      policyDecisions,
      graphPaths: [...new Set(includedResults.flatMap((result) => result.graphPaths ?? []))],
      temporalState,
      summary: {
        included: includedResults.filter((result) => !result.decision || result.decision === "include").length,
        warnings: includedResults.filter((result) => result.decision === "warn" || result.decision === "review").length,
        excluded: results.filter((result) => result.decision === "exclude").length,
        stale: includedResults.filter((result) => result.stale).length,
        contradictions: includedResults.filter((result) => result.contradiction).length
      }
    };
    this.evidencePacks.set(pack.id, pack);
    this.recordAudit("search.run", { userId: options.userId, metadata: { resource: "evidence-pack", contextPackId: pack.id, query: options.query, memories: pack.results.length } });
    this.persist();
    return pack;
  }

  getEvidencePack(id: string): EvidencePack {
    const pack = this.evidencePacks.get(id);
    if (!pack) throw new Error(`Evidence pack not found: ${id}`);
    return pack;
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
    const kind = input.kind ?? inferCorrectionKind(input.content);
    const previous = input.previousMemoryId ? safeGet(this.store, input.previousMemoryId) : undefined;
    const memory = this.add({
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      content: input.content,
      type: kind === "review_correction" ? "feedback" : "project",
      layer: "long_term",
      source: input.source ?? { kind: "reviewed_code", confidence: 0.9 },
      tags: ["engineering-correction", "correction", `engineering:${kind}`],
      entities: [
        ...(input.codebase?.repo ? [input.codebase.repo] : []),
        ...(input.codebase?.branch ? [input.codebase.branch] : []),
        ...(input.codebase?.filePattern ? [input.codebase.filePattern] : [])
      ],
      temporal: { eventAt: input.timestamp ?? new Date().toISOString(), validFrom: input.timestamp ?? new Date().toISOString() },
      relations: previous ? [{ type: "supersedes", targetId: previous.id, confidence: 0.9, evidence: "review correction replaced the previous wrong coding action" }] : [],
      metadata: {
        engineering: {
          kind,
          codebase: input.codebase ?? { repo: input.projectId },
          correctionOfMemoryId: previous?.id,
          previousWrongAction: input.previousWrongAction ?? previous?.content,
          correctAction: input.correctAction,
          confidence: 0.9,
          evidenceIds: input.evidenceIds ?? []
        }
      }
    });
    this.applySupersession(memory);
    const derivedMemories = this.derivedCorrectionMemories(input, memory, previous);
    const finalMemory = derivedMemories.length
      ? this.update(memory.id, {
          metadata: {
            ...memory.metadata,
            correctionPipeline: {
              derivedMemoryIds: derivedMemories.map((item) => item.id),
              derivedKinds: derivedMemories.map((item) => getEngineeringMetadata(item)?.kind).filter(Boolean),
              previousMemoryId: previous?.id
            }
          }
        })
      : memory;
    this.recordAudit("memory.write", { userId: input.userId, memoryId: finalMemory.id, metadata: { resource: "engineering-correction", previousMemoryId: previous?.id, kind, derivedMemoryIds: derivedMemories.map((item) => item.id) } });
    return finalMemory;
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
    const primaryKind = getEngineeringMetadata(correction)?.kind;
    const codebase = input.codebase ?? { repo: input.projectId };
    const source = input.source ?? { kind: "reviewed_code" as const, confidence: 0.88 };
    const timestamp = input.timestamp ?? new Date().toISOString();
    const correctAction = input.correctAction ?? inferCorrectActionFromCorrection(input.content);
    const previousWrongAction = input.previousWrongAction ?? (previous ? getEngineeringMetadata(previous)?.command : undefined) ?? previous?.content;
    const forbiddenAction = inferForbiddenActionFromCorrection(input.content, previousWrongAction);
    const scope = {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId
    };
    const baseMetadata = {
      correctionPipeline: { derivedFromCorrectionId: correction.id, previousMemoryId: previous?.id },
      evidenceIds: input.evidenceIds ?? []
    };
    const derived: MemoryInput[] = [];

    if (repoPolicyFromCorrection(input.content, correctAction) && primaryKind !== "repo_policy") {
      derived.push({
        ...scope,
        content: `Repo policy${codebase.repo ? ` for ${codebase.repo}` : ""}: ${repoPolicyFromCorrection(input.content, correctAction)}`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:repo_policy", "correction-derived", "repo-policy"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.82, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "repo_policy", codebase, confidence: 0.86, correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (forbiddenAction && primaryKind !== "forbidden_action") {
      derived.push({
        ...scope,
        content: `Forbidden action${codebase.repo ? ` for ${codebase.repo}` : ""}: do not ${forbiddenAction}.`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:forbidden_action", "correction-derived", "forbidden-action"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.84, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "forbidden_action", codebase, confidence: 0.86, forbiddenAction, correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (/\bgenerated|generated file|\.generated\.|dist\/|build\/|vendor\/|lockfile\b/i.test(input.content) && primaryKind !== "generated_file_rule") {
      derived.push({
        ...scope,
        content: `Generated-file rule${codebase.repo ? ` for ${codebase.repo}` : ""}: do not edit generated files unless the generator is part of the task.`,
        type: "project",
        layer: "long_term",
        source,
        tags: ["engineering-memory", "engineering:generated_file_rule", "correction-derived", "forbidden-action"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.84, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "generated_file_rule", codebase, confidence: 0.86, forbiddenAction: "edit generated files", correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    if (correctAction && primaryKind !== "procedure") {
      derived.push({
        ...scope,
        content: `Procedure${codebase.repo ? ` for ${codebase.repo}` : ""}: before the next related code change, use ${correctAction}.`,
        type: "procedural",
        layer: "procedural",
        source,
        tags: ["engineering-memory", "engineering:procedure", "correction-derived", "procedure"],
        temporal: { eventAt: timestamp, validFrom: timestamp },
        relations: [{ type: "suggested_by", targetId: correction.id, confidence: 0.82, evidence: "derived from reviewed correction" }],
        metadata: { ...baseMetadata, engineering: { kind: "procedure", codebase, confidence: 0.84, command: correctAction, successPattern: correctAction, evidenceIds: input.evidenceIds ?? [] } }
      });
    }

    return derived.map((item) => this.add(item));
  }

  codingContextPack(options: SearchOptions & { tokenBudget?: number }): CodingContextPack {
    const tokenBudget = options.tokenBudget ?? 900;
    const intent = this.classifyQueryIntent(options.query);
    const preferredKinds = Object.keys(engineeringQueryWeights(intent.plan.queryType)) as EngineeringMemoryKind[];
    const allEngineeringKinds: EngineeringMemoryKind[] = ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "forbidden_action", "migration_note", "test_strategy", "dependency_rule", "generated_file_rule"];
    const engineeringKinds: EngineeringMemoryKind[] = options.filters?.engineeringKind
      ? [options.filters.engineeringKind]
      : options.filters?.engineeringKinds?.length
        ? options.filters.engineeringKinds
        : [...new Set([...preferredKinds, ...allEngineeringKinds])];
    const results = this.search({
      ...options,
      limit: options.limit ?? 18,
      expandQuery: true,
      filters: { ...(options.filters ?? {}), engineeringKinds },
      query: `${options.query} repo policy procedure correction forbidden architecture tool outcome migration generated file`
    });
    const evidence = this.evidencePack({ ...options, limit: options.limit ?? 18, tokenBudget });
    const id = `code_ctx_${contentHash(`${options.userId}:${options.query}:${results.map((result) => result.memory.id).join(",")}:${tokenBudget}`).slice(2, 14)}`;
    const pack = buildCodingContextPackFromResults({
      id,
      query: options.query,
      userId: options.userId,
      results,
      tokenBudget,
      scope: {
        userId: options.userId,
        agentId: options.agentId,
        sessionId: options.sessionId,
        appId: options.appId,
        orgId: options.orgId,
        projectId: options.projectId,
        codebase: options.codebaseScope
      },
      evidencePackId: evidence.id
    });
    this.codingContextPacks.set(pack.id, pack);
    this.recordAudit("search.run", { userId: options.userId, metadata: { resource: "coding-context-pack", contextPackId: pack.id, query: options.query, sections: pack.sections.length, memories: pack.sections.reduce((sum, section) => sum + section.evidence.length, 0) } });
    this.persist();
    return pack;
  }

  getCodingContextPack(id: string): CodingContextPack {
    const pack = this.codingContextPacks.get(id);
    if (!pack) throw new Error(`Coding context pack not found: ${id}`);
    return pack;
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
    const results = this.search({
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      query: `${input.action} forbidden action repo policy generated file procedure alternative`,
      limit: 12,
      codebaseScope: input.codebaseScope,
      filters: { engineeringKinds: ["forbidden_action", "generated_file_rule", "repo_policy", "procedure", "test_strategy"] }
    });
    const existingIds = new Set(results.map((result) => result.memory.id));
    const supplemental = this.store.list(input.userId)
      .filter((memory) => !existingIds.has(memory.id))
      .filter((memory) => {
        const engineering = getEngineeringMetadata(memory);
        return Boolean(engineering && ["forbidden_action", "generated_file_rule", "repo_policy", "procedure", "test_strategy"].includes(engineering.kind) && codingActionOverlap(input.action, memory.content));
      })
      .map((memory) => ({
        memory,
        score: 0.72,
        signals: { semantic: 0, keyword: 0.72, entity: 0, temporal: 0, trust: memory.trust, graph: 0, access: 0 },
        citation: citationFor(memory),
        stale: memory.beliefState === "stale" || memory.beliefState === "needs_verification",
        explanation: ["action guard supplemental engineering-memory match"]
      }));
    const report = evaluateForbiddenAction({ userId: input.userId, action: input.action, results: [...results, ...supplemental] });
    this.recordAudit(report.allowed ? "search.run" : "policy.violation", { userId: input.userId, metadata: { resource: "action-guard", action: input.action, allowed: report.allowed, evidenceIds: report.evidenceIds } });
    return report;
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
    const results: SearchResult[] = input.memoryIds?.length
      ? input.memoryIds.map((id) => safeGet(this.store, id)).filter((memory): memory is Memory => Boolean(memory)).map((memory) => ({
          memory,
          score: 1,
          signals: { semantic: 0, keyword: 0, entity: 0, temporal: 0, trust: memory.trust, graph: 0, access: 0 },
          citation: citationFor(memory),
          stale: memory.beliefState === "stale" || memory.beliefState === "needs_verification",
          explanation: ["explicit evidence memory id supplied"]
        }))
      : this.search({
          userId: input.userId,
          agentId: input.agentId,
          sessionId: input.sessionId,
          appId: input.appId,
          orgId: input.orgId,
          projectId: input.projectId,
          query: `${input.task} correction procedure tool outcome architecture policy`,
          limit: 18,
          codebaseScope: input.codebaseScope,
          filters: { engineeringKinds: ["repo_policy", "architecture_decision", "review_correction", "tool_outcome", "procedure", "test_strategy", "dependency_rule", "migration_note"] }
        });
    const excludedStaleRules = results
      .filter((result) => result.memory.beliefState === "superseded" || result.memory.beliefState === "stale" || result.memory.beliefState === "needs_verification" || result.decision === "exclude")
      .map((result) => ({ memoryId: result.memory.id, reason: `belief=${result.memory.beliefState} decision=${result.decision ?? "include"}` }));
    const evidenceSource = results.find((result) => typeof getEngineeringMetadata(result.memory)?.evidenceIds?.[0] === "string");
    const trail = buildPatchEvidenceTrail({
      id: `patch_ev_${contentHash(`${input.userId}:${input.task}:${results.map((result) => result.memory.id).join(",")}`).slice(2, 14)}`,
      userId: input.userId,
      task: input.task,
      results,
      contextPackId: evidenceSource ? getEngineeringMetadata(evidenceSource.memory)?.evidenceIds?.[0] : undefined,
      filesChanged: input.filesChanged,
      commandsRun: input.commandsRun,
      excludedStaleRules
    });
    this.patchEvidenceTrails.set(trail.id, trail);
    this.recordAudit("search.run", { userId: input.userId, metadata: { resource: "patch-evidence-trail", trailId: trail.id, memories: trail.memoryIds.length } });
    this.persist();
    return trail;
  }

  federatedSearch(options: SearchOptions & { brainIds: string[] }): FederatedSearchReport {
    const allowed = new Set(this.accessibleBrainIds(options));
    const requested = [...new Set(options.brainIds)];
    const searchedBrainIds = requested.filter((id) => allowed.has(id));
    const blockedBrainIds = requested.filter((id) => !allowed.has(id));
    const results = searchedBrainIds.length
      ? this.search({ ...options, brainIds: searchedBrainIds, includeSharedBrains: true })
      : [];
    return {
      query: options.query,
      userId: options.userId,
      requestedBrainIds: requested,
      searchedBrainIds,
      blockedBrainIds,
      results
    };
  }

  reflect(userId: string) {
    this.enforceRetention(new Date(), userId);
    const blocked = this.memoriesDeniedForOperation(userId, "dream");
    if (blocked.length) return this.blockedReflectionReport(userId, "reflect", blocked);
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.recordAudit("reflect.run", { userId, metadata: { created: report.created.length, demoted: report.demoted.length, contradictions: report.contradictions.length } });
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
    this.enforceRetention(new Date(), userId);
    const blocked = this.memoriesDeniedForOperation(userId, "dream");
    if (blocked.length) return this.blockedReflectionReport(userId, "dream", blocked);
    const report = this.reflection.run(userId);
    this.scheduleVerificationFromDream(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.recordAudit("reflect.run", { userId, metadata: { created: report.created.length, demoted: report.demoted.length, contradictions: report.contradictions.length } });
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  verificationQueue(userId: string): VerificationQueueReport {
    const now = new Date();
    const items = this.store.list(userId)
      .filter((memory) => !memory.archivedAt)
      .filter((memory) => memory.beliefState === "needs_verification" || memory.beliefState === "contradicted" || Boolean(memory.temporal.verificationDueAt && new Date(memory.temporal.verificationDueAt) <= now))
      .map((memory) => ({
        memoryId: memory.id,
        content: memory.content,
        beliefState: memory.beliefState,
        trust: memory.trust,
        importance: memory.importance,
        verificationDueAt: memory.temporal.verificationDueAt,
        reason: memory.beliefState === "contradicted" ? "contradiction needs operator review" : memory.beliefState === "needs_verification" ? "belief state requires verification" : "verification due date elapsed"
      }))
      .sort((a, b) => (b.importance * b.trust) - (a.importance * a.trust));
    return { userId, generatedAt: now.toISOString(), items };
  }

  confirmMemory(memoryId: string, userId?: string): Memory {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot confirm memory ${memoryId}`);
    const confirmed = this.update(memoryId, {
      beliefState: "active",
      temporal: { ...memory.temporal, lastConfirmedAt: new Date().toISOString(), verificationDueAt: undefined, stalenessRisk: 0 },
      metadata: { verification: { status: "confirmed", at: new Date().toISOString() } }
    });
    this.recordAudit("memory.update", { userId: confirmed.userId, memoryId, metadata: { action: "confirm" } });
    return confirmed;
  }

  recordHarnessAction(input: HarnessActionInput): Memory {
    const passed = input.tests?.filter((test) => test.status === "passed").map((test) => test.name) ?? [];
    const failed = input.tests?.filter((test) => test.status === "failed").map((test) => test.name) ?? [];
    const content = input.content ?? [
      input.command ? `Command executed: ${input.command}.` : undefined,
      input.cwd ? `Working directory: ${input.cwd}.` : undefined,
      input.envRequirements?.length ? `Environment requirements: ${input.envRequirements.join(", ")}.` : undefined,
      input.environmentHints?.length ? `Environment hints: ${input.environmentHints.join(", ")}.` : undefined,
      typeof input.exitCode === "number" ? `Exit code: ${input.exitCode}.` : undefined,
      typeof input.durationMs === "number" ? `Duration: ${input.durationMs}ms.` : undefined,
      input.outputSummary ? `Output summary: ${input.outputSummary}.` : undefined,
      input.failureReason ? `Failure reason: ${input.failureReason}.` : undefined,
      input.successReason ? `Success reason: ${input.successReason}.` : undefined,
      input.filesChanged?.length ? `Files changed: ${input.filesChanged.join(", ")}.` : undefined,
      input.filesTouched?.length ? `Files touched: ${input.filesTouched.join(", ")}.` : undefined,
      passed.length ? `Tests passed: ${passed.join(", ")}.` : undefined,
      failed.length ? `Tests failed: ${failed.join(", ")}.` : undefined,
      input.pullRequest ? `Pull request created: ${input.pullRequest}.` : undefined,
      input.errorFixed ? `Fixed error: ${input.errorFixed}.` : undefined
    ].filter(Boolean).join(" ");
    return this.add({
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      content: content || "Harness action completed.",
      type: "episodic",
      layer: "episodic",
      source: { kind: "tool", confidence: failed.length ? 0.72 : 0.9 },
      tags: [
        "harness-action",
        "engineering:tool_outcome",
        ...(input.command ? ["command"] : []),
        ...(input.tests?.length ? ["tests"] : []),
        ...(failed.length || (typeof input.exitCode === "number" && input.exitCode !== 0) ? ["test-failure"] : []),
        ...(passed.length && !failed.length && (input.exitCode ?? 0) === 0 ? ["success-pattern"] : []),
        ...(input.errorFixed ? ["fix"] : [])
      ],
      entities: [...(input.filesChanged ?? []), ...(input.command ? [input.command.split(/\s+/)[0]] : [])],
      temporal: { eventAt: input.timestamp ?? new Date().toISOString(), lastConfirmedAt: failed.length ? undefined : new Date().toISOString(), verificationDueAt: failed.length ? new Date(Date.now() + 7 * 86_400_000).toISOString() : undefined },
      metadata: {
        action: {
          command: input.command,
          cwd: input.cwd,
          envRequirements: input.envRequirements ?? [],
          environmentHints: input.environmentHints ?? [],
          exitCode: input.exitCode,
          durationMs: input.durationMs,
          outputSummary: input.outputSummary,
          failureReason: input.failureReason,
          successReason: input.successReason,
          filesChanged: input.filesChanged ?? [],
          filesTouched: input.filesTouched ?? input.filesChanged ?? [],
          tests: input.tests ?? [],
          pullRequest: input.pullRequest,
          errorFixed: input.errorFixed,
          benchmarkScenarioId: input.benchmarkScenarioId,
          evidencePackId: input.evidencePackId
        },
        engineering: {
          kind: "tool_outcome",
          codebase: { repo: input.projectId, harness: input.agentId, currentPath: input.cwd },
          confidence: failed.length ? 0.72 : 0.9,
          command: input.command,
          cwd: input.cwd,
          envRequirements: input.envRequirements ?? [],
          environmentHints: input.environmentHints ?? [],
          exitCode: input.exitCode,
          durationMs: input.durationMs,
          outputSummary: input.outputSummary,
          failureReason: input.failureReason,
          successReason: input.successReason,
          successPattern: input.successReason ?? (passed.length && !failed.length ? `Command ${input.command ?? "tool"} passed ${passed.join(", ")}` : undefined),
          filesChanged: input.filesChanged ?? [],
          filesTouched: input.filesTouched ?? input.filesChanged ?? [],
          testOutputSummary: [...passed.map((name) => `passed:${name}`), ...failed.map((name) => `failed:${name}`)].join(", "),
          evidenceIds: input.evidencePackId ? [input.evidencePackId] : []
        }
      }
    });
  }

  retractMemory(memoryId: string, userId?: string, reason?: string): Memory {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot retract memory ${memoryId}`);
    const retracted = this.update(memoryId, {
      beliefState: "retracted",
      trust: 0,
      metadata: { verification: { status: "retracted", at: new Date().toISOString(), reason } }
    });
    this.recordAudit("memory.update", { userId: retracted.userId, memoryId, metadata: { action: "retract", reason } });
    return retracted;
  }

  feedback(event: FeedbackEvent): Memory {
    const memory = this.store.get(event.memoryId);
    const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
    const delta = feedbackDelta(event.kind);
    const updated = this.store.update(event.memoryId, {
      trust: clamp01(memory.trust + delta.trust),
      importance: clamp01(memory.importance + delta.importance),
      pinned: event.kind === "always_include" ? true : memory.pinned,
      consent:
        event.kind === "private"
          ? { ...memory.consent, visibility: "private" }
          : event.kind === "shareable"
            ? { ...memory.consent, visibility: "org" }
            : memory.consent,
      metadata: {
        feedback: [...((memory.metadata.feedback as unknown[]) ?? []), { ...event, timestamp }],
        ...(event.kind === "approve_pattern"
          ? { patternReview: { status: "approved", reviewedAt: timestamp, note: event.note } }
          : event.kind === "reject_pattern"
            ? { patternReview: { status: "rejected", reviewedAt: timestamp, note: event.note } }
            : {})
      }
    });
    if (event.kind === "reject_pattern") this.store.archive(event.memoryId);
    this.feedbackEvents.push({ ...event, timestamp });
    this.metrics.feedback += 1;
    this.persist();
    return updated;
  }

  recordInjectionFeedback(event: InjectionFeedbackEvent): InjectionFeedbackReport {
    const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
    const accepted = new Set(event.acceptedMemoryIds ?? (event.outcome === "helpful" || event.outcome === "accepted" ? event.injectedMemoryIds : []));
    const rejected = new Set(event.rejectedMemoryIds ?? (event.outcome === "wrong" || event.outcome === "rejected" ? event.injectedMemoryIds : []));
    const updatedMemories: Memory[] = [];
    for (const memoryId of event.injectedMemoryIds) {
      const kind: FeedbackKind | undefined = accepted.has(memoryId) ? "helpful" : rejected.has(memoryId) ? "wrong" : undefined;
      if (!kind || !safeGet(this.store, memoryId)) continue;
      updatedMemories.push(this.feedback({ memoryId, userId: event.userId, kind, note: event.note, timestamp }));
    }
    const trainingSample = this.addTrainingSample({
      query: event.query,
      userId: event.userId,
      selectedMemoryId: event.acceptedMemoryIds?.[0] ?? (event.outcome === "helpful" || event.outcome === "accepted" ? event.injectedMemoryIds[0] : undefined),
      rejectedMemoryIds: event.rejectedMemoryIds ?? (event.outcome === "wrong" || event.outcome === "rejected" ? event.injectedMemoryIds : undefined),
      profileId: event.profileId,
      signals: event.signals,
      outcome: event.outcome,
      timestamp
    });
    const learnedProfile = this.learnRetrievalProfile(event.profileId ?? "learned-injection", "Learned injection feedback", { scope: { userId: event.userId } });
    this.recordAudit("provider.call", { userId: event.userId, metadata: { task: "injection-feedback", query: event.query, injected: event.injectedMemoryIds.length, outcome: event.outcome, learnedSamples: learnedProfile.samples } });
    this.persist();
    return { event: { ...event, timestamp }, updatedMemories, trainingSample, learnedProfile };
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
    const manifest = this.connectorManifests.get(input.connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${input.connectorId}`);
    const feedbackKind: FeedbackKind = input.kind === "accepted_change" ? "helpful" : input.kind === "failing_test" ? "stale" : "wrong";
    const updatedMemories = (input.memoryIds ?? [])
      .filter((memoryId) => Boolean(safeGet(this.store, memoryId)))
      .map((memoryId) => this.feedback({ memoryId, userId: input.userId, kind: feedbackKind, note: input.content }));
    const feedbackMemory = this.add({
      userId: input.userId,
      content: input.content,
      type: "feedback",
      source: { kind: "tool", confidence: input.kind === "accepted_change" ? 0.86 : 0.72 },
      tags: ["connector-feedback", input.kind, input.connectorId],
      metadata: { connectorId: input.connectorId, externalId: input.externalId, feedbackKind, ...(input.metadata ?? {}) }
    });
    const record: ConnectorSyncRecord = {
      id: `sync_${contentHash(`${input.connectorId}:feedback:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
      connectorId: input.connectorId,
      direction: "ingest",
      status: "applied",
      memoryIds: [feedbackMemory.id, ...updatedMemories.map((memory) => memory.id)],
      externalIds: input.externalId ? [input.externalId] : [],
      timestamp: new Date().toISOString(),
      operation: "memory_link",
      payload: { feedbackAdapter: input.kind, feedbackKind, updated: updatedMemories.length }
    };
    this.connectorSyncRecords.push(record);
    this.recordAudit("connector.sync", { userId: input.userId, metadata: { connectorId: input.connectorId, status: record.status, feedbackAdapter: input.kind, memories: record.memoryIds.length } });
    this.persist();
    return { record, feedbackMemory, updatedMemories };
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
    const manifest = this.connectorManifests.get(input.connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${input.connectorId}`);
    const createdMemories: Memory[] = [];
    const reports: Record<string, unknown>[] = [];
    if (input.kind === "tool_outcome") {
      const action = this.recordHarnessAction({
        userId: input.userId,
        agentId: input.harnessId,
        appId: typeof input.metadata?.appId === "string" ? input.metadata.appId : undefined,
        orgId: typeof input.metadata?.orgId === "string" ? input.metadata.orgId : undefined,
        projectId: typeof input.metadata?.projectId === "string" ? input.metadata.projectId : undefined,
        command: input.command ?? input.content,
        cwd: typeof input.metadata?.cwd === "string" ? input.metadata.cwd : undefined,
        envRequirements: Array.isArray(input.metadata?.envRequirements) ? input.metadata.envRequirements.filter((item): item is string => typeof item === "string") : undefined,
        environmentHints: Array.isArray(input.metadata?.environmentHints) ? input.metadata.environmentHints.filter((item): item is string => typeof item === "string") : undefined,
        exitCode: typeof input.metadata?.exitCode === "number" ? input.metadata.exitCode : undefined,
        durationMs: typeof input.metadata?.durationMs === "number" ? input.metadata.durationMs : undefined,
        outputSummary: typeof input.metadata?.outputSummary === "string" ? input.metadata.outputSummary : undefined,
        failureReason: typeof input.metadata?.failureReason === "string" ? input.metadata.failureReason : undefined,
        successReason: typeof input.metadata?.successReason === "string" ? input.metadata.successReason : undefined,
        evidencePackId: typeof input.metadata?.evidencePackId === "string" ? input.metadata.evidencePackId : undefined,
        filesChanged: input.filesChanged,
        filesTouched: Array.isArray(input.metadata?.filesTouched) ? input.metadata.filesTouched.filter((item): item is string => typeof item === "string") : input.filesChanged,
        tests: input.tests,
        content: input.content,
        timestamp: new Date().toISOString()
      });
      createdMemories.push(action);
      reports.push({ kind: "harness-action", memoryId: action.id });
    } else if (input.kind === "context_pack_feedback" && input.query && input.memoryIds?.length) {
      const outcome = input.rejectedMemoryIds?.length && !input.acceptedMemoryIds?.length ? "rejected" : "accepted";
      const report = this.recordInjectionFeedback({
        userId: input.userId,
        query: input.query,
        injectedMemoryIds: input.memoryIds,
        acceptedMemoryIds: input.acceptedMemoryIds,
        rejectedMemoryIds: input.rejectedMemoryIds,
        outcome,
        note: input.content,
        timestamp: new Date().toISOString()
      });
      reports.push({ kind: "injection-feedback", trainingSample: report.trainingSample, updated: report.updatedMemories.map((memory) => memory.id) });
    } else {
      const feedback = this.recordConnectorFeedback({
        connectorId: input.connectorId,
        userId: input.userId,
        kind: input.kind === "accepted_suggestion" ? "accepted_change" : "rejected_suggestion",
        content: input.content ?? `${input.harnessId ?? input.connectorId} ${input.kind}`,
        memoryIds: input.memoryIds,
        externalId: input.externalId,
        metadata: { harnessId: input.harnessId, telemetryKind: input.kind, ...(input.metadata ?? {}) }
      });
      createdMemories.push(feedback.feedbackMemory, ...feedback.updatedMemories);
      reports.push({ kind: "connector-feedback", recordId: feedback.record.id, memoryIds: feedback.record.memoryIds });
    }
    const record: ConnectorSyncRecord = {
      id: `sync_${contentHash(`${input.connectorId}:telemetry:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
      connectorId: input.connectorId,
      direction: "ingest",
      status: "applied",
      memoryIds: createdMemories.map((memory) => memory.id),
      externalIds: input.externalId ? [input.externalId] : [],
      timestamp: new Date().toISOString(),
      operation: "memory_link",
      payload: { telemetryKind: input.kind, harnessId: input.harnessId, reports, metadata: input.metadata ?? {} }
    };
    this.connectorSyncRecords.push(record);
    this.recordAudit("connector.sync", { userId: input.userId, metadata: { connectorId: input.connectorId, telemetryKind: input.kind, harnessId: input.harnessId, memories: record.memoryIds.length } });
    this.persist();
    return { record, createdMemories, reports };
  }

  exportUser(userId: string): Memory[] {
    const denied: PolicyDecision[] = [];
    const allowed = this.store.list(userId).filter((memory) => {
      const decision = this.evaluatePolicy("export", memory, { userId });
      if (decision.allowed) return true;
      denied.push(decision);
      return false;
    });
    if (denied.length) this.recordAudit("policy.violation", { userId, metadata: { operation: "export", denied: denied.length, decisions: denied } });
    return allowed;
  }

  deleteUser(userId: string): number {
    const memories = this.store.list(userId);
    let deleted = 0;
    const denied: PolicyDecision[] = [];
    for (const memory of memories) {
      const decision = this.evaluatePolicy("delete", memory, { userId });
      if (!decision.allowed) {
        denied.push(decision);
        continue;
      }
      if (this.store.delete(memory.id)) deleted += 1;
    }
    if (denied.length) this.recordAudit("policy.violation", { userId, metadata: { operation: "delete", denied: denied.length, decisions: denied } });
    this.persist();
    return deleted;
  }

  createBrain(input: Omit<Brain, "id" | "createdAt" | "updatedAt"> & { id?: string }): Brain {
    const now = new Date().toISOString();
    const brain: Brain = {
      ...input,
      id: input.id ?? `brain_${contentHash(`${input.ownerUserId}:${input.name}`).slice(2)}`,
      createdAt: now,
      updatedAt: now
    };
    this.brains.set(brain.id, brain);
    this.recordAudit("memory.write", { userId: brain.ownerUserId, brainId: brain.id, metadata: { resource: "brain", name: brain.name } });
    this.persist();
    return brain;
  }

  listBrains(): Brain[] {
    return [...this.brains.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  createSource(input: Omit<MemorySource, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemorySource {
    if (!this.brains.has(input.brainId)) throw new Error(`Brain not found: ${input.brainId}`);
    const now = new Date().toISOString();
    const source: MemorySource = {
      ...input,
      id: input.id ?? `src_${contentHash(`${input.brainId}:${input.name}`).slice(2)}`,
      createdAt: now,
      updatedAt: now
    };
    this.sources.set(source.id, source);
    this.recordAudit("memory.write", { brainId: source.brainId, sourceId: source.id, metadata: { resource: "source", kind: source.kind } });
    this.persist();
    return source;
  }

  listSources(brainId?: string): MemorySource[] {
    return [...this.sources.values()].filter((source) => !brainId || source.brainId === brainId).sort((a, b) => a.name.localeCompare(b.name));
  }

  deleteSource(sourceId: string, actorId = "system"): { sourceId: string; affectedMemoryIds: string[] } {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);
    this.sources.delete(sourceId);
    const timestamp = new Date().toISOString();
    const affectedMemoryIds: string[] = [];
    for (const memory of this.store.list().filter((item) => item.sourceId === sourceId)) {
      const updated = this.store.update(memory.id, {
        beliefState: "needs_verification",
        metadata: {
          ...memory.metadata,
          deletedSourceId: sourceId,
          deletedSourceName: source.name,
          sourceDeletedAt: timestamp,
          verificationReason: "source_deleted"
        }
      });
      affectedMemoryIds.push(updated.id);
      this.recordAudit("memory.update", { actorId, userId: updated.userId, brainId: updated.brainId, sourceId, memoryId: updated.id, metadata: { action: "source_deleted_revalidation", sourceName: source.name } });
    }
    this.recordAudit("memory.delete", { actorId, brainId: source.brainId, sourceId, metadata: { resource: "source", kind: source.kind, affectedMemoryIds } });
    this.persist();
    return { sourceId, affectedMemoryIds };
  }

  registerConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): ConnectorManifest {
    validateConnectorManifest(input);
    const now = new Date().toISOString();
    const manifest: ConnectorManifest = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.connectorManifests.set(manifest.id, manifest);
    this.recordAudit("connector.register", { metadata: { connectorId: manifest.id, kind: manifest.kind, capabilities: manifest.capabilities } });
    this.persist();
    return manifest;
  }

  beginConnectorOAuth(connectorId: string, input: { redirectUri?: string; scopes?: string[]; stateSalt?: string } = {}): ConnectorAuthSession {
    const manifest = this.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (manifest.auth !== "oauth") throw new Error(`Connector ${connectorId} does not use OAuth`);
    if (!manifest.oauth?.authorizeUrl) throw new Error(`Connector ${connectorId} is missing oauth.authorizeUrl`);
    const now = new Date().toISOString();
    const redirectUri = input.redirectUri ?? manifest.oauth.redirectUri;
    const scopes = input.scopes ?? manifest.oauth.scopes ?? [];
    const state = contentHash(`${connectorId}:${now}:${input.stateSalt ?? ""}`).slice(2, 26);
    const authorizeUrl = new URL(manifest.oauth.authorizeUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", manifest.oauth.clientIdRef ?? `${connectorId}-client`);
    authorizeUrl.searchParams.set("state", state);
    if (redirectUri) authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    if (scopes.length) authorizeUrl.searchParams.set("scope", scopes.join(" "));
    const session: ConnectorAuthSession = {
      id: `auth_${contentHash(`${connectorId}:${state}`).slice(2, 14)}`,
      connectorId,
      state,
      status: "pending",
      authorizeUrl: authorizeUrl.toString(),
      redirectUri,
      scopes,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
    };
    this.connectorAuthSessions.set(session.id, session);
    this.recordAudit("connector.auth", { metadata: { connectorId, sessionId: session.id, status: session.status, scopes } });
    this.persist();
    return session;
  }

  completeConnectorOAuth(input: { connectorId: string; state: string; code?: string; tokenRef?: string; error?: string }): ConnectorAuthSession {
    const session = [...this.connectorAuthSessions.values()].find((item) => item.connectorId === input.connectorId && item.state === input.state);
    if (!session) throw new Error(`OAuth session not found for connector ${input.connectorId}`);
    const now = new Date().toISOString();
    const tokenRef = input.tokenRef ?? (input.code ? `oauth://${input.connectorId}/${contentHash(input.code).slice(2, 12)}` : undefined);
    const updated: ConnectorAuthSession = {
      ...session,
      status: input.error ? "failed" : "authorized",
      tokenRef,
      tokenHash: input.code || tokenRef ? contentHash(`${input.code ?? ""}:${tokenRef ?? ""}`).slice(2) : undefined,
      error: input.error,
      updatedAt: now
    };
    this.connectorAuthSessions.set(session.id, updated);
    const manifest = this.connectorManifests.get(input.connectorId);
    if (manifest && updated.status === "authorized" && tokenRef) {
      const next: ConnectorManifest = {
        ...manifest,
        updatedAt: now,
        list: manifest.list ? { ...manifest.list, authRef: manifest.list.authRef ?? tokenRef } : manifest.list,
        poll: manifest.poll ? { ...manifest.poll, authRef: manifest.poll.authRef ?? tokenRef } : manifest.poll,
        writeback: manifest.writeback ? { ...manifest.writeback, authRef: manifest.writeback.authRef ?? tokenRef } : manifest.writeback
      };
      this.connectorManifests.set(next.id, next);
    }
    this.recordAudit("connector.auth", { metadata: { connectorId: input.connectorId, sessionId: session.id, status: updated.status, tokenRef: updated.tokenRef } });
    this.persist();
    return updated;
  }

  revokeConnectorAuth(connectorId: string, actorId = "system"): ConnectorAuthSession[] {
    const now = new Date().toISOString();
    const revoked: ConnectorAuthSession[] = [];
    for (const session of this.connectorAuthSessions.values()) {
      if (session.connectorId !== connectorId || session.status === "revoked") continue;
      const updated: ConnectorAuthSession = {
        ...session,
        status: "revoked",
        tokenRef: undefined,
        updatedAt: now,
        error: undefined
      };
      this.connectorAuthSessions.set(session.id, updated);
      revoked.push(updated);
    }
    const manifest = this.connectorManifests.get(connectorId);
    if (manifest) {
      this.connectorManifests.set(connectorId, {
        ...manifest,
        updatedAt: now,
        list: manifest.list ? { ...manifest.list, authRef: undefined } : manifest.list,
        poll: manifest.poll ? { ...manifest.poll, authRef: undefined } : manifest.poll,
        writeback: manifest.writeback ? { ...manifest.writeback, authRef: undefined } : manifest.writeback
      });
    }
    this.recordAudit("connector.auth", { actorId, metadata: { connectorId, status: "revoked", sessions: revoked.length } });
    this.persist();
    return revoked;
  }

  connectorAuthStatus(connectorId?: string): ConnectorAuthSession[] {
    return [...this.connectorAuthSessions.values()]
      .filter((session) => !connectorId || session.connectorId === connectorId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  listConnectorManifests(kind?: ConnectorManifest["kind"]): ConnectorManifest[] {
    return [...this.connectorManifests.values()]
      .filter((manifest) => !kind || manifest.kind === kind)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }

  syncConnectorEvents(
    connectorId: string,
    events: Array<MemoryExtractionEvent & { externalId?: string }>,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">
  ): ConnectorSyncRecord {
    const manifest = this.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("ingest")) throw new Error(`Connector ${connectorId} does not support ingest`);
    if (manifest.privacyPolicy === "never_store") {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:privacy:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "applied",
        memoryIds: [],
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString(),
        payload: { skipped: true, reason: "privacy_policy_never_store", events: events.length }
      };
      this.connectorSyncRecords.push(record);
      this.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, privacyPolicy: manifest.privacyPolicy, memories: 0 } });
      this.persist();
      return record;
    }
    try {
      const mapped = events.map((event) => ({
        ...event,
        source: event.source ?? { kind: manifest.defaultSourceKind, uri: event.uri, confidence: 0.82 },
        sourceRef: event.sourceRef ?? {
          connectorId,
          externalId: event.externalId,
          url: event.uri ?? (typeof event.metadata?.url === "string" ? event.metadata.url : undefined),
          author: typeof event.metadata?.author === "string" ? event.metadata.author : undefined,
          timestamp: event.timestamp,
          version: typeof event.metadata?.version === "string" ? event.metadata.version : undefined,
          hash: contentHash(JSON.stringify({ connectorId, externalId: event.externalId, content: event.content, timestamp: event.timestamp }))
        },
        metadata: { ...(event.metadata ?? {}), connectorId, externalId: event.externalId, mapping: manifest.metadataMapping, privacyPolicy: manifest.privacyPolicy ?? "project" }
      }));
      const report = this.extract(mapped, scope);
      const eventsByExternalId = new Map(events.map((event) => [event.externalId, event]));
      for (const memory of report.memories) {
        const externalId = typeof memory.metadata.externalId === "string" ? memory.metadata.externalId : undefined;
        const event = externalId ? eventsByExternalId.get(externalId) : undefined;
        if (!event) continue;
        const reviewRequired = connectorReviewRequired(manifest, event);
        const visibility = connectorEventVisibility(event);
        const tags = connectorEventTags(manifest, event);
        if (!reviewRequired && !visibility && !tags.length) continue;
        this.store.update(memory.id, {
          beliefState: reviewRequired ? "needs_verification" : memory.beliefState,
          consent: visibility ? { ...memory.consent, visibility } : memory.consent,
          tags: [...new Set([...memory.tags, ...tags])],
          metadata: {
            ...memory.metadata,
            ...(reviewRequired ? { reviewQueue: { status: "pending", connectorId, reason: "connector_candidate_review" } } : {}),
            ...(visibility ? { channelVisibility: visibility } : {})
          }
        });
      }
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "applied",
        memoryIds: report.memories.map((memory) => memory.id),
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString()
      };
      this.connectorSyncRecords.push(record);
      this.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, memories: record.memoryIds.length } });
      this.persist();
      return record;
    } catch (error) {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:failed:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "failed",
        memoryIds: [],
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "unknown connector sync failure"
      };
      this.connectorSyncRecords.push(record);
      this.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, error: record.error } });
      this.persist();
      return record;
    }
  }

  async listConnectorItems(connectorId: string, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorListResult> {
    const manifest = this.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.list?.endpoint) return { connectorId, status: "failed", items: [], error: `Connector ${connectorId} has no list endpoint` };
    if (shouldUseExternalVendor(manifest, manifest.list.endpoint)) {
      const result = await listExternalVendorItems(manifest, fetchImpl, timeoutMs);
      return { connectorId, status: result.status, items: result.items, responseStatusCode: result.responseStatusCode, error: result.error };
    }
    try {
      const request = connectorAdapterRequest(manifest, "list", manifest.list.endpoint, manifest.list.method ?? "GET", undefined, manifest.list.authRef);
      const response = await fetchImpl(request.url, request.method === "GET"
        ? { method: request.method, headers: request.headers, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) }
        : { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
      const json = await response.json().catch(() => ({})) as { items?: Array<Record<string, unknown>> };
      return {
        connectorId,
        status: response.ok ? "applied" : "failed",
        items: Array.isArray(json.items) ? json.items : [],
        responseStatusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return { connectorId, status: "failed", items: [], error: error instanceof Error ? error.message : "connector list failed" };
    }
  }

  async pollConnector(
    connectorId: string,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
  ): Promise<ConnectorSyncRecord> {
    const manifest = this.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("poll")) throw new Error(`Connector ${connectorId} does not support poll`);
    if (!manifest.poll?.endpoint) throw new Error(`Connector ${connectorId} has no poll endpoint`);
    try {
      if (shouldUseExternalVendor(manifest, manifest.poll.endpoint)) {
        const vendor = await pollExternalVendorConnector(manifest, fetchImpl, timeoutMs);
        const record = this.syncConnectorEvents(connectorId, vendor.events, scope);
        record.responseStatusCode = vendor.responseStatusCode;
        if (vendor.request) record.request = vendor.request;
        if (vendor.status === "failed") {
          record.status = "failed";
          record.error = vendor.error;
        }
        this.persist();
        return record;
      }
      const request = connectorAdapterRequest(manifest, "poll", manifest.poll.endpoint, manifest.poll.method ?? "GET", undefined, manifest.poll.authRef);
      const response = await fetchImpl(request.url, request.method === "GET"
        ? { method: request.method, headers: request.headers, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) }
        : { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
      const json = await response.json().catch(() => ({})) as { events?: Array<MemoryExtractionEvent & { externalId?: string }> };
      const events = Array.isArray(json.events) ? json.events : [];
      const record = this.syncConnectorEvents(connectorId, events, scope);
      record.responseStatusCode = response.status;
      record.request = request;
      if (!response.ok) {
        record.status = "failed";
        record.error = `HTTP ${response.status}`;
      }
      this.persist();
      return record;
    } catch (error) {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:poll:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "failed",
        memoryIds: [],
        externalIds: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "connector poll failed"
      };
      this.connectorSyncRecords.push(record);
      this.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, direction: "ingest", error: record.error } });
      this.persist();
      return record;
    }
  }

  connectorHealth(connectorId?: string) {
    return this.listConnectorManifests()
      .filter((manifest) => !connectorId || manifest.id === connectorId)
      .map((manifest) => {
        const records = this.listConnectorSyncRecords(manifest.id);
        const last = records.at(-1);
        const lastIngest = [...records].reverse().find((record) => record.direction === "ingest");
        const lastWriteback = [...records].reverse().find((record) => record.direction === "export");
        const vendorProvider = externalVendorProvider(manifest);
        const vendorStatus = vendorProvider ? externalVendorConfigured(vendorProvider) : undefined;
        return {
          connectorId: manifest.id,
          kind: manifest.kind,
          direction: manifest.direction,
          capabilities: manifest.capabilities,
          privacyPolicy: manifest.privacyPolicy ?? "project",
          supports: {
            list: Boolean(manifest.list?.endpoint),
            poll: Boolean(manifest.poll?.endpoint),
            ingest: manifest.capabilities.includes("ingest"),
            writeback: manifest.capabilities.includes("writeback") || manifest.capabilities.includes("export"),
            externalVendor: shouldUseExternalVendor(manifest, manifest.poll?.endpoint ?? manifest.list?.endpoint ?? manifest.writeback?.endpoint)
          },
          externalVendor: vendorProvider
            ? { provider: vendorProvider, configured: vendorStatus?.configured ?? false, missingEnv: vendorStatus?.missing ?? [] }
            : undefined,
          lastStatus: last?.status ?? "never_run",
          lastError: last?.error,
          lastSyncAt: lastIngest?.timestamp,
          lastWritebackAt: lastWriteback?.timestamp,
          records: records.length
        };
      });
  }

  async writebackConnector(
    connectorId: string,
    input: ConnectorWritebackInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
  ): Promise<ConnectorSyncRecord> {
    const manifest = this.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("writeback") && !manifest.capabilities.includes("export")) throw new Error(`Connector ${connectorId} does not support writeback`);
    const operation = input.operation ?? "comment";
    if (manifest.writeback?.operations?.length && !manifest.writeback.operations.includes(operation)) throw new Error(`Connector ${connectorId} does not support ${operation} writeback`);
    const memories = (input.memoryIds ?? []).map((id) => safeGet(this.store, id)).filter((memory): memory is Memory => Boolean(memory));
    const target = { ...(input.target ?? {}), externalId: input.externalId ?? input.target?.externalId };
    const payload = connectorWritebackPayload(manifest, operation, target, input.content, memories, input.metadata);
    const record: ConnectorSyncRecord = {
      id: `sync_${contentHash(`${connectorId}:writeback:${Date.now()}:${this.connectorSyncRecords.length}`).slice(2)}`,
      connectorId,
      direction: "export",
      status: "queued",
      memoryIds: memories.map((memory) => memory.id),
      externalIds: [input.externalId, target.externalId].filter((id): id is string => typeof id === "string" && id.length > 0),
      timestamp: new Date().toISOString(),
      operation,
      target,
      payload,
      adapter: `${manifest.kind}:${operation}`
    };
    const request = connectorWritebackRequest(manifest, record);
    if (shouldUseExternalVendor(manifest, manifest.writeback?.endpoint)) {
      const vendor = await writebackExternalVendorConnector(manifest, record, fetchImpl, timeoutMs, input.dryRun !== false);
      record.request = vendor.request;
      if (input.dryRun === false) {
        record.responseStatusCode = vendor.responseStatusCode;
        record.status = vendor.status;
        record.error = vendor.error;
      }
    } else if (request) {
      record.request = request;
    }
    if (request && input.dryRun === false && !shouldUseExternalVendor(manifest, manifest.writeback?.endpoint)) {
      try {
        const response = await fetchImpl(request.url, { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
        record.responseStatusCode = response.status;
        record.status = response.ok ? "applied" : "failed";
        if (!response.ok) record.error = `HTTP ${response.status}`;
      } catch (error) {
        record.status = "failed";
        record.error = error instanceof Error ? error.message : "connector writeback failed";
      }
    }
    this.connectorSyncRecords.push(record);
    this.recordAudit("connector.sync", { metadata: { connectorId, status: record.status, direction: "export", operation, adapter: record.adapter, memories: record.memoryIds.length } });
    this.persist();
    return record;
  }

  listConnectorSyncRecords(connectorId?: string): ConnectorSyncRecord[] {
    return this.connectorSyncRecords.filter((record) => !connectorId || record.connectorId === connectorId);
  }

  providerStatus(): ProviderAdapterStatus {
    return {
      active: Boolean(this.defaultExtractor || this.defaultSummarizer || this.defaultVerifier || this.defaultReranker || this.defaultQueryExpander || this.defaultTranslator),
      command: process.env.MEMORY_INTELLIGENCE_COMMAND,
      timeoutMs: Number(process.env.MEMORY_INTELLIGENCE_TIMEOUT_MS ?? 3500),
      tasks: ["contradiction", "rerank", "verify", "summarize", "extract", "expand", "translate"],
      fallback: "deterministic"
    };
  }

  translateText(text: string, sourceLanguage?: string, targetLanguage = "en"): TranslationReport {
    const provider = this.defaultTranslator?.translate({ text, sourceLanguage, targetLanguage });
    const translated = provider?.translated && provider.translated !== text ? provider.translated : deterministicTranslate(text, sourceLanguage, targetLanguage);
    const report: TranslationReport = {
      original: text,
      sourceLanguage,
      targetLanguage,
      translated,
      provider: provider?.translated && provider.translated !== text ? "json-command" : "deterministic",
      confidence: provider?.confidence ?? (translated === text ? 0.35 : 0.68)
    };
    this.recordAudit("provider.call", { metadata: { task: "translate", sourceLanguage, targetLanguage, provider: report.provider, confidence: report.confidence } });
    this.persist();
    return report;
  }

  ingestMedia(
    event: MemoryExtractionEvent,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">
  ): ExtractionReport {
    const media = normalizeMediaExtractionEvent(event);
    const normalized = media.language && !/^en/i.test(media.language)
      ? { ...media, content: this.translateText(media.content, media.language, "en").translated, metadata: { ...(media.metadata ?? {}), translatedFrom: media.language, originalContent: media.content } }
      : media;
    return this.extract([normalized], scope);
  }

  deliverWebhookQueue(handler?: (webhook: WebhookRegistration, event: AuditEvent) => { ok: boolean; error?: string }): { delivered: number; failed: number; queued: number } {
    let delivered = 0;
    let failed = 0;
    for (const delivery of this.webhookDeliveries) {
      if (delivery.status !== "queued" && delivery.status !== "failed") continue;
      if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt).getTime() > Date.now()) continue;
      const webhook = this.webhooks.get(delivery.webhookId);
      const event = this.auditEvents.find((item) => item.id === delivery.eventId);
      if (!webhook || !event || webhook.disabledAt) continue;
      const result = handler ? handler(webhook, event) : { ok: true };
      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      if (result.ok) {
        delivery.status = "delivered";
        delivery.lastError = undefined;
        delivered += 1;
      } else {
        delivery.status = "failed";
        delivery.lastError = result.error ?? "delivery failed";
        delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
        failed += 1;
      }
    }
    this.persist();
    return { delivered, failed, queued: this.webhookDeliveries.filter((delivery) => delivery.status === "queued").length };
  }

  async deliverWebhookQueueHttp(fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_WEBHOOK_TIMEOUT_MS ?? 10_000)): Promise<{ delivered: number; failed: number; queued: number }> {
    let delivered = 0;
    let failed = 0;
    for (const delivery of this.webhookDeliveries) {
      if (delivery.status !== "queued" && delivery.status !== "failed") continue;
      if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt).getTime() > Date.now()) continue;
      const webhook = this.webhooks.get(delivery.webhookId);
      const event = this.auditEvents.find((item) => item.id === delivery.eventId);
      if (!webhook || !event || webhook.disabledAt) continue;
      const body = JSON.stringify({ deliveryId: delivery.id, event });
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "user-agent": "cognibrain-webhook/0.1",
        "x-cognibrain-delivery": delivery.id,
        "x-cognibrain-event": event.type
      };
      if (webhook.secretRef) {
        headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", webhook.secretRef).update(body).digest("hex")}`;
      }
      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      try {
        const response = await fetchImpl(webhook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
        delivery.lastStatusCode = response.status;
        if (response.ok) {
          delivery.status = "delivered";
          delivery.lastError = undefined;
          delivery.nextAttemptAt = undefined;
          delivered += 1;
        } else {
          delivery.status = "failed";
          delivery.lastError = `HTTP ${response.status}`;
          delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
          failed += 1;
        }
      } catch (error) {
        delivery.status = "failed";
        delivery.lastError = error instanceof Error ? error.message : "delivery failed";
        delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
        failed += 1;
      }
    }
    this.persist();
    return { delivered, failed, queued: this.webhookDeliveries.filter((delivery) => delivery.status === "queued").length };
  }

  storageStatus(): StorageBackendStatus {
    const memory = {
      kind: "memory",
      durable: false,
      distributedReady: false,
      transactional: false,
      notes: ["Process-local adapter for tests and embedded runtimes."]
    };
    const json = { kind: "json-file", ...new JsonFilePersistenceAdapter(".memory-harness.json").capabilities() };
    const jsonl = { kind: "append-only-log", ...new AppendOnlyLogPersistenceAdapter(".memory-harness.jsonl").capabilities(), encryptedAppendLog: this.redactionPolicy.mode === "encrypt" };
    const postgres = { kind: "postgres-compatible", ...new PostgresCompatiblePersistenceAdapter(".memory-harness.postgres.json").capabilities() };
    const cockroach = { kind: "cockroach-compatible", ...new PostgresCompatiblePersistenceAdapter(".memory-harness.cockroach.json").capabilities(), notes: ["CockroachDB-compatible mode uses the PostgreSQL wire-protocol adapter and external quorum replication.", "Set MEMORY_STORAGE_BACKEND=cockroach with MEMORY_POSTGRES_URL in production."] };
    const cassandra = { kind: "cassandra-compatible", ...new CassandraCompatiblePersistenceAdapter(".memory-harness.cassandra.json").capabilities() };
    const postgresRemote = { kind: "postgres-remote", ...new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL ?? "postgres://user:pass@host:5432/cognibrain").capabilities() };
    const cockroachRemote = { kind: "cockroach-remote", ...new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL ?? "postgres://user:pass@host:26257/cognibrain", { cockroach: true }).capabilities() };
    const cassandraRemote = { kind: "cassandra-remote", ...new CassandraRemotePersistenceAdapter(process.env.MEMORY_CASSANDRA_CONTACT_POINT ?? "127.0.0.1").capabilities() };
    const sqlite = sqliteAvailable()
      ? { kind: "sqlite", ...new SQLitePersistenceAdapter(".memory-harness.sqlite").capabilities() }
      : {
          kind: "sqlite",
          durable: false,
          distributedReady: false,
          transactional: false,
          appendOnly: false,
          sql: true,
          encryptedAtRest: false,
          migrationSafe: false,
          lexical: { strategy: "none" as const, indexed: false, notes: ["SQLite FTS5 is unavailable in this Node runtime."] },
          vector: { strategy: "in-memory" as const, indexed: false, notes: ["Optional embedding providers can score vectors in memory for development without API keys."] },
          notes: ["Unavailable in this Node runtime; use Node with node:sqlite or another SQL adapter."]
        };
    return {
      active: this.persistence?.kind ?? "memory",
      adapters: [memory, json, jsonl, sqlite, postgres, cockroach, cassandra, postgresRemote, cockroachRemote, cassandraRemote]
    };
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
    return this.auditEvents
      .filter((event) => !filter.userId || event.userId === filter.userId)
      .filter((event) => !filter.memoryId || event.memoryId === filter.memoryId)
      .filter((event) => !filter.type || event.type === filter.type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  auditChain(filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditChainExport {
    const events = this.auditTrail(filter)
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((event) => this.toJournalEvent(event));
    const replay = this.replayAuditEvents(events);
    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      eventCount: events.length,
      headHash: events.at(-1)?.hash,
      valid: replay.valid,
      events,
      replay
    };
  }

  replayAuditState(events: AuditEvent[] = this.auditEvents): AuditChainExport["replay"] {
    return this.replayAuditEvents(events.map((event) => this.toJournalEvent(event)));
  }

  updateConsent(memoryId: string, consent: Partial<ConsentPolicy>): Memory {
    const before = this.store.get(memoryId);
    const memory = this.store.update(memoryId, { consent });
    this.recordAudit("memory.consent", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId, metadata: { before, after: memory, beforeConsent: before.consent, afterConsent: memory.consent } });
    this.persist();
    return memory;
  }

  revertMemory(memoryId: string, auditEventId?: string): Memory {
    const candidates = this.auditEvents
      .filter((event) => event.memoryId === memoryId && (event.type === "memory.update" || event.type === "memory.consent" || event.type === "memory.delete"))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const event = auditEventId ? candidates.find((candidate) => candidate.id === auditEventId) : candidates[0];
    const before = event?.metadata?.before as Memory | undefined;
    if (!event || !before) throw new Error(`No revert snapshot found for memory ${memoryId}`);
    const restored = this.restoreMemorySnapshot(before);
    this.recordAudit("memory.revert", { userId: restored.userId, brainId: restored.brainId, sourceId: restored.sourceId, memoryId, metadata: { revertedEventId: event.id } });
    this.persist();
    return restored;
  }

  queueOfflineOperation(input: Omit<OfflineOperation, "id" | "occurredAt" | "status"> & { id?: string; occurredAt?: Date | string; status?: OfflineOperation["status"] }): OfflineOperation {
    const operation: OfflineOperation = {
      ...input,
      id: input.id ?? `op_${contentHash(`${input.type}:${input.userId}:${input.clientMutationId ?? Date.now()}`).slice(2)}`,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      status: input.status ?? "queued"
    };
    this.offlineOperations.push(operation);
    this.recordAudit("sync.queue", { userId: operation.userId, memoryId: operation.memoryId, metadata: { operationId: operation.id, type: operation.type } });
    this.persist();
    return operation;
  }

  syncOfflineOperations(): SyncReport {
    const applied: OfflineOperation[] = [];
    const conflicts: OfflineOperation[] = [];
    const failed: OfflineOperation[] = [];
    const remaining: OfflineOperation[] = [];
    for (const operation of this.offlineOperations) {
      if (operation.status !== "queued") {
        remaining.push(operation);
        continue;
      }
      const resolved = this.applyOfflineOperation(operation);
      if (resolved.status === "applied") applied.push(resolved);
      else if (resolved.status === "conflict") conflicts.push(resolved);
      else failed.push(resolved);
      if (resolved.status !== "applied") remaining.push(resolved);
    }
    this.offlineOperations = remaining;
    const report: SyncReport = {
      generatedAt: new Date().toISOString(),
      applied,
      conflicts,
      failed,
      remaining: [...this.offlineOperations]
    };
    this.recordAudit("sync.run", { metadata: { applied: applied.length, conflicts: conflicts.length, failed: failed.length, remaining: remaining.length } });
    this.persist();
    return report;
  }

  syncStatus(): { queued: OfflineOperation[]; counts: Record<OfflineOperation["status"], number> } {
    const counts: Record<OfflineOperation["status"], number> = { queued: 0, applied: 0, conflict: 0, failed: 0 };
    for (const operation of this.offlineOperations) counts[operation.status] += 1;
    return { queued: [...this.offlineOperations], counts };
  }

  registerAgent(input: Omit<AgentRegistration, "createdAt" | "updatedAt">): AgentRegistration {
    const now = new Date().toISOString();
    const agent = { ...input, createdAt: now, updatedAt: now };
    this.agents.set(agent.id, agent);
    this.recordAudit("agent.register", { actorId: agent.id, metadata: { resource: "agent", namespace: agent.namespace, brainIds: agent.brainIds, permissions: agent.permissions } });
    this.persist();
    return agent;
  }

  listAgents(): AgentRegistration[] {
    return [...this.agents.values()].sort((a, b) => a.namespace.localeCompare(b.namespace));
  }

  assignAgentPersona(agentId: string, personaId: string): AgentRegistration {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    if (!this.personas.has(personaId)) throw new Error(`Persona not found: ${personaId}`);
    const updated = { ...agent, personaId, updatedAt: new Date().toISOString() };
    this.agents.set(agentId, updated);
    this.recordAudit("agent.register", { actorId: agentId, metadata: { resource: "agent-persona", personaId } });
    this.persist();
    return updated;
  }

  setPersona(input: Omit<PersonaProfile, "createdAt" | "updatedAt">): PersonaProfile {
    const now = new Date().toISOString();
    const persona = { ...input, createdAt: now, updatedAt: now };
    this.personas.set(persona.id, persona);
    this.recordAudit("persona.set", { metadata: { personaId: persona.id, domain: persona.domain, privacyDefault: persona.privacyDefault } });
    this.persist();
    return persona;
  }

  listPersonas(): PersonaProfile[] {
    return [...this.personas.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  promoteSharedMemory(memoryId: string, orgId: string): Memory {
    const memory = this.store.get(memoryId);
    return this.reviewSharedMemory(memoryId, { orgId, reviewerId: memory.userId, decision: "approve" });
  }

  reviewSharedMemory(memoryId: string, input: { orgId: string; reviewerId: string; decision: "approve" | "reject"; note?: string }): Memory {
    const memory = this.store.get(memoryId);
    if (!this.canReviewSharedMemory(memory, input.reviewerId, input.orgId)) throw new Error(`Reviewer ${input.reviewerId} cannot review memory ${memoryId}`);
    const approved = input.decision === "approve";
    const updated = this.store.update(memoryId, {
      orgId: approved ? input.orgId : memory.orgId,
      consent: approved ? { ...memory.consent, visibility: "org" } : memory.consent,
      metadata: {
        shared: {
          ...(memory.metadata.shared as Record<string, unknown> | undefined),
          status: approved ? "approved" : "rejected",
          orgId: input.orgId,
          reviewedAt: new Date().toISOString(),
          reviewedBy: input.reviewerId,
          note: input.note
        }
      }
    });
    this.recordAudit(approved ? "memory.share" : "memory.share.revoke", { actorId: input.reviewerId, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId: input.orgId, decision: input.decision, note: input.note } });
    this.persist();
    return updated;
  }

  requestSharedMemory(memoryId: string, orgId: string, requestedBy?: string, note?: string): Memory {
    const memory = this.store.get(memoryId);
    const updated = this.store.update(memoryId, {
      metadata: {
        shared: {
          status: "pending",
          orgId,
          requestedBy,
          requestedAt: new Date().toISOString(),
          note
        }
      }
    });
    this.recordAudit("memory.share.request", { actorId: requestedBy, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId, note } });
    this.persist();
    return updated;
  }

  revokeSharedMemory(memoryId: string, actorId?: string, reason?: string): Memory {
    const memory = this.store.get(memoryId);
    const updated = this.store.update(memoryId, {
      consent: { ...memory.consent, visibility: "user" },
      metadata: {
        shared: {
          ...(memory.metadata.shared as Record<string, unknown> | undefined),
          status: "revoked",
          revokedAt: new Date().toISOString(),
          revokedBy: actorId,
          reason
        }
      }
    });
    this.recordAudit("memory.share.revoke", { actorId, userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { reason } });
    this.persist();
    return updated;
  }

  graphPaths(from: string, to: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }) {
    const memories = this.store.list(options?.userId).filter((memory) => !memory.archivedAt);
    return findGraphPaths(memories, from, to, options);
  }

  graphExplain(from: string, to: string, options: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string; strategy?: GraphExplainReport["strategy"] } = {}): GraphExplainReport {
    const strategy = options.strategy ?? "strongest";
    const paths = this.graphPaths(from, to, { ...options, limit: Math.max(options.limit ?? 5, 8) });
    const ranked = [...paths].sort((a, b) => {
      if (strategy === "shortest") return a.edges.length - b.edges.length || b.score - a.score;
      if (strategy === "most_recent") return newestPathTime(b) - newestPathTime(a) || b.score - a.score;
      if (strategy === "highest_trust") return averagePathTrust(b) - averagePathTrust(a) || b.score - a.score;
      return b.score - a.score || a.edges.length - b.edges.length;
    });
    return { from, to, strategy, validAt: options.validAt, paths: ranked.slice(0, options.limit ?? 5) };
  }

  graphQuery(query: string, userId?: string) {
    return queryMemoryGraph(this.store.list(userId).filter((memory) => !memory.archivedAt), query);
  }

  graphActivation(query: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number; validAt?: Date | string }): GraphActivationResult {
    return activateGraph(this.store.list(options?.userId).filter((memory) => !memory.archivedAt), query, options);
  }

  graphExport(options: GraphExportOptions = {}): GraphExportResult | string {
    return exportMemoryGraph(this.store.list(options.userId).filter((memory) => !memory.archivedAt), options);
  }

  runInference(rules?: Parameters<typeof inferGraphRelations>[1]): ReturnType<typeof inferGraphRelations> {
    const report = inferGraphRelations(this.store.list().filter((memory) => !memory.archivedAt), rules);
    for (const item of report.inferred) {
      const memory = this.store.get(item.memoryId);
      this.store.update(item.memoryId, { relations: [...memory.relations, item.relation] });
    }
    this.recordAudit("inference.run", { metadata: { rulesEvaluated: report.rulesEvaluated, inferred: report.inferred.length } });
    this.persist();
    return report;
  }

  registerWebhook(input: Omit<WebhookRegistration, "id" | "createdAt"> & { id?: string }): WebhookRegistration {
    const webhook: WebhookRegistration = {
      ...input,
      id: input.id ?? `wh_${contentHash(`${input.url}:${input.events.join(",")}`).slice(2)}`,
      createdAt: new Date().toISOString()
    };
    this.webhooks.set(webhook.id, webhook);
    this.recordAudit("webhook.register", { metadata: { webhookId: webhook.id, events: webhook.events } });
    this.persist();
    return webhook;
  }

  eventFeed(filter: { agentId?: string; brainId?: string; sourceId?: string; type?: AuditEvent["type"] } = {}): { auditEvents: AuditEvent[]; deliveries: WebhookDelivery[] } {
    const agent = filter.agentId ? this.agents.get(filter.agentId) : undefined;
    const subscriptionEvents = new Set(agent?.subscriptions?.events ?? []);
    const subscriptionBrainIds = new Set(agent?.subscriptions?.brainIds ?? agent?.brainIds ?? []);
    const subscriptionSourceIds = new Set(agent?.subscriptions?.sourceIds ?? []);
    const auditEvents = this.auditEvents
      .filter((event) => !filter.type || event.type === filter.type)
      .filter((event) => !filter.brainId || event.brainId === filter.brainId)
      .filter((event) => !filter.sourceId || event.sourceId === filter.sourceId)
      .filter((event) => {
        if (!agent) return true;
        if (subscriptionEvents.size && !subscriptionEvents.has(event.type)) return false;
        if (event.brainId && subscriptionBrainIds.size && !subscriptionBrainIds.has(event.brainId) && !agent.permissions.includes("admin")) return false;
        if (event.sourceId && subscriptionSourceIds.size && !subscriptionSourceIds.has(event.sourceId)) return false;
        return true;
      });
    const visibleEventIds = new Set(auditEvents.map((event) => event.id));
    return { auditEvents, deliveries: this.webhookDeliveries.filter((delivery) => visibleEventIds.has(delivery.eventId)) };
  }

  installMarketplaceModule(module: MarketplaceModule): MarketplaceModule {
    const plan = this.marketplaceInstallPlan(module);
    if (!plan.valid) throw new Error(`Marketplace module failed validation: ${plan.risks.join(", ")}`);
    const current = this.marketplaceModules.get(module.id);
    const installed = {
      ...module,
      security: module.security ?? securityScanFor(module),
      installState: "installed" as const,
      trustSignals: {
        ...(module.trustSignals ?? current?.trustSignals),
        securityStatus: (module.security ?? current?.security)?.status ?? securityScanFor(module).status,
        installCount: (current?.trustSignals?.installCount ?? module.trustSignals?.installCount ?? 0) + 1
      }
    };
    this.marketplaceModules.set(installed.id, installed);
    if (installed.kind === "persona") {
      const manifest = installed.manifest as Partial<PersonaProfile>;
      if (manifest.id && manifest.label) {
        this.setPersona({
          id: manifest.id,
          label: manifest.label,
          summaryStyle: manifest.summaryStyle ?? "concise",
          retrievalWeights: manifest.retrievalWeights,
          privacyDefault: manifest.privacyDefault,
          domain: manifest.domain
        });
      }
    }
    if (installed.kind === "connector") {
      this.registerConnectorManifest(installed.manifest as unknown as ConnectorManifest);
    }
    if (installed.kind === "domain") {
      const manifest = installed.manifest as { id?: string };
      const domain = DOMAIN_MODULES.find((item) => item.id === manifest.id);
      if (domain) {
        if (domain.aliases) this.entities.configureAliases(domain.aliases);
        if (domain.retrievalWeights) {
          this.setRetrievalProfile({
            id: `domain:${domain.id}`,
            label: `${domain.label} Domain`,
            weights: domain.retrievalWeights,
            provenance: "marketplace"
          });
        }
      }
    }
    if (installed.kind === "retrieval_profile") {
      const manifest = installed.manifest as Partial<RetrievalProfile>;
      if (manifest.id && manifest.weights) this.setRetrievalProfile({ id: manifest.id, label: manifest.label ?? installed.name, weights: manifest.weights, provenance: "marketplace" });
    }
    this.recordAudit("marketplace.install", { metadata: { moduleId: installed.id, kind: installed.kind, actions: plan.actions, risks: plan.risks } });
    this.persist();
    return installed;
  }

  installMarketplaceModuleById(moduleId: string): MarketplaceModule {
    const module = this.marketplaceModules.get(moduleId);
    if (!module) throw new Error(`Marketplace module not found: ${moduleId}`);
    return this.installMarketplaceModule(module);
  }

  marketplaceInstallPlan(moduleOrId: MarketplaceModule | string): MarketplaceInstallPlan {
    const module = typeof moduleOrId === "string" ? this.marketplaceModules.get(moduleOrId) : moduleOrId;
    if (!module) return { moduleId: String(moduleOrId), valid: false, actions: [], risks: ["module not found"] };
    const risks = marketplaceRisks(module);
    const actions = [`record ${module.kind} module ${module.id}`];
    actions.push("verify module signature metadata");
    actions.push("check cognibrain version compatibility");
    if (module.security?.permissions?.length) actions.push(`request permissions: ${module.security.permissions.join(", ")}`);
    if (module.kind === "persona") actions.push("materialize persona defaults");
    if (module.kind === "connector") actions.push("register connector manifest");
    if (module.kind === "retrieval_profile") actions.push("save retrieval profile");
    if (module.kind === "domain") actions.push("make domain module available for runtime config");
    return { moduleId: module.id, valid: risks.every((risk) => !risk.startsWith("blocked:")), actions, risks };
  }

  listMarketplaceModules(): MarketplaceModule[] {
    return [...this.marketplaceModules.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  submitMarketplaceModule(input: { module: MarketplaceModule; submitter: string; sourceUrl?: string }): MarketplaceSubmission {
    const id = `submission_${contentHash(`${input.module.id}:${input.module.version}:${input.submitter}`).slice(2, 14)}`;
    const submittedAt = new Date().toISOString();
    const submission: MarketplaceSubmission = {
      id,
      module: {
        ...input.module,
        installState: "available",
        trustSignals: {
          ...(input.module.trustSignals ?? {}),
          publisher: input.submitter,
          sourceUrl: input.sourceUrl
        }
      },
      submitter: input.submitter,
      sourceUrl: input.sourceUrl,
      status: "submitted",
      submittedAt,
      reviewNotes: [],
      reviews: []
    };
    this.marketplaceSubmissions.set(id, submission);
    this.recordAudit("marketplace.submit", { actorId: input.submitter, metadata: { submissionId: id, moduleId: input.module.id, sourceUrl: input.sourceUrl } });
    this.persist();
    return submission;
  }

  scanMarketplaceSubmission(submissionId: string): MarketplaceSubmission {
    const submission = this.requireMarketplaceSubmission(submissionId);
    const scan = securityScanFor(submission.module);
    const updated: MarketplaceSubmission = {
      ...submission,
      status: scan.status === "blocked" ? "changes_requested" : "scanned",
      scannedAt: new Date().toISOString(),
      scan,
      module: {
        ...submission.module,
        security: scan,
        trustSignals: { ...(submission.module.trustSignals ?? {}), securityStatus: scan.status }
      },
      reviewNotes: [...submission.reviewNotes, ...scan.risks]
    };
    this.marketplaceSubmissions.set(submissionId, updated);
    this.recordAudit("marketplace.scan", { actorId: "security-scan", metadata: { submissionId, moduleId: updated.module.id, status: scan.status, risks: scan.risks } });
    this.persist();
    return updated;
  }

  reviewMarketplaceSubmission(submissionId: string, review: { reviewer: string; rating: number; comment?: string; approve?: boolean; requestChanges?: boolean; reject?: boolean }): MarketplaceSubmission {
    const submission = this.requireMarketplaceSubmission(submissionId);
    const normalizedReview: MarketplaceReview = {
      reviewer: review.reviewer,
      rating: clampRating(review.rating),
      comment: review.comment,
      createdAt: new Date().toISOString()
    };
    const reviews = [...submission.reviews, normalizedReview];
    const status = review.reject
      ? "rejected"
      : review.requestChanges
        ? "changes_requested"
        : review.approve
          ? "approved"
          : submission.status;
    const updated: MarketplaceSubmission = {
      ...submission,
      status,
      reviewedAt: normalizedReview.createdAt,
      reviews,
      reviewNotes: review.comment ? [...submission.reviewNotes, review.comment] : submission.reviewNotes,
      module: {
        ...submission.module,
        trustSignals: {
          ...(submission.module.trustSignals ?? {}),
          ratingAverage: averageRating(reviews),
          ratingCount: reviews.length,
          reviewCount: reviews.length,
          lastReviewedAt: normalizedReview.createdAt
        }
      }
    };
    this.marketplaceSubmissions.set(submissionId, updated);
    this.recordAudit("marketplace.review", { actorId: review.reviewer, metadata: { submissionId, moduleId: updated.module.id, status, rating: normalizedReview.rating } });
    this.persist();
    return updated;
  }

  publishMarketplaceSubmission(submissionId: string): MarketplaceModule {
    const submission = this.requireMarketplaceSubmission(submissionId);
    if (submission.status !== "approved" && submission.status !== "scanned") throw new Error(`Marketplace submission ${submissionId} must be scanned or approved before publish`);
    const scan = submission.scan ?? securityScanFor(submission.module);
    if (scan.status === "blocked") throw new Error(`Marketplace submission ${submissionId} is blocked by security scan`);
    const publishedAt = new Date().toISOString();
    const published: MarketplaceModule = {
      ...submission.module,
      security: scan,
      installState: "available",
      trustSignals: {
        ...(submission.module.trustSignals ?? {}),
        securityStatus: scan.status,
        publisher: submission.submitter,
        publishedAt,
        sourceUrl: submission.sourceUrl,
        ratingAverage: averageRating(submission.reviews),
        ratingCount: submission.reviews.length,
        reviewCount: submission.reviews.length
      }
    };
    const updated: MarketplaceSubmission = { ...submission, status: "published", publishedAt, module: published, scan };
    this.marketplaceSubmissions.set(submissionId, updated);
    this.marketplaceModules.set(published.id, published);
    this.recordAudit("marketplace.publish", { actorId: submission.submitter, metadata: { submissionId, moduleId: published.id, securityStatus: scan.status } });
    this.persist();
    return published;
  }

  listMarketplaceSubmissions(status?: MarketplaceSubmission["status"]): MarketplaceSubmission[] {
    return [...this.marketplaceSubmissions.values()]
      .filter((submission) => !status || submission.status === status)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  }

  rateMarketplaceModule(moduleId: string, review: { reviewer: string; rating: number; comment?: string }): MarketplaceModule {
    const module = this.marketplaceModules.get(moduleId);
    if (!module) throw new Error(`Marketplace module not found: ${moduleId}`);
    const priorCount = module.trustSignals?.ratingCount ?? 0;
    const priorAverage = module.trustSignals?.ratingAverage ?? 0;
    const rating = clampRating(review.rating);
    const ratingCount = priorCount + 1;
    const updated: MarketplaceModule = {
      ...module,
      trustSignals: {
        ...(module.trustSignals ?? {}),
        ratingAverage: ((priorAverage * priorCount) + rating) / ratingCount,
        ratingCount,
        reviewCount: (module.trustSignals?.reviewCount ?? 0) + (review.comment ? 1 : 0),
        lastReviewedAt: new Date().toISOString()
      }
    };
    this.marketplaceModules.set(moduleId, updated);
    this.recordAudit("marketplace.review", { actorId: review.reviewer, metadata: { moduleId, rating, comment: review.comment } });
    this.persist();
    return updated;
  }

  private requireMarketplaceSubmission(submissionId: string): MarketplaceSubmission {
    const submission = this.marketplaceSubmissions.get(submissionId);
    if (!submission) throw new Error(`Marketplace submission not found: ${submissionId}`);
    return submission;
  }

  apiDescription(auth?: { mode: "open-local-dev" | "api-key"; protected: boolean; warning?: string }) {
    const protectedAuth: Array<Record<string, string[]>> = auth?.protected ? [{ ApiKeyAuth: [] }, { BearerAuth: [] }] : [];
    const routeMethods: Record<string, string[]> = {
      "/memories": ["GET", "POST"],
      "/episodes": ["GET"],
      "/episodes/{id}": ["GET"],
      "/actions": ["POST"],
      "/code/corrections": ["POST"],
      "/code/action-guard": ["POST"],
      "/search": ["POST"],
      "/route": ["POST"],
      "/intent": ["POST"],
      "/evidence-pack": ["POST"],
      "/coding-context-pack": ["POST"],
      "/coding-context-packs/{id}": ["GET"],
      "/patch-evidence": ["POST"],
      "/evidence-pack/{id}": ["GET"],
      "/context-packs/{id}": ["GET"],
      "/context-packs/{id}/evidence": ["GET"],
      "/feedback": ["POST"],
      "/feedback/injection": ["POST"],
      "/verification/{userId}": ["GET"],
      "/memories/{id}": ["GET", "PATCH", "DELETE"],
      "/memories/{id}/archive": ["POST"],
      "/memories/{id}/confirm": ["POST"],
      "/memories/{id}/retract": ["POST"],
      "/memories/{id}/consent": ["POST"],
      "/memories/{id}/revert": ["POST"],
      "/graph": ["GET"],
      "/graph/paths": ["GET"],
      "/graph/explain": ["GET"],
      "/graph/activate": ["GET"],
      "/graph/export": ["GET"],
      "/graph/query": ["POST"],
      "/audit": ["GET"],
      "/audit/chain": ["GET"],
      "/events": ["GET"],
      "/webhooks": ["POST"],
      "/webhooks/deliveries": ["GET"],
      "/webhooks/deliver": ["POST"],
      "/marketplace": ["GET"],
      "/marketplace/submissions": ["GET", "POST"],
      "/marketplace/scan": ["POST"],
      "/marketplace/review": ["POST"],
      "/marketplace/publish": ["POST"],
      "/marketplace/rate": ["POST"],
      "/marketplace/install": ["POST"],
      "/marketplace/plan": ["POST"],
      "/managed/tenants": ["GET", "POST"],
      "/managed/control-plane": ["GET"],
      "/connectors": ["GET"],
      "/connectors/register": ["POST"],
      "/connectors/sync": ["POST"],
      "/connectors/health": ["GET"],
      "/connectors/auth": ["GET"],
      "/connectors/auth/begin": ["POST"],
      "/connectors/auth/callback": ["POST"],
      "/connectors/auth/revoke": ["POST"],
      "/connectors/list": ["POST"],
      "/connectors/poll": ["POST"],
      "/connectors/writeback": ["POST"],
      "/connectors/feedback": ["POST"],
      "/connectors/telemetry": ["POST"],
      "/profiles": ["GET", "PUT"],
      "/profiles/learn": ["POST"],
      "/profiles/training-samples": ["POST"],
      "/migration/export": ["POST"],
      "/migration/import": ["POST"],
      "/backup/verify": ["POST"],
      "/policy/rules": ["GET", "POST"],
      "/policy/evaluate": ["POST"],
      "/retention/rules": ["GET", "POST"],
      "/retention/enforce": ["POST"],
      "/retention/review": ["GET"],
      "/privacy/insights": ["GET"],
      "/privacy/cross-brain-compute": ["POST"],
      "/security/key-provider": ["GET"],
      "/security/transport": ["GET"],
      "/compliance/export": ["GET"],
      "/auth/status": ["GET"],
      "/storage": ["GET"],
      "/providers": ["GET"],
      "/translate": ["POST"],
      "/ingest/media": ["POST"],
      "/sdk/openapi": ["GET"],
      "/openapi.json": ["GET"],
      "/v1/openapi.json": ["GET"]
    };
    return {
      openapi: "3.1.0",
      info: { title: "cognibrain API", version: "0.1.0" },
      servers: [{ url: "/v1", description: "Versioned local API prefix" }],
      security: protectedAuth,
      paths: openApiPaths(routeMethods, protectedAuth),
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key" },
          BearerAuth: { type: "http", scheme: "bearer" }
        },
        schemas: openApiSchemas()
      },
      "x-cognibrain-generatedFrom": ["src/api/server.ts route registry", "src/core/types.ts public contracts", "src/api/service.ts apiDescription"],
      "x-cognibrain-auth": auth ?? {
        mode: "open-local-dev",
        protected: false,
        warning: "API authentication is disabled for local development. Set MEMORY_API_KEYS or MEMORY_REQUIRE_AUTH=true before exposing this server."
      },
      clients: {
        typescript: "src/sdk/client.ts",
        python: "sdk/python/cognibrain_client.py",
        openapiCodegen: "/sdk/openapi"
      }
    };
  }

  managedMigrationBundle(options: { target?: ManagedMigrationBundle["target"]; backupRef?: string; ssoProvider?: string; secretManager?: string } = {}): ManagedMigrationBundle {
    const target = options.target ?? "backup";
    const keyReport = this.securityKeyReport();
    return {
      generatedAt: new Date().toISOString(),
      target,
      counts: {
        memories: this.store.list().length,
        episodes: this.episodes.size,
        profiles: this.retrievalProfiles.size,
        personas: this.personas.size,
        connectors: this.connectorManifests.size,
        policyRules: this.policyRules.size,
        retentionRules: this.retentionRules.size
      },
      backup: {
        recommended: target !== "backup",
        encryptionKeyIds: Object.keys(keyReport.keyIds),
        backupRef: options.backupRef
      },
      placeholders: {
        sso: { required: target === "managed", provider: options.ssoProvider, note: "Provision SCIM/OIDC externally; this local bundle carries only the provider label." },
        secretManager: { required: keyReport.encrypted > 0, provider: options.secretManager, note: "Move MEMORY_ENCRYPTION_KEY into the target secret manager before importing encrypted memories." }
      },
      deployment: this.managedDeploymentPlan({ target, ssoProvider: options.ssoProvider, secretManager: options.secretManager }),
      manifest: {
        memories: this.store.export(),
        episodes: [...this.episodes.values()],
        retrievalProfiles: [...this.retrievalProfiles.values()],
        personas: [...this.personas.values()],
        connectors: [...this.connectorManifests.values()],
        marketplaceModules: [...this.marketplaceModules.values()],
        policyRules: [...this.policyRules.values()],
        retentionRules: [...this.retentionRules.values()],
        compliance: this.complianceReport()
      }
    };
  }

  importMigrationBundle(bundle: ManagedMigrationBundle): { importedMemories: number; importedEpisodes: number; importedProfiles: number; importedPersonas: number; importedConnectors: number; importedPolicyRules: number; importedRetentionRules: number } {
    const manifest = bundle.manifest as {
      memories?: Memory[];
      episodes?: EpisodeRecord[];
      retrievalProfiles?: RetrievalProfile[];
      personas?: PersonaProfile[];
      connectors?: ConnectorManifest[];
      marketplaceModules?: MarketplaceModule[];
      policyRules?: MemoryPolicyRule[];
      retentionRules?: RetentionRule[];
    };
    const imported = manifest.memories?.length ? this.store.import(manifest.memories) : [];
    for (const episode of manifest.episodes ?? []) this.episodes.set(episode.id, episode);
    for (const profile of manifest.retrievalProfiles ?? []) this.setRetrievalProfile({ ...profile, updatedAt: new Date(profile.updatedAt).toISOString() });
    for (const persona of manifest.personas ?? []) this.personas.set(persona.id, persona);
    for (const connector of manifest.connectors ?? []) this.connectorManifests.set(connector.id, connector);
    for (const module of manifest.marketplaceModules ?? []) this.marketplaceModules.set(module.id, module);
    for (const rule of manifest.policyRules ?? []) this.policyRules.set(rule.id, rule);
    for (const rule of manifest.retentionRules ?? []) this.retentionRules.set(rule.id, rule);
    this.recordAudit("sync.run", { metadata: { action: "migration.import", importedMemories: imported.length, target: bundle.target } });
    this.persist();
    return {
      importedMemories: imported.length,
      importedEpisodes: manifest.episodes?.length ?? 0,
      importedProfiles: manifest.retrievalProfiles?.length ?? 0,
      importedPersonas: manifest.personas?.length ?? 0,
      importedConnectors: manifest.connectors?.length ?? 0,
      importedPolicyRules: manifest.policyRules?.length ?? 0,
      importedRetentionRules: manifest.retentionRules?.length ?? 0
    };
  }

  verifyBackupRecovery(bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport {
    const manifest = bundle?.manifest as { memories?: Memory[] } | undefined;
    const memories = manifest?.memories ?? this.store.export();
    const keyring = options.keyring ?? this.defaultKeyring();
    const recovered: string[] = [];
    const failed: Array<{ memoryId: string; reason: string }> = [];
    for (const memory of memories) {
      const privacy = memory.metadata.privacy as { encrypted?: boolean } | undefined;
      if (!privacy?.encrypted) continue;
      const decrypted = decryptMemoryContent(memory, keyring);
      if (decrypted.ok) recovered.push(memory.id);
      else failed.push({ memoryId: memory.id, reason: decrypted.error ?? "decryption failed" });
    }
    return {
      generatedAt: new Date().toISOString(),
      backupRef: bundle?.backup.backupRef ?? this.securityKeyReport().backupRefs[0],
      encryptedMemories: recovered.length + failed.length,
      recovered,
      failed,
      verified: failed.length === 0
    };
  }

  setRetentionRule(input: Omit<RetentionRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): RetentionRule {
    if (input.retentionDays < 0) throw new Error("Retention days must be non-negative.");
    const now = new Date().toISOString();
    const existing = input.id ? this.retentionRules.get(input.id) : undefined;
    const scope = input.scope ? { ...input.scope, entity: input.scope.entity?.toLowerCase(), tag: input.scope.tag?.toLowerCase() } : undefined;
    const rule: RetentionRule = {
      ...input,
      scope,
      id: input.id ?? `ret_${contentHash(`${input.label}:${now}`).slice(2)}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.retentionRules.set(rule.id, rule);
    this.recordAudit("retention.enforce", { metadata: { action: "rule.set", rule } });
    this.persist();
    return rule;
  }

  listRetentionRules(): RetentionRule[] {
    return [...this.retentionRules.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  enforceRetention(now = new Date(), userId?: string): RetentionEnforcementReport {
    const report: RetentionEnforcementReport = {
      generatedAt: now.toISOString(),
      evaluated: 0,
      archived: [],
      deleted: [],
      episodeArchived: [],
      episodeDeleted: [],
      rulesMatched: {}
    };
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    for (const memory of memories) {
      report.evaluated += 1;
      const consentExpired = memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime();
      const matchedRules = [...this.retentionRules.values()].filter((rule) => retentionRuleMatches(memory, rule, now));
      for (const rule of matchedRules) report.rulesMatched[rule.id] = (report.rulesMatched[rule.id] ?? 0) + 1;
      const deleteRule = matchedRules.find((rule) => rule.action === "delete");
      if (deleteRule) {
        this.store.delete(memory.id);
        this.applyEpisodeRetention(memory.id, "delete", "retention.rule", deleteRule.id, now, report);
        report.deleted.push(memory.id);
        this.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "delete", ruleId: deleteRule.id, before: memory } });
        continue;
      }
      const archiveRule = matchedRules[0];
      if (consentExpired || archiveRule) {
        const archived = this.store.archive(memory.id);
        this.applyEpisodeRetention(memory.id, "archive", consentExpired ? "consent.retentionUntil" : "retention.rule", archiveRule?.id, now, report);
        report.archived.push(memory.id);
        this.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", reason: consentExpired ? "consent.retentionUntil" : "retention.rule", ruleId: archiveRule?.id, after: archived } });
      }
    }
    if (report.archived.length || report.deleted.length) this.persist();
    return report;
  }

  retentionReview(now = new Date(), userId?: string): RetentionReviewReport {
    const expiredMemories: RetentionReviewReport["expiredMemories"] = [];
    const episodeRiskMap = new Map<string, RetentionReviewReport["episodeRisks"][number]>();
    for (const memory of this.store.list(userId).filter((item) => !item.archivedAt)) {
      const consentExpired = memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime();
      const matchedRules = [...this.retentionRules.values()].filter((rule) => retentionRuleMatches(memory, rule, now));
      if (!consentExpired && !matchedRules.length) continue;
      const deleteRule = matchedRules.find((rule) => rule.action === "delete");
      const archiveRule = matchedRules[0];
      const action = deleteRule ? "delete" : "archive";
      const reason = consentExpired ? "consent.retentionUntil" : "retention.rule";
      expiredMemories.push({ memoryId: memory.id, reason, ruleId: deleteRule?.id ?? archiveRule?.id, action });
      for (const episode of this.episodes.values()) {
        if (!episode.memoryIds.includes(memory.id)) continue;
        const existing = episodeRiskMap.get(episode.id);
        const memoryIds = [...new Set([...(existing?.memoryIds ?? []), memory.id])];
        episodeRiskMap.set(episode.id, { episodeId: episode.id, memoryIds, reason, action: existing?.action === "delete" || action === "delete" ? "delete" : "archive" });
      }
    }
    const episodeRisks = [...episodeRiskMap.values()];
    return {
      generatedAt: now.toISOString(),
      userId,
      rules: this.listRetentionRules(),
      expiredMemories,
      episodeRisks,
      summary: {
        memoriesAtRisk: expiredMemories.length,
        episodesAtRisk: episodeRisks.length,
        deleteActions: expiredMemories.filter((item) => item.action === "delete").length + episodeRisks.filter((item) => item.action === "delete").length,
        archiveActions: expiredMemories.filter((item) => item.action === "archive").length + episodeRisks.filter((item) => item.action === "archive").length
      }
    };
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
    const report: SecurityKeyReport = { encrypted: 0, keyIds: {}, keyVersions: {}, rotated: 0, missingKeyMetadata: 0, backupRefs: [] };
    for (const memory of this.store.list()) {
      const privacy = memory.metadata.privacy as { encrypted?: boolean; keyId?: string; keyVersion?: string; rotatedAt?: string; rotationHistory?: unknown[]; backupRef?: string } | undefined;
      if (!privacy?.encrypted) continue;
      report.encrypted += 1;
      if (privacy.keyId) report.keyIds[privacy.keyId] = (report.keyIds[privacy.keyId] ?? 0) + 1;
      if (privacy.keyVersion) report.keyVersions[privacy.keyVersion] = (report.keyVersions[privacy.keyVersion] ?? 0) + 1;
      if (!privacy.keyId || !privacy.keyVersion) report.missingKeyMetadata += 1;
      if (privacy.rotatedAt || privacy.rotationHistory?.length) report.rotated += 1;
      if (privacy.backupRef && !report.backupRefs.includes(privacy.backupRef)) report.backupRefs.push(privacy.backupRef);
    }
    return report;
  }

  keyProviderReport(): KeyProviderReport {
    const security = this.securityKeyReport();
    const configuredProvider = process.env.MEMORY_KEY_PROVIDER;
    const provider: KeyProviderReport["provider"] = configuredProvider ? "external" : this.redactionPolicy.encryptionKey || process.env.MEMORY_ENCRYPTION_KEY ? "local-env" : "unconfigured";
    const scope = (process.env.MEMORY_KEY_SCOPE === "org" || process.env.MEMORY_KEY_SCOPE === "user" ? process.env.MEMORY_KEY_SCOPE : "local") as KeyProviderReport["scope"];
    const rotationPolicyDays = process.env.MEMORY_KEY_ROTATION_DAYS ? Math.max(1, Number(process.env.MEMORY_KEY_ROTATION_DAYS)) : undefined;
    const activeKeyId = this.redactionPolicy.encryptionKeyId ?? process.env.MEMORY_ENCRYPTION_KEY_ID;
    const activeKeyVersion = this.redactionPolicy.encryptionKeyVersion ?? process.env.MEMORY_ENCRYPTION_KEY_VERSION;
    const notes = [
      provider === "external" ? `Key material is expected from ${configuredProvider}.` : provider === "local-env" ? "Local env key provider is active; move production keys to a secret manager." : "No encryption key material is configured.",
      scope === "org" ? "Keys are scoped for organization-level rotation." : scope === "user" ? "Keys are scoped for per-user rotation." : "Keys are scoped to the local runtime."
    ];
    return {
      provider,
      scope,
      activeKeyId,
      activeKeyVersion,
      encryptedMemories: security.encrypted,
      knownKeyIds: Object.keys(security.keyIds),
      knownKeyVersions: Object.keys(security.keyVersions),
      hasEncryptionMaterial: Boolean(this.defaultKeyring().length),
      rotationPolicyDays,
      backupRefs: security.backupRefs,
      notes
    };
  }

  setPolicyRule(input: Omit<MemoryPolicyRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemoryPolicyRule {
    if (!input.label?.trim()) throw new Error("Policy rule label is required.");
    if (!input.operations?.length) throw new Error("Policy rule operations are required.");
    const now = new Date().toISOString();
    const existing = input.id ? this.policyRules.get(input.id) : undefined;
    const rule: MemoryPolicyRule = {
      id: input.id ?? `policy_${contentHash(`${input.label}:${now}:${this.policyRules.size}`).slice(2, 12)}`,
      label: input.label.trim(),
      effect: input.effect,
      operations: [...new Set(input.operations)],
      scope: input.scope,
      priority: input.priority ?? existing?.priority ?? 0,
      reason: input.reason,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.policyRules.set(rule.id, rule);
    this.recordAudit("policy.violation", { actorId: "policy-engine", metadata: { operation: "rule.set", rule } });
    this.persist();
    return rule;
  }

  listPolicyRules(): MemoryPolicyRule[] {
    return [...this.policyRules.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.label.localeCompare(b.label));
  }

  evaluatePolicy(operation: MemoryPolicyOperation, target: Memory | MemoryInput, actor: Partial<MemoryScope> = {}): PolicyDecision {
    const matching = this.listPolicyRules()
      .filter((rule) => rule.operations.includes("all") || rule.operations.includes(operation))
      .filter((rule) => policyRuleMatches(rule, target, actor));
    const decisive = matching[0];
    const allowed = decisive ? decisive.effect === "allow" : true;
    return {
      operation,
      allowed,
      memoryId: "id" in target ? target.id : undefined,
      matchedRules: matching.map((rule) => ({ id: rule.id, label: rule.label, effect: rule.effect, reason: rule.reason })),
      reasons: matching.length ? matching.map((rule) => rule.reason ?? `${rule.effect} by ${rule.label}`) : ["no matching policy rule"]
    };
  }

  canRead(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return this.evaluatePolicy("retrieve", memory, actor).allowed;
  }

  canWrite(input: MemoryInput, actor: Partial<MemoryScope> = {}): boolean {
    return this.evaluatePolicy("write", input, actor).allowed;
  }

  canDelete(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return this.evaluatePolicy("delete", memory, actor).allowed;
  }

  canPromote(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return this.evaluatePolicy("write", memory, actor).allowed && this.evaluatePolicy("retrieve", memory, actor).allowed;
  }

  canUseInContext(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return this.evaluatePolicy("retrieve", memory, actor).allowed && memory.beliefState !== "retracted";
  }

  transportSecurityReport(options: { publicUrl?: string; mode?: TransportSecurityReport["mode"]; tlsTerminatedBy?: string } = {}): TransportSecurityReport {
    const publicUrl = options.publicUrl ?? process.env.MEMORY_PUBLIC_URL;
    const mode = options.mode ?? deploymentModeFromEnv(publicUrl);
    const tlsTerminatedBy = options.tlsTerminatedBy ?? process.env.MEMORY_TLS_TERMINATED_BY;
    const inTransitEncrypted = Boolean(publicUrl?.startsWith("https://") || tlsTerminatedBy);
    return {
      generatedAt: new Date().toISOString(),
      mode,
      publicUrl,
      tlsTerminatedBy,
      inTransitEncrypted,
      ...(!inTransitEncrypted && mode !== "local" ? { warning: "Non-local deployments must terminate TLS before exposing the API or dashboard." } : {})
    };
  }

  managedDeploymentPlan(options: { target?: ManagedMigrationBundle["target"]; ssoProvider?: string; secretManager?: string } = {}): ManagedDeploymentPlan {
    const mode = options.target ?? "backup";
    return {
      mode,
      artifacts: {
        dockerfile: "docker/Dockerfile",
        dockerCompose: "docker/docker-compose.yml",
        kubernetes: "deploy/kubernetes/cognibrain.yaml"
      },
      environment: [
        "MEMORY_STORAGE_BACKEND",
        "MEMORY_ENCRYPTION_KEY_ID",
        "MEMORY_ENCRYPTION_KEY_VERSION",
        "MEMORY_KEY_PROVIDER",
        "MEMORY_PUBLIC_URL",
        "MEMORY_TLS_TERMINATED_BY",
        "MEMORY_SSO_PROVIDER",
        "MEMORY_SECRET_MANAGER"
      ],
      secretManager: options.secretManager,
      ssoProvider: options.ssoProvider,
      importWorkflow: [
        "Run /migration/export or `cognibrain memory migration-export managed` on the source runtime.",
        "Copy the bundle to the target deployment through an encrypted channel.",
        "Provision the listed key ids in the configured secret manager before import.",
        "POST the bundle to /migration/import or run `cognibrain memory migration-import <bundle.json>`.",
        "Run /backup/verify and /compliance/export before serving production traffic."
      ],
      transport: this.transportSecurityReport({ mode: mode === "managed" ? "managed" : mode === "self_hosted" ? "self_hosted" : "local" })
    };
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
    if (!input.name.trim()) throw new Error("Managed tenant name is required.");
    if (!input.orgId.trim()) throw new Error("Managed tenant orgId is required.");
    const now = new Date().toISOString();
    const existing = input.id ? this.managedTenants.get(input.id) : undefined;
    const tenant: ManagedTenant = {
      id: input.id ?? `tenant_${contentHash(`${input.orgId}:${input.name}:${now}`).slice(2, 12)}`,
      name: input.name,
      orgId: input.orgId,
      plan: input.plan ?? "team",
      region: input.region ?? process.env.MEMORY_REGION ?? "local-dev",
      status: input.status ?? "active",
      ssoProvider: input.ssoProvider ?? process.env.MEMORY_SSO_PROVIDER,
      secretManager: input.secretManager ?? process.env.MEMORY_SECRET_MANAGER,
      dataResidency: input.dataResidency ?? process.env.MEMORY_DATA_RESIDENCY,
      autoscaling: input.autoscaling ?? {
        minReplicas: Number(process.env.MEMORY_AUTOSCALE_MIN_REPLICAS ?? 1),
        maxReplicas: Number(process.env.MEMORY_AUTOSCALE_MAX_REPLICAS ?? 3),
        targetCpuUtilization: Number(process.env.MEMORY_AUTOSCALE_TARGET_CPU ?? 70)
      },
      backup: input.backup ?? {
        enabled: Boolean(process.env.MEMORY_BACKUP_REF),
        backupRef: process.env.MEMORY_BACKUP_REF
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.managedTenants.set(tenant.id, tenant);
    this.recordAudit("managed.tenant", { userId: tenant.orgId, metadata: { action: existing ? "update" : "create", tenant } });
    this.persist();
    return tenant;
  }

  listManagedTenants(): ManagedTenant[] {
    return [...this.managedTenants.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  managedControlPlaneReport(): ManagedControlPlaneReport {
    const tenants = this.listManagedTenants();
    const storage = this.storageStatus();
    const keyProvider = this.keyProviderReport();
    const transport = this.transportSecurityReport();
    const migration = this.managedMigrationBundle({
      target: "managed",
      backupRef: process.env.MEMORY_BACKUP_REF,
      ssoProvider: process.env.MEMORY_SSO_PROVIDER,
      secretManager: process.env.MEMORY_SECRET_MANAGER
    });
    const autoscalingValues = tenants.map((tenant) => tenant.autoscaling).filter(Boolean) as NonNullable<ManagedTenant["autoscaling"]>[];
    const maxReplicas = Math.max(0, ...autoscalingValues.map((policy) => policy.maxReplicas));
    const minReplicas = Math.max(0, ...autoscalingValues.map((policy) => policy.minReplicas));
    const targetCpuUtilization = autoscalingValues.length
      ? Math.round(autoscalingValues.reduce((sum, policy) => sum + policy.targetCpuUtilization, 0) / autoscalingValues.length)
      : Number(process.env.MEMORY_AUTOSCALE_TARGET_CPU ?? 70);
    const readiness = {
      storage: storage.adapters.some((adapter) => adapter.kind === storage.active && adapter.durable && (adapter.distributedReady || storage.active !== "memory")),
      backup: tenants.length === 0 ? Boolean(process.env.MEMORY_BACKUP_REF) : tenants.every((tenant) => tenant.backup?.enabled),
      sso: tenants.length === 0 ? Boolean(process.env.MEMORY_SSO_PROVIDER) : tenants.every((tenant) => tenant.ssoProvider),
      secretManager: keyProvider.provider === "external" || tenants.some((tenant) => tenant.secretManager),
      transport: transport.inTransitEncrypted || transport.mode === "local",
      migrationBundle: migration.target === "managed" && Boolean(migration.deployment)
    };
    const notes = [
      readiness.storage ? "Storage has a durable adapter for hosted mode." : "Configure a durable hosted adapter before production traffic.",
      readiness.backup ? "Backup references are present for managed recovery." : "Set MEMORY_BACKUP_REF or tenant backup settings before claiming managed recovery.",
      readiness.sso ? "SSO provider metadata is configured." : "Set MEMORY_SSO_PROVIDER or tenant-level SSO before enterprise rollout.",
      readiness.secretManager ? "External secret-manager metadata is configured." : "Set MEMORY_SECRET_MANAGER or MEMORY_KEY_PROVIDER for production key custody.",
      readiness.transport ? "Transport security is ready for the current deployment mode." : "Expose HTTPS or set MEMORY_TLS_TERMINATED_BY before public managed service use."
    ];
    return {
      generatedAt: new Date().toISOString(),
      deploymentMode: deploymentModeFromEnv(process.env.MEMORY_PUBLIC_URL),
      tenants: {
        total: tenants.length,
        active: tenants.filter((tenant) => tenant.status === "active").length,
        provisioning: tenants.filter((tenant) => tenant.status === "provisioning").length,
        paused: tenants.filter((tenant) => tenant.status === "paused").length,
        regions: [...new Set(tenants.map((tenant) => tenant.region))].sort(),
        plans: {
          developer: tenants.filter((tenant) => tenant.plan === "developer").length,
          team: tenants.filter((tenant) => tenant.plan === "team").length,
          enterprise: tenants.filter((tenant) => tenant.plan === "enterprise").length
        }
      },
      readiness,
      autoscaling: {
        enabled: autoscalingValues.length > 0 && maxReplicas > minReplicas,
        minReplicas,
        maxReplicas,
        targetCpuUtilization
      },
      storage,
      transport,
      keyProvider,
      migration: {
        generatedAt: migration.generatedAt,
        target: migration.target,
        counts: migration.counts,
        backup: migration.backup,
        placeholders: migration.placeholders
      },
      notes
    };
  }

  rotateEncryptionKeyMetadata(input: { keyId: string; keyVersion: string; backupRef?: string; actorId?: string }): KeyRotationReport {
    const now = new Date().toISOString();
    const rotated: string[] = [];
    const skipped: string[] = [];
    for (const memory of this.store.list()) {
      const privacy = memory.metadata.privacy as Record<string, unknown> | undefined;
      if (!privacy?.encrypted) {
        skipped.push(memory.id);
        continue;
      }
      const history = Array.isArray(privacy.rotationHistory) ? privacy.rotationHistory : [];
      this.store.update(memory.id, {
        metadata: {
          ...memory.metadata,
          privacy: {
            ...privacy,
            previousKeyId: privacy.keyId,
            previousKeyVersion: privacy.keyVersion,
            keyId: input.keyId,
            keyVersion: input.keyVersion,
            rotatedAt: now,
            backupRef: input.backupRef,
            rotationHistory: [...history, { rotatedAt: now, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef }]
          }
        }
      });
      rotated.push(memory.id);
    }
    this.recordAudit("security.key.rotate", { actorId: input.actorId, metadata: { rotated: rotated.length, skipped: skipped.length, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef } });
    this.persist();
    return { generatedAt: now, rotated, skipped, keyId: input.keyId, keyVersion: input.keyVersion, backupRef: input.backupRef };
  }

  privacyInsights(options: { epsilon?: number; kAnonymity?: number; includeExact?: boolean } = {}): DifferentialPrivacyReport {
    const epsilon = Math.max(0.1, options.epsilon ?? 1);
    const kAnonymity = Math.max(2, Math.round(options.kAnonymity ?? 3));
    const groups = new Map<string, number>();
    const add = (dimension: string, key: string | undefined) => {
      const safeKey = key || "none";
      groups.set(`${dimension}:${safeKey}`, (groups.get(`${dimension}:${safeKey}`) ?? 0) + 1);
    };
    for (const memory of this.store.list()) {
      add("consent", memory.consent.visibility);
      add("sourceKind", memory.source.kind);
      add("brain", memory.brainId);
      add("source", memory.sourceId);
    }
    for (const event of this.searchEvents) {
      add("searchSession", event.sessionId);
      add("searchProject", event.projectId);
    }
    let suppressedGroups = 0;
    const aggregates = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([compound, exactCount]) => {
      const [dimension, ...keyParts] = compound.split(":");
      const key = keyParts.join(":");
      const suppressed = exactCount < kAnonymity;
      if (suppressed) suppressedGroups += 1;
      const noisyCount = suppressed ? 0 : Math.max(0, Math.round(exactCount + deterministicLaplaceNoise(`${compound}:${exactCount}`, epsilon)));
      return {
        dimension,
        key,
        noisyCount,
        ...(options.includeExact ? { exactCount } : {}),
        suppressed
      };
    });
    const report: DifferentialPrivacyReport = {
      generatedAt: new Date().toISOString(),
      epsilon,
      kAnonymity,
      suppressedGroups,
      aggregates,
      notes: ["Groups below k-anonymity are suppressed.", "Counts use deterministic Laplace-style noise for local reproducibility."]
    };
    this.recordAudit("privacy.insights", { metadata: { epsilon, kAnonymity, suppressedGroups, aggregates: aggregates.length } });
    this.persist();
    return report;
  }

  privacyPreservingCrossBrainCompute(options: {
    brainIds: string[];
    salt?: string;
    minK?: number;
    dimensions?: Array<"entities" | "tags" | "relations">;
  }): CrossBrainPrivacyComputeReport {
    const brainIds = [...new Set(options.brainIds.filter(Boolean))].sort();
    if (brainIds.length < 2) throw new Error("At least two brainIds are required for cross-brain compute.");
    const dimensions = options.dimensions?.length ? [...new Set(options.dimensions)] : ["entities", "tags", "relations"] as Array<"entities" | "tags" | "relations">;
    const minK = Math.max(2, Math.round(options.minK ?? 2));
    const salt = options.salt ?? process.env.MEMORY_PRIVACY_COMPUTE_SALT ?? "local-cross-brain-compute";
    const saltHash = contentHash(salt);
    const byHash = new Map<string, { dimensions: Set<"entities" | "tags" | "relations">; brainIds: Set<string>; memoryIds: Set<string> }>();
    const brainStats = new Map<string, { memoriesScanned: number; hashes: Set<string> }>();

    for (const brainId of brainIds) {
      const memories = this.store.list().filter((memory) => memory.brainId === brainId && !memory.archivedAt);
      const hashes = new Set<string>();
      for (const memory of memories) {
        for (const token of privacyComputeTokens(memory, dimensions)) {
          const hash = createHmac("sha256", salt).update(`${token.dimension}:${token.value}`).digest("hex");
          hashes.add(hash);
          const aggregate = byHash.get(hash) ?? { dimensions: new Set(), brainIds: new Set(), memoryIds: new Set() };
          aggregate.dimensions.add(token.dimension);
          aggregate.brainIds.add(brainId);
          aggregate.memoryIds.add(memory.id);
          byHash.set(hash, aggregate);
        }
      }
      brainStats.set(brainId, { memoriesScanned: memories.length, hashes });
    }

    const intersections = [...byHash.entries()]
      .filter(([, aggregate]) => aggregate.brainIds.size >= minK)
      .sort((a, b) => b[1].brainIds.size - a[1].brainIds.size || a[0].localeCompare(b[0]))
      .map(([hash, aggregate]) => ({
        hash,
        dimensions: [...aggregate.dimensions].sort(),
        participantBrainIds: [...aggregate.brainIds].sort(),
        brainCount: aggregate.brainIds.size,
        memoryCount: aggregate.memoryIds.size
      }));
    const releasedHashes = new Set(intersections.map((item) => item.hash));
    const brains = [...brainStats.entries()].map(([brainId, stats]) => {
      const released = [...stats.hashes].filter((hash) => releasedHashes.has(hash)).length;
      return {
        brainId,
        memoriesScanned: stats.memoriesScanned,
        contributedHashes: stats.hashes.size,
        releasedHashes: released,
        suppressedHashes: stats.hashes.size - released
      };
    });
    const candidateHashes = byHash.size;
    const report: CrossBrainPrivacyComputeReport = {
      generatedAt: new Date().toISOString(),
      brainIds,
      dimensions,
      minK,
      hashAlgorithm: "hmac-sha256",
      saltHash,
      noRawMemoryData: true,
      totals: {
        memoriesScanned: brains.reduce((sum, brain) => sum + brain.memoriesScanned, 0),
        candidateHashes,
        releasedHashes: releasedHashes.size,
        suppressedHashes: candidateHashes - releasedHashes.size
      },
      brains,
      intersections,
      notes: [
        "Only HMAC hashes, counts, and participant brain ids are returned.",
        "Raw memory content, entity labels, tags, and relation labels are never included in this report.",
        "Hashes below minK participant brains are suppressed."
      ]
    };
    this.recordAudit("privacy.compute", { metadata: { brainIds, dimensions, minK, releasedHashes: report.totals.releasedHashes, suppressedHashes: report.totals.suppressedHashes } });
    this.persist();
    return report;
  }

  complianceReport(now = new Date()): ComplianceReport {
    const memories = this.store.list();
    const consent: ComplianceReport["consent"] = { private: 0, user: 0, org: 0, public: 0 };
    let encrypted = 0;
    let retentionExpired = 0;
    let deleteOnRequest = 0;
    for (const memory of memories) {
      consent[memory.consent.visibility] += 1;
      if ((memory.metadata.privacy as { action?: string } | undefined)?.action === "encrypt") encrypted += 1;
      if (memory.consent.retentionUntil && new Date(memory.consent.retentionUntil).getTime() <= now.getTime()) retentionExpired += 1;
      if (memory.consent.deleteOnRequest) deleteOnRequest += 1;
    }
    const auditByType: Record<string, number> = {};
    for (const event of this.auditEvents) auditByType[event.type] = (auditByType[event.type] ?? 0) + 1;
    const encryption = this.securityKeyReport();
    const keyProvider = this.keyProviderReport();
    const backup = this.verifyBackupRecovery();
    const transportSecurity = this.transportSecurityReport();
    const dataFlows = Object.entries(auditByType)
      .map(([type, count]) => ({
        type,
        count,
        lastSeenAt: this.auditEvents.filter((event) => event.type === type).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp
      }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    return {
      generatedAt: now.toISOString(),
      totals: { memories: memories.length, auditEvents: this.auditEvents.length, brains: this.brains.size, sources: this.sources.size },
      consent,
      encrypted,
      retentionExpired,
      deleteOnRequest,
      auditByType,
      policyRules: this.listPolicyRules(),
      retentionRules: this.listRetentionRules(),
      encryption,
      keyProvider,
      backup,
      transportSecurity,
      dataFlows,
      risks: [
        ...(retentionExpired ? [`${retentionExpired} memories are past retention and should be archived or deleted.`] : []),
        ...(encryption.missingKeyMetadata ? [`${encryption.missingKeyMetadata} encrypted memories are missing key id/version metadata.`] : []),
        ...(!backup.verified ? [`${backup.failed.length} encrypted memories failed backup recovery verification.`] : []),
        ...(transportSecurity.warning ? [transportSecurity.warning] : []),
        ...(memories.some((memory) => memory.consent.visibility === "public" && memory.trust < 0.5) ? ["Low-trust public memories require operator review."] : [])
      ]
    };
  }

  metricsReport(): MetricsReport {
    return { ...this.metrics, sessions: { ...(this.metrics.sessions ?? {}) }, dreamActions: { ...(this.metrics.dreamActions ?? {}) } };
  }

  addTrainingSample(sample: RetrievalTrainingSample): RetrievalTrainingSample {
    const saved = { ...sample, timestamp: sample.timestamp ?? new Date().toISOString() };
    this.trainingSamples.push(saved);
    this.persist();
    return saved;
  }

  setRetrievalProfile(profile: Omit<RetrievalProfile, "updatedAt" | "weights"> & { weights: Partial<RetrievalWeights>; updatedAt?: string }): RetrievalProfile {
    const saved: RetrievalProfile = {
      ...profile,
      weights: normalizeRetrievalWeights(profile.weights),
      updatedAt: profile.updatedAt ?? new Date().toISOString()
    };
    this.retrievalProfiles.set(saved.id, saved);
    this.persist();
    return saved;
  }

  getRetrievalProfiles(): RetrievalProfile[] {
    return [...this.retrievalProfiles.values()];
  }

  learnRetrievalProfile(id = "learned", label = "Learned feedback profile", options: { scope?: RetrievalProfile["scope"] } = {}): LearnedProfileReport {
    const positiveSignals: Partial<RetrievalWeights> = {};
    const negativeSignals: Partial<RetrievalWeights> = {};
    let samples = 0;
    for (const event of this.feedbackEvents) {
      const memory = safeGet(this.store, event.memoryId);
      if (!memory) continue;
      if (!memoryMatchesProfileScope(memory, options.scope)) continue;
      const bucket = event.kind === "helpful" || event.kind === "always_include" ? positiveSignals : event.kind === "wrong" || event.kind === "never_include" ? negativeSignals : undefined;
      if (!bucket) continue;
      samples += 1;
      bucket.trust = (bucket.trust ?? 0) + memory.trust;
      bucket.entity = (bucket.entity ?? 0) + Math.min(1, memory.entities.length / 5);
      bucket.temporal = (bucket.temporal ?? 0) + (memory.lastAccessedAt ? 0.6 : 0.2);
      bucket.access = (bucket.access ?? 0) + Math.min(1, Math.log1p(memory.accessCount) / 4);
    }
    const trainingSamples = this.trainingSamples.filter((sample) => sampleMatchesProfileScope(sample, options.scope));
    for (const sample of trainingSamples) {
      const bucket = sample.outcome === "helpful" || sample.outcome === "accepted" ? positiveSignals : negativeSignals;
      samples += 1;
      for (const key of Object.keys(baseSignalTemplate()) as Array<keyof RetrievalWeights>) {
        bucket[key] = (bucket[key] ?? 0) + (sample.signals?.[key] ?? 0);
      }
    }
    const base = this.retrievalProfiles.get("default")?.weights ?? normalizeRetrievalWeights();
    const lossBefore = profileLoss(base, trainingSamples);
    const learned = { ...base };
    if (samples) {
      for (const key of Object.keys(base) as Array<keyof RetrievalWeights>) {
        learned[key] = Math.max(0.01, base[key] + ((positiveSignals[key] ?? 0) - (negativeSignals[key] ?? 0)) / Math.max(20, samples * 10));
      }
    }
    const profile = this.setRetrievalProfile({
      id,
      label,
      weights: learned,
      scope: options.scope,
      learned: true,
      trainingSamples: samples,
      benchmarkDelta: 0,
      provenance: "feedback coordinate update"
    });
    return { profile, samples, positiveSignals, negativeSignals, lossBefore, lossAfter: profileLoss(profile.weights, trainingSamples) };
  }

  linkIdentity(primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    const link = this.identities.link(primaryUserId, linkedUserId, consentToken, consent);
    this.recordAudit("memory.consent", { userId: primaryUserId, metadata: { resource: "identity-link", linkedUserId, consent, linkId: link.id, hashedSubject: link.hashedSubject } });
    this.persist();
    return link;
  }

  unlinkIdentity(id: string): IdentityLink {
    const link = this.identities.unlink(id);
    this.recordAudit("memory.consent", { userId: link.primaryUserId, metadata: { resource: "identity-link", linkedUserId: link.linkedUserId, linkId: link.id, revoked: true } });
    this.persist();
    return link;
  }

  timeline(userId: string): TimelineReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const events = memories
      .map((memory) => ({
        memoryId: memory.id,
        content: memory.content,
        eventAt: memory.temporal.eventAt ?? memory.createdAt,
        validFrom: memory.temporal.validFrom,
        validUntil: memory.temporal.validUntil,
        supersededAt: memory.temporal.supersededAt,
        entities: memory.entities
      }))
      .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
    const summaries = new Map(memories.filter((memory) => memory.metadata.period).map((memory) => [String(memory.metadata.period), memory.content]));
    return {
      userId,
      events,
      periods: groupedPeriods(events, summaries)
    };
  }

  summarizeTimeline(
    userId: string,
    options: { granularity?: TimelineSummaryReport["granularity"]; persist?: boolean; style?: "concise" | "descriptive" | "narrative" } = {}
  ): TimelineSummaryReport {
    const now = new Date();
    const granularity = options.granularity ?? "all";
    const periods = this.timeline(userId).periods.filter((period) => granularity === "all" || period.granularity === granularity);
    const existingSummaryIds = new Set(
      this.store
        .list(userId)
        .filter((memory) => memory.metadata.dreamJob === "timeline-summary")
        .map((memory) => `${memory.metadata.granularity}:${memory.metadata.period}`)
    );
    const summaries: TimelineSummaryReport["summaries"] = [];
    for (const period of periods) {
      const memories = period.memoryIds.map((id) => safeGet(this.store, id)).filter((memory): memory is Memory => Boolean(memory && !memory.archivedAt && memory.layer !== "reflection"));
      if (!memories.length) continue;
      const generated = this.defaultSummarizer?.summarize({ theme: `timeline ${period.granularity} ${period.period}`, memories, now });
      const providerContent = generated?.content?.trim();
      const content = providerContent
        ? providerContent.slice(0, 1200)
        : deterministicTimelineSummary(period.period, period.granularity, memories, options.style ?? "concise");
      const mode = providerContent ? "provider" : "deterministic";
      let summaryMemoryId: string | undefined;
      const key = `${period.granularity}:${period.period}`;
      if (options.persist && !existingSummaryIds.has(key)) {
        const summary = this.add({
          userId,
          content,
          type: "episodic",
          layer: "reflection",
          source: { kind: mode === "provider" ? "agent" : "tool", confidence: generated?.confidence ?? 0.76 },
          tags: ["timeline-summary", period.granularity, period.period],
          entities: [...new Set(memories.flatMap((memory) => memory.entities))].slice(0, 12),
          timestamp: now.toISOString(),
          metadata: {
            summaryOf: memories.map((memory) => memory.id),
            period: period.period,
            granularity: period.granularity,
            dreamJob: "timeline-summary",
            summaryMode: mode,
            summaryStyle: options.style ?? "concise",
            generatedAt: now.toISOString(),
            provider: generated?.metadata?.provider
          }
        });
        summaryMemoryId = summary.id;
        existingSummaryIds.add(key);
      }
      summaries.push({
        period: period.period,
        granularity: period.granularity,
        content,
        memoryIds: memories.map((memory) => memory.id),
        summaryMemoryId,
        confidence: generated?.confidence ?? 0.76,
        mode
      });
    }
    this.recordAudit("reflect.run", { userId, metadata: { resource: "timeline-summary", granularity, persisted: Boolean(options.persist), summaries: summaries.length } });
    this.persist();
    return { userId, generatedAt: now.toISOString(), granularity, persisted: Boolean(options.persist), summaries };
  }

  temporalQuery(userId: string, options: { after?: Date | string; before?: Date | string } = {}): TemporalQueryReport {
    const after = options.after ? new Date(options.after) : undefined;
    const before = options.before ? new Date(options.before) : undefined;
    const events = this.timeline(userId).events.filter((event) => {
      return intervalOverlaps(event, after, before);
    });
    const byEntity = new Map<string, { memoryIds: string[]; dates: Date[] }>();
    for (const event of events) {
      for (const entity of event.entities) {
        const current = byEntity.get(entity) ?? { memoryIds: [], dates: [] };
        current.memoryIds.push(event.memoryId);
        current.dates.push(new Date(event.eventAt));
        byEntity.set(entity, current);
      }
    }
    return {
      userId,
      after: options.after,
      before: options.before,
      events,
      changedEntities: [...byEntity.entries()].map(([entity, value]) => ({
        entity,
        memoryIds: [...new Set(value.memoryIds)],
        firstAt: new Date(Math.min(...value.dates.map((date) => date.getTime()))).toISOString(),
        lastAt: new Date(Math.max(...value.dates.map((date) => date.getTime()))).toISOString()
      }))
    };
  }

  behavioralPatterns(userId: string): BehavioralPatternReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const generated = memories
      .filter((memory) => memory.metadata.dreamJob === "behavior-pattern")
      .map((memory) => ({
        key: String(memory.metadata.pattern ?? memory.id),
        label: memory.content,
        support: Array.isArray(memory.metadata.summaryOf) ? memory.metadata.summaryOf.length : 1,
        memoryIds: Array.isArray(memory.metadata.summaryOf) ? memory.metadata.summaryOf.map(String) : [memory.id],
        confidence: Number(memory.metadata.confidence ?? memory.trust),
        cadence: String(memory.metadata.recurrenceWindow ?? "observed-period"),
        pendingReview: (memory.metadata.patternReview as { status?: string } | undefined)?.status === "pending",
        lastObservedAt: String(memory.metadata.lastObservedAt ?? memory.createdAt.toISOString()),
        falsePositiveRisk: Number(memory.metadata.falsePositiveRisk ?? 0.2)
      }));
    const mined = [...mineRecurringPatterns(memories), ...mineRecurringSequences(memories)];
    return { userId, patterns: [...generated, ...mined].sort((a, b) => b.confidence - a.confidence || b.support - a.support) };
  }

  adaptiveDreamPolicy(userId: string): AdaptiveDreamPolicyReport {
    const health = this.health(userId);
    const active = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const reviewMemories = active.filter((memory) => memory.trust < 0.55 || memory.tags.includes("needs-review") || memory.source.kind === "transcript").length;
    const feedback = this.feedbackEvents.filter((event) => !event.userId || event.userId === userId);
    const negativeFeedback = feedback.filter((event) => event.kind === "wrong" || event.kind === "never_include" || event.kind === "stale" || event.kind === "reject_pattern").length;
    const writesSinceDream = this.userMaintenance(userId).writesSinceDream;
    const pressure = Math.min(1, reviewMemories / Math.max(1, active.length) + negativeFeedback / Math.max(4, feedback.length || 1) + (1 - health.healthScore));
    const recommended = {
      intervalHours: Math.max(1, Math.round(this.autoDream.intervalHours * (pressure > 0.75 ? 0.45 : pressure > 0.45 ? 0.7 : 1.15))),
      writeThreshold: Math.max(3, Math.round(this.autoDream.writeThreshold * (pressure > 0.75 ? 0.45 : pressure > 0.45 ? 0.7 : 1.1))),
      summaryDepth: pressure > 0.65 ? 5 : pressure > 0.35 ? 4 : 3,
      fadeAfterDays: pressure > 0.65 ? 30 : 45,
      archiveAfterDays: pressure > 0.65 ? 60 : 90
    };
    const rationale = [
      `health=${health.healthScore.toFixed(2)}`,
      `${reviewMemories} active memories need review`,
      `${negativeFeedback}/${feedback.length} feedback events are negative`,
      `${writesSinceDream} writes since last dream`
    ];
    return {
      userId,
      generatedAt: new Date().toISOString(),
      recommended,
      signals: {
        healthScore: health.healthScore,
        activeMemories: active.length,
        reviewMemories,
        feedbackVolume: feedback.length,
        negativeFeedback,
        writesSinceDream,
        searches: this.metrics.searches
      },
      rationale
    };
  }

  generateObservations(userId: string, options: { style?: ObservationReport["style"]; persist?: boolean; limit?: number } = {}): ObservationReport {
    const now = new Date();
    const style = options.style ?? "concise";
    const clusters = observationClusters(this.store.list(userId).filter((memory) => !memory.archivedAt && memory.layer !== "reflection")).slice(0, options.limit ?? 4);
    const observations: ObservationReport["observations"] = [];
    for (const cluster of clusters) {
      const generated = this.defaultSummarizer?.summarize({ theme: cluster.label, memories: cluster.memories, now });
      const providerContent = generated?.content?.trim();
      const content = providerContent || deterministicObservation(cluster.label, cluster.memories, style);
      let observationMemoryId: string | undefined;
      if (options.persist) {
        const memory = this.add({
          userId,
          content,
          type: "reference",
          layer: "reflection",
          source: { kind: providerContent ? "agent" : "tool", confidence: generated?.confidence ?? 0.78 },
          tags: ["observation", style, cluster.label],
          entities: [cluster.label],
          metadata: {
            summaryOf: cluster.memories.map((memory) => memory.id),
            observation: true,
            observationStyle: style,
            generatedAt: now.toISOString(),
            summaryMode: providerContent ? "provider" : "deterministic",
            provider: generated?.metadata?.provider
          }
        });
        observationMemoryId = memory.id;
      }
      observations.push({
        content,
        memoryIds: cluster.memories.map((memory) => memory.id),
        citations: cluster.memories.map(citationFor),
        confidence: generated?.confidence ?? Math.min(0.92, 0.55 + cluster.memories.length * 0.08),
        mode: providerContent ? "provider" : "deterministic",
        observationMemoryId
      });
    }
    this.recordAudit("reflect.run", { userId, metadata: { resource: "observations", style, persisted: Boolean(options.persist), observations: observations.length } });
    this.persist();
    return { userId, generatedAt: now.toISOString(), style, persisted: Boolean(options.persist), observations };
  }

  predictionReport(userId: string, options: { query?: string; limit?: number } = {}): PredictionReport {
    const patterns = this.behavioralPatterns(userId).patterns.slice(0, options.limit ?? 4);
    const predictions = patterns.map((pattern) => ({
      label: pattern.label,
      confidence: pattern.confidence,
      reason: `${pattern.cadence} with ${pattern.support} supporting memories`,
      memoryIds: pattern.memoryIds,
      suggestedQuery: options.query ?? pattern.label.replace(/^Inferred pattern:\s*/i, "").slice(0, 160)
    }));
    const prefetchQuery = predictions[0]?.suggestedQuery ?? options.query ?? "recent memory workflow";
    const prefetch = this.search({ userId, query: prefetchQuery, limit: 5, includePrivate: true, expandQuery: true });
    const now = Date.now();
    const anomalies: PredictionReport["anomalies"] = [];
    for (const memory of this.store.list(userId).filter((item) => !item.archivedAt)) {
      const ageDays = (now - memory.createdAt.getTime()) / 86_400_000;
      if (memory.metadata.patternReview && (memory.metadata.patternReview as { status?: string }).status === "pending") anomalies.push({ kind: "pending_pattern_review", memoryId: memory.id, message: `Pattern ${memory.id} awaits operator review.` });
      if (ageDays < 14 && memory.trust < 0.55) anomalies.push({ kind: "low_trust_recent_memory", memoryId: memory.id, message: `Recent memory ${memory.id} has low trust.` });
      if (ageDays > 30 && !memory.temporal.lastConfirmedAt && memory.pinned) anomalies.push({ kind: "missing_recent_confirmation", memoryId: memory.id, message: `Pinned memory ${memory.id} has no recent confirmation.` });
    }
    return { userId, generatedAt: new Date().toISOString(), predictions, prefetch, anomalies: anomalies.slice(0, 12) };
  }

  graph(userId?: string): GraphReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    return this.entities.graph(memories);
  }

  entityCatalog(userId?: string): { entities: EntityRecord[]; mergeSuggestions: EntityMergeSuggestion[]; enrichmentCandidates: EnrichmentCandidate[] } {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    return {
      entities: this.entities.graph(memories).entities,
      mergeSuggestions: this.entities.suggestMerges(memories),
      enrichmentCandidates: enrichmentCandidatesFor(memories)
    };
  }

  runEntityEnrichment(input: { userId: string; entity: string; approveExternal?: boolean; sourceUri?: string }) {
    const candidates = this.entityCatalog(input.userId).enrichmentCandidates;
    const candidate = candidates.find((item) => item.entity.toLowerCase() === input.entity.toLowerCase());
    const externalAllowed = input.approveExternal === true || process.env.MEMORY_ENRICHMENT_ALLOW_NETWORK === "true";
    if (!candidate) return { status: "skipped" as const, entity: input.entity, reason: "entity has not crossed enrichment threshold", memories: [] as Memory[] };
    if (!externalAllowed) return { status: "blocked" as const, entity: candidate.entity, reason: "external enrichment requires approval or MEMORY_ENRICHMENT_ALLOW_NETWORK=true", candidate, memories: [] as Memory[] };
    if (!this.defaultExtractor) return { status: "skipped" as const, entity: candidate.entity, reason: "no provider extractor configured for enrichment", candidate, memories: [] as Memory[] };
    const extracted = this.defaultExtractor.extract({
      events: [{
        role: "operator",
        content: `Enrich entity ${candidate.entity} with approved external source facts.`,
        source: { kind: "import", uri: input.sourceUri, confidence: 0.7 },
        metadata: { enrichment: { entity: candidate.entity, action: candidate.suggestedAction, memoryIds: candidate.memoryIds } }
      }],
      scope: { userId: input.userId },
      existing: this.store.list(input.userId),
      now: new Date()
    });
    const memories = extracted.map((memory) =>
      this.add({
        ...memory,
        userId: input.userId,
        type: memory.type ?? "reference",
        layer: memory.layer ?? "long_term",
        source: memory.source ?? { kind: "import", uri: input.sourceUri, confidence: 0.72 },
        tags: [...new Set([...(memory.tags ?? []), "external-enrichment", candidate.entity])],
        entities: [...new Set([...(memory.entities ?? []), candidate.entity])],
        metadata: {
          ...(memory.metadata ?? {}),
          enrichment: { entity: candidate.entity, action: candidate.suggestedAction, sourceUri: input.sourceUri, sourceMemoryIds: candidate.memoryIds },
          addOnly: true
        }
      })
    );
    this.recordAudit("provider.call", { userId: input.userId, metadata: { task: "entity-enrichment", entity: candidate.entity, status: memories.length ? "applied" : "empty", memories: memories.map((memory) => memory.id) } });
    this.persist();
    return { status: memories.length ? "applied" as const : "empty" as const, entity: candidate.entity, candidate, memories };
  }

  mergeEntity(canonical: string, aliases: string[], userId?: string): EntityRecord {
    const memories = this.store.list(userId);
    const record = this.entities.merge(canonical, aliases, memories);
    for (const memory of memories) this.recanonicalizeMemory(memory);
    this.recordAudit("entity.merge", { userId, metadata: { canonical: record.canonical, aliases: record.aliases } });
    this.persist();
    return record;
  }

  splitEntity(canonical: string, aliases: string[], userId?: string): EntityRecord | undefined {
    const record = this.entities.split(canonical, aliases);
    if (!record) return undefined;
    for (const memory of this.store.list(userId)) this.recanonicalizeMemory(memory);
    this.recordAudit("entity.split", { userId, metadata: { canonical: record.canonical, aliases } });
    this.persist();
    return record;
  }

  lifecyclePreview(userId: string, policy?: Partial<LifecyclePolicy>) {
    const normalized = normalizeLifecyclePolicy(policy);
    const now = new Date();
    return this.store.list(userId).map((memory) => {
      const ageDays = (now.getTime() - memory.createdAt.getTime()) / 86_400_000;
      const utility = memory.trust * memory.importance + Math.log1p(memory.accessCount) / normalized.accessBoostDivisor;
      return {
        memoryId: memory.id,
        action:
          memory.pinned || normalized.protectedSourceKinds.includes(memory.source.kind) || normalized.protectedLayers.includes(memory.layer)
            ? "protect"
            : ageDays > normalized.archiveAfterDays && utility < normalized.archiveUtilityThreshold
              ? "archive"
              : ageDays > normalized.fadeAfterDays && utility < normalized.fadeUtilityThreshold
                ? "fade"
                : "keep",
        utility
      };
    });
  }

  runDomainEvaluation(domain = this.domainModule): DomainEvaluationReport {
    if (!domain) throw new Error("No domain module configured");
    const report = runDomainEvaluation(domain);
    this.domainEvaluations.push(report);
    this.metrics.benchmarkRuns = (this.metrics.benchmarkRuns ?? 0) + 1;
    this.persist();
    return report;
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
      const report = this.reflection.run(userId);
      this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
      this.markDreamed(userId);
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

  private markDreamed(userId: string): void {
    const status = this.userMaintenance(userId);
    status.lastDreamAt = new Date().toISOString();
    status.writesSinceDream = 0;
  }

  private userMaintenance(userId: string): { lastDreamAt?: string; writesSinceDream: number } {
    this.maintenance.users[userId] ??= { writesSinceDream: 0 };
    return this.maintenance.users[userId];
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

  private scheduleVerificationFromDream(userId: string): void {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    for (const memory of this.store.list(userId)) {
      if (memory.archivedAt || memory.pinned || memory.temporal.verificationDueAt) continue;
      const risk = memory.temporal.stalenessRisk ?? 0;
      if (memory.beliefState === "contradicted" || memory.beliefState === "needs_verification" || (risk >= 0.65 && memory.importance >= 0.5)) {
        this.store.update(memory.id, {
          beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
          temporal: { ...memory.temporal, verificationDueAt: dueAt },
          metadata: { verification: { status: "queued", at: new Date().toISOString(), reason: "dream belief revision" } }
        });
      }
    }
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

  private load(): void {
    const raw = this.persistence?.load();
    if (!raw) return;
    if (Array.isArray(raw)) {
      this.store.seed(raw);
      return;
    }
    this.maintenance = raw.maintenance ?? { users: {} };
    this.metrics = raw.metrics ?? this.metrics;
    this.feedbackEvents = raw.feedback ?? [];
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
    this.evidencePacks = new Map((raw.evidencePacks ?? []).map((pack) => [pack.id, pack]));
    this.policyRules = new Map((raw.policyRules ?? []).map((rule) => [rule.id, rule]));
    this.retentionRules = new Map((raw.retentionRules ?? []).map((rule) => [rule.id, rule]));
    this.store.import(raw.memories ?? []);
    for (const memory of this.store.list()) this.entities.ingest(memory);
  }

  private persist(): void {
    if (!this.persistence) return;
    const payload: PersistedMemoryFile = {
      version: 2,
      memories: this.store.export(),
      episodes: [...this.episodes.values()],
      maintenance: this.maintenance,
      metrics: this.metrics,
      feedback: this.feedbackEvents,
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
      evidencePacks: [...this.evidencePacks.values()],
      policyRules: [...this.policyRules.values()],
      retentionRules: [...this.retentionRules.values()]
    };
    this.persistence.save(payload);
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
  return new MemoryService({
    persistence: persistencePath ? createPersistenceFromEnv(persistencePath) : undefined,
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

function redactionModeFromEnv(value: string | undefined): RedactionPolicy["mode"] {
  if (value === "off" || value === "reject" || value === "archive" || value === "encrypt") return value;
  return "redact";
}

function deploymentModeFromEnv(publicUrl?: string): TransportSecurityReport["mode"] {
  const raw = process.env.MEMORY_DEPLOYMENT_MODE;
  if (raw === "managed" || raw === "self_hosted" || raw === "production" || raw === "local") return raw;
  if (!publicUrl) return "local";
  try {
    const host = new URL(publicUrl).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" ? "local" : "production";
  } catch {
    return "production";
  }
}

function ruleExtractionFailures(events: MemoryExtractionEvent[]): ExtractionReport["failures"] {
  return events.flatMap((event, index) => {
    const failures: ExtractionReport["failures"] = [];
    const mediaType = event.mediaType ?? "text";
    if (event.content.trim().length <= 8) {
      failures.push({
        eventIndex: index,
        stage: "rules",
        reason: "content too short for deterministic fact extraction",
        mediaType,
        language: event.language,
        contentPreview: preview(event.content)
      });
    }
    if ((mediaType === "audio" || mediaType === "image" || mediaType === "video") && !hasLocalMediaExtraction(event)) {
      failures.push({
        eventIndex: index,
        stage: "rules",
        reason: `deterministic ${mediaType} extraction requires provider OCR/ASR/vision adapter`,
        mediaType,
        language: event.language,
        contentPreview: preview(event.content)
      });
    }
    return failures;
  });
}

function normalizeMediaExtractionEvent(event: MemoryExtractionEvent): MemoryExtractionEvent {
  const mediaType = event.mediaType ?? "text";
  if (mediaType !== "audio" && mediaType !== "image" && mediaType !== "video" && mediaType !== "document") return event;
  const metadata = event.metadata ?? {};
  if (typeof metadata.mediaExtraction === "object" && metadata.mediaExtraction !== null) return event;
  const transformations = Array.isArray(metadata.transformations) ? metadata.transformations.map(String) : [];
  if (mediaType === "audio" && typeof metadata.asrText === "string" && metadata.asrText.trim()) {
    return {
      ...event,
      content: metadata.asrText.trim(),
      metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, "local-asr"], mediaExtraction: { mode: "local", task: "asr" } }
    };
  }
  if ((mediaType === "image" || mediaType === "document") && typeof metadata.ocrText === "string" && metadata.ocrText.trim()) {
    const labels = Array.isArray(metadata.imageLabels) ? ` Labels: ${metadata.imageLabels.map(String).join(", ")}.` : "";
    const transform = mediaType === "document" ? "local-document-ocr" : "local-ocr";
    return {
      ...event,
      content: `${metadata.ocrText.trim()}${labels}`,
      metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, transform], mediaExtraction: { mode: "local", task: "ocr" } }
    };
  }
  if (mediaType === "video" && Array.isArray(metadata.frames) && metadata.frames.length) {
    const frames = metadata.frames
      .filter((frame): frame is Record<string, unknown> => typeof frame === "object" && frame !== null)
      .map((frame) => {
        const at = typeof frame.at === "string" ? `Frame ${frame.at}: ` : "Frame: ";
        const text = typeof frame.text === "string" ? frame.text : "";
        const description = typeof frame.description === "string" ? frame.description : "";
        return `${at}${[description, text].filter(Boolean).join(" ")}`.trim();
      })
      .filter(Boolean);
    if (frames.length) {
      return {
        ...event,
        content: frames.join("\n"),
        metadata: { ...metadata, originalMediaContent: event.content, transformations: [...transformations, "local-video-frames"], mediaExtraction: { mode: "local", task: "video_frames", frames: frames.length } }
      };
    }
  }
  return event;
}

function hasLocalMediaExtraction(event: MemoryExtractionEvent): boolean {
  const metadata = event.metadata ?? {};
  if (event.mediaType === "audio") return typeof metadata.asrText === "string" && metadata.asrText.trim().length > 0;
  if (event.mediaType === "image" || event.mediaType === "document") return typeof metadata.ocrText === "string" && metadata.ocrText.trim().length > 0;
  if (event.mediaType === "video") return Array.isArray(metadata.frames) && metadata.frames.length > 0;
  return false;
}

function markExtractionStage(input: MemoryInput, stage: "rules" | "provider"): MemoryInput {
  return {
    ...input,
    tags: [...new Set([...(input.tags ?? []), stage === "provider" ? "provider-extracted" : "rule-extracted"])],
    metadata: {
      ...(input.metadata ?? {}),
      extraction: {
        ...((input.metadata?.extraction as Record<string, unknown> | undefined) ?? {}),
        stage
      }
    }
  };
}

function extractionConfidence(events: MemoryExtractionEvent[], extracted: number): number {
  if (!events.length) return 0;
  const mediaPenalty = events.some((event) => event.mediaType === "audio" || event.mediaType === "image" || event.mediaType === "video") ? 0.25 : 0;
  const languagePenalty = events.some((event) => event.language && !/^en/i.test(event.language)) ? 0.08 : 0;
  return clamp01((extracted ? 0.82 : 0.24) - mediaPenalty - languagePenalty);
}

function enrichmentCandidatesFor(memories: Memory[]): EnrichmentCandidate[] {
  const byEntity = new Map<string, Memory[]>();
  for (const memory of memories) {
    for (const entity of memory.entities) {
      const current = byEntity.get(entity) ?? [];
      current.push(memory);
      byEntity.set(entity, current);
    }
  }
  return [...byEntity.entries()]
    .map(([entity, support]) => {
      const mentionCount = support.length;
      const trusted = support.reduce((sum, memory) => sum + memory.trust * memory.importance, 0);
      const attention = clamp01(mentionCount / 4 + trusted / Math.max(1, mentionCount * 2));
      const suggestedAction: EnrichmentCandidate["suggestedAction"] = attention >= 0.9 ? "full_pipeline" : mentionCount >= 2 ? "enrich" : "stub";
      return {
        entity,
        mentionCount,
        attention,
        suggestedAction,
        reason:
          suggestedAction === "full_pipeline"
            ? "high mention count and trust merit external enrichment"
            : suggestedAction === "enrich"
              ? "repeated mentions merit metadata enrichment"
              : "first mention creates a lightweight entity stub",
        memoryIds: support.map((memory) => memory.id)
      };
    })
    .filter((candidate) => candidate.suggestedAction !== "stub" || candidate.mentionCount >= 1)
    .sort((a, b) => b.attention - a.attention || b.mentionCount - a.mentionCount)
    .slice(0, 25);
}

function learnedRuleSuggestions(events: MemoryExtractionEvent[], failures: ExtractionReport["failures"]): ExtractionReport["learnedRules"] {
  const suggestions: ExtractionReport["learnedRules"] = [];
  const mediaFailures = new Map<string, string[]>();
  for (const failure of failures) {
    if (failure.mediaType === "audio" || failure.mediaType === "image" || failure.mediaType === "video") {
      const current = mediaFailures.get(failure.mediaType) ?? [];
      current.push(failure.contentPreview);
      mediaFailures.set(failure.mediaType, current);
    }
    if (failure.reason.includes("too short")) {
      suggestions.push({
        kind: "regex",
        pattern: "\\b(confirm(ed)?|verified|decided|prefers|uses)\\b",
        reason: "short events may still contain durable confirmations when domain verbs are present",
        examples: [failure.contentPreview].filter(Boolean),
        confidence: 0.48
      });
    }
  }
  for (const [mediaType, examples] of mediaFailures) {
    suggestions.push({
      kind: "provider",
      reason: `configure a ${mediaType} extractor adapter for OCR/ASR/vision before rule extraction`,
      examples: examples.filter(Boolean).slice(0, 3),
      confidence: 0.78
    });
  }
  const languages = [...new Set(events.map((event) => event.language).filter((language): language is string => Boolean(language && !/^en/i.test(language))))];
  for (const language of languages) {
    suggestions.push({
      kind: "translation",
      reason: `add ${language} normalization or translation before contradiction/extraction rules`,
      examples: events.filter((event) => event.language === language).map((event) => preview(event.content)).slice(0, 3),
      confidence: 0.62
    });
  }
  return suggestions;
}

function preview(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function feedbackDelta(kind: FeedbackEvent["kind"]): { trust: number; importance: number } {
  switch (kind) {
    case "helpful":
      return { trust: 0.04, importance: 0.06 };
    case "always_include":
      return { trust: 0.06, importance: 0.12 };
    case "wrong":
      return { trust: -0.18, importance: -0.08 };
    case "stale":
      return { trust: -0.1, importance: -0.04 };
    case "never_include":
      return { trust: -0.25, importance: -0.18 };
    default:
      return { trust: 0, importance: 0 };
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rollingAverage(current: number, sample: number, count: number): number {
  return current + (sample - current) / Math.max(1, count);
}

function contentHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `c_${(hash >>> 0).toString(36)}`;
}

function syntheticExtractionEvent(input: MemoryInput): MemoryExtractionEvent {
  return {
    role: input.source?.kind === "tool" ? "tool" : input.source?.kind === "agent" ? "assistant" : "user",
    content: input.content,
    timestamp: input.timestamp,
    source: input.source,
    uri: input.source?.uri,
    metadata: input.metadata
  };
}

function auditEventForHash(event: AuditEvent): Record<string, unknown> {
  const { hash: _hash, payloadHash: _payloadHash, ...rest } = event;
  return rest;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function canonicalAuditJournalType(event: AuditEvent): AuditJournalEvent["journalType"] {
  if (event.type === "memory.write" && event.memoryId) return "memory.created";
  if (event.type === "memory.update" || event.type === "memory.consent" || event.type === "memory.revert") {
    if (event.metadata?.action === "archive") return "memory.archived";
    if (event.metadata?.action === "retract") return "memory.retracted";
    const after = event.metadata?.after as Memory | undefined;
    if (after?.beliefState === "superseded") return "memory.superseded";
    return "memory.updated";
  }
  if (event.type === "memory.delete") return "memory.deleted";
  if (event.type === "search.run") return event.metadata?.resource === "evidence-pack" ? "context_pack.created" : "memory.retrieved";
  if (event.type === "policy.violation") return "policy.denied";
  if (event.type === "reflect.run" || event.type === "retention.enforce") return "dream.action";
  if (event.type === "connector.sync") return "connector.ingested";
  return "system.event";
}

function applyMemoryJournalEvent(current: AuditReplayMemoryState, event: AuditJournalEvent): AuditReplayMemoryState {
  const next: AuditReplayMemoryState = {
    ...current,
    userId: current.userId ?? event.userId,
    brainId: current.brainId ?? event.brainId,
    sourceId: current.sourceId ?? event.sourceId,
    lastEventId: event.id,
    lastHash: event.hash,
    versions: current.versions + (event.journalType === "memory.retrieved" ? 0 : 1)
  };
  if (event.journalType === "memory.created" || event.journalType === "memory.updated") return { ...next, exists: true };
  if (event.journalType === "memory.archived") return { ...next, exists: true, archived: true };
  if (event.journalType === "memory.retracted") return { ...next, exists: true, retracted: true };
  if (event.journalType === "memory.superseded") return { ...next, exists: true, superseded: true };
  if (event.journalType === "memory.deleted") return { ...next, exists: false };
  return next;
}

function openApiPaths(routeMethods: Record<string, string[]>, security: Array<Record<string, string[]>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(routeMethods).map(([path, methods]) => [
      path,
      Object.fromEntries(methods.map((method) => [method.toLowerCase(), openApiOperation(path, method, security)]))
    ])
  );
}

function openApiOperation(path: string, method: string, security: Array<Record<string, string[]>>): Record<string, unknown> {
  const operationId = `${method.toLowerCase()}${path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[{}-](.)/g, (_match, char: string) => char.toUpperCase()).replace(/[{}]/g, ""))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}`;
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" }
  }));
  return {
    operationId,
    summary: `${method} ${path}`,
    ...(security.length && path !== "/auth/status" ? { security } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(method !== "GET" && method !== "DELETE" ? { requestBody: jsonBody(schemaRef(requestSchemaFor(path))) } : {}),
    responses: {
      "200": jsonResponse(responseSchemaFor(path, method)),
      "201": jsonResponse(responseSchemaFor(path, method)),
      "202": jsonResponse(responseSchemaFor(path, method)),
      "400": jsonResponse("ErrorResponse"),
      "401": jsonResponse("ErrorResponse"),
      "404": jsonResponse("ErrorResponse")
    }
  };
}

function requestSchemaFor(path: string): string {
  if (path === "/memories" || path === "/ingest/media") return "MemoryInput";
  if (path === "/search" || path === "/route" || path === "/evidence-pack") return "SearchRequest";
  if (path === "/policy/evaluate") return "PolicyEvaluateRequest";
  if (path === "/policy/rules") return "MemoryPolicyRule";
  if (path === "/connectors/register") return "ConnectorManifest";
  if (path.includes("connector")) return "ConnectorRequest";
  if (path.includes("graph")) return "GraphRequest";
  if (path.includes("migration")) return "ManagedMigrationBundle";
  return "GenericObject";
}

function responseSchemaFor(path: string, method: string): string {
  if (path === "/memories" && method === "GET") return "MemoryList";
  if (path === "/memories" || path.startsWith("/memories/{id}")) return "Memory";
  if (path.includes("evidence") || path.includes("context-packs")) return "EvidencePack";
  if (path === "/audit/chain") return "AuditChain";
  if (path === "/audit") return "AuditEventList";
  if (path.includes("policy")) return "PolicyDecision";
  if (path.includes("connectors")) return "ConnectorResponse";
  if (path.includes("graph")) return "GraphResponse";
  if (path === "/sdk/openapi") return "OpenAPI";
  if (method === "DELETE") return "EmptyResponse";
  return "GenericObject";
}

function jsonBody(schema: Record<string, unknown>): Record<string, unknown> {
  return { required: true, content: { "application/json": { schema } } };
}

function jsonResponse(schemaName: string): Record<string, unknown> {
  return { description: schemaName, content: { "application/json": { schema: schemaRef(schemaName) } } };
}

function schemaRef(name: string): Record<string, string> {
  return { "$ref": `#/components/schemas/${name}` };
}

function openApiSchemas(): Record<string, Record<string, unknown>> {
  return {
    GenericObject: { type: "object", additionalProperties: true },
    EmptyResponse: { type: "object", additionalProperties: false },
    ErrorResponse: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
    MemoryInput: {
      type: "object",
      required: ["userId", "content"],
      properties: {
        userId: { type: "string" },
        brainId: { type: "string" },
        sourceId: { type: "string" },
        agentId: { type: "string" },
        orgId: { type: "string" },
        projectId: { type: "string" },
        content: { type: "string" },
        type: { enum: ["user", "feedback", "project", "reference", "episodic", "procedural"] },
        layer: { enum: ["working", "episodic", "long_term", "procedural", "reflection"] },
        tags: { type: "array", items: { type: "string" } },
        entities: { type: "array", items: { type: "string" } },
        consent: { "$ref": "#/components/schemas/ConsentPolicy" },
        source: { "$ref": "#/components/schemas/Provenance" }
      }
    },
    Memory: {
      allOf: [
        { "$ref": "#/components/schemas/MemoryInput" },
        {
          type: "object",
          required: ["id", "schemaVersion", "createdAt", "updatedAt", "trust", "importance", "audit"],
          properties: {
            id: { type: "string" },
            schemaVersion: { const: "2.0" },
            beliefState: { enum: ["active", "stale", "superseded", "contradicted", "needs_verification", "retracted", "archived"] },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            trust: { type: "number" },
            importance: { type: "number" },
            audit: { type: "array", items: { "$ref": "#/components/schemas/MemoryAuditEvent" } }
          }
        }
      ]
    },
    MemoryList: { type: "array", items: { "$ref": "#/components/schemas/Memory" } },
    ConsentPolicy: {
      type: "object",
      properties: {
        visibility: { enum: ["private", "user", "org", "public"] },
        allowTraining: { type: "boolean" },
        retentionUntil: { type: "string", format: "date-time" },
        deleteOnRequest: { type: "boolean" }
      }
    },
    Provenance: {
      type: "object",
      required: ["kind", "confidence"],
      properties: {
        kind: { enum: ["human", "reviewed_code", "tool", "agent", "transcript", "import"] },
        uri: { type: "string" },
        commit: { type: "string" },
        lineStart: { type: "number" },
        lineEnd: { type: "number" },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    MemoryAuditEvent: { type: "object", additionalProperties: true },
    SearchRequest: {
      type: "object",
      required: ["userId", "query"],
      properties: {
        userId: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
        includePrivate: { type: "boolean" },
        includeSharedBrains: { type: "boolean" },
        brainId: { type: "string" },
        brainIds: { type: "array", items: { type: "string" } },
        orgId: { type: "string" },
        projectId: { type: "string" },
        mode: { enum: ["hybrid", "rrf", "graph", "path"] }
      }
    },
    EvidencePack: { type: "object", required: ["schemaVersion", "id", "query", "context", "results", "hash"], additionalProperties: true },
    AuditEvent: { type: "object", required: ["id", "type", "timestamp"], additionalProperties: true },
    AuditEventList: { type: "array", items: { "$ref": "#/components/schemas/AuditEvent" } },
    AuditChain: { type: "object", required: ["schemaVersion", "eventCount", "valid", "events", "replay"], additionalProperties: true },
    MemoryPolicyRule: { type: "object", required: ["label", "effect", "operations"], additionalProperties: true },
    PolicyEvaluateRequest: { type: "object", required: ["operation"], additionalProperties: true },
    PolicyDecision: { type: "object", required: ["operation", "allowed", "matchedRules", "reasons"], additionalProperties: true },
    ConnectorManifest: { type: "object", required: ["id", "name", "kind", "version", "direction", "capabilities", "auth"], additionalProperties: true },
    ConnectorRequest: { type: "object", additionalProperties: true },
    ConnectorResponse: { type: "object", additionalProperties: true },
    GraphRequest: { type: "object", additionalProperties: true },
    GraphResponse: { type: "object", additionalProperties: true },
    ManagedMigrationBundle: { type: "object", additionalProperties: true },
    OpenAPI: { type: "object", required: ["openapi", "info", "paths", "components"], additionalProperties: true }
  };
}

function safeGet(store: MemoryStore, id: string): Memory | undefined {
  try {
    return store.get(id);
  } catch {
    return undefined;
  }
}

function connectorReviewRequired(manifest: ConnectorManifest, event: MemoryExtractionEvent & { externalId?: string }): boolean {
  if (event.metadata?.reviewRequired === true) return true;
  if (manifest.kind === "chat" && /\b(decision|decided|approved|must|should)\b/i.test(event.content)) return true;
  return false;
}

function connectorEventVisibility(event: MemoryExtractionEvent & { externalId?: string }): ConsentVisibility | undefined {
  const value = event.metadata?.visibility ?? event.metadata?.channelVisibility;
  if (value === "private" || value === "user" || value === "org" || value === "public") return value;
  if (value === "team") return "org";
  return undefined;
}

function connectorEventTags(manifest: ConnectorManifest, event: MemoryExtractionEvent & { externalId?: string }): string[] {
  const eventType = typeof event.metadata?.eventType === "string" ? event.metadata.eventType : "";
  const tags = [manifest.id, manifest.kind];
  if (manifest.id.includes("github")) tags.push("github");
  if (manifest.id.includes("slack")) tags.push("slack");
  if (manifest.id.includes("discord")) tags.push("discord");
  if (/pr[_-]?decision/i.test(eventType) || /\bPR\b.*\b(decision|approved|merged)\b/i.test(event.content)) tags.push("pr-decision", "connector-decision");
  if (/test[_-]?failure|actions[_-]?failure/i.test(eventType) || /\b(test|actions?)\b.*\b(failed|failure)\b/i.test(event.content)) tags.push("test-failure", "harness-action");
  if (connectorReviewRequired(manifest, event)) tags.push("memory-candidate", "review-required");
  return [...new Set(tags)];
}

function connectorWritebackPayload(
  manifest: ConnectorManifest,
  operation: ConnectorWritebackOperation,
  target: Record<string, unknown>,
  content: string | undefined,
  memories: Memory[],
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const text = content?.trim() || memories.map((memory) => memory.content).join("\n\n").slice(0, 2000) || "Cognibrain memory update.";
  const citations = memories.map((memory) => citationFor(memory));
  const base = { operation, text, citations, memoryIds: memories.map((memory) => memory.id), metadata: metadata ?? {} };
  if (manifest.kind === "email") return { ...base, adapter: "email.draft_reply", messageId: target.externalId, threadId: target.threadId, subject: target.subject ?? "Memory update", body: text };
  if (manifest.kind === "chat") return { ...base, adapter: "chat.post_message", channel: target.channel, threadId: target.threadId, text };
  if (manifest.kind === "project_management") return { ...base, adapter: operation === "status" ? "issue.update_status" : "issue.add_comment", issueKey: target.externalId ?? target.issueKey, status: target.status, comment: text };
  if (manifest.kind === "docs") return { ...base, adapter: "docs.append_comment", uri: target.uri, title: target.title, comment: text };
  if (manifest.kind === "code") return { ...base, adapter: "code.review_comment", repo: target.repo, path: target.path, pullRequest: target.pullRequest, comment: text };
  if (manifest.kind === "calendar") return { ...base, adapter: "calendar.update_event_note", eventId: target.externalId ?? target.eventId, note: text };
  if (manifest.kind === "cloud_storage") return { ...base, adapter: "cloud_storage.file_metadata", fileId: target.externalId ?? target.fileId, tags: target.tags, summary: text };
  return { ...base, adapter: "custom.writeback", target };
}

function connectorWritebackRequest(manifest: ConnectorManifest, record: ConnectorSyncRecord): ConnectorSyncRecord["request"] | undefined {
  const endpoint = manifest.writeback?.endpoint;
  if (!endpoint) return undefined;
  const body = JSON.stringify({
    connectorId: manifest.id,
    kind: manifest.kind,
    operation: record.operation,
    target: record.target,
    payload: record.payload
  });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "cognibrain-connector/0.1",
    "x-cognibrain-connector": manifest.id,
    "x-cognibrain-operation": record.operation ?? "comment"
  };
  if (manifest.writeback?.authRef) headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", manifest.writeback.authRef).update(body).digest("hex")}`;
  return {
    method: manifest.writeback?.method ?? "POST",
    url: interpolateConnectorEndpoint(endpoint, record.target ?? {}),
    headers,
    body
  };
}

function connectorAdapterRequest(
  manifest: ConnectorManifest,
  operation: string,
  endpoint: string,
  method: "GET" | "POST",
  payload?: Record<string, unknown>,
  authRef?: string
): NonNullable<ConnectorSyncRecord["request"]> {
  const body = method === "GET" ? "" : JSON.stringify({ connectorId: manifest.id, kind: manifest.kind, operation, payload: payload ?? {} });
  const headers: Record<string, string> = {
    "user-agent": "cognibrain-connector/0.1",
    "x-cognibrain-connector": manifest.id,
    "x-cognibrain-operation": operation
  };
  if (method !== "GET") headers["content-type"] = "application/json";
  if (authRef) headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", authRef).update(body).digest("hex")}`;
  return { method, url: endpoint, headers, body };
}

function connectorWritebackOperations(kind: ConnectorManifest["kind"]): ConnectorWritebackOperation[] {
  if (kind === "project_management") return ["comment", "status", "tag", "memory_link"];
  if (kind === "chat") return ["comment", "summary", "memory_link"];
  if (kind === "email") return ["comment", "tag", "summary"];
  if (kind === "docs") return ["comment", "summary", "memory_link"];
  if (kind === "code") return ["comment", "status", "memory_link"];
  if (kind === "calendar") return ["summary", "memory_link"];
  if (kind === "cloud_storage") return ["tag", "summary", "memory_link"];
  return ["comment", "tag", "status", "summary", "memory_link"];
}

function interpolateConnectorEndpoint(endpoint: string, target: Record<string, unknown>): string {
  return endpoint.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key: string) => encodeURIComponent(String(target[key] ?? "")));
}

function linkStateChange(input: MemoryInput, existing: Memory[]): MemoryInput {
  const subject = input.entities?.[0];
  if (!subject) return input;
  const prior = existing.find((memory) => !memory.archivedAt && memory.entities.includes(subject) && memory.content !== input.content);
  if (!prior) return input;
  const lower = input.content.toLowerCase();
  const relationType = /\b(no longer|instead|now|currently|nicht mehr|jetzt)\b/.test(lower) ? "supersedes" : undefined;
  if (!relationType) return input;
  return {
    ...input,
    relations: [...(input.relations ?? []), { type: relationType, targetId: prior.id, targetEntity: subject, confidence: 0.62 }],
    temporal: { ...(input.temporal ?? {}), validFrom: input.timestamp ?? new Date().toISOString() }
  };
}

function providerFromEnv(): NonNullable<MemoryServiceOptions["intelligence"]> {
  const provider = createJsonCommandIntelligenceFromEnv();
  if (!provider) return {};
  return {
    reranker: provider,
    verifier: provider,
    contradictionDetector: provider,
    summarizer: provider,
    extractor: provider,
    queryExpander: provider,
    translator: provider
  };
}

function inferCorrectionKind(content: string): EngineeringMemoryKind {
  const lower = content.toLowerCase();
  if (/\b(do not|don't|dont|never|must not|should not)\b.*\b(generated|\.generated\.|dist\/|build\/|vendor\/)\b/.test(lower)) return "generated_file_rule";
  if (/\b(use npm|don't use pnpm|dont use pnpm|never use pnpm|always use|repo policy|repository policy)\b/.test(lower)) return "repo_policy";
  if (/\b(validation|architecture|belongs in|lives in|layer|directory|folder|adr)\b/.test(lower)) return "architecture_decision";
  if (/\b(test|vitest|jest|pytest|go test|e2e)\b/.test(lower)) return "test_strategy";
  if (/\b(dependency|package|library|import)\b/.test(lower)) return "dependency_rule";
  if (/\b(migrat|deprecated|moved|renamed|now uses|formerly)\b/.test(lower)) return "migration_note";
  if (/\b(do not|don't|dont|never|must not|should not)\b/.test(lower)) return "forbidden_action";
  return "review_correction";
}

function inferCorrectActionFromCorrection(content: string): string | undefined {
  const patterns = [
    /\buse\s+([^.;]+?)\s+instead\b/i,
    /\binstead[, ]+\s*([^.;]+)/i,
    /\bshould\s+(?:use|run|call)\s+([^.;]+)/i,
    /\brun\s+([^.;]+?)\s+(?:before|after|for|when|instead)\b/i
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern)?.[1]?.trim();
    if (match) return normalizeActionPhrase(match);
  }
  const command = content.match(/\b(?:npm|pnpm|yarn|pytest|go test|make)\b[^.;]*/i)?.[0]?.trim();
  return command ? normalizeActionPhrase(command) : undefined;
}

function inferForbiddenActionFromCorrection(content: string, previousWrongAction?: string): string | undefined {
  if (previousWrongAction && previousWrongAction.length < 120) return normalizeActionPhrase(previousWrongAction);
  const match = content.match(/\b(?:do not|don't|dont|never|must not|should not)\s+([^.;]+)/i)?.[1]?.trim();
  if (!match) return undefined;
  return normalizeActionPhrase(match.replace(/\b(?:in this repo|for this repo|here)\b/gi, "").trim());
}

function repoPolicyFromCorrection(content: string, correctAction?: string): string | undefined {
  const lower = content.toLowerCase();
  if (!/\b(repo|repository|always|never|do not|don't|dont|must|should|use|instead|policy|pnpm|npm|pytest|go test|generated)\b/.test(lower)) return undefined;
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 180) return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return correctAction ? `use ${correctAction} for matching changes.` : `${trimmed.slice(0, 177)}...`;
}

function normalizeActionPhrase(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
}

function codingActionOverlap(action: string, content: string): boolean {
  const actionTokens = new Set(action.toLowerCase().split(/\W+/).filter((token) => token.length > 2));
  const contentTokens = new Set(content.toLowerCase().split(/\W+/).filter((token) => token.length > 2));
  return [...actionTokens].some((token) => contentTokens.has(token));
}

function withProceduralMetadata(input: MemoryInput): MemoryInput {
  const content = input.content.toLowerCase();
  const tags = new Set((input.tags ?? []).map((tag) => tag.toLowerCase()));
  const looksProcedural =
    input.type === "procedural" ||
    input.layer === "procedural" ||
    tags.has("procedure") ||
    tags.has("workflow") ||
    /\b(always|before|after|when|if|run|verify|deploy|release|test|checklist|procedure|workflow|must|should)\b/.test(content);
  if (!looksProcedural) return input;
  const previous = input.metadata?.procedure as Partial<ProceduralMemoryMetadata> | undefined;
  const tests = Array.isArray((input.metadata?.action as { tests?: unknown } | undefined)?.tests)
    ? ((input.metadata?.action as { tests?: Array<{ status?: string }> }).tests ?? [])
    : [];
  const passed = tests.filter((test) => test.status === "passed").length;
  const failed = tests.filter((test) => test.status === "failed").length;
  const at = input.timestamp ?? new Date().toISOString();
  const triggerConditions = previous?.triggerConditions?.length
    ? previous.triggerConditions
    : inferProcedureTriggers(input.content, input.tags ?? []);
  const procedure: ProceduralMemoryMetadata = {
    triggerConditions,
    applicabilityScope: {
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      brainId: input.brainId,
      sourceId: input.sourceId
    },
    confidence: previous?.confidence ?? input.confidence ?? input.source?.confidence ?? 0.72,
    lastOutcome: failed ? "failure" : passed ? "success" : previous?.lastOutcome ?? "unknown",
    successCount: (previous?.successCount ?? 0) + passed,
    failureCount: (previous?.failureCount ?? 0) + failed,
    lastSuccessAt: passed ? at : previous?.lastSuccessAt,
    lastFailureAt: failed ? at : previous?.lastFailureAt,
    feedback: previous?.feedback?.length ? previous.feedback : [{ kind: "observed", at }]
  };
  return {
    ...input,
    type: input.type ?? "procedural",
    layer: input.layer ?? "procedural",
    tags: Array.from(new Set([...(input.tags ?? []), "procedure"])),
    metadata: { ...(input.metadata ?? {}), procedure }
  };
}

function inferProcedureTriggers(content: string, tags: string[]): string[] {
  const triggers = new Set<string>();
  const lower = content.toLowerCase();
  if (/\brelease|deploy|ship\b/.test(lower) || tags.includes("release")) triggers.add("before release or deploy work");
  if (/\btest|verify|ci|build\b/.test(lower) || tags.includes("test")) triggers.add("before validation or CI-sensitive changes");
  if (/\bpr|pull request|merge\b/.test(lower)) triggers.add("before pull-request or merge workflows");
  if (/\bwhen\s+([^,.]+)/i.test(content)) triggers.add(content.match(/\bwhen\s+([^,.]+)/i)?.[1]?.trim() ?? "conditional workflow");
  if (/\bif\s+([^,.]+)/i.test(content)) triggers.add(content.match(/\bif\s+([^,.]+)/i)?.[1]?.trim() ?? "conditional workflow");
  if (!triggers.size) triggers.add("matching workflow intent");
  return [...triggers];
}

function officialConnectorManifests(): ConnectorManifest[] {
  const now = "2026-01-01T00:00:00.000Z";
  const base = (kind: ConnectorManifest["kind"], name: string, capabilities: ConnectorManifest["capabilities"], metadataMapping: Record<string, string>, defaultSourceKind: ConnectorManifest["defaultSourceKind"] = "import"): ConnectorManifest => ({
    id: `official-${kind}`,
    name,
    kind,
    version: "1.0.0",
    direction: capabilities.includes("writeback") ? "two_way" : "ingest",
    capabilities,
    auth: kind === "custom" ? "none" : "oauth",
    defaultSourceKind,
    metadataMapping,
    privacyPolicy: "project",
    writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind) } : undefined,
    createdAt: now,
    updatedAt: now
  });
  const service = (
    id: string,
    name: string,
    kind: ConnectorManifest["kind"],
    capabilities: ConnectorManifest["capabilities"],
    metadataMapping: Record<string, string>,
    defaultSourceKind: ConnectorManifest["defaultSourceKind"],
    oauthScopes: string[]
  ): ConnectorManifest => ({
    ...base(kind, name, capabilities, metadataMapping, defaultSourceKind),
    id,
    name,
    oauth: {
      authorizeUrl: `https://connectors.cognibrain.local/${id.replace(/^official-/, "")}/oauth/authorize`,
      tokenUrl: `https://connectors.cognibrain.local/${id.replace(/^official-/, "")}/oauth/token`,
      clientIdRef: `secret://${id}/client-id`,
      scopes: oauthScopes,
      redirectUri: "http://localhost:8787/connectors/auth/callback"
    },
    list: { endpoint: `connector://${id}/list`, method: "POST" },
    poll: capabilities.includes("poll") ? { endpoint: `connector://${id}/poll`, method: "POST" } : undefined,
    writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind), endpoint: `connector://${id}/writeback`, method: "POST" } : undefined
  });
  const vendor = (
    id: "official-github" | "official-slack" | "official-discord",
    name: string,
    kind: ConnectorManifest["kind"],
    capabilities: ConnectorManifest["capabilities"],
    metadataMapping: Record<string, string>,
    defaultSourceKind: ConnectorManifest["defaultSourceKind"],
    oauthScopes: string[],
    provider: "github" | "slack" | "discord",
    docsUrl: string,
    requiredEnv: string[]
  ): ConnectorManifest => {
    const vendorEndpoint = { github: "vendor://github", slack: "vendor://slack", discord: "vendor://discord" }[provider];
    return {
      ...service(id, name, kind, capabilities, metadataMapping, defaultSourceKind, oauthScopes),
      list: { endpoint: `${vendorEndpoint}/list`, method: "GET" },
      poll: capabilities.includes("poll") ? { endpoint: `${vendorEndpoint}/poll`, method: "GET" } : undefined,
      writeback: capabilities.includes("writeback") ? { operations: connectorWritebackOperations(kind), endpoint: `${vendorEndpoint}/writeback`, method: "POST" } : undefined,
      vendor: { provider, docsUrl, requiredEnv, realSmokeEnv: requiredEnv }
    };
  };
  return [
    base("email", "Email", ["ingest", "export", "webhook", "poll", "writeback"], { subject: "content.title", from: "source.author", messageId: "externalId", threadId: "metadata.threadId" }, "human"),
    base("chat", "Chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageId: "externalId", text: "content" }, "transcript"),
    base("project_management", "Project Management", ["ingest", "export", "poll", "writeback"], { issueKey: "externalId", status: "metadata.status", assignee: "entities.assignee", title: "content.title" }, "import"),
    base("docs", "Docs", ["ingest", "webhook", "poll", "writeback"], { url: "source.uri", title: "content.title", workspace: "metadata.workspace" }, "import"),
    base("code", "Code", ["ingest", "webhook", "poll", "writeback"], { repo: "metadata.repo", path: "source.uri", commit: "source.commit", symbol: "entities.symbol" }, "reviewed_code"),
    base("calendar", "Calendar", ["ingest", "poll", "writeback"], { eventId: "externalId", attendees: "entities.attendees", start: "temporal.eventAt" }, "human"),
    base("cloud_storage", "Cloud Storage", ["ingest", "poll", "media"], { fileId: "externalId", mimeType: "mimeType", uri: "source.uri", name: "content.title" }, "import"),
    vendor("official-github", "GitHub", "code", ["ingest", "export", "webhook", "poll", "writeback"], { repo: "metadata.repo", issueNumber: "externalId", pullRequest: "metadata.pullRequest", commit: "source.commit", actor: "source.author", url: "source.uri" }, "reviewed_code", ["repo:read", "issues:read", "pull_requests:read", "contents:read"], "github", "https://docs.github.com/en/rest/pulls/pulls", ["MEMORY_GITHUB_REPO", "MEMORY_GITHUB_TOKEN"]),
    service("official-jira", "Jira", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { issueKey: "externalId", status: "metadata.status", assignee: "entities.assignee", sprint: "metadata.sprint", project: "metadata.project", url: "source.uri" }, "import", ["read:jira-work", "write:jira-work"]),
    service("official-linear", "Linear", "project_management", ["ingest", "export", "webhook", "poll", "writeback"], { issueId: "externalId", team: "metadata.team", status: "metadata.status", assignee: "entities.assignee", label: "tags", url: "source.uri" }, "import", ["read", "write"]),
    vendor("official-slack", "Slack", "chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageTs: "externalId", threadTs: "metadata.threadId", permalink: "source.uri" }, "transcript", ["channels:history", "groups:history", "chat:write"], "slack", "https://docs.slack.dev/reference/methods/conversations.history/", ["MEMORY_SLACK_TOKEN", "MEMORY_SLACK_CHANNEL_ID"]),
    vendor("official-discord", "Discord", "chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageId: "externalId", threadId: "metadata.threadId", jumpUrl: "source.uri" }, "transcript", ["messages.read", "messages.write"], "discord", "https://docs.discord.com/developers/resources/message", ["MEMORY_DISCORD_BOT_TOKEN", "MEMORY_DISCORD_CHANNEL_ID"]),
    service("official-notion", "Notion", "docs", ["ingest", "webhook", "poll", "writeback"], { pageId: "externalId", workspace: "metadata.workspace", title: "content.title", url: "source.uri", lastEditedBy: "source.author" }, "import", ["read_content", "update_content"]),
    service("official-google-drive", "Google Drive", "cloud_storage", ["ingest", "poll", "media"], { fileId: "externalId", mimeType: "mimeType", uri: "source.uri", name: "content.title", owner: "source.author" }, "import", ["drive.readonly"]),
    service("official-gmail", "Gmail", "email", ["ingest", "export", "webhook", "poll", "writeback"], { messageId: "externalId", threadId: "metadata.threadId", subject: "content.title", from: "source.author", labelIds: "tags" }, "human", ["gmail.readonly", "gmail.modify"]),
    service("official-google-calendar", "Google Calendar", "calendar", ["ingest", "poll", "writeback"], { eventId: "externalId", calendarId: "metadata.calendarId", attendees: "entities.attendees", start: "temporal.eventAt", url: "source.uri" }, "human", ["calendar.readonly", "calendar.events"])
  ];
}

function officialMarketplaceModules(): MarketplaceModule[] {
  const scannedAt = "2026-01-01T00:00:00.000Z";
  const security = (permissions: string[] = []): MarketplaceModule["security"] => ({ scannedAt, status: "passed", permissions, risks: [] });
  const signed = (id: string): Pick<MarketplaceModule, "signature" | "compatibility"> => ({
    signature: {
      signer: "cognilabz",
      algorithm: "sha256",
      digest: contentHash(`cognibrain:${id}:1.0.0`),
      status: "verified",
      verifiedAt: scannedAt
    },
    compatibility: { minCognibrainVersion: "0.1.0", engines: ["node>=20"] }
  });
  return [
    ...officialConnectorManifests().map((manifest): MarketplaceModule => ({
      id: `market-${manifest.id}`,
      kind: "connector" as const,
      name: `${manifest.name} Connector`,
      version: manifest.version,
      description: `Official ${manifest.name.toLowerCase()} connector manifest with local-first install metadata.`,
      installState: "available" as const,
      security: security(manifest.capabilities),
      ...signed(`market-${manifest.id}`),
      manifest: { ...manifest } as Record<string, unknown>
    })),
    ...DOMAIN_MODULES.filter((domain) => domain.id !== "general").map((domain): MarketplaceModule => ({
      id: `domain-${domain.id}`,
      kind: "domain" as const,
      name: `${domain.label} Domain`,
      version: "1.0.0",
      description: `Domain module for ${domain.label.toLowerCase()} memory behavior.`,
      installState: "available" as const,
      security: security(["enrich", ...(domain.redactionPolicy ? ["redaction-policy"] : [])]),
      ...signed(`domain-${domain.id}`),
      manifest: {
        id: domain.id,
        label: domain.label,
        retrievalWeights: domain.retrievalWeights,
        lifecyclePolicy: domain.lifecyclePolicy,
        aliases: domain.aliases,
        redactionMode: domain.redactionPolicy?.mode
      }
    })),
    {
      id: "retrieval-trust-heavy",
      kind: "retrieval_profile",
      name: "Trust Heavy Retrieval",
      version: "1.0.0",
      description: "Prioritizes high-trust and entity-linked context for production agents.",
      installState: "available",
      security: security(["retrieval-profile"]),
      ...signed("retrieval-trust-heavy"),
      manifest: { id: "trust-heavy", label: "Trust Heavy", weights: { trust: 0.36, entity: 0.24, graph: 0.14, semantic: 0.14, keyword: 0.08, temporal: 0.04 } }
    },
    {
      id: "persona-operator",
      kind: "persona",
      name: "Operator Persona",
      version: "1.0.0",
      description: "Concise summaries, private defaults, and high-trust retrieval.",
      installState: "available",
      security: security(["persona"]),
      ...signed("persona-operator"),
      manifest: { id: "operator", label: "Operator", summaryStyle: "concise", privacyDefault: "private", retrievalWeights: { trust: 0.34, graph: 0.2 } }
    }
  ];
}

function marketplaceRisks(module: MarketplaceModule): string[] {
  const risks: string[] = [];
  if (!module.id.trim() || !module.name.trim() || !module.version.trim()) risks.push("blocked: module requires id, name and version");
  if (module.security?.status === "blocked") risks.push("blocked: security scan blocked install");
  if (!module.signature) risks.push("warning: module has no signature metadata");
  if (module.signature?.status === "invalid") risks.push("blocked: module signature is invalid");
  if (module.signature && !module.signature.digest.trim()) risks.push("blocked: module signature digest is empty");
  if (module.compatibility?.minCognibrainVersion && compareVersions(COGNIBRAIN_VERSION, module.compatibility.minCognibrainVersion) < 0) risks.push(`blocked: requires cognibrain >= ${module.compatibility.minCognibrainVersion}`);
  if (module.compatibility?.maxCognibrainVersion && compareVersions(COGNIBRAIN_VERSION, module.compatibility.maxCognibrainVersion) > 0) risks.push(`blocked: supports cognibrain <= ${module.compatibility.maxCognibrainVersion}`);
  if (!module.security?.permissions?.length) risks.push("warning: module declares no requested permissions");
  if (module.kind === "connector") {
    try {
      validateConnectorManifest(module.manifest as unknown as ConnectorManifest);
    } catch (error) {
      risks.push(`blocked: ${error instanceof Error ? error.message : "invalid connector manifest"}`);
    }
  }
  if (module.kind === "retrieval_profile" && !(module.manifest as Partial<RetrievalProfile>).weights) risks.push("blocked: retrieval profile requires weights");
  if (module.kind === "persona" && (!(module.manifest as Partial<PersonaProfile>).id || !(module.manifest as Partial<PersonaProfile>).label)) risks.push("blocked: persona requires id and label");
  if (!module.security) risks.push("warning: module has no security scan metadata");
  return risks;
}

function securityScanFor(module: MarketplaceModule): NonNullable<MarketplaceModule["security"]> {
  const risks = marketplaceRisks({ ...module, security: { scannedAt: new Date().toISOString(), status: "passed", permissions: [], risks: [] } }).filter((risk) => risk !== "warning: module has no security scan metadata");
  return {
    scannedAt: new Date().toISOString(),
    status: risks.some((risk) => risk.startsWith("blocked:")) ? "blocked" : risks.length ? "warning" : "passed",
    permissions: module.security?.permissions?.length ? module.security.permissions : module.kind === "connector" ? ((module.manifest as Partial<ConnectorManifest>).capabilities ?? []) : [module.kind],
    risks
  };
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number(part) || 0);
  const rightParts = right.split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(5, Math.max(1, Math.round(value * 10) / 10));
}

function averageRating(reviews: MarketplaceReview[]): number | undefined {
  if (!reviews.length) return undefined;
  return reviews.reduce((sum, review) => sum + clampRating(review.rating), 0) / reviews.length;
}

function validateConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt">): void {
  if (!input.id.trim() || !input.name.trim()) throw new Error("Connector manifest requires id and name");
  if (!input.capabilities.length) throw new Error(`Connector ${input.id} must declare at least one capability`);
  if (input.direction === "two_way" && !input.capabilities.includes("ingest")) throw new Error(`Two-way connector ${input.id} must support ingest`);
  if (input.capabilities.includes("writeback") && input.direction === "ingest") throw new Error(`Writeback connector ${input.id} must be export or two_way`);
  if (input.auth === "oauth" && !input.oauth?.authorizeUrl) throw new Error(`OAuth connector ${input.id} requires oauth.authorizeUrl`);
}

function deterministicTranslate(text: string, sourceLanguage?: string, targetLanguage = "en"): string {
  if (targetLanguage !== "en" || !sourceLanguage || /^en/i.test(sourceLanguage)) return text;
  const dictionary: Record<string, string> = {
    speicher: "memory",
    erinnerung: "memory",
    fehler: "bug",
    veröffentlichung: "release",
    freigabe: "release",
    benutzer: "user",
    werkzeug: "tool",
    soll: "should",
    nicht: "not"
  };
  return text
    .split(/(\W+)/)
    .map((part) => dictionary[part.toLowerCase()] ?? part)
    .join("");
}

function baseSignalTemplate(): RetrievalWeights {
  return normalizeRetrievalWeights();
}

function profileLoss(weights: RetrievalWeights, samples: RetrievalTrainingSample[]): number | undefined {
  if (!samples.length) return undefined;
  let total = 0;
  for (const sample of samples) {
    const score = dot(weights, sample.signals ?? {});
    const target = sample.outcome === "helpful" || sample.outcome === "accepted" ? 1 : 0;
    total += (target - score) ** 2;
  }
  return total / samples.length;
}

function dot(weights: RetrievalWeights, signals: Partial<RetrievalWeights>): number {
  return (Object.keys(weights) as Array<keyof RetrievalWeights>).reduce((sum, key) => sum + weights[key] * (signals[key] ?? 0), 0);
}

function memoryMatchesProfileScope(memory: Memory, scope: RetrievalProfile["scope"] | undefined): boolean {
  if (!scope) return true;
  return (
    (!scope.userId || memory.userId === scope.userId) &&
    (!scope.projectId || memory.projectId === scope.projectId) &&
    (!scope.appId || memory.appId === scope.appId) &&
    (!scope.orgId || memory.orgId === scope.orgId) &&
    (!scope.agentId || memory.agentId === scope.agentId)
  );
}

function sampleMatchesProfileScope(sample: RetrievalTrainingSample, scope: RetrievalProfile["scope"] | undefined): boolean {
  if (!scope) return true;
  return !scope.userId || sample.userId === scope.userId;
}

function buildQueryPlan(query: string): QueryPlan {
  const text = query.toLowerCase();
  const rules: Array<{
    queryType: string;
    pattern: RegExp;
    intent: QueryIntentReport["intent"];
    strategies: QueryPlanStrategy[];
    confidence: number;
    recommendedMode?: QueryIntentReport["recommendedMode"];
    recommendedWeights?: Partial<RetrievalWeights>;
    reason: string;
  }> = [
    { queryType: "command_selection", pattern: /\b(what command should i run|which command|test command|run tests|run before|npm|pnpm|yarn|pytest|go test|cargo test|command)\b/, intent: "preference_procedural", strategies: ["repo_policy", "procedure", "tool_outcome", "keyword", "evidence"], confidence: 0.86, recommendedWeights: { trust: 0.3, keyword: 0.22, temporal: 0.18, entity: 0.16 }, reason: "coding command-selection language detected" },
    { queryType: "change_location", pattern: /\b(where should|where does|which file|which folder|which directory|what file|add validation|place this|belongs in|change go)\b/, intent: "project_context", strategies: ["architecture", "repo_policy", "scope", "keyword", "evidence"], confidence: 0.84, recommendedWeights: { entity: 0.28, trust: 0.24, keyword: 0.2, graph: 0.14 }, reason: "coding change-location language detected" },
    { queryType: "reviewer_correction", pattern: /\b(review corrected|reviewer|requested changes|what did .* correct|correction|feedback|wrong last time|korrigiert)\b/, intent: "preference_procedural", strategies: ["correction", "repo_policy", "procedure", "temporal", "evidence"], confidence: 0.86, recommendedWeights: { trust: 0.3, temporal: 0.22, keyword: 0.18, graph: 0.16 }, reason: "review correction language detected" },
    { queryType: "dangerous_file", pattern: /\b(dangerous file|do not edit|generated file|forbidden file|safe to edit|should i edit|lockfile|dist\/|build\/)\b/, intent: "preference_procedural", strategies: ["guard", "policy", "repo_policy", "keyword", "evidence"], confidence: 0.88, recommendedWeights: { trust: 0.34, keyword: 0.22, entity: 0.16, temporal: 0.12 }, reason: "forbidden-file or action-guard language detected" },
    { queryType: "architecture_decision", pattern: /\b(architecture|architecture decision|adr|module boundary|directory convention|validation architecture|dependency rule|existing pattern)\b/, intent: "project_context", strategies: ["architecture", "graph_path", "entity", "evidence"], confidence: 0.84, recommendedMode: "path", recommendedWeights: { graph: 0.32, entity: 0.24, trust: 0.22, keyword: 0.12 }, reason: "architecture decision language detected" },
    { queryType: "failed_last_time", pattern: /\b(failed last time|what failed|last failure|previous command failed|ci failed|test failed|exit code|failure reason)\b/, intent: "temporal_question", strategies: ["tool_outcome", "timeline", "temporal", "keyword", "evidence"], confidence: 0.86, recommendedWeights: { temporal: 0.3, trust: 0.24, keyword: 0.2, entity: 0.12 }, reason: "previous tool-outcome language detected" },
    { queryType: "repo_change", pattern: /\b(what changed in this repo|repo changed|repository changed|migrated|test migration|dependency migration|architecture migration|deprecated|new convention|branch rule|package changed|ci config changed)\b/, intent: "temporal_question", strategies: ["timeline", "engineering_memory", "repo_policy", "temporal", "evidence"], confidence: 0.84, recommendedWeights: { temporal: 0.32, trust: 0.22, keyword: 0.18, graph: 0.14 }, reason: "repo-state change language detected" },
    { queryType: "temporal_recent", pattern: /\b(today|yesterday|last week|recent|latest|now)\b/, intent: "temporal_question", strategies: ["temporal", "keyword"], confidence: 0.8, recommendedWeights: { temporal: 0.3, trust: 0.22, keyword: 0.18 }, reason: "recent-time language detected" },
    { queryType: "temporal_range", pattern: /\b(before|after|since|between|from .* to|valid until|gültig|seit|vor|nach)\b/, intent: "temporal_question", strategies: ["temporal", "timeline"], confidence: 0.8, recommendedWeights: { temporal: 0.34, trust: 0.2, semantic: 0.16 }, reason: "time-window language detected" },
    { queryType: "change_summary", pattern: /\b(what changed|changed|history|timeline|changelog|difference|diff|was hat sich geändert)\b/, intent: "temporal_question", strategies: ["timeline", "temporal", "entity"], confidence: 0.78, reason: "change-summary language detected" },
    { queryType: "connection_explanation", pattern: /\b(connected|related|relationship|path|how.*connect|between|zusammenhang|verbunden)\b/, intent: "connection_explanation", strategies: ["graph_path", "activation", "entity"], confidence: 0.84, recommendedMode: "path", recommendedWeights: { graph: 0.42, entity: 0.22, trust: 0.18 }, reason: "connection language detected" },
    { queryType: "graph_multi_hop", pattern: /\b(multi[- ]?hop|linked through|über .* verbunden|transitive)\b/, intent: "multi_hop_question", strategies: ["graph_path", "activation"], confidence: 0.82, recommendedMode: "path", recommendedWeights: { graph: 0.4, entity: 0.22, semantic: 0.16 }, reason: "multi-hop graph language detected" },
    { queryType: "dependency_path", pattern: /\b(depends on|dependency|imports|calls|blocked by|requires|abhängig)\b/, intent: "multi_hop_question", strategies: ["graph_path", "entity", "keyword"], confidence: 0.82, recommendedMode: "path", recommendedWeights: { graph: 0.38, entity: 0.24, keyword: 0.18 }, reason: "dependency language detected" },
    { queryType: "procedure_recall", pattern: /\b(how do i|procedure|workflow|runbook|steps|before i|wie mache ich|ablauf)\b/, intent: "preference_procedural", strategies: ["procedure", "keyword", "semantic"], confidence: 0.78, recommendedWeights: { trust: 0.26, keyword: 0.22, entity: 0.18, semantic: 0.18 }, reason: "procedural language detected" },
    { queryType: "checklist_release", pattern: /\b(checklist|before release|deploy|ship|release gate|run tests|verify before)\b/, intent: "preference_procedural", strategies: ["procedure", "pattern", "policy"], confidence: 0.78, recommendedWeights: { trust: 0.28, keyword: 0.22, temporal: 0.16 }, reason: "release/checklist language detected" },
    { queryType: "contradiction_check", pattern: /\b(contradict|conflict|disagree|widerspruch|conflicting)\b/, intent: "contradiction_check", strategies: ["contradiction", "temporal", "entity"], confidence: 0.84, recommendedWeights: { trust: 0.3, temporal: 0.22, entity: 0.18 }, reason: "contradiction language detected" },
    { queryType: "stale_or_outdated", pattern: /\b(outdated|stale|superseded|old|no longer|nicht mehr|veraltet)\b/, intent: "contradiction_check", strategies: ["contradiction", "temporal", "timeline"], confidence: 0.82, recommendedWeights: { temporal: 0.3, trust: 0.22, entity: 0.16 }, reason: "staleness language detected" },
    { queryType: "person_entity", pattern: /\b(who|person|owner|author|maintainer|contact|wer|person)\b/, intent: "personal_context", strategies: ["entity", "keyword", "semantic"], confidence: 0.74, reason: "person/entity language detected" },
    { queryType: "project_state", pattern: /\b(repo|repository|project|workspace|codebase|branch|milestone|projekt)\b/, intent: "project_context", strategies: ["project", "keyword", "temporal"], confidence: 0.74, reason: "project context language detected" },
    { queryType: "team_memory", pattern: /\b(team|org|shared|everyone|company|kollektiv|firma)\b/, intent: "team_context", strategies: ["team", "policy", "keyword"], confidence: 0.74, reason: "team context language detected" },
    { queryType: "personal_preference", pattern: /\b(my|me|i prefer|preference|always use|never use|ich bevorzuge|immer|nie)\b/, intent: "personal_context", strategies: ["personal", "pattern", "trust"], confidence: 0.76, reason: "personal preference language detected" },
    { queryType: "source_provenance", pattern: /\b(source|citation|evidence|where did|provenance|beweis|quelle)\b/, intent: "fact_lookup", strategies: ["source", "keyword", "entity"], confidence: 0.76, reason: "source/provenance language detected" },
    { queryType: "policy_permission", pattern: /\b(allowed|permission|policy|consent|private|public|dürfen|erlaubt)\b/, intent: "team_context", strategies: ["policy", "team", "source"], confidence: 0.78, reason: "policy/permission language detected" },
    { queryType: "pattern_behavior", pattern: /\b(pattern|habit|usually|recurring|often|typical|gewöhnlich)\b/, intent: "preference_procedural", strategies: ["pattern", "temporal", "semantic"], confidence: 0.76, reason: "behavioral pattern language detected" },
    { queryType: "incident_root_cause", pattern: /\b(root cause|why did|incident|failure|regression|broken|warum.*kaputt)\b/, intent: "multi_hop_question", strategies: ["graph_path", "timeline", "source"], confidence: 0.8, recommendedMode: "path", reason: "incident/root-cause language detected" },
    { queryType: "action_history", pattern: /\b(what did i do|actions|commits|changed by me|last action|was habe ich gemacht)\b/, intent: "temporal_question", strategies: ["timeline", "source", "personal"], confidence: 0.78, reason: "action-history language detected" },
    { queryType: "direct_fact", pattern: /\b(what is|which|tell me|show me|fact|value|status|was ist|welche)\b/, intent: "fact_lookup", strategies: ["semantic", "keyword"], confidence: 0.68, reason: "direct fact language detected" }
  ];
  const matches = rules.filter((rule) => rule.pattern.test(text));
  const selected = matches[0] ?? rules.at(-1)!;
  const secondaryTypes = matches.slice(1).map((rule) => rule.queryType);
  const strategies = [...new Set((matches.length ? matches : [selected]).flatMap((rule) => rule.strategies))];
  if (!strategies.includes("semantic")) strategies.push("semantic");
  const recommendedMode = selected.recommendedMode ?? (strategies.includes("graph_path") ? "path" : "hybrid");
  return {
    query,
    queryType: selected.queryType,
    secondaryTypes,
    intent: selected.intent,
    recommendedMode,
    strategies,
    recommendedWeights: selected.recommendedWeights,
    explanation: matches.length ? matches.map((rule) => rule.reason) : ["default direct fact lookup"],
    confidence: selected.confidence
  };
}

function deterministicQueryExpansions(query: string): string[] {
  const lower = query.toLowerCase();
  const groups = [
    ["cli", "command line", "terminal", "shell"],
    ["ui", "dashboard", "frontend", "operator console"],
    ["bug", "issue", "defect", "regression"],
    ["memory", "recall", "context", "knowledge"],
    ["auth", "login", "session", "identity"],
    ["database", "storage", "persistence", "store"],
    ["sync", "replay", "offline", "replication"],
    ["release", "launch", "deployment", "ship"]
  ];
  const expansions = new Set<string>();
  for (const group of groups) {
    if (!group.some((term) => lower.includes(term))) continue;
    for (const term of group) expansions.add(query.replace(new RegExp(group.find((item) => lower.includes(item)) ?? group[0], "i"), term));
    expansions.add(`${query} ${group.join(" ")}`);
  }
  return [...expansions];
}

function mineRecurringPatterns(memories: Memory[]): BehavioralPatternReport["patterns"] {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
    const weekday = eventAt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
    const anchors = [...memory.tags, ...memory.entities].filter((value) => value.length > 2).slice(0, 4);
    for (const anchor of anchors) {
      const key = `${weekday}:${anchor.toLowerCase()}`;
      const current = groups.get(key) ?? [];
      current.push(memory);
      groups.set(key, current);
    }
  }
  return [...groups.entries()]
    .filter(([, support]) => support.length >= 2)
    .map(([key, support]) => {
      const [weekday, anchor] = key.split(":");
      const lastObservedAt = new Date(Math.max(...support.map((memory) => (memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt).getTime()))).toISOString();
      return {
        key,
        label: `Recurring ${anchor} memory on ${weekday}s`,
        support: support.length,
        memoryIds: support.map((memory) => memory.id),
        confidence: Math.min(0.92, 0.45 + support.length * 0.12),
        cadence: `weekly:${weekday}`,
        pendingReview: true,
        lastObservedAt,
        falsePositiveRisk: clamp01(0.55 - support.length * 0.08)
      };
    });
}

function mineRecurringSequences(memories: Memory[]): BehavioralPatternReport["patterns"] {
  const byDay = new Map<string, Memory[]>();
  for (const memory of memories.filter((item) => item.layer !== "reflection")) {
    const eventAt = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
    const day = isoDay(eventAt);
    const current = byDay.get(day) ?? [];
    current.push(memory);
    byDay.set(day, current);
  }
  const sequenceGroups = new Map<string, Memory[]>();
  for (const dayMemories of byDay.values()) {
    const ordered = dayMemories.sort((a, b) => new Date(a.temporal.eventAt ?? a.createdAt).getTime() - new Date(b.temporal.eventAt ?? b.createdAt).getTime());
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const first = sequenceAnchor(ordered[index]);
      const second = sequenceAnchor(ordered[index + 1]);
      if (!first || !second || first === second) continue;
      const key = `${first}->${second}`;
      sequenceGroups.set(key, [...(sequenceGroups.get(key) ?? []), ordered[index], ordered[index + 1]]);
    }
  }
  return [...sequenceGroups.entries()]
    .map(([key, support]) => ({ key, support: dedupeMemories(support) }))
    .filter((item) => item.support.length >= 4)
    .map(({ key, support }) => ({
      key: `sequence:${key}`,
      label: `Recurring sequence: ${key.replace("->", " then ")}`,
      support: support.length,
      memoryIds: support.map((memory) => memory.id),
      confidence: Math.min(0.88, 0.42 + support.length * 0.08),
      cadence: "sequence",
      pendingReview: true,
      lastObservedAt: new Date(Math.max(...support.map((memory) => (memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt).getTime()))).toISOString(),
      falsePositiveRisk: clamp01(0.62 - support.length * 0.06)
    }));
}

function sequenceAnchor(memory: Memory): string | undefined {
  return [...memory.tags, ...memory.entities].map((value) => value.toLowerCase()).find((value) => value.length > 2);
}

function dedupeMemories(memories: Memory[]): Memory[] {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    if (seen.has(memory.id)) return false;
    seen.add(memory.id);
    return true;
  });
}

function observationClusters(memories: Memory[]): Array<{ label: string; memories: Memory[] }> {
  const groups = new Map<string, Memory[]>();
  for (const memory of memories) {
    const keys = [...memory.entities, ...memory.tags].filter((value) => value.length > 2).slice(0, 4);
    for (const key of keys.length ? keys : ["general"]) {
      const normalized = key.toLowerCase();
      groups.set(normalized, [...(groups.get(normalized) ?? []), memory]);
    }
  }
  return [...groups.entries()]
    .map(([label, group]) => ({ label, memories: dedupeMemories(group).sort((a, b) => b.trust * b.importance - a.trust * a.importance) }))
    .filter((cluster) => cluster.memories.length >= 2)
    .sort((a, b) => b.memories.length - a.memories.length || b.memories[0].trust - a.memories[0].trust);
}

function policyRuleMatches(rule: MemoryPolicyRule, target: Memory | MemoryInput, actor: Partial<MemoryScope>): boolean {
  const scope = rule.scope;
  if (!scope) return true;
  const memory = "id" in target ? target : undefined;
  const metadata = (target.metadata ?? {}) as Record<string, unknown>;
  const consent = target.consent as Partial<ConsentPolicy> | undefined;
  const source = target.source;
  const value = {
    userId: target.userId ?? actor.userId,
    orgId: target.orgId ?? actor.orgId,
    brainId: target.brainId ?? actor.brainId,
    sourceId: target.sourceId ?? actor.sourceId,
    sourceKind: source?.kind,
    memoryType: target.type,
    connectorId: typeof metadata.connectorId === "string" ? metadata.connectorId : undefined,
    visibility: consent?.visibility,
    tags: target.tags ?? []
  };
  if (scope.userId && value.userId !== scope.userId) return false;
  if (scope.orgId && value.orgId !== scope.orgId) return false;
  if (scope.brainId && value.brainId !== scope.brainId) return false;
  if (scope.sourceId && value.sourceId !== scope.sourceId) return false;
  if (scope.sourceKind && value.sourceKind !== scope.sourceKind) return false;
  if (scope.memoryType && value.memoryType !== scope.memoryType) return false;
  if (scope.connectorId && value.connectorId !== scope.connectorId) return false;
  if (scope.visibility && value.visibility !== scope.visibility) return false;
  if (scope.tag && !value.tags.includes(scope.tag)) return false;
  if (memory && scope.visibility && memory.consent.visibility !== scope.visibility) return false;
  return true;
}

function retentionRuleMatches(memory: Memory, rule: RetentionRule, now: Date): boolean {
  const scope = rule.scope ?? {};
  if (scope.userId && memory.userId !== scope.userId) return false;
  if (scope.brainId && memory.brainId !== scope.brainId) return false;
  if (scope.sourceId && memory.sourceId !== scope.sourceId) return false;
  if (scope.sourceKind && memory.source.kind !== scope.sourceKind) return false;
  if (scope.visibility && memory.consent.visibility !== scope.visibility) return false;
  if (scope.entity && !memory.entities.includes(scope.entity.toLowerCase())) return false;
  if (scope.relationType && !memory.relations.some((relation) => relation.type === scope.relationType)) return false;
  if (scope.tag && !memory.tags.includes(scope.tag)) return false;
  const effectiveDate = memory.temporal.eventAt ? new Date(memory.temporal.eventAt) : memory.createdAt;
  const ageDays = (now.getTime() - effectiveDate.getTime()) / 86_400_000;
  return ageDays >= rule.retentionDays;
}

function deterministicLaplaceNoise(seed: string, epsilon: number): number {
  const hash = contentHash(seed);
  const integer = Number.parseInt(hash.slice(0, 12), 36);
  const u = Math.min(0.999999, Math.max(0.000001, (integer % 1_000_000) / 1_000_000));
  const centered = u - 0.5;
  return -(Math.sign(centered) || 1) * Math.log(1 - 2 * Math.abs(centered)) / epsilon;
}

function privacyComputeTokens(memory: Memory, dimensions: Array<"entities" | "tags" | "relations">): Array<{ dimension: "entities" | "tags" | "relations"; value: string }> {
  const tokens: Array<{ dimension: "entities" | "tags" | "relations"; value: string }> = [];
  if (dimensions.includes("entities")) {
    for (const entity of memory.entities) {
      const normalized = entity.trim().toLowerCase();
      if (normalized) tokens.push({ dimension: "entities", value: normalized });
    }
  }
  if (dimensions.includes("tags")) {
    for (const tag of memory.tags) {
      const normalized = tag.trim().toLowerCase();
      if (normalized) tokens.push({ dimension: "tags", value: normalized });
    }
  }
  if (dimensions.includes("relations")) {
    for (const relation of memory.relations) tokens.push({ dimension: "relations", value: relation.type });
  }
  return tokens;
}

function deterministicObservation(label: string, memories: Memory[], style: ObservationReport["style"]): string {
  const facts = memories
    .slice(0, style === "concise" ? 3 : 5)
    .map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 120));
  if (style === "narrative") return `Observation about ${label}: ${facts.join(" Then, ")}`;
  if (style === "descriptive") return `Observation about ${label}: ${facts.join(" | ")}`;
  return `${label}: ${facts.join(" | ")}`;
}

function groupedPeriods(events: TimelineReport["events"], summaries: Map<string, string>): TimelineReport["periods"] {
  const groups = new Map<string, TimelineReport["periods"][number]>();
  for (const event of events) {
    const date = new Date(event.eventAt);
    for (const [granularity, period] of [
      ["hour", isoHour(date)],
      ["day", isoDay(date)],
      ["week", isoWeek(date)],
      ["month", isoMonth(date)]
    ] as const) {
      const key = `${granularity}:${period}`;
      const current = groups.get(key) ?? { granularity, period, memoryIds: [], summary: summaries.get(period) };
      current.memoryIds.push(event.memoryId);
      groups.set(key, current);
    }
  }
  return [...groups.values()].sort((a, b) => a.period.localeCompare(b.period) || a.granularity.localeCompare(b.granularity));
}

function deterministicTimelineSummary(period: string, granularity: TimelineReport["periods"][number]["granularity"], memories: Memory[], style: "concise" | "descriptive" | "narrative"): string {
  const lead = style === "narrative" ? `During ${period}, the timeline shows` : style === "descriptive" ? `Timeline ${granularity} ${period} includes` : `Timeline summary for ${period}:`;
  const facts = memories
    .slice()
    .sort((a, b) => (b.trust * b.importance) - (a.trust * a.importance))
    .slice(0, style === "concise" ? 3 : 6)
    .map((memory) => memory.content.replace(/\s+/g, " ").slice(0, 110));
  return `${lead} ${facts.join(" | ")}`;
}

function intervalOverlaps(event: TimelineReport["events"][number], after?: Date, before?: Date): boolean {
  if (!after && !before) return true;
  const start = new Date(event.validFrom ?? event.eventAt);
  const end = event.validUntil ? new Date(event.validUntil) : new Date(event.eventAt);
  if (before && start >= before) return false;
  if (after && end < after) return false;
  return true;
}

function evidenceDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function roundMetric(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function newestPathTime(path: { edges: Array<{ timestamp?: Date | string }> }): number {
  return Math.max(0, ...path.edges.map((edge) => edge.timestamp ? new Date(edge.timestamp).getTime() : 0));
}

function averagePathTrust(path: { edges: Array<{ trust?: number }> }): number {
  if (!path.edges.length) return 0;
  return path.edges.reduce((sum, edge) => sum + (edge.trust ?? 0), 0) / path.edges.length;
}

function isoHour(date: Date): string {
  return `${isoDay(date)}T${String(date.getUTCHours()).padStart(2, "0")}:00Z`;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoWeek(date: Date): string {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const defaultService = createDefaultMemoryService();
