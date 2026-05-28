import { MemoryServiceStore } from './memoryServiceStore';
import { AppendOnlyLogPersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresMemoryRepository, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SOURCE_QUALITY, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, claimStateForMemory, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compactLiveSourceContent, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentDigest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createRepositoryFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, defaultSourceResolverDecision, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, liveSourceVersion, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, memoryStoreForRepository, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeComparableUrl, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, repositoryFromStorage, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefMatchesVendorItem, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, stringFromCandidate, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticEventForMemory, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceDeps';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration, ConnectorListResult, ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

export class MemoryServiceTruth extends MemoryServiceStore {
  registerMemoryClaim(memory: Memory): ClaimRecord | undefined {
    const rawClaim = memory.metadata?.claim as MemoryClaim | undefined;
    const claim = rawClaim ?? extractClaim(memory.content, syntheticEventForMemory(memory), memory.scope, memory.source, memory.entities);
    if (!claim.subject || !claim.predicate || !claim.object) return undefined;
    const now = new Date().toISOString();
    const existing = [...this.claims.values()].find((item) => item.sourceMemoryId === memory.id);
    const record: ClaimRecord = {
      id: existing?.id ?? `claim_${contentDigest(`${memory.id}:${claim.subject}:${claim.predicate}:${claim.object}`).slice(0, 16)}`,
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      qualifiers: claim.qualifiers ?? {},
      sourceMemoryId: memory.id,
      sourceRef: memory.provenance.sourceRef,
      validFrom: memory.temporal.validFrom ?? memory.createdAt,
      validUntil: memory.temporal.validUntil,
      confidence: claim.confidence,
      trust: memory.trust,
      state: claimStateForMemory(memory),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.claims.set(record.id, record);
    this.rebuildConflictSetFor(record.subject, record.predicate);
    return record;
  }

  currentTruthForMemory(memory: Memory): CurrentTruthDecision | undefined {
    const claim = [...this.claims.values()].find((item) => item.sourceMemoryId === memory.id) ?? this.registerMemoryClaim(memory);
    if (!claim) return undefined;
    return this.currentTruthForClaim(claim);
  }

  currentTruthForClaim(claim: ClaimRecord): CurrentTruthDecision {
    const candidates = [...this.claims.values()]
      .filter((item) => item.subject === claim.subject && item.predicate === claim.predicate)
      .filter((item) => item.state !== "retracted");
    if (!candidates.length) {
      return { subject: claim.subject, predicate: claim.predicate, state: "missing", reason: "no claim candidates available", suppressedClaimIds: [] };
    }
    const scored = candidates
      .map((item) => ({ claim: item, score: this.truthScore(item) }))
      .sort((a, b) => b.score - a.score);
    const selected = scored[0];
    const runnerUp = scored[1];
    const conflict = this.conflictSetFor(claim.subject, claim.predicate);
    const uncertain = Boolean(runnerUp && runnerUp.claim.object !== selected.claim.object && selected.score - runnerUp.score < 0.05);
    if (uncertain) {
      return {
        subject: claim.subject,
        predicate: claim.predicate,
        selectedClaimId: selected.claim.id,
        selectedMemoryId: selected.claim.sourceMemoryId,
        state: "uncertain",
        reason: `conflicting claims are too close to auto-resolve (${selected.score.toFixed(3)} vs ${runnerUp?.score.toFixed(3)})`,
        suppressedClaimIds: scored.slice(1).map((item) => item.claim.id),
        conflictSetId: conflict?.id,
        scoreBreakdown: { selected: selected.score, runnerUp: runnerUp?.score ?? 0 }
      };
    }
    const sourceReason = `selected by source quality ${this.sourceQualityForClaim(selected.claim).toFixed(2)}, trust ${selected.claim.trust.toFixed(2)}, confidence ${selected.claim.confidence.toFixed(2)}`;
    return {
      subject: claim.subject,
      predicate: claim.predicate,
      selectedClaimId: selected.claim.id,
      selectedMemoryId: selected.claim.sourceMemoryId,
      state: "selected",
      reason: runnerUp && runnerUp.claim.object !== selected.claim.object
        ? `${sourceReason}; suppressed conflicting claim ${runnerUp.claim.id}`
        : sourceReason,
      suppressedClaimIds: scored.slice(1).map((item) => item.claim.id),
      conflictSetId: conflict?.id,
      scoreBreakdown: { selected: selected.score, runnerUp: runnerUp?.score ?? 0 }
    };
  }

  listConflictSets(status?: ConflictSet["status"]): ConflictSet[] {
    return [...this.conflictSets.values()]
      .filter((conflictSet) => !status || conflictSet.status === status)
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  resolveConflictSet(
    conflictSetId: string,
    input: { selectedClaimId: string; reason: string; resolvedBy?: "system" | "operator" | "source_revalidation" }
  ): ConflictSet {
    const conflictSet = this.conflictSets.get(conflictSetId);
    if (!conflictSet) throw new Error(`Conflict set not found: ${conflictSetId}`);
    if (!conflictSet.claimIds.includes(input.selectedClaimId)) throw new Error(`Claim ${input.selectedClaimId} is not part of conflict set ${conflictSetId}`);
    const selected = this.claims.get(input.selectedClaimId);
    if (!selected) throw new Error(`Claim not found: ${input.selectedClaimId}`);
    const now = new Date().toISOString();
    for (const claimId of conflictSet.claimIds) {
      const claim = this.claims.get(claimId);
      if (!claim) continue;
      const state = claim.id === selected.id ? "active" : "contradicted";
      this.claims.set(claim.id, { ...claim, state, updatedAt: now });
      const memory = safeGet(this.store, claim.sourceMemoryId);
      if (memory && memory.beliefState !== "retracted" && memory.beliefState !== "archived") {
        this.storage.update(memory.id, {
          beliefState: state === "active" ? "active" : "contradicted",
          metadata: {
            ...memory.metadata,
            conflictSetId,
            truthResolutionReason: input.reason,
            ...(state === "active" ? { selectedTruthClaimId: selected.id } : { suppressedByTruthClaimId: selected.id })
          }
        });
      }
    }
    const resolved: ConflictSet = {
      ...conflictSet,
      status: "resolved",
      resolution: {
        selectedClaimId: selected.id,
        reason: input.reason,
        resolvedBy: input.resolvedBy ?? "operator",
        resolvedAt: now
      }
    };
    this.conflictSets.set(conflictSetId, resolved);
    this.recordAudit("memory.update", { userId: safeGet(this.store, selected.sourceMemoryId)?.userId ?? "system", memoryId: selected.sourceMemoryId, metadata: { resource: "conflict-set", conflictSetId, selectedClaimId: selected.id, reason: input.reason } });
    this.persist();
    return resolved;
  }

  listConnectorReviewQueue(options: { connectorId?: string; userId?: string; status?: "pending" | "approved" | "rejected" } = {}): Memory[] {
    return this.store.list(options.userId)
      .filter((memory) => {
        const queue = memory.metadata?.reviewQueue as { status?: string; connectorId?: string } | undefined;
        if (!queue) return false;
        if (options.connectorId && queue.connectorId !== options.connectorId) return false;
        return (options.status ?? "pending") === queue.status;
      });
  }

  reviewConnectorMemory(
    memoryId: string,
    input: { decision: "approve" | "reject"; reviewerId?: string; reason?: string }
  ): Memory {
    const memory = this.store.get(memoryId);
    const queue = memory.metadata?.reviewQueue as { status?: string; connectorId?: string; reason?: string } | undefined;
    if (!queue) throw new Error(`Memory ${memoryId} is not in the connector review queue`);
    const status = input.decision === "approve" ? "approved" : "rejected";
    const reviewedAt = new Date().toISOString();
    const updated = this.update(memoryId, {
      beliefState: input.decision === "approve" ? "active" : "retracted",
      trust: input.decision === "approve" ? Math.max(memory.trust, 0.82) : 0,
      temporal: input.decision === "approve" ? { ...memory.temporal, lastConfirmedAt: reviewedAt } : memory.temporal,
      metadata: {
        ...memory.metadata,
        reviewQueue: {
          ...queue,
          status,
          reviewedAt,
          reviewerId: input.reviewerId,
          decisionReason: input.reason
        }
      }
    });
    this.recordAudit("memory.update", { userId: updated.userId, memoryId, metadata: { resource: "connector-review-queue", connectorId: queue.connectorId, decision: input.decision, reviewerId: input.reviewerId, reason: input.reason } });
    return updated;
  }

  protected truthScore(claim: ClaimRecord): number {
    const sourceQuality = this.sourceQualityForClaim(claim);
    const validUntilPenalty = claim.validUntil && new Date(claim.validUntil).getTime() < Date.now() ? 0.25 : 0;
    const statePenalty = claim.state === "needs_verification" ? 0.1 : claim.state === "contradicted" ? 0.2 : claim.state === "superseded" ? 0.35 : 0;
    const recency = Math.max(0, Math.min(1, 1 - ((Date.now() - new Date(claim.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 365))));
    return Math.max(0, claim.trust * 0.4 + claim.confidence * 0.25 + sourceQuality * 0.25 + recency * 0.1 - statePenalty - validUntilPenalty);
  }

  protected sourceQualityForClaim(claim: ClaimRecord): number {
    const memory = safeGet(this.store, claim.sourceMemoryId);
    if (!memory) return 0.35;
    if (memory.metadata?.engineeringKind === "review_correction") return 0.95;
    if (memory.metadata?.engineeringKind === "tool_outcome") return 0.9;
    if (memory.metadata?.engineeringKind === "architecture_decision") return 0.88;
    if (memory.provenance.sourceRef?.connectorId === "jira") return 0.78;
    if (memory.provenance.sourceRef?.connectorId === "slack") return 0.72;
    return this.sourceQuality[memory.source.kind] ?? 0.5;
  }

  protected rebuildConflictSetFor(subject: string, predicate: string): ConflictSet | undefined {
    const candidates = [...this.claims.values()].filter((claim) => claim.subject === subject && claim.predicate === predicate && claim.state !== "retracted");
    const objects = new Set(candidates.map((claim) => claim.object));
    const existing = this.conflictSetFor(subject, predicate);
    if (objects.size <= 1) {
      if (existing && existing.status === "open") this.conflictSets.set(existing.id, { ...existing, status: "resolved", resolution: { selectedClaimId: candidates[0]?.id ?? "", reason: "claims converged to one object", resolvedBy: "system", resolvedAt: new Date().toISOString() } });
      return existing;
    }
    const id = existing?.id ?? `conflict_${contentDigest(`${subject}:${predicate}`).slice(0, 16)}`;
    const next: ConflictSet = {
      id,
      claimIds: candidates.map((claim) => claim.id),
      detectedAt: existing?.detectedAt ?? new Date().toISOString(),
      status: existing?.status === "resolved" ? "operator_review" : existing?.status ?? "open",
      resolution: existing?.status === "resolved" ? existing.resolution : undefined
    };
    this.conflictSets.set(id, next);
    return next;
  }

  protected conflictSetFor(subject: string, predicate: string): ConflictSet | undefined {
    return [...this.conflictSets.values()].find((set) => set.id === `conflict_${contentDigest(`${subject}:${predicate}`).slice(0, 16)}` || set.claimIds.some((id) => {
      const claim = this.claims.get(id);
      return claim?.subject === subject && claim.predicate === predicate;
    }));
  }

  protected applySupersession(memory: Memory): void {
    const supersedes = memory.relations.filter((relation) => relation.type === "supersedes" && relation.targetId);
    if (!supersedes.length) return;
    const validUntil = new Date(memory.temporal.validFrom ?? memory.createdAt).toISOString();
    for (const relation of supersedes) {
      const target = safeGet(this.store, relation.targetId!);
      if (!target || target.beliefState === "retracted") continue;
      const updated = this.store.update(target.id, {
        beliefState: "superseded",
        temporal: {
          ...target.temporal,
          validUntil,
          supersededAt: validUntil
        },
        metadata: {
          ...target.metadata,
          supersededBy: memory.id,
          supersessionReason: `Superseded by ${memory.id}`
        }
      });
      this.registerMemoryClaim(updated);
      this.recordAudit("memory.update", { userId: updated.userId, brainId: updated.brainId, sourceId: updated.sourceId, memoryId: updated.id, metadata: { action: "superseded", supersededBy: memory.id } });
    }
  }
}
