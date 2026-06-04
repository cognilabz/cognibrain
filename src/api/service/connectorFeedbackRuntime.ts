import type { ConnectorManifest, ConnectorSyncRecord, ConnectorSyncState, FeedbackKind, HarnessActionInput, Memory, ProviderAdapterStatus } from "../../core";
import { contentHash, firstString, safeGet } from "./helpers";

export function providerStatus(service: any): ProviderAdapterStatus {
  return {
    active: Boolean(service.defaultExtractor || service.defaultSummarizer || service.defaultVerifier || service.defaultEvidenceJudge || service.defaultReranker || service.defaultQueryExpander || service.defaultTranslator),
    timeoutMs: Number(process.env.MEMORY_INTELLIGENCE_TIMEOUT_MS ?? 3500),
    tasks: ["contradiction", "rerank", "verify", "evidence", "summarize", "extract", "expand", "translate"],
    fallback: "deterministic"
  };
}

export function recordConnectorFeedback(service: any, input: {
  connectorId: string;
  userId: string;
  kind: "accepted_change" | "rejected_suggestion" | "failing_test" | "user_correction";
  content: string;
  memoryIds?: string[];
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  const manifest = service.connectorManifests.get(input.connectorId);
  if (!manifest) throw new Error(`Connector manifest not found: ${input.connectorId}`);
  const feedbackKind: FeedbackKind = input.kind === "accepted_change" ? "helpful" : input.kind === "failing_test" ? "stale" : "wrong";
  const updatedMemories = (input.memoryIds ?? [])
    .filter((memoryId) => Boolean(safeGet(service.store, memoryId)))
    .map((memoryId) => service.feedback({ memoryId, userId: input.userId, kind: feedbackKind, note: input.content }));
  const feedbackMemory = service.add({
    userId: input.userId,
    content: input.content,
    type: "feedback",
    source: { kind: "tool", confidence: input.kind === "accepted_change" ? 0.86 : 0.72 },
    tags: ["connector-feedback", input.kind, input.connectorId],
    metadata: { connectorId: input.connectorId, externalId: input.externalId, feedbackKind, ...(input.metadata ?? {}) }
  });
  const record: ConnectorSyncRecord = {
    id: `sync_${contentHash(`${input.connectorId}:feedback:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
    connectorId: input.connectorId,
    direction: "ingest",
    status: "applied",
    memoryIds: [feedbackMemory.id, ...updatedMemories.map((memory) => memory.id)],
    externalIds: input.externalId ? [input.externalId] : [],
    timestamp: new Date().toISOString(),
    operation: "memory_link",
    payload: { feedbackAdapter: input.kind, feedbackKind, updated: updatedMemories.length }
  };
  appendConnectorSyncRecord(service, record);
  service.recordAudit("connector.sync", { userId: input.userId, metadata: { connectorId: input.connectorId, status: record.status, feedbackAdapter: input.kind, memories: record.memoryIds.length } });
  service.persist();
  return { record, feedbackMemory, updatedMemories };
}

export function recordConnectorTelemetry(service: any, input: {
  connectorId: string;
  harnessId?: string;
  userId: string;
  kind: "accepted_suggestion" | "rejected_suggestion" | "context_pack_feedback" | "tool_outcome";
  content?: string;
  query?: string;
  memoryIds?: string[];
  acceptedMemoryIds?: string[];
  rejectedMemoryIds?: string[];
  command?: string;
  filesChanged?: string[];
  tests?: HarnessActionInput["tests"];
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  const manifest = service.connectorManifests.get(input.connectorId);
  if (!manifest) throw new Error(`Connector manifest not found: ${input.connectorId}`);
  const createdMemories: Memory[] = [];
  const reports: Record<string, unknown>[] = [];
  if (input.kind === "tool_outcome") {
    const action = service.recordHarnessAction({
      userId: input.userId,
      agentId: input.harnessId,
      appId: typeof input.metadata?.appId === "string" ? input.metadata.appId : undefined,
      orgId: typeof input.metadata?.orgId === "string" ? input.metadata.orgId : undefined,
      projectId: typeof input.metadata?.projectId === "string" ? input.metadata.projectId : undefined,
      command: input.command ?? input.content,
      cwd: typeof input.metadata?.cwd === "string" ? input.metadata.cwd : undefined,
      envRequirements: Array.isArray(input.metadata?.envRequirements) ? input.metadata.envRequirements.filter((item): item is string => typeof item === "string") : undefined,
      environmentHints: Array.isArray(input.metadata?.environmentHints) ? input.metadata.environmentHints.filter((item): item is string => typeof item === "string") : undefined,
      exitCode: typeof input.metadata?.exitCode === "number" ? input.metadata.exitCode : undefined,
      durationMs: typeof input.metadata?.durationMs === "number" ? input.metadata.durationMs : undefined,
      outputSummary: typeof input.metadata?.outputSummary === "string" ? input.metadata.outputSummary : undefined,
      failureReason: typeof input.metadata?.failureReason === "string" ? input.metadata.failureReason : undefined,
      successReason: typeof input.metadata?.successReason === "string" ? input.metadata.successReason : undefined,
      evidencePackId: typeof input.metadata?.evidencePackId === "string" ? input.metadata.evidencePackId : undefined,
      filesChanged: input.filesChanged,
      filesTouched: Array.isArray(input.metadata?.filesTouched) ? input.metadata.filesTouched.filter((item): item is string => typeof item === "string") : input.filesChanged,
      tests: input.tests,
      content: input.content,
      timestamp: new Date().toISOString()
    });
    createdMemories.push(action);
    reports.push({ kind: "harness-action", memoryId: action.id });
  } else if (input.kind === "context_pack_feedback" && input.query && input.memoryIds?.length) {
    const outcome = input.rejectedMemoryIds?.length && !input.acceptedMemoryIds?.length ? "rejected" : "accepted";
    const report = service.recordInjectionFeedback({
      userId: input.userId,
      query: input.query,
      injectedMemoryIds: input.memoryIds,
      acceptedMemoryIds: input.acceptedMemoryIds,
      rejectedMemoryIds: input.rejectedMemoryIds,
      outcome,
      note: input.content,
      timestamp: new Date().toISOString()
    });
    reports.push({ kind: "injection-feedback", trainingSample: report.trainingSample, updated: report.updatedMemories.map((memory: Memory) => memory.id) });
  } else {
    const feedback = service.recordConnectorFeedback({
      connectorId: input.connectorId,
      userId: input.userId,
      kind: input.kind === "accepted_suggestion" ? "accepted_change" : "rejected_suggestion",
      content: input.content ?? `${input.harnessId ?? input.connectorId} ${input.kind}`,
      memoryIds: input.memoryIds,
      externalId: input.externalId,
      metadata: { harnessId: input.harnessId, telemetryKind: input.kind, ...(input.metadata ?? {}) }
    });
    createdMemories.push(feedback.feedbackMemory, ...feedback.updatedMemories);
    reports.push({ kind: "connector-feedback", recordId: feedback.record.id, memoryIds: feedback.record.memoryIds });
  }
  const record: ConnectorSyncRecord = {
    id: `sync_${contentHash(`${input.connectorId}:telemetry:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
    connectorId: input.connectorId,
    direction: "ingest",
    status: "applied",
    memoryIds: createdMemories.map((memory) => memory.id),
    externalIds: input.externalId ? [input.externalId] : [],
    timestamp: new Date().toISOString(),
    operation: "memory_link",
    payload: { telemetryKind: input.kind, harnessId: input.harnessId, reports, metadata: input.metadata ?? {} }
  };
  appendConnectorSyncRecord(service, record);
  service.recordAudit("connector.sync", { userId: input.userId, metadata: { connectorId: input.connectorId, telemetryKind: input.kind, harnessId: input.harnessId, memories: record.memoryIds.length } });
  service.persist();
  return { record, createdMemories, reports };
}

function appendConnectorSyncRecord(service: any, record: ConnectorSyncRecord): ConnectorSyncRecord {
  service.connectorSyncRecords.push(record);
  updateConnectorSyncState(service, record);
  return record;
}

function updateConnectorSyncState(service: any, record: ConnectorSyncRecord): void {
  const existing = service.connectorSyncStates.get(record.connectorId) as ConnectorSyncState | undefined;
  const payload = record.payload ?? {};
  const isSuccessfulPoll = record.direction === "ingest" && record.status === "applied";
  service.connectorSyncStates.set(record.connectorId, {
    connectorId: record.connectorId,
    cursor: firstString(payload.cursorAfter, payload.nextCursor, payload.cursor) ?? existing?.cursor,
    lastSuccessfulPollAt: isSuccessfulPoll ? record.timestamp : existing?.lastSuccessfulPollAt,
    lastExternalUpdatedAt: firstString(payload.lastExternalUpdatedAt) ?? existing?.lastExternalUpdatedAt,
    etag: firstString(payload.etag) ?? existing?.etag,
    sourceVersion: firstString(payload.sourceVersion) ?? existing?.sourceVersion,
    lastRecordId: record.id,
    lastStatus: record.status,
    records: service.connectorSyncRecords.filter((item: ConnectorSyncRecord) => item.connectorId === record.connectorId).length
  });
}
