import { applyRedactionPolicy, type RedactionPolicy } from "../core/privacy";
import { createJsonCommandIntelligenceFromEnv } from "../core/providers";
import { loadRuntimeConfig } from "../core/runtimeConfig";
import {
  createPersistenceFromEnv,
  JsonFilePersistenceAdapter,
  type MemoryPersistenceAdapter,
  type PersistedMemoryFile
} from "./persistence";
import {
  EntityRegistry,
  activateGraph,
  citationFor,
  extractAddOnlyMemories,
  exportMemoryGraph,
  findGraphPaths,
  healthReport,
  IdentityResolver,
  inferGraphRelations,
  MemoryStore,
  normalizeLifecyclePolicy,
  normalizeRetrievalWeights,
  queryMemoryGraph,
  runDomainEvaluation,
  ReflectionEngine,
  RetrievalEngine,
  type LifecyclePolicy,
  type DomainModule
} from "../core";
import type {
  DomainEvaluationReport,
  AgentRegistration,
  AuditEvent,
  Brain,
  ComplianceReport,
  ContradictionDetector,
  ConnectorManifest,
  ConnectorSyncRecord,
  EnrichmentCandidate,
  EntityMergeSuggestion,
  EntityRecord,
  ExtractionReport,
  FeedbackKind,
  FeedbackEvent,
  FederatedSearchReport,
  GraphReport,
  GraphActivationResult,
  GraphExportOptions,
  GraphExportResult,
  IdentityLink,
  LearnedProfileReport,
  Memory,
  MemoryExtractionEvent,
  MemoryExtractor,
  MemoryInput,
  MemorySource,
  MarketplaceModule,
  MetricsReport,
  OfflineOperation,
  PersonaProfile,
  RelationType,
  RetrievalProfile,
  RetrievalTrainingSample,
  RetrievalWeights,
  RetentionEnforcementReport,
  RetentionRule,
  SearchOptions,
  SecurityKeyReport,
  ReflectionSummarizer,
  StorageBackendStatus,
  SyncReport,
  ConsentPolicy,
  QueryExpander,
  TranslationProvider,
  ProviderAdapterStatus,
  TranslationReport,
  InjectionFeedbackEvent,
  InjectionFeedbackReport,
  AdaptiveDreamPolicyReport,
  DifferentialPrivacyReport,
  KeyRotationReport,
  ObservationReport,
  PredictionReport,
  BehavioralPatternReport,
  TemporalQueryReport,
  TimelineSummaryReport,
  TimelineReport,
  WebhookDelivery,
  WebhookRegistration
} from "../core";

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

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

export class MemoryService {
  readonly store = new MemoryStore();
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
  private brains = new Map<string, Brain>();
  private sources = new Map<string, MemorySource>();
  private agents = new Map<string, AgentRegistration>();
  private personas = new Map<string, PersonaProfile>();
  private auditEvents: AuditEvent[] = [];
  private webhooks = new Map<string, WebhookRegistration>();
  private webhookDeliveries: WebhookDelivery[] = [];
  private marketplaceModules = new Map<string, MarketplaceModule>();
  private offlineOperations: OfflineOperation[] = [];
  private connectorManifests = new Map<string, ConnectorManifest>();
  private connectorSyncRecords: ConnectorSyncRecord[] = [];
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
    const enriched = this.domainModule?.enrich ? this.domainModule.enrich(scopedInput) : scopedInput;
    this.ensureScopedAccess(enriched);
    const checked = applyRedactionPolicy(enriched, this.redactionPolicy);
    if (checked.rejected || !checked.input) {
      throw new Error(`Memory rejected by redaction policy: ${checked.matches.map((match) => match.detector).join(", ")}`);
    }
    const memory = this.entities.ingest(this.store.add(checked.input));
    if (memory.metadata.archivedOnWrite) this.store.archive(memory.id);
    this.metrics.memoriesAdded += 1;
    this.recordAudit("memory.write", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    this.afterWrite(memory.userId);
    return memory;
  }

