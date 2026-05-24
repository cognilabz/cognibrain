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
  extractAddOnlyMemories,
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
  EnrichmentCandidate,
  EntityMergeSuggestion,
  EntityRecord,
  ExtractionReport,
  FeedbackEvent,
  GraphReport,
  IdentityLink,
  LearnedProfileReport,
  Memory,
  MemoryExtractionEvent,
  MemoryExtractor,
  MemoryInput,
  MemorySource,
  MarketplaceModule,
  MetricsReport,
  PersonaProfile,
  RelationType,
  RetrievalProfile,
  RetrievalTrainingSample,
  RetrievalWeights,
  SearchOptions,
  ReflectionSummarizer,
  BehavioralPatternReport,
  TemporalQueryReport,
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
    this.redactionPolicy = options.redactionPolicy ?? runtimeConfig.redactionPolicy ?? options.domainModule?.redactionPolicy ?? { mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE), encryptionKey: process.env.MEMORY_ENCRYPTION_KEY };
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
    this.load();
  }

  private readonly defaultReranker?: SearchOptions["reranker"];
  private readonly defaultVerifier?: SearchOptions["verifier"];
  private readonly defaultExtractor?: MemoryExtractor;

  add(input: MemoryInput) {
    const enriched = this.domainModule?.enrich ? this.domainModule.enrich(input) : input;
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
    const memory = this.store.update(id, patch);
    this.recordAudit("memory.update", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    this.afterWrite(memory.userId);
    return memory;
  }

  delete(id: string) {
    const memory = this.store.get(id);
    const deleted = this.store.delete(id);
    if (deleted) this.recordAudit("memory.delete", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId: memory.id });
    if (deleted) this.afterWrite(memory.userId);
    return deleted;
  }

  search(options: SearchOptions) {
    const profile = options.profileId ? this.retrievalProfiles.get(options.profileId) : this.profileFor(options);
    const linkedUserIds = options.includeLinkedIdentities ? this.identities.resolve(options.userId).filter((id) => id !== options.userId) : [];
    const results = this.retrieval.search({
      ...options,
      linkedUserIds,
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

  reflect(userId: string) {
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.recordAudit("reflect.run", { userId, metadata: { created: report.created.length, demoted: report.demoted.length, contradictions: report.contradictions.length } });
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
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

  registerAgent(input: Omit<AgentRegistration, "createdAt" | "updatedAt">): AgentRegistration {
    const now = new Date().toISOString();
    const agent = { ...input, createdAt: now, updatedAt: now };
    this.agents.set(agent.id, agent);
    this.recordAudit("memory.write", { actorId: agent.id, metadata: { resource: "agent", namespace: agent.namespace } });
    this.persist();
    return agent;
  }

  listAgents(): AgentRegistration[] {
    return [...this.agents.values()].sort((a, b) => a.namespace.localeCompare(b.namespace));
  }

  setPersona(input: Omit<PersonaProfile, "createdAt" | "updatedAt">): PersonaProfile {
    const now = new Date().toISOString();
    const persona = { ...input, createdAt: now, updatedAt: now };
    this.personas.set(persona.id, persona);
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
      metadata: { shared: { promotedAt: new Date().toISOString(), orgId } }
    });
    this.recordAudit("memory.share", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { orgId } });
    this.persist();
    return updated;
  }

  graphPaths(from: string, to: string, options?: { userId?: string; maxDepth?: number; relationTypes?: RelationType[] }) {
    const memories = this.store.list(options?.userId).filter((memory) => !memory.archivedAt);
    return findGraphPaths(memories, from, to, options);
  }

  graphQuery(query: string, userId?: string) {
    return queryMemoryGraph(this.store.list(userId).filter((memory) => !memory.archivedAt), query);
  }

  runInference(): ReturnType<typeof inferGraphRelations> {
    const report = inferGraphRelations(this.store.list().filter((memory) => !memory.archivedAt));
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

  eventFeed(): { auditEvents: AuditEvent[]; deliveries: WebhookDelivery[] } {
    return { auditEvents: [...this.auditEvents], deliveries: [...this.webhookDeliveries] };
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
    return {
      generatedAt: now.toISOString(),
      totals: { memories: memories.length, auditEvents: this.auditEvents.length, brains: this.brains.size, sources: this.sources.size },
      consent,
      encrypted,
      retentionExpired,
      deleteOnRequest,
      auditByType,
      risks: [
        ...(retentionExpired ? [`${retentionExpired} memories are past retention and should be archived or deleted.`] : []),
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

  learnRetrievalProfile(id = "learned", label = "Learned feedback profile"): LearnedProfileReport {
    const positiveSignals: Partial<RetrievalWeights> = {};
    const negativeSignals: Partial<RetrievalWeights> = {};
    let samples = 0;
    for (const event of this.feedbackEvents) {
      const memory = safeGet(this.store, event.memoryId);
      if (!memory) continue;
      const bucket = event.kind === "helpful" || event.kind === "always_include" ? positiveSignals : event.kind === "wrong" || event.kind === "never_include" ? negativeSignals : undefined;
      if (!bucket) continue;
      samples += 1;
      bucket.trust = (bucket.trust ?? 0) + memory.trust;
      bucket.entity = (bucket.entity ?? 0) + Math.min(1, memory.entities.length / 5);
      bucket.temporal = (bucket.temporal ?? 0) + (memory.lastAccessedAt ? 0.6 : 0.2);
      bucket.access = (bucket.access ?? 0) + Math.min(1, Math.log1p(memory.accessCount) / 4);
    }
    for (const sample of this.trainingSamples) {
      const bucket = sample.outcome === "helpful" || sample.outcome === "accepted" ? positiveSignals : negativeSignals;
      samples += 1;
      for (const key of Object.keys(baseSignalTemplate()) as Array<keyof RetrievalWeights>) {
        bucket[key] = (bucket[key] ?? 0) + (sample.signals?.[key] ?? 0);
      }
    }
    const base = this.retrievalProfiles.get("default")?.weights ?? normalizeRetrievalWeights();
    const lossBefore = profileLoss(base, this.trainingSamples);
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
      learned: true,
      trainingSamples: samples,
      benchmarkDelta: 0,
      provenance: "feedback coordinate update"
    });
    return { profile, samples, positiveSignals, negativeSignals, lossBefore, lossAfter: profileLoss(profile.weights, this.trainingSamples) };
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

  temporalQuery(userId: string, options: { after?: Date | string; before?: Date | string } = {}): TemporalQueryReport {
    const after = options.after ? new Date(options.after) : undefined;
    const before = options.before ? new Date(options.before) : undefined;
    const events = this.timeline(userId).events.filter((event) => {
      const eventAt = new Date(event.eventAt);
      if (after && eventAt < after) return false;
      if (before && eventAt >= before) return false;
      return true;
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
        lastObservedAt: String(memory.metadata.lastObservedAt ?? memory.createdAt.toISOString())
      }));
    const mined = mineRecurringPatterns(memories);
    return { userId, patterns: [...generated, ...mined].sort((a, b) => b.confidence - a.confidence || b.support - a.support) };
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
    if (input.brainId && !this.brains.has(input.brainId)) throw new Error(`Brain not found: ${input.brainId}`);
    if (input.agentId) {
      const agent = this.agents.get(input.agentId);
      if (agent && input.brainId && !agent.brainIds.includes(input.brainId) && !agent.permissions.includes("admin")) {
        throw new Error(`Agent ${input.agentId} cannot write to brain ${input.brainId}`);
      }
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
      marketplaceModules: [...this.marketplaceModules.values()]
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
    redactionPolicy: { mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE), encryptionKey: process.env.MEMORY_ENCRYPTION_KEY }
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
    extractor: provider
  };
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
        lastObservedAt
      };
    });
}

function groupedPeriods(events: TimelineReport["events"], summaries: Map<string, string>): TimelineReport["periods"] {
  const groups = new Map<string, TimelineReport["periods"][number]>();
  for (const event of events) {
    const date = new Date(event.eventAt);
    for (const [granularity, period] of [
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
