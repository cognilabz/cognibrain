export * from './memoryServiceImports';
import { AppendOnlyLogPersistenceAdapter, AsyncPostgresMemoryRepository, CassandraCompatiblePersistenceAdapter, CassandraRemotePersistenceAdapter, DOMAIN_MODULES, EntityRegistry, IdentityResolver, InMemoryMemoryRepository, InMemoryStorageAdapter, JsonFilePersistenceAdapter, MemoryStore, PostgresCompatiblePersistenceAdapter, PostgresMemoryRepository, PostgresRemotePersistenceAdapter, ReflectionEngine, RepositoryBackedStorageAdapter, RetrievalEngine, SQLiteMemoryRepository, SQLitePersistenceAdapter, activateGraph, adaptiveDreamPolicyImpl, addImpl, addTrainingSampleImpl, apiDescriptionImpl, applyMemoryJournalEvent, applyRedactionPolicy, archiveImpl, assignAgentPersonaImpl, auditChainImpl, auditEventForHash, auditTrailImpl, averagePathTrust, averageRating, baseSignalTemplate, beginConnectorOAuthImpl, behavioralPatternsImpl, budgetForTrigger, buildApiDescription, buildCodingContextPackFromResults, buildEnrichedContext, buildPatchEvidenceTrail, buildQueryPlan, canDeleteImpl, canPromoteImpl, canReadImpl, canUseInContextImpl, canWriteImpl, canonicalAuditJournalType, citationFor, clamp01, clampRating, classifyDurability, classifyQueryIntentImpl, codingActionOverlap, codingContextPackImpl, compactContextItemText, compareVersions, completeConnectorOAuthImpl, complianceReportImpl, confirmMemoryImpl, connectorAdapterRequest, connectorAuthStatusImpl, connectorEventTags, connectorEventVisibility, connectorHealthImpl, connectorReviewRequired, connectorSyncStateImpl, connectorWritebackOperations, connectorWritebackPayload, connectorWritebackRequest, contentHash, contextConnectorPlan, contextEvidenceForItem, createBrainImpl, createEpisodeImpl, createHash, createHmac, createJsonCommandIntelligenceFromEnv, createManagedTenantImpl, createPersistenceFromEnv, createSourceImpl, csv, decryptMemoryContent, dedupeExternalEvidence, dedupeMemories, deleteImpl, deleteSourceImpl, deleteUserImpl, deliverWebhookQueueHttpImpl, deliverWebhookQueueImpl, deploymentModeFromEnv, derivedCorrectionMemoriesImpl, detectContextReferences, deterministicLaplaceNoise, deterministicObservation, deterministicQueryExpansions, deterministicTimelineSummary, deterministicTranslate, dot, dreamImpl, dreamInputForHarnessEvent, dreamJobStatusImpl, dreamPlanImpl, enforceRetentionImpl, engineeringQueryWeights, enrichContextImpl, enrichmentCandidatesFor, entityCatalogImpl, evaluateForbiddenAction, evaluatePolicyImpl, eventFeedImpl, evidenceDate, evidencePackImpl, exportMemoryGraph, exportUserImpl, extractAddOnlyMemories, extractClaim, extractImpl, extractionConfidence, federatedSearchImpl, feedbackDelta, feedbackImpl, findGraphPaths, firstString, generateObservationsImpl, getCodingContextPackImpl, getEngineeringMetadata, getEpisodeImpl, getEvidencePackImpl, getImpl, getRetrievalProfilesImpl, graphActivationImpl, graphExplainImpl, graphExportImpl, graphImpl, graphPathsImpl, graphQueryImpl, groupedPeriods, guardActionImpl, hasLocalMediaExtraction, healthReport, importMigrationBundleImpl, inferCorrectActionFromCorrection, inferCorrectionKind, inferForbiddenActionFromCorrection, inferGraphRelations, inferProcedureTriggers, ingestMediaImpl, installMarketplaceModuleByIdImpl, installMarketplaceModuleImpl, interpolateConnectorEndpoint, intervalOverlaps, isoDay, isoHour, isoMonth, isoWeek, keyProviderReportImpl, learnRetrievalProfileImpl, learnedRuleSuggestions, lifecyclePreviewImpl, linkIdentityImpl, linkStateChange, listAgentsImpl, listBrainsImpl, listConnectorItemsImpl, listConnectorManifestsImpl, listConnectorSyncRecordsImpl, listEpisodesImpl, listExternalVendorItems, listImpl, listManagedTenantsImpl, listMarketplaceModulesImpl, listMarketplaceSubmissionsImpl, listMemoriesImpl, listPersonasImpl, listPolicyRulesImpl, listRetentionRulesImpl, listSourcesImpl, loadRuntimeConfig, managedControlPlaneReportImpl, managedDeploymentPlanImpl, managedMigrationBundleImpl, markExtractionStage, marketplaceInstallPlanImpl, marketplaceRisks, memoryMatchesProfileScope, mergeEntityImpl, metricsReportImpl, mineRecurringPatterns, mineRecurringSequences, modeForTrigger, newestPathTime, normalizeActionPhrase, normalizeLifecyclePolicy, normalizeMediaExtractionEvent, normalizeRetrievalWeights, normalizeUrl, observationClusters, officialConnectorManifests, officialMarketplaceModules, parseReferenceUrl, patchEvidenceTrailImpl, policyRuleMatches, pollConnectorImpl, predictionReportImpl, prepareDreamImpl, privacyComputeTokens, privacyInsightsImpl, privacyPreservingCrossBrainComputeImpl, productionPolicyMode, profileLoss, promoteSharedMemoryImpl, providerFromEnv, providerStatusImpl, publishMarketplaceSubmissionImpl, queryMemoryGraph, queueOfflineOperationImpl, rankContextItems, rateMarketplaceModuleImpl, recordCodeCorrectionImpl, recordConnectorFeedbackImpl, recordConnectorTelemetryImpl, recordHarnessActionImpl, recordHarnessLifecycleEventImpl, recordInjectionFeedbackImpl, redactionModeFromEnv, referenceMatchesItem, reflectImpl, refreshConnectorOAuthImpl, registerAgentImpl, registerConnectorManifestImpl, registerWebhookImpl, replayAuditStateImpl, repoPolicyFromCorrection, requestSharedMemoryImpl, resolveVerificationQueueImpl, retentionReviewImpl, retentionRuleMatches, retractMemoryImpl, revalidateMemoryImpl, revertMemoryImpl, reviewMarketplaceSubmissionImpl, reviewSharedMemoryImpl, revokeConnectorAuthImpl, revokeSharedMemoryImpl, rollingAverage, rotateEncryptionKeyMetadataImpl, roundMetric, routeMemoryImpl, ruleExtractionFailures, runDomainEvaluation, runDomainEvaluationImpl, runDreamCycleAsyncImpl, runDreamCycleImpl, runEntityEnrichmentImpl, runInferenceImpl, safeGet, sampleMatchesProfileScope, scanMarketplaceSubmissionImpl, searchImpl, securityKeyReportImpl, securityScanFor, sequenceAnchor, setPersonaImpl, setPolicyRuleImpl, setRetentionRuleImpl, setRetrievalProfileImpl, shouldUseExternalVendor, sourceEvidenceTime, sourceRefChanged, sourceRefsMatch, sourceRevalidationSummary, splitEntityImpl, sqliteAvailable, sqliteRepositoryAvailable, stableStringify, startDreamJobImpl, storageStatusImpl, submitMarketplaceModuleImpl, summarizeTimelineImpl, syncConnectorEventsImpl, syncOfflineOperationsImpl, syncStatusImpl, syntheticExtractionEvent, temporalQueryImpl, timelineImpl, tokenSet, translateTextImpl, transportSecurityReportImpl, triggerForMode, truncateText, uniqueStrings, unlinkIdentityImpl, updateConsentImpl, updateImpl, validateConnectorManifest, verificationQueueImpl, verifyBackupRecoveryImpl, verifyBackupReplayImpl, withEngineeringMemoryMetadata, withProceduralMetadata, writebackConnectorImpl } from './memoryServiceImports';
import type { ActionGuardReport, AdaptiveDreamPolicyReport, AgentRegistration, AuditChainExport, AuditEvent, AuditJournalEvent, AuditReplayMemoryState, BackupRecoveryReport, BehavioralPatternReport, Brain, ClaimRecord, CodebaseScope, CodingContextPack, ComplianceReport, ConflictSet, ConnectorAuthSession, ConnectorHealthItem, ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, ConsentPolicy, ConsentVisibility, ContextEnrichmentReport, ContextReference, ContradictionDetector, CrossBrainPrivacyComputeReport, CurrentTruthDecision, DecryptionKeyMaterial, DifferentialPrivacyReport, DomainEvaluationReport, DomainModule, DreamBudget, DreamConnectorRefreshReport, DreamCycleInput, DreamCycleMode, DreamCycleReport, DreamCycleTrigger, DreamJob, DreamPlanReport, DreamPreparationReport, DurabilityDecision, EngineeringMemoryClassifier, EngineeringMemoryKind, EnrichmentCandidate, EntityMergeSuggestion, EntityRecord, EpisodeInput, EpisodeRecord, EvidencePack, ExternalContextEvidence, ExtractionReport, FederatedSearchReport, FeedbackEvent, FeedbackKind, GraphActivationResult, GraphExplainReport, GraphExportOptions, GraphExportResult, GraphReport, HarnessActionInput, HarnessLifecycleEventInput, HarnessLifecycleEventReport, IdentityLink, InjectionFeedbackEvent, InjectionFeedbackReport, KeyProviderReport, KeyRotationReport, LearnedProfileReport, LifecyclePolicy, ManagedControlPlaneReport, ManagedDeploymentPlan, ManagedMigrationBundle, ManagedTenant, MarketplaceInstallPlan, MarketplaceModule, MarketplaceReview, MarketplaceSubmission, Memory, MemoryClaim, MemoryExtractionEvent, MemoryExtractor, MemoryInput, MemoryPersistenceAdapter, MemoryPolicyOperation, MemoryPolicyRule, MemoryRepository, MemoryRouteReport, MemoryScope, MemorySource, MemoryStorageAdapter, MetricsReport, ObservationReport, OfflineOperation, PatchEvidenceTrail, PersistedMemoryFile, PersonaProfile, PolicyDecision, PredictionReport, ProceduralMemoryMetadata, ProviderAdapterStatus, QueryExpander, QueryIntentReport, QueryPlan, QueryPlanStrategy, RedactionPolicy, ReflectionEvaluator, ReflectionSummarizer, RelationType, RepositoryStatePersistence, RetentionEnforcementReport, RetentionReviewReport, RetentionRule, RetrievalProfile, RetrievalTrainingSample, RetrievalWeights, SearchOptions, SearchResult, SecurityKeyReport, SourceRecord, SourceResolver, SourceRevalidationReport, SourceRevalidationResult, SourceRevalidationStatus, SourceValidationDecision, StorageBackendStatus, SyncReport, TemporalQueryReport, TimelineReport, TimelineSummaryReport, TranslationProvider, TranslationReport, TransportSecurityReport, VerificationQueueReport, VerificationResolutionReport, WebhookDelivery, WebhookRegistration } from './memoryServiceImports';

