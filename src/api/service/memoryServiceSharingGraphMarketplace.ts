import { MemoryServiceConnectorsAdmin } from './memoryServiceConnectorsAdmin';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresMemoryRepository, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceSharingGraphMarketplace extends MemoryServiceConnectorsAdmin {
  protected lexicalProviderForPersistence(): SearchOptions["lexicalProvider"] | undefined {
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

  protected requireMarketplaceSubmission(submissionId: string): MarketplaceSubmission {
    const submission = this.marketplaceSubmissions.get(submissionId);
    if (!submission) throw new Error(`Marketplace submission not found: ${submissionId}`);
    return submission;
  }

  apiDescription(auth?: import("../apiDescription").ApiDescriptionAuth) {
    return apiDescriptionImpl(this, auth);
  }
}
