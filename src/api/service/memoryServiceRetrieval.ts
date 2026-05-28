import { MemoryServiceTruth } from './memoryServiceTruth';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresMemoryRepository, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceRetrieval extends MemoryServiceTruth {
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
}
