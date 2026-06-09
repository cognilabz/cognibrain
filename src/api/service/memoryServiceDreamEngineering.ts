import { MemoryServiceRetrieval } from './memoryServiceRetrieval';
import { productionDreamWorkerMode, runDreamJobWorkerOnce as runDreamJobWorkerOnceImpl } from './dreamRuntime';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionAsyncImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

function cloneDreamJob(job: DreamJob): DreamJob {
  return {
    ...job,
    logs: job.logs ? job.logs.map((entry) => ({ ...entry })) : job.logs
  };
}

export class MemoryServiceDreamEngineering extends MemoryServiceRetrieval {
  recordCodeCorrection(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  }): Memory {
    return recordCodeCorrectionImpl(this, input);
  }

  recordCodeCorrectionAsync(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  }): Promise<Memory> {
    return recordCodeCorrectionAsyncImpl(this, input);
  }

  protected derivedCorrectionMemories(input: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    appId?: string;
    orgId?: string;
    projectId?: string;
    content: string;
    previousMemoryId?: string;
    previousWrongAction?: string;
    correctAction?: string;
    kind?: EngineeringMemoryKind;
    codebase?: CodebaseScope;
    source?: MemoryInput["source"];
    timestamp?: Date | string;
    evidenceIds?: string[];
  }, correction: Memory, previous?: Memory): Memory[] {
    return derivedCorrectionMemoriesImpl(this, input, correction, previous);
  }

  reflect(userId: string): DreamCycleReport {
    return reflectImpl(this, userId);
  }

  dream(userId: string): DreamCycleReport {
    return dreamImpl(this, userId);
  }

  dreamPlan(input: DreamCycleInput): DreamPlanReport {
    return dreamPlanImpl(this, input);
  }

  prepareDream(input: DreamCycleInput & { run?: boolean }): DreamPreparationReport {
    return prepareDreamImpl(this, input);
  }

  runDreamCycle(input: DreamCycleInput): DreamCycleReport {
    return runDreamCycleImpl(this, input);
  }

  async runDreamCycleAsync(
    input: DreamCycleInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)
  ): Promise<DreamCycleReport> {
    return runDreamCycleAsyncImpl(this, input, fetchImpl, timeoutMs);
  }

  async startDreamJob(
    input: DreamCycleInput,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
    options: { wait?: boolean; queueOnly?: boolean } = {}
  ): Promise<DreamJob> {
    return startDreamJobImpl(this, input, fetchImpl, timeoutMs, options);
  }

  async runDreamJobWorkerOnce(
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
    options: { now?: string } = {}
  ): Promise<DreamJob | undefined> {
    return runDreamJobWorkerOnceImpl(this, fetchImpl, timeoutMs, options);
  }

  protected async executeDreamJob(
    job: DreamJob,
    input: DreamCycleInput,
    mode: DreamCycleMode,
    trigger: DreamCycleTrigger,
    fetchImpl: typeof fetch,
    timeoutMs: number,
    options: { alreadyLeased?: boolean } = {}
  ): Promise<void> {
    if (productionDreamWorkerMode() && !options.alreadyLeased) {
      throw new Error("Production dream job execution must be claimed by the repository-backed worker before running.");
    }
    if (job.status === "cancelled") {
      this.persist();
      return;
    }
    if (!options.alreadyLeased && !this.leaseDreamJob(job)) return;
    if (options.alreadyLeased) this.dreamJobs.set(job.jobId, job);
    this.persist();
    const terminal = () => this.dreamJobs.get(job.jobId);
    const cancelled = () => terminal()?.status === "cancelled";
    const finished = (): string => {
      const finishedAt = new Date().toISOString();
      job.leaseUntil = undefined;
      job.nextRunAt = undefined;
      job.finishedAt = finishedAt;
      return finishedAt;
    };
    try {
      const report = await this.runDreamCycleAsync({ ...input, mode, trigger, connectorIds: job.plan.connectorIds, sourceRefresh: job.plan.sourceRefresh }, fetchImpl, timeoutMs);
      const finishedAt = finished();
      job.report = report;
      job.logs = [...(job.logs ?? []), { at: finishedAt, level: "info", message: "dream job completed", payload: { releaseBlockers: report.dreamCycle.plan.releaseBlockers?.length ?? 0 } }];
      job.progress = {
        connectorPolls: report.dreamCycle.connectorRefresh?.attempted ?? 0,
        connectorPollFailures: report.dreamCycle.connectorRefresh?.failed ?? 0,
        connectorPollSkipped: report.dreamCycle.connectorRefresh?.skipped ?? 0,
        memoriesEvaluated: report.lifecycle.evaluated,
        contradictions: report.contradictions.length,
        sourceRevalidations: report.dreamCycle.sourceRevalidation?.evaluated ?? 0,
        verificationScheduled: report.dreamCycle.verificationScheduled
      };
      if (!cancelled()) job.status = "done";
    } catch (error) {
      if (!cancelled()) job.status = "failed";
      const finishedAt = finished();
      job.logs = [...(job.logs ?? []), { at: finishedAt, level: "error", message: error instanceof Error ? error.message : "dream job failed" }];
      if (!cancelled()) job.error = error instanceof Error ? error.message : "dream job failed";
    }
    this.recordAudit(job.status === "failed" ? "policy.violation" : "reflect.run", { userId: input.userId, metadata: { resource: "dream-job", jobId: job.jobId, status: job.status, trigger, mode, leaseOwner: job.leaseOwner, attemptCount: job.attemptCount, progress: job.progress, error: job.error } });
    this.persist();
  }

  private leaseDreamJob(job: DreamJob): boolean {
    const current = this.dreamJobs.get(job.jobId);
    if (!current || current.status === "cancelled") return false;
    if (current.status === "running" && current.leaseUntil && new Date(current.leaseUntil).getTime() > Date.now()) return false;
    const now = new Date();
    const leaseMs = Number(process.env.MEMORY_DREAM_JOB_LEASE_MS ?? 300_000);
    const owner = process.env.MEMORY_DREAM_WORKER_ID ?? `pid-${process.pid}`;
    job.status = "running";
    job.startedAt = now.toISOString();
    job.leaseOwner = owner;
    job.leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
    job.attemptCount = (job.attemptCount ?? 0) + 1;
    job.nextRunAt = undefined;
    job.logs = [...(job.logs ?? []), { at: job.startedAt, level: "info", message: "dream job leased", payload: { leaseOwner: owner, leaseUntil: job.leaseUntil, attemptCount: job.attemptCount } }];
    current.status = job.status;
    current.startedAt = job.startedAt;
    current.leaseOwner = job.leaseOwner;
    current.leaseUntil = job.leaseUntil;
    current.attemptCount = job.attemptCount;
    current.nextRunAt = job.nextRunAt;
    current.logs = job.logs;
    return true;
  }

  dreamJobStatus(jobId?: string): DreamJob[] {
    return dreamJobStatusImpl(this, jobId);
  }

  cancelDreamJob(jobId: string, reason?: string): DreamJob {
    const job = this.dreamJobs.get(jobId);
    if (!job) throw new Error(`Dream job not found: ${jobId}`);
    if (job.status === "done" || job.status === "failed" || job.status === "cancelled") return job;
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    job.error = reason ?? "cancelled by operator";
    this.recordAudit("reflect.run", { userId: job.userId, metadata: { resource: "dream-job", jobId, status: job.status, reason: job.error } });
    this.persist();
    return job;
  }

  async cancelDreamJobAsync(jobId: string, reason?: string): Promise<DreamJob> {
    const job = this.cancelDreamJob(jobId, reason);
    const repository = (this as any).productionAsyncRepository?.dreamJobRepository;
    if (repository?.completeJob && job.status === "cancelled") {
      const persisted = await repository.completeJob(jobId, cloneDreamJob(job));
      this.dreamJobs.set(jobId, cloneDreamJob(persisted));
      return persisted;
    }
    return job;
  }

  async retryDreamJob(
    jobId: string,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000),
    options: { wait?: boolean } = {}
  ): Promise<DreamJob> {
    const job = this.dreamJobs.get(jobId);
    if (!job) throw new Error(`Dream job not found: ${jobId}`);
    if (job.status !== "failed" && job.status !== "cancelled") throw new Error(`Dream job ${jobId} is not retryable from status ${job.status}`);
    job.status = "retrying";
    job.nextRunAt = new Date().toISOString();
    job.leaseUntil = undefined;
    job.logs = [...(job.logs ?? []), { at: new Date().toISOString(), level: "info", message: "dream job retry queued" }];
    const input = { ...(job.input ?? { userId: job.userId }), trigger: job.trigger, mode: job.mode, budget: job.plan.budget, sourceRefresh: job.plan.sourceRefresh, connectorIds: job.plan.connectorIds };
    const repository = (this as any).productionAsyncRepository?.dreamJobRepository;
    if (repository?.retryJob) {
      const retry = await repository.retryJob(jobId, cloneDreamJob(job));
      this.dreamJobs.set(retry.jobId, cloneDreamJob(retry));
      const result = options.wait ? await this.runDreamJobWorkerOnce(fetchImpl, timeoutMs) : retry;
      const finalJob = result ?? retry;
      this.recordAudit("reflect.run", { userId: job.userId, metadata: { resource: "dream-job", jobId: finalJob.jobId, retryOf: jobId, status: finalJob.status, repositoryBacked: true } });
      this.persist();
      return finalJob;
    }
    const retry = await this.startDreamJob(input, fetchImpl, timeoutMs, options);
    retry.retryOf = jobId;
    this.recordAudit("reflect.run", { userId: job.userId, metadata: { resource: "dream-job", jobId: retry.jobId, retryOf: jobId, status: retry.status } });
    this.persist();
    return retry;
  }

  protected async refreshDreamSources(
    input: DreamCycleInput,
    plan: DreamPlanReport,
    fetchImpl: typeof fetch,
    timeoutMs: number
  ): Promise<DreamConnectorRefreshReport> {
    const selected = this.selectDreamConnectors(input, plan);
    const report: DreamConnectorRefreshReport = {
      generatedAt: new Date().toISOString(),
      attempted: 0,
      applied: 0,
      failed: 0,
      skipped: 0,
      records: [],
      skippedConnectors: []
    };
    for (const connectorId of selected) {
      const manifest = this.connectorManifests.get(connectorId);
      const skipReason = this.connectorDreamRefreshSkipReason(manifest);
      if (skipReason) {
        report.skipped += 1;
        report.skippedConnectors.push({ connectorId, reason: skipReason });
        continue;
      }
      report.attempted += 1;
      const record = await this.pollConnector(connectorId, {
        userId: input.userId,
        sessionId: input.scope?.sessionId,
        orgId: input.scope?.orgId,
        projectId: input.scope?.projectId
      }, fetchImpl, timeoutMs);
      if (record.status === "applied") report.applied += 1;
      if (record.status === "failed") report.failed += 1;
      report.records.push({
        connectorId,
        recordId: record.id,
        status: record.status,
        memoryIds: record.memoryIds,
        externalIds: record.externalIds,
        error: record.error,
        responseStatusCode: record.responseStatusCode
      });
    }
    return report;
  }

  protected selectDreamConnectors(input: DreamCycleInput, plan: DreamPlanReport): string[] {
    const selected = new Set<string>([
      ...(input.connectorIds ?? []),
      ...plan.connectorIds,
      ...(input.scope?.connectorId ? [input.scope.connectorId] : [])
    ].filter(Boolean));
    if (!selected.size && (plan.budget === "deep" || plan.budget === "release")) {
      for (const manifest of this.connectorManifests.values()) {
        if (manifest.capabilities.includes("poll") && manifest.poll?.endpoint) selected.add(manifest.id);
      }
    }
    return [...selected].sort();
  }

  protected connectorDreamRefreshSkipReason(manifest?: ConnectorManifest): string | undefined {
    if (!manifest) return "connector_manifest_missing";
    if (manifest.privacyPolicy === "never_store") return "privacy_policy_never_store";
    if (!manifest.capabilities.includes("poll")) return "poll_not_supported";
    if (!manifest.poll?.endpoint) return "poll_endpoint_missing";
    if (manifest.auth === "oauth") {
      const authorized = [...this.connectorAuthSessions.values()].some((session) => {
        if (session.connectorId !== manifest.id || session.status !== "authorized") return false;
        return !session.expiresAt || new Date(session.expiresAt).getTime() > Date.now();
      });
      if (!authorized && !shouldUseExternalVendor(manifest, manifest.poll.endpoint)) return "connector_not_authorized";
    }
    return undefined;
  }
}
