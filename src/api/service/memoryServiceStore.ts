import { MemoryServiceBase } from './memoryServiceBase';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addAsyncImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveAsyncImpl, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryAsyncImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeAsyncImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteAsyncImpl, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractAsyncImpl, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaAsyncImpl, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionAsyncImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryAsyncImpl, retractMemoryImpl, revalidateMemoryImpl, revertMemoryAsyncImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateAsyncImpl, updateConsentAsyncImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceStore extends MemoryServiceBase {
  add(input: MemoryInput): Memory {
    return addImpl(this, input);
  }

  addAsync(input: MemoryInput): Promise<Memory> {
    return addAsyncImpl(this, input);
  }

  createEpisode(input: EpisodeInput): EpisodeRecord {
    return createEpisodeImpl(this, input);
  }

  createEpisodeAsync(input: EpisodeInput): Promise<EpisodeRecord> {
    return createEpisodeAsyncImpl(this, input);
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

  extractAsync(
    events: MemoryExtractionEvent[],
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "deviceId" | "runId">
  ): Promise<ExtractionReport> {
    return extractAsyncImpl(this, events, scope);
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

  updateAsync(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }): Promise<Memory> {
    return updateAsyncImpl(this, id, patch);
  }

  archive(id: string): Memory {
    return archiveImpl(this, id);
  }

  archiveAsync(id: string): Promise<Memory> {
    return archiveAsyncImpl(this, id);
  }

  delete(id: string): boolean {
    return deleteImpl(this, id);
  }

  deleteAsync(id: string): Promise<boolean> {
    return deleteAsyncImpl(this, id);
  }

  listMemories(userId: string, options: { limit?: number; includeArchived?: boolean } = {}): Memory[] {
    return listMemoriesImpl(this, userId, options);
  }

  ingestMedia(
    event: MemoryExtractionEvent,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">
  ): ExtractionReport {
    return ingestMediaImpl(this, event, scope);
  }

  ingestMediaAsync(
    event: MemoryExtractionEvent,
    scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">
  ): Promise<ExtractionReport> {
    return ingestMediaAsyncImpl(this, event, scope);
  }
}
