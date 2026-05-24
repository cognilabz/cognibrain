import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MemoryService } from "../api/service";

interface Check {
  id: string;
  passed: boolean;
  detail: string;
}

export function runNextgenEvaluation() {
  const service = new MemoryService();
  const checks: Check[] = [];

  const brain = service.createBrain({ name: "Nextgen Team Brain", ownerUserId: "bench", orgId: "org-bench", visibility: "team" });
  const source = service.createSource({ brainId: brain.id, name: "Benchmark Source", kind: "docs" });
  service.registerAgent({
    id: "agent-bench",
    name: "Benchmark Agent",
    namespace: "eval",
    brainIds: [brain.id],
    permissions: ["read", "write", "share"],
    subscriptions: { events: ["memory.write", "memory.share.request", "memory.share", "memory.share.revoke"], brainIds: [brain.id] }
  });
  service.registerWebhook({ url: "https://example.invalid/hooks/memory", events: ["memory.write", "inference.run", "memory.share"] });
  service.installMarketplaceModule({
    id: "persona-nextgen",
    kind: "persona",
    name: "Nextgen Persona",
    version: "1.0.0",
    description: "Evaluation persona for nextgen proof.",
    manifest: { id: "nextgen", label: "Nextgen", summaryStyle: "concise", privacyDefault: "private" }
  });
  service.assignAgentPersona("agent-bench", "nextgen");

  const atlas = service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    agentId: "agent-bench",
    orgId: "org-bench",
    content: "Atlas depends on CacheClient for cache reads.",
    entities: ["atlas", "cacheclient"],
    relations: [{ type: "depends_on", sourceEntity: "atlas", targetEntity: "cacheclient", confidence: 0.91 }],
    consent: { visibility: "private", retentionUntil: "2024-01-01T00:00:00.000Z", deleteOnRequest: true },
    source: { kind: "human", confidence: 0.97 }
  });
  const riskyCacheClaim = service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    agentId: "agent-bench",
    orgId: "org-bench",
    content: "CacheClient imports RedisAdapter for storage.",
    entities: ["cacheclient", "redisadapter"],
    relations: [{ type: "imports", sourceEntity: "cacheclient", targetEntity: "redisadapter", confidence: 0.89 }],
    source: { kind: "reviewed_code", confidence: 0.96 }
  });
  const federationProof = service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    agentId: "agent-bench",
    orgId: "org-bench",
    content: "Shared team brain publishes active release architecture notes.",
    entities: ["release architecture", "team brain"],
    consent: { visibility: "org" },
    source: { kind: "human", confidence: 0.96 }
  });
  for (const timestamp of ["2026-05-01T09:00:00.000Z", "2026-05-08T09:00:00.000Z"]) {
    service.add({
      brainId: brain.id,
      sourceId: source.id,
      userId: "bench",
      agentId: "agent-bench",
      content: "Benchmark operator reviews graph reports on Friday.",
      tags: ["review", "graph"],
      entities: ["operator"],
      timestamp,
      temporal: { eventAt: timestamp },
      source: { kind: "human", confidence: 0.94 }
    });
  }
  const extraction = service.extract(
    [
      { role: "operator", content: "Audio", mediaType: "audio", language: "de", uri: "file:///eval/review.m4a" },
      { role: "user", content: "Atlas evaluation says CacheClient also appears as Cache Client in docs.", mediaType: "document", language: "en" }
    ],
    { userId: "bench", brainId: brain.id, sourceId: source.id, agentId: "agent-bench", orgId: "org-bench" }
  );
  service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    content: "Cache Client is the documentation spelling for CacheClient.",
    entities: ["cache client"],
    source: { kind: "human", confidence: 0.93 }
  });

  const inference = service.runInference();
  const paths = service.graphPaths("atlas", "redisadapter", { userId: "bench", maxDepth: 3, relationTypes: ["transitive_depends_on"] });
  const activation = service.graphActivation("Atlas RedisAdapter", { userId: "bench", maxDepth: 3 });
  const graphExport = service.graphExport({ userId: "bench", relationTypes: ["depends_on", "imports", "transitive_depends_on"], minTrust: 0.7 }) as { nodes: unknown[]; edges: Array<{ type: string }> };
  const graphML = String(service.graphExport({ userId: "bench", format: "graphml" }));
  const query = service.graphQuery("MATCH (a)-[:transitive_depends_on]->(b) WHERE trust>0.8 RETURN a,b,trust", "bench");
  const temporal = service.temporalQuery("bench", { after: "2026-05-01T00:00:00.000Z", before: "2026-05-09T00:00:00.000Z" });
  const patterns = service.behavioralPatterns("bench");
  const timelineSummary = service.summarizeTimeline("bench", { granularity: "week", persist: true, style: "concise" });
  const behavioralSearch = service.search({ userId: "bench", query: "Friday graph review habit", includePrivate: true, weights: { behavioral: 1, semantic: 0, keyword: 0, entity: 0, temporal: 0, trust: 0, graph: 0, access: 0 } });
  const entities = service.entityCatalog("bench");
  const shareRequest = service.requestSharedMemory(atlas.id, "org-bench", "agent-bench", "Benchmark federation review.");
  service.promoteSharedMemory(atlas.id, "org-bench");
  const federated = service.search({ userId: "bench-peer", orgId: "org-bench", query: "release architecture", includeSharedBrains: true, brainIds: [brain.id] });
  const storage = service.storageStatus();
  const consented = service.updateConsent(atlas.id, { visibility: "public", allowTraining: true });
  service.update(atlas.id, { content: "Atlas temporarily used a stale cache note." });
  const reverted = service.revertMemory(atlas.id);
  service.queueOfflineOperation({
    type: "add",
    userId: "bench",
    input: {
      brainId: brain.id,
      sourceId: source.id,
      userId: "bench",
      orgId: "org-bench",
      content: "Offline benchmark note syncs through the local queue.",
      source: { kind: "human", confidence: 0.9 }
    }
  });
  const sync = service.syncOfflineOperations();
  service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    orgId: "org-bench",
    content: "The command line launcher starts the local memory backend.",
    entities: ["command line", "launcher"],
    source: { kind: "human", confidence: 0.95 }
  });
  service.add({
    brainId: brain.id,
    sourceId: source.id,
    userId: "bench",
    orgId: "org-bench",
    content: "Atlas should not use CacheClient for cache reads.",
    entities: ["atlas", "cacheclient"],
    source: { kind: "transcript", confidence: 0.32 }
  });
  service.addTrainingSample({ userId: "bench", query: "cli launcher", outcome: "accepted", signals: { keyword: 0.9, semantic: 0.7 } });
  const learnedRetrieval = service.learnRetrievalProfile("bench-retrieval", "Bench retrieval", { scope: { userId: "bench" } });
  const expandedRetrieval = service.search({ userId: "bench", query: "cli launcher", expandQuery: true, mode: "rrf" });
  const contradictionRetrieval = service.search({ userId: "bench", query: "Atlas CacheClient cache reads", mode: "path" });
  const connectorManifest = service.registerConnectorManifest({
    id: "eval-chat",
    name: "Eval Chat",
    kind: "chat",
    version: "1.0.0",
    direction: "two_way",
    capabilities: ["ingest", "webhook", "writeback"],
    auth: "token",
    defaultSourceKind: "transcript",
    metadataMapping: { channel: "metadata.channel", messageId: "externalId", text: "content" }
  });
  const connectorSync = service.syncConnectorEvents(
    connectorManifest.id,
    [{ role: "assistant", content: "Eval connector captured the operator escalation decision.", externalId: "eval-msg-1", metadata: { channel: "ops" } }],
    { userId: "bench", brainId: brain.id, sourceId: source.id, agentId: "agent-bench", orgId: "org-bench" }
  );
  const translation = service.translateText("Speicher soll nicht fehler", "de");
  const mediaIngest = service.ingestMedia(
    { role: "operator", content: "Speicher soll release notes erfassen.", mediaType: "audio", language: "de", uri: "file:///eval/audio-de.m4a" },
    { userId: "bench", brainId: brain.id, sourceId: source.id, agentId: "agent-bench", orgId: "org-bench" }
  );
  const injectionFeedback = service.recordInjectionFeedback({
    userId: "bench",
    query: "Atlas CacheClient proof",
    injectedMemoryIds: [atlas.id, riskyCacheClaim.id],
    acceptedMemoryIds: [atlas.id],
    rejectedMemoryIds: [riskyCacheClaim.id],
    outcome: "accepted",
    profileId: "bench-injection",
    signals: { graph: 0.9, trust: 0.8, semantic: 0.6 }
  });
  const adaptivePolicy = service.adaptiveDreamPolicy("bench");
  const observations = service.generateObservations("bench", { persist: true, style: "descriptive", limit: 2 });
  const predictions = service.predictionReport("bench", { query: "Friday graph review habit", limit: 3 });
  const webhookDelivery = service.deliverWebhookQueue();
  const compliance = service.complianceReport(new Date("2026-01-01T00:00:00.000Z"));
  const agentFeed = service.eventFeed({ agentId: "agent-bench", brainId: brain.id });
  const events = service.eventFeed();
  const audit = service.auditTrail({ memoryId: atlas.id });
  const federatedReport = service.federatedSearch({ userId: "bench-peer", agentId: "agent-bench", orgId: "org-bench", query: "release architecture", brainIds: [brain.id] });
  const revoked = service.revokeSharedMemory(atlas.id, "agent-bench", "Benchmark cleanup.");
  const securityService = new MemoryService({ redactionPolicy: { mode: "encrypt", encryptionKey: "nextgen-test-key-with-enough-length", encryptionKeyId: "nextgen", encryptionKeyVersion: "1" } });
  const expiredSecurity = securityService.add({
    userId: "security",
    content: "Atlas security retention note should leave retrieval.",
    entities: ["atlas"],
    timestamp: "2020-01-01T00:00:00.000Z",
    source: { kind: "human", confidence: 0.95 }
  });
  securityService.add({ userId: "security", content: "The token ghp_abcdefghijklmnopqrstuvwxyz123456 rotates metadata only.", source: { kind: "human", confidence: 0.95 } });
  securityService.add({ userId: "dp1", content: "Privacy aggregate human one.", source: { kind: "human", confidence: 0.95 } });
  securityService.add({ userId: "dp2", content: "Privacy aggregate human two.", source: { kind: "human", confidence: 0.95 } });
  securityService.add({ userId: "dp3", content: "Privacy aggregate transcript singleton.", source: { kind: "transcript", confidence: 0.42 } });
  const retentionRule = securityService.setRetentionRule({ label: "Security archive", retentionDays: 1, action: "archive", scope: { entity: "atlas" } });
  const retainedSearch = securityService.search({ userId: "security", query: "Atlas security retention note", includePrivate: true });
  const keyRotation = securityService.rotateEncryptionKeyMetadata({ keyId: "nextgen", keyVersion: "2", backupRef: "local-backup://nextgen" });
  const dpInsights = securityService.privacyInsights({ epsilon: 0.8, kAnonymity: 2, includeExact: true });
  const securityCompliance = securityService.complianceReport();

  checks.push({
    id: "graph-inference",
    passed: inference.inferred.some((item) => item.relation.type === "transitive_depends_on"),
    detail: `${inference.inferred.length} inferred relations`
  });
  checks.push({
    id: "path-explainer",
    passed: paths.some((path) => path.explanation.join(" ").includes("transitive_depends_on") && path.edges.some((edge) => edge.source && typeof edge.trust === "number")),
    detail: `${paths.length} graph paths`
  });
  checks.push({
    id: "graph-query",
    passed:
      query.matches.some((match) => match.relation?.targetEntity === "redisadapter" && match.source) &&
      activation.ranked.length > 0 &&
      graphExport.nodes.length > 0 &&
      graphExport.edges.every((edge) => ["depends_on", "imports", "transitive_depends_on", "mentions"].includes(edge.type)) &&
      graphML.includes("<graphml"),
    detail: `${query.matches.length} query matches, ${activation.ranked.length} activation nodes, ${graphExport.edges.length} exported edges`
  });
  checks.push({
    id: "multi-tenant-audit",
    passed:
      compliance.totals.brains === 1 &&
      compliance.totals.sources === 1 &&
      (compliance.auditByType["memory.write"] ?? 0) >= 1 &&
      federated.some((result) => result.memory.id === federationProof.id) &&
      audit.some((event) => event.type === "memory.revert") &&
      consented.consent.visibility === "public" &&
      reverted.content.includes("CacheClient"),
    detail: `${compliance.totals.auditEvents} audit events, ${federated.length} federated results`
  });
  checks.push({
    id: "offline-storage-sync",
    passed: sync.applied.length === 1 && sync.remaining.length === 0 && storage.adapters.some((adapter) => adapter.kind === "append-only-log" && adapter.distributedReady),
    detail: `${sync.applied.length} sync operations applied through ${storage.active}`
  });
  checks.push({
    id: "retrieval-ranking",
    passed:
      expandedRetrieval.some((result) => result.retrievalMode === "rrf" && result.expandedQueries?.some((query) => query.includes("command line"))) &&
      contradictionRetrieval.some((result) => result.contradiction?.action === "exclude") &&
      learnedRetrieval.samples >= 1,
    detail: `${expandedRetrieval.length} expanded RRF results, ${contradictionRetrieval.filter((result) => result.contradiction).length} contradictions, ${learnedRetrieval.samples} learned samples`
  });
  checks.push({
    id: "webhook-event-feed",
    passed: events.deliveries.some((delivery) => delivery.status === "delivered" || delivery.status === "queued"),
    detail: `${events.deliveries.length} deliveries, ${webhookDelivery.delivered} delivered`
  });
  checks.push({
    id: "connectors-ingestion",
    passed:
      service.listConnectorManifests().some((manifest) => manifest.id === "official-email") &&
      connectorSync.status === "applied" &&
      connectorSync.memoryIds.length === 1 &&
      service.listConnectorSyncRecords("eval-chat").length === 1 &&
      translation.translated.includes("memory") &&
      mediaIngest.memories.some((memory) => memory.metadata.translatedFrom === "de") &&
      service.providerStatus().tasks.includes("translate") &&
      service.auditTrail({ type: "connector.sync" }).length >= 1,
    detail: `${service.listConnectorManifests().length} connector manifests, ${connectorSync.memoryIds.length} synced memories, translation provider=${translation.provider}`
  });
  checks.push({
    id: "learning-adaptation",
    passed:
      injectionFeedback.updatedMemories.length === 2 &&
      service.getRetrievalProfiles().some((profile) => profile.id === "bench-injection") &&
      adaptivePolicy.rationale.some((item) => item.includes("feedback") || item.includes("health")) &&
      observations.observations.some((observation) => observation.citations.length >= 1 && observation.observationMemoryId) &&
      predictions.prefetch.length > 0 &&
      predictions.anomalies.some((anomaly) => anomaly.kind === "low_trust_recent_memory" || anomaly.kind === "pending_pattern_review"),
    detail: `${injectionFeedback.updatedMemories.length} feedback memories, ${observations.observations.length} observations, ${predictions.prefetch.length} prefetched`
  });
  checks.push({
    id: "multi-agent-collaboration",
    passed:
      service.listAgents().some((agent) => agent.id === "agent-bench" && agent.personaId === "nextgen") &&
      service.listPersonas().some((persona) => persona.id === "nextgen") &&
      (shareRequest.metadata.shared as { status?: string }).status === "pending" &&
      agentFeed.auditEvents.some((event) => event.type === "memory.share.request") &&
      federatedReport.searchedBrainIds.includes(brain.id) &&
      (revoked.metadata.shared as { status?: string }).status === "revoked",
    detail: `${agentFeed.auditEvents.length} agent-visible events, ${federatedReport.results.length} federated results`
  });
  checks.push({
    id: "compliance-retention",
    passed: compliance.retentionExpired === 1 && compliance.deleteOnRequest >= 1,
    detail: `${compliance.retentionExpired} expired retention entries, ${compliance.deleteOnRequest} delete-on-request entries`
  });
  checks.push({
    id: "security-compliance",
    passed:
      securityService.listRetentionRules().some((rule) => rule.id === retentionRule.id) &&
      !retainedSearch.some((result) => result.memory.id === expiredSecurity.id) &&
      securityService.exportUser("security").some((memory) => memory.id === expiredSecurity.id && memory.archivedAt) &&
      keyRotation.rotated.length === 1 &&
      securityService.securityKeyReport().backupRefs.includes("local-backup://nextgen") &&
      dpInsights.aggregates.some((item) => item.dimension === "sourceKind" && item.key === "transcript" && item.suppressed) &&
      securityCompliance.dataFlows?.some((flow) => flow.type === "security.key.rotate") === true,
    detail: `${securityService.listRetentionRules().length} retention rules, ${keyRotation.rotated.length} key rotations, ${dpInsights.suppressedGroups} DP groups suppressed`
  });
  checks.push({
    id: "temporal-patterns",
    passed:
      temporal.events.length >= 2 &&
      patterns.patterns.some((pattern) => pattern.cadence === "weekly:friday" && typeof pattern.falsePositiveRisk === "number") &&
      timelineSummary.summaries.some((summary) => summary.summaryMemoryId) &&
      behavioralSearch.some((result) => (result.signals.behavioral ?? 0) > 0.5),
    detail: `${temporal.events.length} interval events, ${patterns.patterns.length} patterns, ${timelineSummary.summaries.length} summaries`
  });
  checks.push({
    id: "extraction-enrichment",
    passed:
      extraction.stages.some((stage) => stage.stage === "rules" && stage.extracted >= 1) &&
      extraction.failures.some((failure) => failure.mediaType === "audio") &&
      extraction.learnedRules.some((rule) => rule.kind === "provider" || rule.kind === "translation") &&
      entities.enrichmentCandidates.length >= 1 &&
      entities.mergeSuggestions.some((suggestion) => suggestion.canonical.includes("cache")),
    detail: `${extraction.memories.length} extracted, ${extraction.failures.length} failures, ${extraction.learnedRules.length} learned rule suggestions, ${entities.mergeSuggestions.length} merge suggestions`
  });
  checks.push({
    id: "marketplace-persona",
    passed: service.listMarketplaceModules().some((module) => module.id === "persona-nextgen" && module.installState === "installed") && service.listPersonas().some((persona) => persona.id === "nextgen"),
    detail: `${service.listMarketplaceModules().length} marketplace modules`
  });

  const report = {
    passed: checks.every((check) => check.passed),
    generatedAt: new Date().toISOString(),
    checks,
    summary: {
      passed: checks.filter((check) => check.passed).length,
      total: checks.length
    }
  };
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIndex = process.argv.indexOf("--out");
  const out = outIndex >= 0 ? process.argv[outIndex + 1] : "artifacts/nextgen-eval.json";
  const report = runNextgenEvaluation();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}
