import { MemoryServiceInsightsMaintenance } from './memoryServiceInsightsMaintenance';
import { AppendOnlyLogPersistenceAdapter, DOMAIN_MODULES, InMemoryMemoryRepository, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresMemoryRepository, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServicePersistence extends MemoryServiceInsightsMaintenance {
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

  protected recordAudit(type: AuditEvent["type"], event: Partial<AuditEvent>): AuditEvent {
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

  protected sealAuditEvent(event: AuditEvent, previousEvent = this.auditEvents.at(-1), sequence = this.auditEvents.length + 1): AuditJournalEvent {
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

  protected rebuildAuditChain(events: AuditEvent[]): AuditJournalEvent[] {
    const rebuilt: AuditJournalEvent[] = [];
    for (const [index, event] of events.entries()) {
      rebuilt.push(this.sealAuditEvent(event, rebuilt.at(-1), index + 1));
    }
    return rebuilt;
  }

  protected toJournalEvent(event: AuditEvent): AuditJournalEvent {
    if (event.journalType && event.sequence && event.hash && event.payloadHash) return event as AuditJournalEvent;
    return this.rebuildAuditChain([event])[0];
  }

  protected replayAuditEvents(events: AuditJournalEvent[]): AuditChainExport["replay"] {
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

  protected recanonicalizeMemory(memory: Memory): void {
    const entities = [...new Set(memory.entities.map((entity) => this.entities.canonicalize(entity)).filter(Boolean))];
    const relations = memory.relations.map((relation) => ({
      ...relation,
      sourceEntity: relation.sourceEntity ? this.entities.canonicalize(relation.sourceEntity) : relation.sourceEntity,
      targetEntity: relation.targetEntity ? this.entities.canonicalize(relation.targetEntity) : relation.targetEntity
    }));
    this.store.update(memory.id, { entities, relations });
  }

  protected applyDomainEnrichment(input: MemoryInput): MemoryInput {
    const modules = [
      ...(this.domainModule ? [this.domainModule] : []),
      ...this.listMarketplaceModules()
        .filter((module) => module.kind === "domain" && module.installState === "installed")
        .map((module) => DOMAIN_MODULES.find((domain) => domain.id === (module.manifest as { id?: string }).id))
        .filter((domain): domain is DomainModule => Boolean(domain))
    ];
    return modules.reduce((current, domain) => domain.enrich ? domain.enrich(current) : current, input);
  }

  protected memoriesDeniedForOperation(userId: string, operation: MemoryPolicyOperation): PolicyDecision[] {
    return this.store.list(userId)
      .filter((memory) => !memory.archivedAt)
      .map((memory) => this.evaluatePolicy(operation, memory, { userId }))
      .filter((decision) => !decision.allowed);
  }

  protected blockedReflectionReport(userId: string, operation: "reflect" | "dream", blocked: PolicyDecision[]) {
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

  protected load(): void {
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

  protected syncReadModelFromRepository(): void {
    if (this.repository instanceof InMemoryMemoryRepository) return;
    if ((this.repository as { store?: unknown }).store === this.store) return;
    this.store.clear();
    this.store.import(this.repository.export());
  }

  protected repositorySharesReadModel(): boolean {
    return this.repository instanceof InMemoryMemoryRepository || (this.repository as { store?: unknown }).store === this.store;
  }

protected persist(): void {
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

  protected loadRepositoryState(): PersistedMemoryFile | Memory[] | undefined {
    const state = (this.repository as MemoryRepository & RepositoryStatePersistence).loadState?.();
    if (!state) return undefined;
    if (Array.isArray(state)) return state as Memory[];
    return state as PersistedMemoryFile;
  }

  protected saveRepositoryState(payload: PersistedMemoryFile): void {
    (this.repository as MemoryRepository & RepositoryStatePersistence).saveState?.(payload);
  }

  protected defaultKeyring(): DecryptionKeyMaterial[] {
    const key = this.redactionPolicy.encryptionKey ?? process.env.MEMORY_ENCRYPTION_KEY;
    if (!key || key.length < 16) return [];
    return [{
      key,
      keyId: this.redactionPolicy.encryptionKeyId ?? process.env.MEMORY_ENCRYPTION_KEY_ID,
      keyVersion: this.redactionPolicy.encryptionKeyVersion ?? process.env.MEMORY_ENCRYPTION_KEY_VERSION
    }];
  }
}
