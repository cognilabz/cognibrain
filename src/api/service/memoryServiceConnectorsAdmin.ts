import { MemoryServiceLifecycleFeedback } from './memoryServiceLifecycleFeedback';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceConnectorsAdmin extends MemoryServiceLifecycleFeedback {
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

  deliverWebhookQueue(handler?: (webhook: WebhookRegistration, event: AuditEvent) => { ok: boolean; error?: string }): { delivered: number; failed: number; queued: number } {
    return deliverWebhookQueueImpl(this, handler);
  }

  async deliverWebhookQueueHttp(fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_WEBHOOK_TIMEOUT_MS ?? 10_000)): Promise<{ delivered: number; failed: number; queued: number }> {
    return deliverWebhookQueueHttpImpl(this, fetchImpl, timeoutMs);
  }

storageStatus(): StorageBackendStatus {
    return storageStatusImpl(this);
  }
}
