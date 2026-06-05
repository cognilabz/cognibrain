import { existsSync, readFileSync } from "node:fs";
import {
  externalVendorConfigured,
  externalVendorProvider,
  listExternalVendorItems,
  pollExternalVendorConnector,
  shouldUseExternalVendor,
  writebackExternalVendorConnector
} from "../../connectors/vendorConnectors";
import type { ConnectorWritebackInput } from "../service";
import type {
  ConnectorManifest,
  ConnectorSyncRecord,
  ConnectorSyncState,
  Memory,
  ExtractionReport,
  MemoryExtractionEvent,
  MemoryInput
} from "../../core";
import {
  connectorAdapterRequest,
  connectorEventTags,
  connectorEventVisibility,
  connectorReviewRequired,
  connectorWritebackPayload,
  connectorWritebackRequest,
  contentHash,
  firstString,
  safeGet,
  validateConnectorManifest
} from "./helpers";
export {
  beginConnectorOAuth,
  completeConnectorOAuth,
  connectorAuthStatus,
  ReferenceOnlyTokenSecretStore,
  refreshConnectorOAuth,
  revokeConnectorAuth,
  type TokenSecretStore
} from "./connectorOAuthRuntime";
export {
  providerStatus,
  recordConnectorFeedback,
  recordConnectorTelemetry
} from "./connectorFeedbackRuntime";

export interface ConnectorHealthItem {
  connectorId: string;
  kind: ConnectorManifest["kind"];
  direction: ConnectorManifest["direction"];
  capabilities: ConnectorManifest["capabilities"];
  privacyPolicy: string;
  supports: { list: boolean; poll: boolean; ingest: boolean; writeback: boolean; externalVendor: boolean };
  externalVendor?: { provider: string; configured: boolean; missingEnv: string[] };
  certification: {
    state: "not_certified" | "implementation-ready" | "credential-blocked" | "tenant-verified" | "production-certified" | "failed";
    artifact?: string;
    blockedBy: string[];
    canBecomeTenantVerified: boolean;
    canBecomeProductionCertified: boolean;
    productionCertified: boolean;
  };
  lastStatus: ConnectorSyncRecord["status"] | "never_run";
  lastError?: string;
  lastSyncAt?: string | Date;
  lastWritebackAt?: string | Date;
  records: number;
}

const CONNECTOR_CERTIFICATION_ARTIFACT = process.env.MEMORY_CONNECTOR_CERTIFICATION_ARTIFACT ?? "artifacts/connector-certification.json";

export interface ConnectorListResult {
  connectorId: string;
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  responseStatusCode?: number;
  error?: string;
}

function connectorCertification(manifest: ConnectorManifest, provider?: string): ConnectorHealthItem["certification"] {
  const artifact = loadConnectorCertificationArtifact();
  const rows = Array.isArray(artifact?.rows) ? artifact.rows as Array<Record<string, unknown>> : [];
  const row = rows.find((candidate) => candidate.connectorId === manifest.id || (provider && candidate.provider === provider));
  const state = String(row?.state ?? "not_certified") as ConnectorHealthItem["certification"]["state"];
  return {
    state,
    artifact: row ? CONNECTOR_CERTIFICATION_ARTIFACT : undefined,
    blockedBy: Array.isArray(row?.blockedBy) ? row.blockedBy.map(String) : ["connector certification artifact row missing"],
    canBecomeTenantVerified: row?.canBecomeTenantVerified === true,
    canBecomeProductionCertified: row?.canBecomeProductionCertified === true,
    productionCertified: state === "production-certified"
  };
}