export const COGNIBRAIN_VERSION = "0.1.0";
export const SOURCE_QUALITY: Record<string, number> = {
  human: 1,
  reviewed_code: 0.95,
  tool: 0.9,
  import: 0.78,
  agent: 0.55,
  transcript: 0.42
};

export function contentDigest(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function syntheticEventForMemory(memory: Memory): MemoryExtractionEvent {
  return {
    role: "user",
    content: memory.content,
    timestamp: memory.createdAt,
    source: memory.source,
    sourceRef: memory.provenance.sourceRef
  };
}

export function claimStateForMemory(memory: Memory): ClaimRecord["state"] {
  if (memory.beliefState === "archived") return "needs_verification";
  if (memory.beliefState === "stale") return "needs_verification";
  if (memory.beliefState === "active") return "active";
  return memory.beliefState;
}

export function defaultSourceResolverDecision(memory: Memory, sourceRecord: SourceRecord): SourceValidationDecision {
  if (sourceRecord.status === "missing") return { status: "source_missing", reason: "source resolver marked source as missing", sourceRecord };
  const previous = memory.provenance.sourceRef;
  const next = sourceRecord.sourceRef;
  if (previous && sourceRefChanged(previous, next)) return { status: "source_updated", reason: "source resolver detected version or hash change", sourceRecord };
  if (sourceRecord.version && previous?.version && sourceRecord.version !== previous.version) return { status: "source_updated", reason: "source resolver detected version change", sourceRecord };
  if (sourceRecord.hash && previous?.hash && sourceRecord.hash !== previous.hash) return { status: "source_updated", reason: "source resolver detected content hash change", sourceRecord };
  return { status: "confirmed", reason: "source resolver confirmed sourceRef", sourceRecord };
}

export interface MemoryServiceOptions {
  persistencePath?: string;
  persistence?: MemoryPersistenceAdapter;
  repository?: MemoryRepository;
  storage?: MemoryStorageAdapter;
  autoDream?: {
    enabled?: boolean;
    intervalHours?: number;
    writeThreshold?: number;
  };
  retrievalWeights?: Partial<RetrievalWeights>;
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  domainModule?: DomainModule;
  configPath?: string;
  entityAliases?: Record<string, string[]>;
  sourceQuality?: Partial<Record<string, number>>;
  intelligence?: {
    reranker?: SearchOptions["reranker"];
    verifier?: SearchOptions["verifier"];
    evidenceJudge?: SearchOptions["evidenceJudge"];
    contradictionDetector?: ContradictionDetector;
    summarizer?: ReflectionSummarizer;
    evaluator?: ReflectionEvaluator;
    engineeringClassifier?: EngineeringMemoryClassifier;
    extractor?: MemoryExtractor;
    queryExpander?: QueryExpander;
    translator?: TranslationProvider;
  };
}

export type ConnectorWritebackOperation = NonNullable<ConnectorSyncRecord["operation"]>;

export interface ConnectorWritebackInput {
  operation?: ConnectorWritebackOperation;
  memoryIds?: string[];
  externalId?: string;
  content?: string;
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

export interface ConnectorListResult {
  connectorId: string;
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  responseStatusCode?: number;
  error?: string;
}

export interface ContextEnrichmentInput extends SearchOptions {
  tokenBudget?: number;
  primaryIssueStore?: string;
  primaryKnowledgeStore?: string;
  defaultSearchConnectors?: string[];
  fetchReferenced?: boolean;
  searchPrimaryStores?: boolean;
  persistFetched?: boolean;
  maxExternalFetches?: number;
  maxExternalResults?: number;
}

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

export function repositoryFromStorage(storage?: MemoryStorageAdapter): MemoryRepository | undefined {
  if (!storage) return undefined;
  if (storage instanceof RepositoryBackedStorageAdapter) return storage.repository;
  if (storage instanceof InMemoryStorageAdapter) return new InMemoryMemoryRepository(storage.store);
  return undefined;
}

export function createRepositoryFromEnv(defaultPath = ".memory-harness.json"): MemoryRepository | undefined {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if (backend === "sqlite" || backend === "sql" || backend === "sqlite-repository") {
    if (!sqliteRepositoryAvailable()) return undefined;
    return new SQLiteMemoryRepository(process.env.MEMORY_SQLITE_PATH ?? defaultPath.replace(/\.json$/i, ".sqlite"));
  }
  if ((backend === "postgres-repository" || backend === "postgres-db-primary" || backend === "postgres-production" || backend === "postgres-async") && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresMemoryRepository(process.env.MEMORY_POSTGRES_URL);
  }
  return undefined;
}

export function sourceRefMatchesVendorItem(sourceRef: NonNullable<Memory["provenance"]["sourceRef"]>, item: Record<string, unknown>): boolean {
  const externalId = stringFromCandidate(item, ["externalId", "id", "key", "issueKey", "identifier", "number", "iid", "gid"]);
  const uri = stringFromCandidate(item, ["url", "uri", "webUrl", "web_url", "html_url", "permalink_url"]);
  return Boolean(
    (sourceRef.externalId && externalId && String(sourceRef.externalId).toLowerCase() === externalId.toLowerCase()) ||
    (sourceRef.url && uri && normalizeComparableUrl(sourceRef.url) === normalizeComparableUrl(uri)) ||
    (sourceRef.externalId && uri && uri.toLowerCase().includes(String(sourceRef.externalId).toLowerCase()))
  );
}

export function stringFromCandidate(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

export function liveSourceVersion(item: Record<string, unknown>): string | undefined {
  return stringFromCandidate(item, ["version", "updatedAt", "updated_at", "modifiedAt", "lastEditedTime", "last_edited_time", "etag"]);
}

export function compactLiveSourceContent(item: Record<string, unknown>): string {
  return [
    stringFromCandidate(item, ["title", "name", "summary", "subject", "key", "identifier"]),
    stringFromCandidate(item, ["content", "body", "description", "text", "notes", "status", "state"]),
    stringFromCandidate(item, ["url", "uri", "webUrl", "web_url", "html_url", "permalink_url"])
  ].filter((value): value is string => Boolean(value)).join(" | ") || stableStringify(item).slice(0, 1200);
}

export function normalizeComparableUrl(value: string): string {
  return value.replace(/\/+$/, "").toLowerCase();
}

export function memoryStoreForRepository(repository: MemoryRepository): MemoryStore {
  if (repository instanceof InMemoryMemoryRepository) return repository.store;
  const maybeRepositoryStore = (repository as { store?: unknown }).store;
  if (maybeRepositoryStore instanceof MemoryStore) {
    repository.export();
    return maybeRepositoryStore;
  }
  const store = new MemoryStore();
  store.import(repository.export());
  return store;
}

