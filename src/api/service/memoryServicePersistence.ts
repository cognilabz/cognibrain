import { MemoryServiceInsightsMaintenance } from './memoryServiceInsightsMaintenance';
import { AppendOnlyLogPersistenceAdapter, DOMAIN_MODULES, InMemoryMemoryRepository, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
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

  importMemoryFile(raw: PersistedMemoryFile, options: { persist?: boolean; persistPruned?: boolean } = {}): void {
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
    const prunedTransientContextPacks = this.pruneTransientContextPacks();
    this.policyRules = new Map((raw.policyRules ?? []).map((rule) => [rule.id, rule]));
    this.retentionRules = new Map((raw.retentionRules ?? []).map((rule) => [rule.id, rule]));
    this.repository.import(raw.memories ?? []);
    this.syncReadModelFromRepository();
    for (const memory of this.store.list()) this.entities.ingest(memory);
    if (!this.claims.size) for (const memory of this.store.list()) this.registerMemoryClaim(memory);
    if (options.persist !== false || (options.persistPruned && prunedTransientContextPacks)) this.persist();
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
    this.importMemoryFile(raw, { persist: false, persistPruned: true });
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
    this.pruneTransientContextPacks();
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
      evidencePacks: this.compactEvidencePacksForPersistence([...this.evidencePacks.values()]),
      policyRules: [...this.policyRules.values()],
      retentionRules: [...this.retentionRules.values()]
    };
    if (this.persistence) this.persistence.save(payload);
    else this.saveRepositoryState(payload);
  }

  private compactEvidencePacksForPersistence(packs: EvidencePack[]): EvidencePack[] {
    const maxPersistedBytes = envInteger("MEMORY_EVIDENCE_PACK_PERSIST_MAX_BYTES", 16_000);
    if (maxPersistedBytes <= 0) return packs;
    const contextMaxChars = envInteger("MEMORY_EVIDENCE_PACK_PERSIST_CONTEXT_CHARS", 4_000);
    const resultContentMaxChars = envInteger("MEMORY_EVIDENCE_PACK_PERSIST_RESULT_CONTENT_CHARS", 1_200);
    const explanationMaxItems = envInteger("MEMORY_EVIDENCE_PACK_PERSIST_EXPLANATION_ITEMS", 8);
	    return packs.map((pack) => {
	      const originalBytes = jsonBytes(pack);
	      if (originalBytes <= maxPersistedBytes) return pack;
	      const sourceOriginalBytes = pack.storage?.originalBytes ?? originalBytes;
	      const compacted = compactEvidencePack(pack, {
	        originalBytes: sourceOriginalBytes,
	        maxPersistedBytes,
	        contextMaxChars,
	        resultContentMaxChars,
	        explanationMaxItems
	      });
	      const storage = {
	        compacted: true,
	        originalBytes: sourceOriginalBytes,
	        persistedBytes: 0,
	        maxPersistedBytes,
	        resultContentMaxChars,
	        ...(maxPersistedBytes >= 2_000 ? {
	          compactedAt: new Date().toISOString(),
	          reason: "c",
	          contextMaxChars,
	          explanationMaxItems
	        } : {})
	      };
	      let stored = attachEvidencePackStorage(compacted, storage);
	      if (jsonBytes(stored) > maxPersistedBytes) stored = attachEvidencePackStorage(compactEvidencePackHardLimit(compacted, maxPersistedBytes), storage);
	      return stored;
	    });
	  }

  protected pruneTransientContextPacks(): boolean {
    const evidencePruned = pruneGeneratedMap(this.evidencePacks, envInteger("MEMORY_EVIDENCE_PACK_RETENTION_MAX", 64));
    const codingPruned = pruneGeneratedMap(this.codingContextPacks, envInteger("MEMORY_CODING_CONTEXT_PACK_RETENTION_MAX", 64));
    return evidencePruned || codingPruned;
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

function compactEvidencePack(pack: EvidencePack, limits: { originalBytes: number; maxPersistedBytes: number; contextMaxChars: number; resultContentMaxChars: number; explanationMaxItems: number }): EvidencePack {
  const compacted: EvidencePack = {
    ...pack,
    context: truncatePersistedText(pack.context, limits.contextMaxChars),
    results: pack.results.map((result) => ({
      ...result,
      content: truncatePersistedText(result.content, limits.resultContentMaxChars),
      provenance: compactProvenance(result.provenance),
      retrieval: {
        ...result.retrieval,
        scoreBreakdown: compactScoreBreakdown(result.retrieval.scoreBreakdown),
        explanation: compactStringList(result.retrieval.explanation, limits.explanationMaxItems),
        whyIncluded: compactStringList(result.retrieval.whyIncluded, limits.explanationMaxItems),
        whyNotExcluded: compactStringList(result.retrieval.whyNotExcluded, limits.explanationMaxItems),
        graphPaths: compactStringList(result.retrieval.graphPaths, limits.explanationMaxItems),
        plan: result.retrieval.plan ? {
          queryType: result.retrieval.plan.queryType,
          secondaryTypes: result.retrieval.plan.secondaryTypes,
          intent: result.retrieval.plan.intent,
          recommendedMode: result.retrieval.plan.recommendedMode,
          strategies: result.retrieval.plan.strategies,
          confidence: result.retrieval.plan.confidence
        } as typeof result.retrieval.plan : undefined
      },
      policyDecision: result.policyDecision ? {
        operation: result.policyDecision.operation,
        allowed: result.policyDecision.allowed,
        memoryId: result.policyDecision.memoryId,
        reasons: compactStringList(result.policyDecision.reasons, limits.explanationMaxItems)
      } as typeof result.policyDecision : undefined,
      contradictionWarnings: compactStringList(result.contradictionWarnings ?? [], limits.explanationMaxItems),
      truthDecision: result.truthDecision ? {
        subject: result.truthDecision.subject,
        predicate: result.truthDecision.predicate,
        selectedClaimId: result.truthDecision.selectedClaimId,
        selectedMemoryId: result.truthDecision.selectedMemoryId,
        state: result.truthDecision.state,
        reason: truncatePersistedText(result.truthDecision.reason, 500),
        conflictSetId: result.truthDecision.conflictSetId,
        scoreBreakdown: result.truthDecision.scoreBreakdown
      } as typeof result.truthDecision : undefined
    })),
	    excludedResults: pack.excludedResults?.map((result) => ({
	      ...result,
      reason: truncatePersistedText(result.reason, 500),
      policyDecision: result.policyDecision ? {
        operation: result.policyDecision.operation,
        allowed: result.policyDecision.allowed,
        memoryId: result.policyDecision.memoryId,
        reasons: compactStringList(result.policyDecision.reasons, limits.explanationMaxItems)
      } as typeof result.policyDecision : undefined,
      truthDecision: result.truthDecision ? {
        subject: result.truthDecision.subject,
        predicate: result.truthDecision.predicate,
        selectedClaimId: result.truthDecision.selectedClaimId,
        selectedMemoryId: result.truthDecision.selectedMemoryId,
        state: result.truthDecision.state,
        reason: truncatePersistedText(result.truthDecision.reason, 500),
        conflictSetId: result.truthDecision.conflictSetId,
        scoreBreakdown: result.truthDecision.scoreBreakdown
      } as typeof result.truthDecision : undefined
	    })),
	    policyDecisions: pack.policyDecisions?.map((decision) => ({
	      operation: decision.operation,
	      allowed: decision.allowed,
	      memoryId: decision.memoryId,
	      matchedRules: decision.matchedRules,
	      reasons: compactStringList(decision.reasons, limits.explanationMaxItems)
	    } as typeof decision)),
	    truthDecisions: pack.truthDecisions?.map((decision) => compactTruthDecision(decision, 500)),
	    graphPaths: compactStringList(pack.graphPaths ?? [], 24)
	  };
	  if (jsonBytes(compacted) <= limits.maxPersistedBytes) return compacted;
	  const tighter: EvidencePack = {
	    ...compacted,
	    context: truncatePersistedText(compacted.context, Math.min(limits.contextMaxChars, 1_500)),
	    results: compacted.results.map((result) => ({
	      ...result,
	      content: truncatePersistedText(result.content, Math.min(limits.resultContentMaxChars, 360)),
      retrieval: {
        ...result.retrieval,
        explanation: compactStringList(result.retrieval.explanation, 3),
        whyIncluded: compactStringList(result.retrieval.whyIncluded, 3),
        whyNotExcluded: compactStringList(result.retrieval.whyNotExcluded, 3),
	        graphPaths: compactStringList(result.retrieval.graphPaths, 3)
	      }
	    })),
	    truthDecisions: compacted.truthDecisions?.map((decision) => compactTruthDecision(decision, 240)),
	    policyDecisions: compacted.policyDecisions?.slice(0, 12).map((decision) => ({
	      operation: decision.operation,
	      allowed: decision.allowed,
	      memoryId: decision.memoryId,
	      matchedRules: decision.matchedRules?.slice(0, 4),
	      reasons: compactStringList(decision.reasons, 3)
	    } as typeof decision)),
	    graphPaths: compactStringList(compacted.graphPaths ?? [], 8)
	  };
	  if (jsonBytes(tighter) <= limits.maxPersistedBytes) return tighter;
	  const aggressive: EvidencePack = {
	    ...tighter,
	    context: truncatePersistedText(tighter.context, 500),
	    results: tighter.results.slice(0, 8).map((result) => compactEvidenceResult(result, 220)),
	    excludedResults: tighter.excludedResults?.slice(0, 8).map((result) => ({
	      memoryId: result.memoryId,
	      reason: truncatePersistedText(result.reason, 180),
	      policyDecision: result.policyDecision ? compactPolicyDecision(result.policyDecision, 2) : undefined,
	      truthDecision: result.truthDecision ? compactTruthDecision(result.truthDecision, 180) : undefined
	    } as typeof result)),
	    policyDecisions: tighter.policyDecisions?.slice(0, 8).map((decision) => compactPolicyDecision(decision, 2)),
	    truthDecisions: tighter.truthDecisions?.slice(0, 8).map((decision) => compactTruthDecision(decision, 180)),
	    graphPaths: compactStringList(tighter.graphPaths ?? [], 4)
	  };
	  if (jsonBytes(aggressive) <= limits.maxPersistedBytes) return aggressive;
	  return {
	    ...aggressive,
	    results: aggressive.results.slice(0, 4).map((result) => compactEvidenceResult(result, 120)),
	    excludedResults: aggressive.excludedResults?.slice(0, 4),
	    policyDecisions: aggressive.policyDecisions?.slice(0, 4),
	    truthDecisions: aggressive.truthDecisions?.slice(0, 4),
	    graphPaths: compactStringList(aggressive.graphPaths ?? [], 2)
	  };
	}

function compactEvidencePackHardLimit(pack: EvidencePack, maxPersistedBytes: number): EvidencePack {
  const resultLimit = maxPersistedBytes < 2_000 ? 1 : 4;
  const contentChars = maxPersistedBytes < 2_000 ? 0 : 80;
  const tinyLimit = maxPersistedBytes < 2_000;
  return {
    schemaVersion: pack.schemaVersion,
    id: pack.id,
    generatedAt: pack.generatedAt,
    query: truncatePersistedText(pack.query, tinyLimit ? 32 : 240),
    userId: pack.userId,
    tokenBudget: pack.tokenBudget,
    hash: pack.hash,
    context: "",
    results: pack.results.slice(0, resultLimit).map((result) => compactEvidenceResultSkeleton(result, contentChars)),
    excludedResults: [],
    policyDecisions: [],
    graphPaths: [],
    truthDecisions: [],
    summary: pack.summary
  };
}

function attachEvidencePackStorage(pack: EvidencePack, storage: NonNullable<EvidencePack["storage"]>): EvidencePack {
  const placeholder = { ...pack, storage: { ...storage, persistedBytes: 0 } };
  let persistedBytes = jsonBytes(placeholder);
  let stored = { ...pack, storage: { ...storage, persistedBytes } };
  for (let index = 0; index < 3; index += 1) {
    const nextPersistedBytes = jsonBytes(stored);
    if (nextPersistedBytes === persistedBytes) break;
    persistedBytes = nextPersistedBytes;
    stored = { ...pack, storage: { ...storage, persistedBytes } };
  }
  return {
    ...stored,
    storage: {
      ...stored.storage,
      persistedBytes: jsonBytes(stored)
    }
  };
}

function compactProvenance(provenance: EvidencePack["results"][number]["provenance"]): EvidencePack["results"][number]["provenance"] {
  return {
    source: provenance.source,
    citations: compactStringList(provenance.citations ?? [], 6),
    sourceRef: provenance.sourceRef
  };
}

function compactScoreBreakdown(scoreBreakdown: EvidencePack["results"][number]["retrieval"]["scoreBreakdown"]): EvidencePack["results"][number]["retrieval"]["scoreBreakdown"] {
  if (!scoreBreakdown) return undefined;
  return {
    semantic: scoreBreakdown.semantic,
    keyword: scoreBreakdown.keyword,
    entity: scoreBreakdown.entity,
    temporal: scoreBreakdown.temporal,
    behavioral: scoreBreakdown.behavioral,
    trust: scoreBreakdown.trust,
    graph: scoreBreakdown.graph,
    access: scoreBreakdown.access,
    finalScore: scoreBreakdown.finalScore,
    initialScore: scoreBreakdown.initialScore,
    confidence: scoreBreakdown.confidence
  };
}

function compactEvidenceResult(result: EvidencePack["results"][number], contentChars: number): EvidencePack["results"][number] {
  return {
    memoryId: result.memoryId,
    content: truncatePersistedText(result.content, contentChars),
    source: result.source,
    scope: { userId: result.scope.userId } as typeof result.scope,
    consent: result.consent,
    trust: result.trust,
    confidence: result.confidence,
    importance: result.importance,
    beliefState: result.beliefState,
    provenance: compactProvenance(result.provenance),
    validity: result.validity,
    retrieval: {
      score: result.retrieval.score,
      confidence: result.retrieval.confidence,
      unsafeToInject: result.retrieval.unsafeToInject,
      initialScore: result.retrieval.initialScore,
      mode: result.retrieval.mode,
      signals: {} as typeof result.retrieval.signals,
      scoreBreakdown: compactScoreBreakdown(result.retrieval.scoreBreakdown),
      explanation: compactStringList(result.retrieval.explanation, 2),
      whyIncluded: compactStringList(result.retrieval.whyIncluded, 2),
      whyNotExcluded: compactStringList(result.retrieval.whyNotExcluded, 2),
      graphPaths: compactStringList(result.retrieval.graphPaths, 2),
      citation: result.retrieval.citation,
      contradiction: result.retrieval.contradiction,
      plan: result.retrieval.plan ? {
        queryType: result.retrieval.plan.queryType,
        secondaryTypes: result.retrieval.plan.secondaryTypes,
        intent: result.retrieval.plan.intent,
        recommendedMode: result.retrieval.plan.recommendedMode,
        strategies: result.retrieval.plan.strategies,
        confidence: result.retrieval.plan.confidence
      } as typeof result.retrieval.plan : undefined
    },
    policyDecision: result.policyDecision ? compactPolicyDecision(result.policyDecision, 2) : undefined,
    contradictionWarnings: compactStringList(result.contradictionWarnings ?? [], 2),
    truthDecision: result.truthDecision ? compactTruthDecision(result.truthDecision, 180) : undefined
  } as typeof result;
}

function compactEvidenceResultSkeleton(result: EvidencePack["results"][number], contentChars: number): EvidencePack["results"][number] {
  return {
    memoryId: result.memoryId,
    content: truncatePersistedText(result.content, contentChars),
    source: {
      kind: result.source.kind,
      confidence: result.source.confidence
    } as typeof result.source,
    scope: result.scope,
    consent: result.consent,
    trust: result.trust,
    confidence: result.confidence,
    importance: result.importance,
    beliefState: result.beliefState,
    provenance: {
      source: result.provenance.source,
      citations: []
    } as typeof result.provenance,
    validity: {
      stale: result.validity.stale
    },
    retrieval: {
      score: result.retrieval.score,
      confidence: result.retrieval.confidence,
      unsafeToInject: result.retrieval.unsafeToInject,
      signals: result.retrieval.signals,
      explanation: [],
      whyIncluded: [],
      whyNotExcluded: [],
      graphPaths: [],
      citation: truncatePersistedText(result.retrieval.citation, 40)
    },
    contradictionWarnings: []
  };
}

function compactPolicyDecision<T extends { operation?: unknown; allowed?: unknown; memoryId?: unknown; matchedRules?: unknown[]; reasons?: string[] }>(decision: T, reasonLimit: number): T {
  return {
    operation: decision.operation,
    allowed: decision.allowed,
    memoryId: decision.memoryId,
    matchedRules: decision.matchedRules?.slice(0, 4),
    reasons: compactStringList(decision.reasons ?? [], reasonLimit)
  } as T;
}

function compactTruthDecision(decision: CurrentTruthDecision, reasonChars: number): CurrentTruthDecision {
  return {
    subject: decision.subject,
    predicate: decision.predicate,
    selectedClaimId: decision.selectedClaimId,
    selectedMemoryId: decision.selectedMemoryId,
    state: decision.state,
    suppressedClaimIds: (decision.suppressedClaimIds ?? []).slice(0, 8),
    conflictSetId: decision.conflictSetId,
    reason: truncatePersistedText(decision.reason, reasonChars),
    scoreBreakdown: decision.scoreBreakdown
  };
}

function compactStringList(values: string[], limit: number): string[] {
  return values.slice(0, Math.max(0, limit)).map((value) => truncatePersistedText(value, 240));
}

function truncatePersistedText(value: string | undefined, maxChars: number): string {
  if (!value) return "";
  if (maxChars <= 0) return "";
  return value.length <= maxChars ? value : `${value.slice(0, maxChars)}...[truncated ${value.length - maxChars} chars]`;
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function pruneGeneratedMap<T extends { generatedAt?: string }>(items: Map<string, T>, maxItems: number): boolean {
  if (maxItems <= 0 || items.size <= maxItems) return false;
  const initialSize = items.size;
  const keep = new Set([...items.entries()]
    .map(([id, value], index) => ({ id, index, time: Date.parse(value.generatedAt ?? "") || 0 }))
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .slice(0, maxItems)
    .map((item) => item.id));
  for (const id of items.keys()) {
    if (!keep.has(id)) items.delete(id);
  }
  return items.size !== initialSize;
}

function envInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? NaN);
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}