function loadConnectorCertificationArtifact(): Record<string, unknown> | undefined {
  try {
    if (!existsSync(CONNECTOR_CERTIFICATION_ARTIFACT)) return undefined;
    return JSON.parse(readFileSync(CONNECTOR_CERTIFICATION_ARTIFACT, "utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
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

export function registerConnectorManifest(service: any, input: Omit<ConnectorManifest, "createdAt" | "updatedAt"> & { createdAt?: Date | string; updatedAt?: Date | string }): ConnectorManifest {
    validateConnectorManifest(input);
    const now = new Date().toISOString();
    const manifest: ConnectorManifest = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    service.connectorManifests.set(manifest.id, manifest);
    service.recordAudit("connector.register", { metadata: { connectorId: manifest.id, kind: manifest.kind, capabilities: manifest.capabilities } });
    service.persist();
    return manifest;
  }

export function listConnectorManifests(service: any, kind?: ConnectorManifest["kind"]): ConnectorManifest[] {
    return [...service.connectorManifests.values()]
      .filter((manifest) => !kind || manifest.kind === kind)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  }

export function syncConnectorEvents(service: any, connectorId: string, events: Array<MemoryExtractionEvent & { externalId?: string }>, scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">): ConnectorSyncRecord {
    const manifest = service.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("ingest")) throw new Error(`Connector ${connectorId} does not support ingest`);
    if (manifest.privacyPolicy === "never_store") {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:privacy:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "applied",
        memoryIds: [],
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString(),
        payload: { skipped: true, reason: "privacy_policy_never_store", events: events.length }
      };
      appendConnectorSyncRecord(service, record);
      service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, privacyPolicy: manifest.privacyPolicy, memories: 0 } });
      service.persist();
      return record;
    }
    try {
      const mapped = events.map((event) => ({
        ...event,
        source: event.source ?? { kind: manifest.defaultSourceKind, uri: event.uri, confidence: 0.82 },
        sourceRef: event.sourceRef ?? {
          connectorId,
          externalId: event.externalId,
          url: event.uri ?? (typeof event.metadata?.url === "string" ? event.metadata.url : undefined),
          author: typeof event.metadata?.author === "string" ? event.metadata.author : undefined,
          timestamp: event.timestamp,
          version: typeof event.metadata?.version === "string" ? event.metadata.version : undefined,
          hash: contentHash(JSON.stringify({ connectorId, externalId: event.externalId, content: event.content, timestamp: event.timestamp }))
        },
        metadata: { ...(event.metadata ?? {}), connectorId, externalId: event.externalId, mapping: manifest.metadataMapping, privacyPolicy: manifest.privacyPolicy ?? "project" }
      }));
      const report = service.extract(mapped, scope) as ExtractionReport;
      const eventsByExternalId = new Map(events.map((event) => [event.externalId, event]));
      const supplementalMemories: Memory[] = [];
      for (const memory of report.memories) {
        const externalId = typeof memory.metadata.externalId === "string" ? memory.metadata.externalId : undefined;
        const event = externalId ? eventsByExternalId.get(externalId) : undefined;
        if (!event) continue;
        const reviewRequired = connectorReviewRequired(manifest, event);
        const visibility = connectorEventVisibility(event);
        const tags = connectorEventTags(manifest, event);
        const upstreamClaim = isRecord(event.metadata?.claim) ? event.metadata.claim : undefined;
        const tenantVerificationRequired = event.metadata?.requiresTenantVerification === true;
        if (!reviewRequired && !visibility && !tags.length && !upstreamClaim && !tenantVerificationRequired) continue;
        service.store.update(memory.id, {
          beliefState: reviewRequired || tenantVerificationRequired ? "needs_verification" : memory.beliefState,
          consent: visibility ? { ...memory.consent, visibility } : memory.consent,
          tags: [...new Set([...memory.tags, ...tags])],
          metadata: {
            ...memory.metadata,
            ...(upstreamClaim ? { claim: upstreamClaim, upstreamClaim } : {}),
            ...(tenantVerificationRequired ? { tenantVerification: { status: "required", connectorId, externalId, at: new Date().toISOString() } } : {}),
            ...(reviewRequired ? { reviewQueue: { status: "pending", connectorId, reason: "connector_candidate_review" } } : {}),
            ...(visibility ? { channelVisibility: visibility } : {})
          }
        });
        if (tenantVerificationRequired) {
          supplementalMemories.push(service.add({
            ...scope,
            content: `External claim ${externalId ?? connectorId} requires live tenant verification before release.`,
            type: "reference",
            source: { kind: "tool", confidence: 0.84 },
            tags: ["tenant-verification", "release-gate", connectorId],
            metadata: { connectorId, externalId, tenantVerification: { status: "required", sourceMemoryId: memory.id } }
          }));
        }
      }
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "applied",
        memoryIds: [...report.memories, ...supplementalMemories].map((memory) => memory.id),
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString()
      };
      appendConnectorSyncRecord(service, record);
      service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, memories: record.memoryIds.length } });
      service.persist();
      return record;
    } catch (error) {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:failed:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "failed",
        memoryIds: [],
        externalIds: events.map((event) => event.externalId).filter((id): id is string => Boolean(id)),
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "unknown connector sync failure"
      };
      appendConnectorSyncRecord(service, record);
      service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, error: record.error } });
      service.persist();
      return record;
    }
  }

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

