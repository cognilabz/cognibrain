import { MemoryServiceDreamEngineering } from './memoryServiceDreamEngineering';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryAsyncImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryAsyncImpl, retractMemoryImpl, revalidateMemoryImpl, revertMemoryAsyncImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentAsyncImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceSourceRevalidation extends MemoryServiceDreamEngineering {
  async revalidateSourceRefsAsync(
    userId: string,
    options: { connectorIds?: string[]; scope?: DreamCycleInput["scope"]; onlyDue?: boolean; limit?: number } = {}
  ): Promise<SourceRevalidationReport> {
    const now = new Date();
    const candidates = this.sourceRevalidationCandidates(userId, options);
    const results: SourceRevalidationResult[] = [];
    for (const memory of candidates) {
      results.push(await this.revalidateMemorySourceRefAsync(memory.id, userId));
    }
    const report: SourceRevalidationReport = {
      userId,
      generatedAt: now.toISOString(),
      evaluated: candidates.length,
      results,
      summary: sourceRevalidationSummary(results)
    };
    if (results.length) {
      this.recordAudit("reflect.run", { userId, metadata: { resource: "source-revalidation", mode: "live", evaluated: report.evaluated, summary: report.summary } });
      this.persist();
    }
    return report;
  }

  revalidateMemory(memoryId: string, userId?: string): SourceRevalidationResult {
    return revalidateMemoryImpl(this, memoryId, userId);
  }

  async revalidateMemoryAsync(memoryId: string, userId?: string): Promise<SourceRevalidationResult> {
    return this.revalidateMemorySourceRefAsync(memoryId, userId);
  }

  registerSourceResolver(resolver: SourceResolver): SourceResolver {
    this.sourceResolvers.set(resolver.connectorId, resolver);
    return resolver;
  }

  listSourceResolvers(): SourceResolver[] {
    return [...this.sourceResolvers.values()];
  }

  protected registerDefaultSourceResolvers(): void {
    const providers = ["github", "jira", "confluence", "notion", "sentry", "pagerduty"];
    for (const provider of providers) {
      const connectorIds = [`official-${provider}`, provider];
      for (const connectorId of connectorIds) {
        this.registerSourceResolver({
          id: `resolver:${connectorId}`,
          connectorId,
          supports: (sourceRef) => sourceRef.connectorId === connectorId || sourceRef.connectorId === provider,
          fetch: async (sourceRef, memory) => this.fetchLiveSourceRecord(sourceRef, memory),
          get: (sourceRef, memory) => this.latestSourceRecordFromMemories(sourceRef, memory),
          compare: (memory, sourceRecord) => defaultSourceResolverDecision(memory, sourceRecord)
        });
      }
    }
  }

  protected latestSourceRecordFromMemories(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): SourceRecord | undefined {
    const candidates = this.store.list(memory.userId)
      .filter((item) => item.provenance.sourceRef?.connectorId === sourceRef.connectorId)
      .filter((item) => !sourceRef.externalId || item.provenance.sourceRef?.externalId === sourceRef.externalId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const current = candidates[0] ?? memory;
    return {
      sourceRef,
      content: current.content,
      title: typeof current.metadata?.title === "string" ? current.metadata.title : undefined,
      updatedAt: current.updatedAt,
      version: current.provenance.sourceRef?.version,
      hash: current.provenance.sourceRef?.hash,
      status: "found",
      metadata: { provider: sourceRef.connectorId, memoryId: current.id }
    };
  }

  protected async fetchLiveSourceRecord(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, memory: Memory): Promise<SourceRecord | { missing: true }> {
    const connectorId = sourceRef.connectorId;
    if (!connectorId) return this.latestSourceRecordFromMemories(sourceRef, memory) ?? { missing: true };
    const manifest = this.connectorManifests.get(connectorId)
      ?? this.connectorManifests.get(`official-${connectorId}`);
    if (!manifest) return this.latestSourceRecordFromMemories(sourceRef, memory) ?? { missing: true };
    const listed = await listExternalVendorItems(manifest, fetch, Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000));
    if (listed.status === "failed") {
      const local = this.latestSourceRecordFromMemories(sourceRef, memory);
      return local
        ? { ...local, metadata: { ...(local.metadata ?? {}), liveFetchSkipped: true, liveFetchError: listed.error } }
        : { missing: true };
    }
    const item = listed.items.find((candidate: Record<string, unknown>) => sourceRefMatchesVendorItem(sourceRef, candidate));
    if (!item) return { missing: true };
    const hash = contentHash(stableStringify(item));
    return {
      sourceRef: { ...sourceRef, version: liveSourceVersion(item), hash },
      content: compactLiveSourceContent(item),
      title: stringFromCandidate(item, ["title", "name", "summary", "key", "identifier", "externalId", "id"]),
      updatedAt: stringFromCandidate(item, ["updatedAt", "updated_at", "modifiedAt", "lastEditedTime", "last_edited_time"]) ?? new Date().toISOString(),
      version: liveSourceVersion(item),
      hash,
      status: "found",
      metadata: {
        provider: manifest.vendor?.provider,
        connectorId: manifest.id,
        liveFetch: true,
        responseStatusCode: listed.responseStatusCode
      }
    };
  }

  protected sourceRevalidationCandidates(
    userId: string,
    options: { connectorIds?: string[]; scope?: DreamCycleInput["scope"]; onlyDue?: boolean; limit?: number } = {}
  ): Memory[] {
    const connectorIds = new Set(options.connectorIds ?? []);
    const dueMemoryIds = new Set(this.verificationQueue(userId).items.map((item: { memoryId: string }) => item.memoryId));
    return this.store.list(userId)
      .filter((memory) => !memory.archivedAt)
      .filter((memory) => Boolean(memory.provenance.sourceRef))
      .filter((memory) => !connectorIds.size || connectorIds.has(memory.provenance.sourceRef?.connectorId ?? ""))
      .filter((memory) => this.memoryMatchesDreamScope(memory, options.scope))
      .filter((memory) => !options.onlyDue || dueMemoryIds.has(memory.id) || (memory.temporal.stalenessRisk ?? 0) >= 0.65)
      .slice(0, options.limit ?? 200);
  }

  protected revalidateMemorySourceRef(memoryId: string, userId?: string): SourceRevalidationResult {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot revalidate memory ${memoryId}`);
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) {
      const updated = this.store.update(memory.id, {
        beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
        metadata: { verification: { status: "needs_operator_review", at: new Date().toISOString(), reason: "memory has no sourceRef" } }
      });
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "needs_operator_review", reason: "missing_source_ref" } });
      return { memoryId, status: "needs_operator_review", reason: "memory has no sourceRef" };
    }
    const resolver = sourceRef.connectorId ? this.sourceResolvers.get(sourceRef.connectorId) : undefined;
    if (resolver) {
      const sourceRecord = resolver.get(sourceRef, memory);
      const decision: SourceValidationDecision = sourceRecord
        ? resolver.compare?.(memory, sourceRecord) ?? defaultSourceResolverDecision(memory, sourceRecord)
        : { status: "source_missing" as const, reason: "source resolver returned no source record" };
      return this.applySourceResolverDecision(memory, sourceRef, decision);
    }
    return this.revalidateMemorySourceRefFallback(memory, sourceRef);
  }

  protected async revalidateMemorySourceRefAsync(memoryId: string, userId?: string): Promise<SourceRevalidationResult> {
    const memory = this.store.get(memoryId);
    if (userId && memory.userId !== userId) throw new Error(`User ${userId} cannot revalidate memory ${memoryId}`);
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) {
      return this.revalidateMemorySourceRef(memoryId, userId);
    }
    const resolver = sourceRef.connectorId ? this.sourceResolvers.get(sourceRef.connectorId) : undefined;
    if (resolver) {
      const fetched = resolver.fetch ? await resolver.fetch(sourceRef, memory) : resolver.get(sourceRef, memory);
      const sourceRecord = fetched && !("missing" in fetched) ? fetched : undefined;
      const decision: SourceValidationDecision = sourceRecord
        ? resolver.compare?.(memory, sourceRecord) ?? defaultSourceResolverDecision(memory, sourceRecord)
        : { status: "source_missing" as const, reason: resolver.fetch ? "live source resolver returned missing" : "source resolver returned no source record" };
      return this.applySourceResolverDecision(memory, sourceRef, decision);
    }
    return this.revalidateMemorySourceRefFallback(memory, sourceRef);
  }

protected revalidateMemorySourceRefFallback(
    memory: Memory,
    sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>
  ): SourceRevalidationResult {
    if (memory.metadata.verificationReason === "source_deleted" || memory.metadata.sourceDeletedAt) {
      const updated = this.store.update(memory.id, {
        beliefState: "needs_verification",
        temporal: { ...memory.temporal, verificationDueAt: memory.temporal.verificationDueAt ?? new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.85) },
        metadata: { sourceRevalidation: { status: "source_missing", at: new Date().toISOString(), reason: "source deleted" } }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "source_missing" } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "source_missing",
        reason: "source was deleted or detached",
        previousHash: sourceRef.hash,
        previousVersion: sourceRef.version
      };
    }

    const latest = this.latestSourceMemory(memory);
    const latestRef = latest?.provenance.sourceRef;
    const syncRecord = this.latestSourceSyncRecord(sourceRef);
    const hasNewerEvidence = latest && latest.id !== memory.id && sourceEvidenceTime(latest) >= sourceEvidenceTime(memory);
    if (hasNewerEvidence && latestRef && sourceRefChanged(sourceRef, latestRef)) {
      const validUntil = new Date(latest.temporal.eventAt ?? latest.createdAt).toISOString();
      const updated = this.store.update(memory.id, {
        beliefState: "superseded",
        temporal: { ...memory.temporal, validUntil, supersededAt: validUntil, verificationDueAt: undefined, stalenessRisk: 0 },
        metadata: {
          sourceRevalidation: {
            status: "superseded",
            at: new Date().toISOString(),
            sourceMemoryId: latest.id,
            reason: "sourceRef changed in newer connector evidence"
          },
          supersededBy: latest.id
        }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "superseded", sourceMemoryId: latest.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "superseded",
        reason: "newer connector evidence changed the source version or hash",
        sourceMemoryId: latest.id,
        syncRecordId: syncRecord?.id,
        previousHash: sourceRef.hash,
        currentHash: latestRef.hash,
        previousVersion: sourceRef.version,
        currentVersion: latestRef.version
      };
    }

    const failedRecord = this.latestConnectorSyncRecord(sourceRef.connectorId, "failed");
    if (failedRecord && (!syncRecord || new Date(failedRecord.timestamp).getTime() > new Date(syncRecord.timestamp).getTime())) {
      const updated = this.store.update(memory.id, {
        beliefState: memory.beliefState,
        temporal: { ...memory.temporal, lastConfirmedAt: new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.35) },
        metadata: { sourceRevalidation: { status: "confirmed", at: new Date().toISOString(), reason: `kept last known good source after failed connector refresh: ${failedRecord.error ?? "latest connector sync failed"}`, syncRecordId: failedRecord.id } }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "confirmed_last_known_good", syncRecordId: failedRecord.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: "confirmed",
        reason: `kept last known good source after failed connector refresh: ${failedRecord.error ?? "latest connector sync failed"}`,
        syncRecordId: failedRecord.id,
        previousHash: sourceRef.hash,
        previousVersion: sourceRef.version
      };
    }

    if (latest && (!latestRef || !sourceRefChanged(sourceRef, latestRef) || latest.id === memory.id || sourceEvidenceTime(latest) >= sourceEvidenceTime(memory))) {
      const contradictionRequiresReview = memory.beliefState === "contradicted" || typeof memory.metadata.contradiction === "string";
      const updated = this.store.update(memory.id, {
        beliefState: contradictionRequiresReview ? "needs_verification" : "active",
        temporal: { ...memory.temporal, lastConfirmedAt: new Date().toISOString(), verificationDueAt: contradictionRequiresReview ? memory.temporal.verificationDueAt ?? new Date().toISOString() : undefined, stalenessRisk: contradictionRequiresReview ? Math.max(memory.temporal.stalenessRisk ?? 0, 0.7) : 0 },
        metadata: {
          sourceRevalidation: {
            status: contradictionRequiresReview ? "needs_operator_review" : "confirmed",
            at: new Date().toISOString(),
            sourceMemoryId: latest.id,
            syncRecordId: syncRecord?.id
          },
          verification: contradictionRequiresReview
            ? { status: "needs_operator_review", at: new Date().toISOString(), reason: "confirmed source exists but memory was contradicted" }
            : { status: "confirmed", at: new Date().toISOString(), reason: "sourceRef revalidation" }
        }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: contradictionRequiresReview ? "needs_operator_review" : "confirmed", sourceMemoryId: latest.id } });
      return {
        memoryId: memory.id,
        connectorId: sourceRef.connectorId,
        externalId: sourceRef.externalId,
        status: contradictionRequiresReview ? "needs_operator_review" : "confirmed",
        reason: contradictionRequiresReview ? "source exists but contradiction still requires operator review" : "sourceRef matches current connector evidence",
        sourceMemoryId: latest.id,
        syncRecordId: syncRecord?.id,
        previousHash: sourceRef.hash,
        currentHash: latestRef?.hash ?? sourceRef.hash,
        previousVersion: sourceRef.version,
      currentVersion: latestRef?.version ?? sourceRef.version
      };
    }

    const updated = this.store.update(memory.id, {
      beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
      temporal: { ...memory.temporal, verificationDueAt: memory.temporal.verificationDueAt ?? new Date().toISOString(), stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.65) },
      metadata: { sourceRevalidation: { status: "needs_operator_review", at: new Date().toISOString(), reason: "no current connector evidence found", syncRecordId: syncRecord?.id } }
    });
    this.registerMemoryClaim(updated);
    this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status: "needs_operator_review" } });
    return {
      memoryId: memory.id,
      connectorId: sourceRef.connectorId,
      externalId: sourceRef.externalId,
      status: "needs_operator_review",
      reason: "no current connector evidence found",
      syncRecordId: syncRecord?.id,
      previousHash: sourceRef.hash,
      previousVersion: sourceRef.version
    };
  }

  protected applySourceResolverDecision(
    memory: Memory,
    sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>,
    decision: SourceValidationDecision
  ): SourceRevalidationResult {
    const now = new Date().toISOString();
    const sourceRecord = decision.sourceRecord;
    const status = decision.status;
    const nextBeliefState = decision.beliefState ?? (
      status === "confirmed" ? "active" :
        status === "source_updated" || status === "source_missing" || status === "needs_operator_review" ? "needs_verification" :
          status === "superseded" ? "superseded" :
            status === "contradicted" ? "contradicted" :
              memory.beliefState
    );
    const updated = this.store.update(memory.id, {
      beliefState: nextBeliefState,
      temporal: {
        ...memory.temporal,
        lastConfirmedAt: status === "confirmed" ? now : memory.temporal.lastConfirmedAt,
        verificationDueAt: status === "confirmed" ? undefined : memory.temporal.verificationDueAt ?? now,
        stalenessRisk: status === "confirmed" ? 0 : Math.max(memory.temporal.stalenessRisk ?? 0, status === "source_missing" ? 0.85 : 0.7)
      },
      metadata: {
        ...memory.metadata,
        sourceRevalidation: {
          status,
          at: now,
          reason: decision.reason,
          resolver: sourceRef.connectorId,
          sourceRecord: sourceRecord ? {
            version: sourceRecord.version,
            hash: sourceRecord.hash,
            updatedAt: sourceRecord.updatedAt,
            status: sourceRecord.status
          } : undefined
        }
      }
    });
    this.registerMemoryClaim(updated);
    this.recordAudit("memory.update", { userId: updated.userId, memoryId: updated.id, metadata: { action: "source_revalidation", status, resolver: sourceRef.connectorId, reason: decision.reason } });
    return {
      memoryId: memory.id,
      connectorId: sourceRef.connectorId,
      externalId: sourceRef.externalId,
      status,
      reason: decision.reason,
      previousHash: sourceRef.hash,
      currentHash: sourceRecord?.hash ?? sourceRecord?.sourceRef.hash,
      previousVersion: sourceRef.version,
      currentVersion: sourceRecord?.version ?? sourceRecord?.sourceRef.version
    };
  }

  protected latestSourceMemory(memory: Memory): Memory | undefined {
    const sourceRef = memory.provenance.sourceRef;
    if (!sourceRef) return undefined;
    return this.store.list(memory.userId)
      .filter((candidate) => !candidate.archivedAt)
      .filter((candidate) => sourceRefsMatch(sourceRef, candidate.provenance.sourceRef))
      .sort((a, b) => sourceEvidenceTime(b) - sourceEvidenceTime(a) || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  protected latestSourceSyncRecord(sourceRef: Memory["provenance"]["sourceRef"]): ConnectorSyncRecord | undefined {
    if (!sourceRef?.connectorId) return undefined;
    return this.connectorSyncRecords
      .filter((record) => record.connectorId === sourceRef.connectorId && record.status === "applied")
      .filter((record) => !sourceRef.externalId || record.externalIds.includes(sourceRef.externalId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  protected appendConnectorSyncRecord(record: ConnectorSyncRecord): ConnectorSyncRecord {
    this.connectorSyncRecords.push(record);
    this.updateConnectorSyncState(record);
    return record;
  }

  protected updateConnectorSyncState(record: ConnectorSyncRecord): void {
    const existing = this.connectorSyncStates.get(record.connectorId);
    const payload = record.payload ?? {};
    const isSuccessfulPoll = record.direction === "ingest" && record.status === "applied";
    this.connectorSyncStates.set(record.connectorId, {
      connectorId: record.connectorId,
      cursor: firstString(payload.cursorAfter, payload.nextCursor, payload.cursor) ?? existing?.cursor,
      lastSuccessfulPollAt: isSuccessfulPoll ? record.timestamp : existing?.lastSuccessfulPollAt,
      lastExternalUpdatedAt: firstString(payload.lastExternalUpdatedAt) ?? existing?.lastExternalUpdatedAt,
      etag: firstString(payload.etag) ?? existing?.etag,
      sourceVersion: firstString(payload.sourceVersion) ?? existing?.sourceVersion,
      lastRecordId: record.id,
      lastStatus: record.status,
      records: this.connectorSyncRecords.filter((item) => item.connectorId === record.connectorId).length
    });
  }

  protected latestConnectorSyncRecord(connectorId?: string, status?: ConnectorSyncRecord["status"]): ConnectorSyncRecord | undefined {
    if (!connectorId) return undefined;
    return this.connectorSyncRecords
      .filter((record) => record.connectorId === connectorId)
      .filter((record) => !status || record.status === status)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  protected scheduleVerificationFromDream(userId: string): number {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let scheduled = 0;
    for (const memory of this.store.list(userId)) {
      if (memory.archivedAt || memory.pinned || memory.temporal.verificationDueAt) continue;
      const risk = memory.temporal.stalenessRisk ?? 0;
      if (memory.beliefState === "contradicted" || memory.beliefState === "needs_verification" || (risk >= 0.65 && memory.importance >= 0.5)) {
        this.store.update(memory.id, {
          beliefState: memory.beliefState === "active" ? "needs_verification" : memory.beliefState,
          temporal: { ...memory.temporal, verificationDueAt: dueAt },
          metadata: { verification: { status: "queued", at: new Date().toISOString(), reason: "dream belief revision" } }
        });
        scheduled += 1;
      }
    }
    return scheduled;
  }
}