  extract(
    events: MemoryExtractionEvent[],
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "deviceId" | "runId">
  ): ExtractionReport {
    const existing = this.store.list(scope.userId);
    const failures = ruleExtractionFailures(events);
    const ruleInputs = extractAddOnlyMemories(events, scope).map((input) => markExtractionStage(input, "rules"));
    const needsProvider = Boolean(this.defaultExtractor && (ruleInputs.length === 0 || failures.length > 0 || events.some((event) => event.mediaType && !["text", "code", "document"].includes(event.mediaType))));
    const providerInputs = needsProvider ? this.defaultExtractor?.extract({ events, scope, existing, now: new Date() }).map((input) => markExtractionStage({ ...scope, ...input }, "provider")) ?? [] : [];
    const stages: ExtractionReport["stages"] = [
      { stage: "rules", inputEvents: events.length, extracted: ruleInputs.length, confidence: extractionConfidence(events, ruleInputs.length), reason: "single-pass add-only rules" },
      ...(needsProvider
        ? [{ stage: "provider" as const, inputEvents: events.length, extracted: providerInputs.length, confidence: providerInputs.length ? 0.78 : 0.2, reason: providerInputs.length ? "fallback extractor produced candidate memories" : "fallback extractor returned no candidates" }]
        : [])
    ];
    const existingHashes = new Set(existing.map((memory) => memory.metadata.contentHash).filter(Boolean));
    const seenHashes = new Set<string>();
    const inputs = [...ruleInputs, ...providerInputs].filter((input) => {
      const hash = contentHash(`${input.content}:${input.source?.kind ?? ""}:${input.timestamp ?? ""}`);
      input.metadata = { ...(input.metadata ?? {}), contentHash: hash };
      if (existingHashes.has(hash) || seenHashes.has(hash)) return false;
      seenHashes.add(hash);
      return true;
    });
    const memories = inputs.map((input) => this.add(linkStateChange(input, this.store.list(scope.userId))));
    const enrichmentCandidates = enrichmentCandidatesFor(this.store.list(scope.userId));
    const learnedRules = learnedRuleSuggestions(events, failures);
    stages.push({
      stage: "enrichment",
      inputEvents: events.length,
      extracted: enrichmentCandidates.length,
      confidence: enrichmentCandidates.length ? 0.72 : 1,
      reason: enrichmentCandidates.length ? "entity attention threshold produced candidates" : "no entity crossed enrichment threshold"
    });
    this.recordAudit("extract.run", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { events: events.length, memories: memories.length, stages, failures: failures.length, learnedRules: learnedRules.length } });
    const entityLinks: Record<string, string[]> = {};
    for (const memory of memories) {
      for (const entity of memory.entities) {
        entityLinks[entity] ??= [];
        entityLinks[entity].push(memory.id);
      }
    }
    return { memories, entityLinks, stages, failures, enrichmentCandidates, learnedRules };
  }

  list(userId?: string) {
    return this.store.list(userId);
  }

  get(id: string) {
    return this.store.get(id);
  }

  update(id: string, patch: Partial<MemoryInput>) {
    const before = this.store.get(id);
    const memory = this.store.update(id, patch);
    this.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before, after: memory } });
    this.afterWrite(memory.userId);
    return memory;
  }

  delete(id: string) {
    const memory = this.store.get(id);
    const deleted = this.store.delete(id);
    if (deleted) this.recordAudit("memory.delete", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { before: memory } });
    if (deleted) this.afterWrite(memory.userId);
    return deleted;
  }

  search(options: SearchOptions) {
    this.enforceRetention(new Date(), options.userId);
    const persona = options.agentId ? this.personaForAgent(options.agentId) : undefined;
    const personaProfile = persona?.retrievalWeights
      ? {
          id: `persona:${persona.id}`,
          label: persona.label,
          weights: normalizeRetrievalWeights(persona.retrievalWeights),
          scope: { agentId: options.agentId },
          updatedAt: persona.updatedAt,
          provenance: "persona"
        }
      : undefined;
    const profile = options.profileId ? this.retrievalProfiles.get(options.profileId) : personaProfile ?? this.profileFor(options);
    const linkedUserIds = options.includeLinkedIdentities ? this.identities.resolve(options.userId).filter((id) => id !== options.userId) : [];
    const federatedBrainIds = options.includeSharedBrains ? options.brainIds ?? this.accessibleBrainIds(options) : options.brainIds;
    const queryExpansions = this.expandSearchQuery(options);
    const results = this.retrieval.search({
      ...options,
      brainIds: federatedBrainIds,
      linkedUserIds,
      queryExpansions,
      weights: options.weights ?? profile?.weights,
      reranker: options.reranker ?? this.defaultReranker,
      verifier: options.verifier ?? this.defaultVerifier
    });
    this.metrics.searches += 1;
    this.metrics.noHitSearches += results.length === 0 ? 1 : 0;
    this.metrics.lowConfidenceSearches = (this.metrics.lowConfidenceSearches ?? 0) + (results.some((result) => result.decision === "warn" || result.decision === "review") ? 1 : 0);
    this.metrics.averageSearchResults = rollingAverage(this.metrics.averageSearchResults, results.length, this.metrics.searches);
    this.recordSessionMetrics(options, results.length);
    this.searchEvents.push({
      timestamp: new Date().toISOString(),
      userId: options.userId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      resultCount: results.length,
      lowConfidence: results.some((result) => result.decision === "warn" || result.decision === "review"),
      queryHash: contentHash(options.query)
    });
    this.recordAudit("search.run", { userId: options.userId, brainId: options.brainId, sourceId: options.sourceId, metadata: { resultCount: results.length, profileId: profile?.id } });
    this.persist();
    return results;
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
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.recordAudit("reflect.run", { userId, metadata: { created: report.created.length, demoted: report.demoted.length, contradictions: report.contradictions.length } });
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
    this.enforceRetention(new Date(), userId);
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.recordAudit("reflect.run", { userId, metadata: { created: report.created.length, demoted: report.demoted.length, contradictions: report.contradictions.length } });
    this.markDreamed(userId);
    this.persist();
    return report;
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

  exportUser(userId: string): Memory[] {
    return this.store.list(userId);
  }

  deleteUser(userId: string): number {
    const memories = this.store.list(userId);
    for (const memory of memories) this.store.delete(memory.id);
    this.persist();
    return memories.length;
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
    try {
      const mapped = events.map((event) => ({
        ...event,
        source: event.source ?? { kind: manifest.defaultSourceKind, uri: event.uri, confidence: 0.82 },
        metadata: { ...(event.metadata ?? {}), connectorId, externalId: event.externalId, mapping: manifest.metadataMapping }
      }));
      const report = this.extract(mapped, scope);
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
    const normalized = event.language && !/^en/i.test(event.language)
      ? { ...event, content: this.translateText(event.content, event.language, "en").translated, metadata: { ...(event.metadata ?? {}), translatedFrom: event.language, originalContent: event.content } }
      : event;
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

  storageStatus(): StorageBackendStatus {
    return {
      active: this.persistence?.kind ?? "memory",
      adapters: [
        {
          kind: "memory",
          durable: false,
          distributedReady: false,
          transactional: false,
          notes: ["Process-local adapter for tests and embedded runtimes."]
        },
        {
          kind: "json-file",
          durable: true,
          distributedReady: false,
          transactional: true,
          notes: ["Atomic snapshot writes for local-first desktop and CLI usage."]
        },
        {
          kind: "append-only-log",
          durable: true,
          distributedReady: true,
          transactional: false,
          encryptedAppendLog: this.redactionPolicy.mode === "encrypt",
          notes: ["JSONL snapshots can be tailed, replicated, compacted, or replayed by SQL/cloud adapters."]
        }
      ]
    };
  }

  auditTrail(filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditEvent[] {
    return this.auditEvents
      .filter((event) => !filter.userId || event.userId === filter.userId)
      .filter((event) => !filter.memoryId || event.memoryId === filter.memoryId)
      .filter((event) => !filter.type || event.type === filter.type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
    const updated = this.store.update(memoryId, {
      orgId,
      consent: { ...memory.consent, visibility: "org" },
      metadata: { shared: { status: "approved", promotedAt: new Date().toISOString(), orgId } }
    });
    this.recordAudit("memory.share", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId } });
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

  graphPaths(from: string, to: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number }) {
    const memories = this.store.list(options?.userId).filter((memory) => !memory.archivedAt);
    return findGraphPaths(memories, from, to, options);
  }

  graphQuery(query: string, userId?: string) {
    return queryMemoryGraph(this.store.list(userId).filter((memory) => !memory.archivedAt), query);
  }

  graphActivation(query: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[]; limit?: number }): GraphActivationResult {
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
    const installed = { ...module, installState: "installed" as const };
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
    this.recordAudit("marketplace.install", { metadata: { moduleId: installed.id, kind: installed.kind } });
    this.persist();
    return installed;
  }

  listMarketplaceModules(): MarketplaceModule[] {
    return [...this.marketplaceModules.values()].sort((a, b) => a.name.localeCompare(b.name));
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
        report.deleted.push(memory.id);
        this.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "delete", ruleId: deleteRule.id, before: memory } });
        continue;
      }
      const archiveRule = matchedRules[0];
      if (consentExpired || archiveRule) {
        const archived = this.store.archive(memory.id);
        report.archived.push(memory.id);
        this.recordAudit("retention.enforce", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id, metadata: { action: "archive", reason: consentExpired ? "consent.retentionUntil" : "retention.rule", ruleId: archiveRule?.id, after: archived } });
      }
    }
    if (report.archived.length || report.deleted.length) this.persist();
    return report;
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
      retentionRules: this.listRetentionRules(),
      encryption,
      dataFlows,
      risks: [
        ...(retentionExpired ? [`${retentionExpired} memories are past retention and should be archived or deleted.`] : []),
        ...(encryption.missingKeyMetadata ? [`${encryption.missingKeyMetadata} encrypted memories are missing key id/version metadata.`] : []),
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
    this.persist();
    return link;
  }

  unlinkIdentity(id: string): IdentityLink {
    const link = this.identities.unlink(id);
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
        if (brain.id === options.brainId) return true;
        if (brain.ownerUserId === options.userId || brain.memberUserIds?.includes(options.userId)) return true;
        if (agent?.brainIds.includes(brain.id)) return true;
        if (options.agentId && brain.allowedAgentIds?.includes(options.agentId)) return true;
        if (brain.visibility === "org") return Boolean(options.orgId && brain.orgId === options.orgId);
        return brain.visibility === "public";
      })
      .map((brain) => brain.id);
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
    const saved: AuditEvent = {
      id: `audit_${contentHash(`${type}:${Date.now()}:${this.auditEvents.length}`).slice(2)}`,
      type,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.auditEvents.push(saved);
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

  private recanonicalizeMemory(memory: Memory): void {
    const entities = [...new Set(memory.entities.map((entity) => this.entities.canonicalize(entity)).filter(Boolean))];
    const relations = memory.relations.map((relation) => ({
      ...relation,
      sourceEntity: relation.sourceEntity ? this.entities.canonicalize(relation.sourceEntity) : relation.sourceEntity,
      targetEntity: relation.targetEntity ? this.entities.canonicalize(relation.targetEntity) : relation.targetEntity
    }));
    this.store.update(memory.id, { entities, relations });
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
    this.auditEvents = raw.auditEvents ?? [];
    this.webhooks = new Map((raw.webhooks ?? []).map((webhook) => [webhook.id, webhook]));
    this.webhookDeliveries = raw.webhookDeliveries ?? [];
    this.marketplaceModules = new Map((raw.marketplaceModules ?? []).map((module) => [module.id, module]));
    this.offlineOperations = raw.offlineOperations ?? [];
    for (const manifest of raw.connectorManifests ?? []) this.connectorManifests.set(manifest.id, manifest);
    this.connectorSyncRecords = raw.connectorSyncRecords ?? [];
    this.retentionRules = new Map((raw.retentionRules ?? []).map((rule) => [rule.id, rule]));
    this.store.import(raw.memories ?? []);
    for (const memory of this.store.list()) this.entities.ingest(memory);
  }

  private persist(): void {
    if (!this.persistence) return;
    const payload: PersistedMemoryFile = {
      version: 2,
      memories: this.store.export(),
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
      offlineOperations: this.offlineOperations,
      connectorManifests: [...this.connectorManifests.values()],
      connectorSyncRecords: this.connectorSyncRecords,
      retentionRules: [...this.retentionRules.values()]
    };
    this.persistence.save(payload);
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
    if (mediaType === "audio" || mediaType === "image" || mediaType === "video") {
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

function safeGet(store: MemoryStore, id: string): Memory | undefined {
  try {
    return store.get(id);
  } catch {
    return undefined;
  }
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
    createdAt: now,
    updatedAt: now
  });
  return [
    base("email", "Email", ["ingest", "export", "webhook", "poll", "writeback"], { subject: "content.title", from: "source.author", messageId: "externalId", threadId: "metadata.threadId" }, "human"),
    base("chat", "Chat", ["ingest", "webhook", "poll", "writeback"], { channel: "metadata.channel", sender: "source.author", messageId: "externalId", text: "content" }, "transcript"),
    base("project_management", "Project Management", ["ingest", "export", "poll", "writeback"], { issueKey: "externalId", status: "metadata.status", assignee: "entities.assignee", title: "content.title" }, "import"),
    base("docs", "Docs", ["ingest", "webhook", "poll", "writeback"], { url: "source.uri", title: "content.title", workspace: "metadata.workspace" }, "import"),
    base("code", "Code", ["ingest", "webhook", "poll"], { repo: "metadata.repo", path: "source.uri", commit: "source.commit", symbol: "entities.symbol" }, "reviewed_code"),
    base("calendar", "Calendar", ["ingest", "poll", "writeback"], { eventId: "externalId", attendees: "entities.attendees", start: "temporal.eventAt" }, "human"),
    base("cloud_storage", "Cloud Storage", ["ingest", "poll", "media"], { fileId: "externalId", mimeType: "mimeType", uri: "source.uri", name: "content.title" }, "import")
  ];
}

function validateConnectorManifest(input: Omit<ConnectorManifest, "createdAt" | "updatedAt">): void {
  if (!input.id.trim() || !input.name.trim()) throw new Error("Connector manifest requires id and name");
  if (!input.capabilities.length) throw new Error(`Connector ${input.id} must declare at least one capability`);
  if (input.direction === "two_way" && !input.capabilities.includes("ingest")) throw new Error(`Two-way connector ${input.id} must support ingest`);
  if (input.capabilities.includes("writeback") && input.direction === "ingest") throw new Error(`Writeback connector ${input.id} must be export or two_way`);
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