function applyDeletedSourceRefs(service: any, connectorId: string, deletedExternalIds: string[], scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">): Memory[] {
    const deleted = new Set(deletedExternalIds.filter(Boolean));
    if (!deleted.size) return [];
    const now = new Date().toISOString();
    const updated: Memory[] = [];
    for (const memory of (service.store.list(scope.userId) as Memory[])) {
      const sourceRef = memory.provenance.sourceRef;
      if (memory.archivedAt || sourceRef?.connectorId !== connectorId || !sourceRef.externalId || !deleted.has(sourceRef.externalId)) continue;
      const next = service.store.update(memory.id, {
        content: `Source ${sourceRef.externalId} was deleted; operator review is required before relying on prior connector evidence.`,
        beliefState: "needs_verification",
        temporal: {
          ...memory.temporal,
          verificationDueAt: memory.temporal.verificationDueAt ?? now,
          stalenessRisk: Math.max(memory.temporal.stalenessRisk ?? 0, 0.92)
        },
        metadata: {
          ...memory.metadata,
          sourceDeletedAt: now,
          verificationReason: "source_deleted",
          sourceRevalidation: { status: "source_missing", at: now, reason: "connector poll reported deleted externalId" },
          previousContent: memory.content
        }
      });
      updated.push(next);
      service.recordAudit("memory.update", { userId: next.userId, brainId: next.brainId, sourceId: next.sourceId, memoryId: next.id, metadata: { action: "source_deleted_revalidation", connectorId, externalId: sourceRef.externalId } });
    }
    return updated;
  }

export async function listConnectorItems(service: any, connectorId: string, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorListResult> {
    const manifest = service.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.list?.endpoint) return { connectorId, status: "failed", items: [], error: `Connector ${connectorId} has no list endpoint` };
    if (shouldUseExternalVendor(manifest, manifest.list.endpoint)) {
      const result = await listExternalVendorItems(manifest, fetchImpl, timeoutMs);
      return { connectorId, status: result.status, items: result.items, responseStatusCode: result.responseStatusCode, error: result.error };
    }
    try {
      const request = connectorAdapterRequest(manifest, "list", manifest.list.endpoint, manifest.list.method ?? "GET", undefined, manifest.list.authRef);
      const response = await fetchImpl(request.url, request.method === "GET"
        ? { method: request.method, headers: request.headers, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) }
        : { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
      const json = await response.json().catch(() => ({})) as { items?: Array<Record<string, unknown>> };
      return {
        connectorId,
        status: response.ok ? "applied" : "failed",
        items: Array.isArray(json.items) ? json.items : [],
        responseStatusCode: response.status,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      return { connectorId, status: "failed", items: [], error: error instanceof Error ? error.message : "connector list failed" };
    }
  }

export async function pollConnector(service: any, connectorId: string, scope: Pick<MemoryInput, "userId" | "brainId" | "sourceId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId">, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorSyncRecord> {
    const manifest = service.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("poll")) throw new Error(`Connector ${connectorId} does not support poll`);
    if (!manifest.poll?.endpoint) throw new Error(`Connector ${connectorId} has no poll endpoint`);
    try {
      if (shouldUseExternalVendor(manifest, manifest.poll.endpoint)) {
        const vendor = await pollExternalVendorConnector(manifest, fetchImpl, timeoutMs);
        if (vendor.status === "failed") {
          const record: ConnectorSyncRecord = {
            id: `sync_${contentHash(`${connectorId}:vendor-poll-failed:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
            connectorId,
            direction: "ingest",
            status: "failed",
            memoryIds: [],
            externalIds: [],
            timestamp: new Date().toISOString(),
            responseStatusCode: vendor.responseStatusCode,
            request: vendor.request,
            error: vendor.error ?? "vendor connector poll failed"
          };
          appendConnectorSyncRecord(service, record);
          service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, direction: "ingest", error: record.error } });
          service.persist();
          return record;
        }
        const record = service.syncConnectorEvents(connectorId, vendor.events, scope);
        record.responseStatusCode = vendor.responseStatusCode;
        if (vendor.request) record.request = vendor.request;
        updateConnectorSyncState(service, record);
        service.persist();
        return record;
      }
      const request = connectorAdapterRequest(manifest, "poll", manifest.poll.endpoint, manifest.poll.method ?? "GET", undefined, manifest.poll.authRef);
      const response = await fetchImpl(request.url, request.method === "GET"
        ? { method: request.method, headers: request.headers, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) }
        : { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
      const json = await response.json().catch(() => ({})) as {
        events?: Array<MemoryExtractionEvent & { externalId?: string }>;
        deletedExternalIds?: string[];
        cursor?: string;
        nextCursor?: string;
        lastExternalUpdatedAt?: string;
        etag?: string;
        sourceVersion?: string;
      };
      const cursorBefore = service.connectorSyncState(connectorId)[0]?.cursor;
      if (!response.ok) {
        const record: ConnectorSyncRecord = {
          id: `sync_${contentHash(`${connectorId}:poll-http-failed:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
          connectorId,
          direction: "ingest",
          status: "failed",
          memoryIds: [],
          externalIds: [],
          timestamp: new Date().toISOString(),
          responseStatusCode: response.status,
          request,
          payload: {
            cursorBefore,
            cursorAfter: firstString(json.nextCursor, json.cursor),
            lastExternalUpdatedAt: json.lastExternalUpdatedAt,
            etag: json.etag,
            sourceVersion: json.sourceVersion,
            skippedEvents: Array.isArray(json.events) ? json.events.length : 0
          },
          error: `HTTP ${response.status}`
        };
        appendConnectorSyncRecord(service, record);
        service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, direction: "ingest", error: record.error } });
        service.persist();
        return record;
      }
      const events = Array.isArray(json.events) ? json.events : [];
      const deletedExternalIds = Array.isArray(json.deletedExternalIds) ? json.deletedExternalIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
      const record = service.syncConnectorEvents(connectorId, events, scope);
      const deletedMemories = applyDeletedSourceRefs(service, connectorId, deletedExternalIds, scope);
      record.responseStatusCode = response.status;
      record.request = request;
      record.memoryIds = [...new Set([...record.memoryIds, ...deletedMemories.map((memory) => memory.id)])];
      record.externalIds = [...new Set([...record.externalIds, ...deletedExternalIds])];
      record.payload = {
        ...(record.payload ?? {}),
        cursorBefore,
        cursorAfter: firstString(json.nextCursor, json.cursor),
        lastExternalUpdatedAt: json.lastExternalUpdatedAt,
        etag: json.etag,
        sourceVersion: json.sourceVersion,
        deletedExternalIds
      };
      updateConnectorSyncState(service, record);
      service.persist();
      return record;
    } catch (error) {
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:poll:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "failed",
        memoryIds: [],
        externalIds: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "connector poll failed"
      };
      appendConnectorSyncRecord(service, record);
      service.recordAudit("connector.sync", { userId: scope.userId, brainId: scope.brainId, sourceId: scope.sourceId, metadata: { connectorId, status: record.status, direction: "ingest", error: record.error } });
      service.persist();
      return record;
    }
  }

