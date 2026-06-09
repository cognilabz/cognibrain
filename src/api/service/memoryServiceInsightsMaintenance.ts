import { MemoryServiceGovernanceOps } from './memoryServiceGovernanceOps';
import { productionDreamWorkerMode } from './dreamRuntime';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryAsyncImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryAsyncImpl, retractMemoryImpl, revalidateMemoryImpl, revertMemoryAsyncImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentAsyncImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceInsightsMaintenance extends MemoryServiceGovernanceOps {
  metricsReport(): MetricsReport {
    return metricsReportImpl(this);
  }

  addTrainingSample(sample: RetrievalTrainingSample): RetrievalTrainingSample {
    return addTrainingSampleImpl(this, sample);
  }

  setRetrievalProfile(profile: Omit<RetrievalProfile, "updatedAt" | "weights"> & { weights: Partial<RetrievalWeights>; updatedAt?: string }): RetrievalProfile {
    return setRetrievalProfileImpl(this, profile);
  }

  getRetrievalProfiles(): RetrievalProfile[] {
    return getRetrievalProfilesImpl(this);
  }

  learnRetrievalProfile(id = "learned", label = "Learned feedback profile", options: { scope?: RetrievalProfile["scope"] } = {}): LearnedProfileReport {
    return learnRetrievalProfileImpl(this, id, label, options);
  }

  linkIdentity(primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    return linkIdentityImpl(this, primaryUserId, linkedUserId, consentToken, consent);
  }

  unlinkIdentity(id: string): IdentityLink {
    return unlinkIdentityImpl(this, id);
  }

  timeline(userId: string): TimelineReport {
    return timelineImpl(this, userId);
  }

  summarizeTimeline(
    userId: string,
    options: { granularity?: TimelineSummaryReport["granularity"]; persist?: boolean; style?: "concise" | "descriptive" | "narrative" } = {}
  ): TimelineSummaryReport {
    return summarizeTimelineImpl(this, userId, options);
  }

  temporalQuery(userId: string, options: { after?: Date | string; before?: Date | string } = {}): TemporalQueryReport {
    return temporalQueryImpl(this, userId, options);
  }

  behavioralPatterns(userId: string): BehavioralPatternReport {
    return behavioralPatternsImpl(this, userId);
  }

  adaptiveDreamPolicy(userId: string): AdaptiveDreamPolicyReport {
    return adaptiveDreamPolicyImpl(this, userId);
  }

  generateObservations(userId: string, options: { style?: ObservationReport["style"]; persist?: boolean; limit?: number } = {}): ObservationReport {
    return generateObservationsImpl(this, userId, options);
  }

  predictionReport(userId: string, options: { query?: string; limit?: number } = {}): PredictionReport {
    return predictionReportImpl(this, userId, options);
  }

  graph(userId?: string): GraphReport {
    return graphImpl(this, userId);
  }

  entityCatalog(userId?: string): { entities: EntityRecord[]; mergeSuggestions: EntityMergeSuggestion[]; enrichmentCandidates: EnrichmentCandidate[] } {
    return entityCatalogImpl(this, userId);
  }

  runEntityEnrichment(input: { userId: string; entity: string; approveExternal?: boolean; sourceUri?: string }) {
    return runEntityEnrichmentImpl(this, input);
  }

  mergeEntity(canonical: string, aliases: string[], userId?: string): EntityRecord {
    return mergeEntityImpl(this, canonical, aliases, userId);
  }

  splitEntity(canonical: string, aliases: string[], userId?: string): EntityRecord | undefined {
    return splitEntityImpl(this, canonical, aliases, userId);
  }

  lifecyclePreview(userId: string, policy?: Partial<LifecyclePolicy>) {
    return lifecyclePreviewImpl(this, userId, policy);
  }

  runDomainEvaluation(domain = this.domainModule): DomainEvaluationReport {
    return runDomainEvaluationImpl(this, domain);
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
    for (const [userId, status] of Object.entries(this.maintenance.users)) {
      if (status.writesSinceDream <= 0) continue;
      if (!this.isDreamDue(userId, now)) continue;
      this.runAutoDream(userId);
      dreamed.push(userId);
    }
    return dreamed;
  }

  async runDueDreamJobsAsync(now = new Date()): Promise<string[]> {
    if (!this.autoDream.enabled) return [];
    const dreamed: string[] = [];
    for (const [userId, status] of Object.entries(this.maintenance.users)) {
      if (status.writesSinceDream <= 0) continue;
      if (!this.isDreamDue(userId, now)) continue;
      await this.queueAutoDreamJob(userId);
      dreamed.push(userId);
    }
    return dreamed;
  }

  protected afterWrite(userId: string): void {
    const status = this.userMaintenance(userId);
    status.writesSinceDream += 1;
    if (this.autoDream.enabled && this.isDreamDue(userId)) {
      if (productionDreamWorkerMode()) {
        void this.queueAutoDreamJob(userId).catch((error) => {
          this.recordAudit("policy.violation", {
            userId,
            metadata: {
              resource: "auto-dream-job",
              status: "queue_failed",
              error: error instanceof Error ? error.message : "auto dream queue failed"
            }
          });
          this.persist();
        });
      } else {
        this.runAutoDream(userId);
      }
    }
    this.persist();
  }

  protected async queueAutoDreamJob(userId: string): Promise<void> {
    if (this.dreaming) return;
    this.dreaming = true;
    try {
      await this.startDreamJob({
        userId,
        mode: "dream",
        trigger: this.autoDreamTrigger(userId)
      }, fetch, undefined, { queueOnly: true });
    } finally {
      this.dreaming = false;
    }
  }

  protected runAutoDream(userId: string): void {
    if (this.dreaming) return;
    this.dreaming = true;
    try {
      this.runDreamCycle({
        userId,
        mode: "dream",
        trigger: this.autoDreamTrigger(userId)
      });
    } finally {
      this.dreaming = false;
    }
  }

  protected recordDream(qualityScore: number, contradictions: number, actions: string[] = []): void {
    this.metrics.dreams += 1;
    this.metrics.contradictionsResolved += contradictions;
    this.metrics.averageQualityScore = rollingAverage(this.metrics.averageQualityScore, qualityScore, this.metrics.dreams);
    this.metrics.dreamActions ??= {};
    for (const action of actions) {
      const key = action.split(" ").slice(0, 2).join(" ");
      this.metrics.dreamActions[key] = (this.metrics.dreamActions[key] ?? 0) + 1;
    }
  }

  protected recordSessionMetrics(options: SearchOptions, resultCount: number): void {
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

  protected profileFor(options: SearchOptions): RetrievalProfile | undefined {
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

  protected isDreamDue(userId: string, now = new Date()): boolean {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return true;
    if (!status.lastDreamAt) return false;
    const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
    return ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0;
  }

  protected autoDreamTrigger(userId: string, now = new Date()): DreamCycleTrigger {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return "auto_write_threshold";
    if (status.lastDreamAt) {
      const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
      if (ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0) return "auto_interval";
    }
    return "auto_interval";
  }

  protected markDreamed(userId: string): void {
    const status = this.userMaintenance(userId);
    status.lastDreamAt = new Date().toISOString();
    status.writesSinceDream = 0;
  }

  protected userMaintenance(userId: string): { lastDreamAt?: string; writesSinceDream: number } {
    this.maintenance.users[userId] ??= { writesSinceDream: 0 };
    return this.maintenance.users[userId];
  }

  protected memoryMatchesDreamScope(memory: Memory, scope?: DreamCycleInput["scope"]): boolean {
    if (!scope) return true;
    if (scope.sessionId && memory.sessionId !== scope.sessionId) return false;
    if (scope.projectId && memory.projectId !== scope.projectId) return false;
    if (scope.orgId && memory.orgId !== scope.orgId) return false;
    if (scope.connectorId && memory.provenance.sourceRef?.connectorId !== scope.connectorId) return false;
    if (scope.repo) {
      const engineering = getEngineeringMetadata(memory);
      const repo = engineering?.codebase?.repo ?? engineering?.codebase?.repository ?? memory.projectId;
      if (repo !== scope.repo) return false;
    }
    if (scope.branch) {
      const branch = getEngineeringMetadata(memory)?.codebase?.branch ?? String(memory.metadata.branch ?? "");
      if (branch !== scope.branch) return false;
    }
    return true;
  }

  protected ensureScopedAccess(input: MemoryInput): void {
    if (input.sourceId) {
      const source = this.sources.get(input.sourceId);
      if (!source) throw new Error(`Source not found: ${input.sourceId}`);
      if (input.brainId && source.brainId !== input.brainId) throw new Error(`Source ${input.sourceId} is not part of brain ${input.brainId}`);
    }
    if (input.brainId) {
      const brain = this.brains.get(input.brainId);
      if (!brain) throw new Error(`Brain not found: ${input.brainId}`);
      const member = brain.ownerUserId === input.userId || brain.memberUserIds?.includes(input.userId);
      const agentAllowed = Boolean(input.agentId && (brain.allowedAgentIds?.includes(input.agentId) || this.agents.get(input.agentId)?.permissions.includes("admin")));
      if (!member && !agentAllowed && brain.visibility !== "public") throw new Error(`User ${input.userId} cannot write to brain ${input.brainId}`);
    }
    if (input.agentId) {
      const agent = this.agents.get(input.agentId);
      if (agent && input.brainId && !agent.brainIds.includes(input.brainId) && !agent.permissions.includes("admin")) {
        throw new Error(`Agent ${input.agentId} cannot write to brain ${input.brainId}`);
      }
    }
  }

  protected accessibleBrainIds(options: SearchOptions): string[] {
    const agent = options.agentId ? this.agents.get(options.agentId) : undefined;
    return [...this.brains.values()]
      .filter((brain) => {
        if (brain.ownerUserId === options.userId || brain.memberUserIds?.includes(options.userId)) return true;
        if (agent?.brainIds.includes(brain.id)) return true;
        if (options.agentId && brain.allowedAgentIds?.includes(options.agentId)) return true;
        if (brain.visibility === "org") return Boolean(options.orgId && brain.orgId === options.orgId);
        return brain.visibility === "public";
      })
      .map((brain) => brain.id);
  }

  protected canReviewSharedMemory(memory: Memory, reviewerId: string, orgId: string): boolean {
    if (reviewerId === memory.userId) return true;
    const brain = memory.brainId ? this.brains.get(memory.brainId) : undefined;
    if (brain?.ownerUserId === reviewerId) return true;
    if (brain?.orgId && brain.orgId !== orgId) return false;
    const agent = this.agents.get(reviewerId);
    if (!agent) return false;
    if (agent.permissions.includes("admin")) return true;
    if (!agent.permissions.includes("share")) return false;
    if (memory.brainId && !agent.brainIds.includes(memory.brainId) && !brain?.allowedAgentIds?.includes(agent.id)) return false;
    return !brain?.orgId || brain.orgId === orgId;
  }

  protected personaForAgent(agentId: string): PersonaProfile | undefined {
    const agent = this.agents.get(agentId);
    return agent?.personaId ? this.personas.get(agent.personaId) : undefined;
  }

  protected expandSearchQuery(options: SearchOptions): string[] | undefined {
    const explicit = options.queryExpansions ?? [];
    if (!options.expandQuery) return explicit.length ? explicit : undefined;
    const provider = this.defaultQueryExpander?.expand({
      query: options.query,
      userId: options.userId,
      now: options.now ?? new Date(),
      memories: this.store.list(options.userId).slice(0, 50)
    }) ?? [];
    const deterministic = deterministicQueryExpansions(options.query);
    const expansions = [...new Set([...explicit, ...provider, ...deterministic].map((item) => item.trim()).filter(Boolean))].filter((item) => item.toLowerCase() !== options.query.toLowerCase());
    return expansions.slice(0, 10);
  }

  protected restoreMemorySnapshot(snapshot: Memory): Memory {
    const restored = {
      ...snapshot,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(),
      lastAccessedAt: snapshot.lastAccessedAt ? new Date(snapshot.lastAccessedAt) : undefined,
      archivedAt: snapshot.archivedAt ? new Date(snapshot.archivedAt) : undefined
    };
    this.store.import([restored]);
    const memory = this.store.get(restored.id);
    this.entities.ingest(memory);
    return memory;
  }

protected applyOfflineOperation(operation: OfflineOperation): OfflineOperation {
    try {
      if (operation.type === "add") {
        if (!operation.input) return { ...operation, status: "failed", reason: "add operation requires input" };
        const memory = this.add({ ...operation.input, userId: operation.input.userId ?? operation.userId });
        return { ...operation, status: "applied", appliedMemoryId: memory.id, conflictResolution: "add_only" };
      }
      if (!operation.memoryId) return { ...operation, status: "failed", reason: `${operation.type} operation requires memoryId` };
      const current = safeGet(this.store, operation.memoryId);
      if (!current) return { ...operation, status: "conflict", conflictResolution: "manual_review", reason: "target memory was not found" };
      const occurredAt = new Date(operation.occurredAt).getTime();
      if (new Date(current.updatedAt).getTime() > occurredAt && operation.type !== "delete") {
        return { ...operation, status: "conflict", conflictResolution: "manual_review", reason: "server memory changed after offline operation" };
      }
      if (operation.type === "update") {
        this.update(operation.memoryId, operation.patch ?? {});
        return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "last_write_wins" };
      }
      if (operation.type === "consent") {
        this.updateConsent(operation.memoryId, operation.consent ?? {});
        return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "last_write_wins" };
      }
      this.delete(operation.memoryId);
      return { ...operation, status: "applied", appliedMemoryId: operation.memoryId, conflictResolution: "delete_wins" };
    } catch (error) {
      return { ...operation, status: "failed", reason: error instanceof Error ? error.message : "unknown sync failure" };
    }
  }
}
