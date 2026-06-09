import { MemoryServiceSharingGraphMarketplace } from './memoryServiceSharingGraphMarketplace';
import { enforceRetentionAsyncImpl } from './memoryServiceDeps';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryAsyncImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeAsyncImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryAsyncImpl, retractMemoryImpl, revalidateMemoryImpl, revertMemoryAsyncImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentAsyncImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceGovernanceOps extends MemoryServiceSharingGraphMarketplace {
  managedMigrationBundle(options: { target?: ManagedMigrationBundle["target"]; backupRef?: string; ssoProvider?: string; secretManager?: string } = {}): ManagedMigrationBundle {
    return managedMigrationBundleImpl(this, options);
  }

  importMigrationBundle(bundle: ManagedMigrationBundle): { importedMemories: number; importedEpisodes: number; importedProfiles: number; importedPersonas: number; importedConnectors: number; importedPolicyRules: number; importedRetentionRules: number } {
    return importMigrationBundleImpl(this, bundle);
  }

  verifyBackupRecovery(bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport {
    return verifyBackupRecoveryImpl(this, bundle, options);
  }

  verifyBackupReplay(bundle?: ManagedMigrationBundle, options: { keyring?: DecryptionKeyMaterial[] } = {}): BackupRecoveryReport & { replay: unknown } {
    return verifyBackupReplayImpl(this, bundle, options);
  }

  setRetentionRule(input: Omit<RetentionRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): RetentionRule {
    return setRetentionRuleImpl(this, input);
  }

  listRetentionRules(): RetentionRule[] {
    return listRetentionRulesImpl(this);
  }

  enforceRetention(now = new Date(), userId?: string): RetentionEnforcementReport {
    return enforceRetentionImpl(this, now, userId);
  }

  enforceRetentionAsync(now = new Date(), userId?: string): Promise<RetentionEnforcementReport> {
    return enforceRetentionAsyncImpl(this, now, userId);
  }

  retentionReview(now = new Date(), userId?: string): RetentionReviewReport {
    return retentionReviewImpl(this, now, userId);
  }

  protected applyEpisodeRetention(memoryId: string, action: "archive" | "delete", reason: string, ruleId: string | undefined, now: Date, report: RetentionEnforcementReport): void {
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
    return securityKeyReportImpl(this);
  }

  keyProviderReport(): KeyProviderReport {
    return keyProviderReportImpl(this);
  }

  setPolicyRule(input: Omit<MemoryPolicyRule, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemoryPolicyRule {
    return setPolicyRuleImpl(this, input);
  }

  listPolicyRules(): MemoryPolicyRule[] {
    return listPolicyRulesImpl(this);
  }

  evaluatePolicy(operation: MemoryPolicyOperation, target: Memory | MemoryInput, actor: Partial<MemoryScope> = {}): PolicyDecision {
    return evaluatePolicyImpl(this, operation, target, actor);
  }

  canRead(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canReadImpl(this, memory, actor);
  }

  canWrite(input: MemoryInput, actor: Partial<MemoryScope> = {}): boolean {
    return canWriteImpl(this, input, actor);
  }

  canDelete(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canDeleteImpl(this, memory, actor);
  }

  canPromote(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canPromoteImpl(this, memory, actor);
  }

  canUseInContext(memory: Memory, actor: Partial<MemoryScope> = {}): boolean {
    return canUseInContextImpl(this, memory, actor);
  }

  transportSecurityReport(options: { publicUrl?: string; mode?: TransportSecurityReport["mode"]; tlsTerminatedBy?: string } = {}): TransportSecurityReport {
    return transportSecurityReportImpl(this, options);
  }

  managedDeploymentPlan(options: { target?: ManagedMigrationBundle["target"]; ssoProvider?: string; secretManager?: string } = {}): ManagedDeploymentPlan {
    return managedDeploymentPlanImpl(this, options);
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
    return createManagedTenantImpl(this, input);
  }

  listManagedTenants(): ManagedTenant[] {
    return listManagedTenantsImpl(this);
  }

  managedControlPlaneReport(): ManagedControlPlaneReport {
    return managedControlPlaneReportImpl(this);
  }

rotateEncryptionKeyMetadata(input: { keyId: string; keyVersion: string; backupRef?: string; actorId?: string }): KeyRotationReport {
    return rotateEncryptionKeyMetadataImpl(this, input);
  }

  privacyInsights(options: { epsilon?: number; kAnonymity?: number; includeExact?: boolean } = {}): DifferentialPrivacyReport {
    return privacyInsightsImpl(this, options);
  }

  privacyPreservingCrossBrainCompute(options: {
    brainIds: string[];
    salt?: string;
    minK?: number;
    dimensions?: Array<"entities" | "tags" | "relations">;
  }): CrossBrainPrivacyComputeReport {
    return privacyPreservingCrossBrainComputeImpl(this, options);
  }

  complianceReport(now = new Date()): ComplianceReport {
    return complianceReportImpl(this, now);
  }
}