export function connectorHealth(service: any, connectorId?: string): ConnectorHealthItem[] {
    return (service.listConnectorManifests() as ConnectorManifest[])
      .filter((manifest: ConnectorManifest) => !connectorId || manifest.id === connectorId)
      .map((manifest: ConnectorManifest) => {
        const records = service.listConnectorSyncRecords(manifest.id) as ConnectorSyncRecord[];
        const last = records.at(-1);
        const lastIngest = [...records].reverse().find((record) => record.direction === "ingest");
        const lastWriteback = [...records].reverse().find((record) => record.direction === "export");
        const vendorProvider = externalVendorProvider(manifest);
        const vendorStatus = vendorProvider ? externalVendorConfigured(vendorProvider) : undefined;
        const certification = connectorCertification(manifest, vendorProvider);
        return {
          connectorId: manifest.id,
          kind: manifest.kind,
          direction: manifest.direction,
          capabilities: manifest.capabilities,
          privacyPolicy: manifest.privacyPolicy ?? "project",
          supports: {
            list: Boolean(manifest.list?.endpoint),
            poll: Boolean(manifest.poll?.endpoint),
            ingest: manifest.capabilities.includes("ingest"),
            writeback: manifest.capabilities.includes("writeback") || manifest.capabilities.includes("export"),
            externalVendor: shouldUseExternalVendor(manifest, manifest.poll?.endpoint ?? manifest.list?.endpoint ?? manifest.writeback?.endpoint)
          },
          externalVendor: vendorProvider
            ? { provider: vendorProvider, configured: vendorStatus?.configured ?? false, missingEnv: vendorStatus?.missing ?? [] }
            : undefined,
          certification,
          lastStatus: last?.status ?? "never_run",
          lastError: last?.error,
          lastSyncAt: lastIngest?.timestamp,
          lastWritebackAt: lastWriteback?.timestamp,
          records: records.length
        };
      });
  }

export async function writebackConnector(service: any, connectorId: string, input: ConnectorWritebackInput, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_CONNECTOR_TIMEOUT_MS ?? 10_000)): Promise<ConnectorSyncRecord> {
    const manifest = service.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (!manifest.capabilities.includes("writeback") && !manifest.capabilities.includes("export")) throw new Error(`Connector ${connectorId} does not support writeback`);
    const operation = input.operation ?? "comment";
    if (manifest.writeback?.operations?.length && !manifest.writeback.operations.includes(operation)) throw new Error(`Connector ${connectorId} does not support ${operation} writeback`);
    const memories = (input.memoryIds ?? []).map((id) => safeGet(service.store, id)).filter((memory): memory is Memory => Boolean(memory));
    const target = { ...(input.target ?? {}), externalId: input.externalId ?? input.target?.externalId };
    const payload = connectorWritebackPayload(manifest, operation, target, input.content, memories, input.metadata);
    const record: ConnectorSyncRecord = {
      id: `sync_${contentHash(`${connectorId}:writeback:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
      connectorId,
      direction: "export",
      status: "queued",
      memoryIds: memories.map((memory) => memory.id),
      externalIds: [input.externalId, target.externalId].filter((id): id is string => typeof id === "string" && id.length > 0),
      timestamp: new Date().toISOString(),
      operation,
      target,
      payload,
      adapter: `${manifest.kind}:${operation}`
    };
    const request = connectorWritebackRequest(manifest, record);
    if (shouldUseExternalVendor(manifest, manifest.writeback?.endpoint)) {
      const vendor = await writebackExternalVendorConnector(manifest, record, fetchImpl, timeoutMs, input.dryRun !== false);
      record.request = vendor.request;
      if (input.dryRun === false) {
        record.responseStatusCode = vendor.responseStatusCode;
        record.status = vendor.status;
        record.error = vendor.error;
      }
    } else if (request) {
      record.request = request;
    }
    if (request && input.dryRun === false && !shouldUseExternalVendor(manifest, manifest.writeback?.endpoint)) {
      try {
        const response = await fetchImpl(request.url, { method: request.method, headers: request.headers, body: request.body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
        record.responseStatusCode = response.status;
        record.status = response.ok ? "applied" : "failed";
        if (!response.ok) record.error = `HTTP ${response.status}`;
      } catch (error) {
        record.status = "failed";
        record.error = error instanceof Error ? error.message : "connector writeback failed";
      }
    }
    appendConnectorSyncRecord(service, record);
    service.recordAudit("connector.sync", { metadata: { connectorId, status: record.status, direction: "export", operation, adapter: record.adapter, memories: record.memoryIds.length } });
    service.persist();
    return record;
  }

export function listConnectorSyncRecords(service: any, connectorId?: string): ConnectorSyncRecord[] {
    return (service.connectorSyncRecords as ConnectorSyncRecord[]).filter((record: ConnectorSyncRecord) => !connectorId || record.connectorId === connectorId);
  }

export function connectorSyncState(service: any, connectorId?: string): ConnectorSyncState[] {
    const connectorIds = new Set([
      ...(service.listConnectorManifests() as ConnectorManifest[]).map((manifest: ConnectorManifest) => manifest.id),
      ...(service.connectorSyncRecords as ConnectorSyncRecord[]).map((record: ConnectorSyncRecord) => record.connectorId),
      ...service.connectorSyncStates.keys()
    ]);
    return [...connectorIds]
      .filter((id) => !connectorId || id === connectorId)
      .map((id) => {
        const persisted = service.connectorSyncStates.get(id) as ConnectorSyncState | undefined;
        const records = (service.listConnectorSyncRecords(id) as ConnectorSyncRecord[]).sort((a: ConnectorSyncRecord, b: ConnectorSyncRecord) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = records.at(-1);
        const lastApplied = [...records].reverse().find((record) => record.status === "applied");
        const lastPoll = [...records].reverse().find((record) => record.direction === "ingest" && record.status === "applied");
        return {
          connectorId: id,
          cursor: persisted?.cursor ?? firstString(lastPoll?.payload?.cursorAfter, lastPoll?.payload?.cursor),
          lastSuccessfulPollAt: persisted?.lastSuccessfulPollAt ?? lastPoll?.timestamp,
          lastExternalUpdatedAt: persisted?.lastExternalUpdatedAt ?? firstString(lastPoll?.payload?.lastExternalUpdatedAt),
          etag: persisted?.etag ?? firstString(lastPoll?.payload?.etag),
          sourceVersion: persisted?.sourceVersion ?? firstString(lastPoll?.payload?.sourceVersion),
          lastRecordId: persisted?.lastRecordId ?? lastApplied?.id ?? last?.id,
          lastStatus: persisted?.lastStatus ?? last?.status ?? "never_run",
          records: persisted?.records ?? records.length
        };
      });
  }
