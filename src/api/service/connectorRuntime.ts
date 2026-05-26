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
  ConnectorAuthSession,
  ConnectorManifest,
  ConnectorSyncRecord,
  ConnectorSyncState,
  Memory,
  ExtractionReport,
  MemoryExtractionEvent,
  MemoryInput,
  FeedbackKind,
  HarnessActionInput,
  ProviderAdapterStatus
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

export interface ConnectorHealthItem {
  connectorId: string;
  kind: ConnectorManifest["kind"];
  direction: ConnectorManifest["direction"];
  capabilities: ConnectorManifest["capabilities"];
  privacyPolicy: string;
  supports: { list: boolean; poll: boolean; ingest: boolean; writeback: boolean; externalVendor: boolean };
  externalVendor?: { provider: string; configured: boolean; missingEnv: string[] };
  lastStatus: ConnectorSyncRecord["status"] | "never_run";
  lastError?: string;
  lastSyncAt?: string | Date;
  lastWritebackAt?: string | Date;
  records: number;
}

export interface ConnectorListResult {
  connectorId: string;
  status: "applied" | "failed";
  items: Array<Record<string, unknown>>;
  responseStatusCode?: number;
  error?: string;
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

export function beginConnectorOAuth(service: any, connectorId: string, input: { redirectUri?: string; scopes?: string[]; stateSalt?: string } = {}): ConnectorAuthSession {
    const manifest = service.connectorManifests.get(connectorId);
    if (!manifest) throw new Error(`Connector manifest not found: ${connectorId}`);
    if (manifest.auth !== "oauth") throw new Error(`Connector ${connectorId} does not use OAuth`);
    if (!manifest.oauth?.authorizeUrl) throw new Error(`Connector ${connectorId} is missing oauth.authorizeUrl`);
    const now = new Date().toISOString();
    const redirectUri = input.redirectUri ?? manifest.oauth.redirectUri;
    const scopes = input.scopes ?? manifest.oauth.scopes ?? [];
    const state = contentHash(`${connectorId}:${now}:${input.stateSalt ?? ""}`).slice(2, 26);
    const authorizeUrl = new URL(manifest.oauth.authorizeUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", manifest.oauth.clientIdRef ?? `${connectorId}-client`);
    authorizeUrl.searchParams.set("state", state);
    if (redirectUri) authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    if (scopes.length) authorizeUrl.searchParams.set("scope", scopes.join(" "));
    const session: ConnectorAuthSession = {
      id: `auth_${contentHash(`${connectorId}:${state}`).slice(2, 14)}`,
      connectorId,
      state,
      status: "pending",
      authorizeUrl: authorizeUrl.toString(),
      redirectUri,
      scopes,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString()
    };
    service.connectorAuthSessions.set(session.id, session);
    service.recordAudit("connector.auth", { metadata: { connectorId, sessionId: session.id, status: session.status, scopes } });
    service.persist();
    return session;
  }

export function completeConnectorOAuth(service: any, input: { connectorId: string; state: string; code?: string; tokenRef?: string; error?: string }): ConnectorAuthSession {
    const session = [...service.connectorAuthSessions.values()].find((item) => item.connectorId === input.connectorId && item.state === input.state);
    if (!session) throw new Error(`OAuth session not found for connector ${input.connectorId}`);
    const now = new Date().toISOString();
    const tokenRef = input.tokenRef ?? (input.code ? `oauth://${input.connectorId}/${contentHash(input.code).slice(2, 12)}` : undefined);
    const updated: ConnectorAuthSession = {
      ...session,
      status: input.error ? "failed" : "authorized",
      tokenRef,
      tokenHash: input.code || tokenRef ? contentHash(`${input.code ?? ""}:${tokenRef ?? ""}`).slice(2) : undefined,
      error: input.error,
      updatedAt: now
    };
    service.connectorAuthSessions.set(session.id, updated);
    const manifest = service.connectorManifests.get(input.connectorId);
    if (manifest && updated.status === "authorized" && tokenRef) {
      const next: ConnectorManifest = {
        ...manifest,
        updatedAt: now,
        list: manifest.list ? { ...manifest.list, authRef: manifest.list.authRef ?? tokenRef } : manifest.list,
        poll: manifest.poll ? { ...manifest.poll, authRef: manifest.poll.authRef ?? tokenRef } : manifest.poll,
        writeback: manifest.writeback ? { ...manifest.writeback, authRef: manifest.writeback.authRef ?? tokenRef } : manifest.writeback
      };
      service.connectorManifests.set(next.id, next);
    }
    service.recordAudit("connector.auth", { metadata: { connectorId: input.connectorId, sessionId: session.id, status: updated.status, tokenRef: updated.tokenRef } });
    service.persist();
    return updated;
  }

export function revokeConnectorAuth(service: any, connectorId: string, actorId = "system"): ConnectorAuthSession[] {
    const now = new Date().toISOString();
    const revoked: ConnectorAuthSession[] = [];
    for (const session of service.connectorAuthSessions.values()) {
      if (session.connectorId !== connectorId || session.status === "revoked") continue;
      const updated: ConnectorAuthSession = {
        ...session,
        status: "revoked",
        tokenRef: undefined,
        updatedAt: now,
        error: undefined
      };
      service.connectorAuthSessions.set(session.id, updated);
      revoked.push(updated);
    }
    const manifest = service.connectorManifests.get(connectorId);
    if (manifest) {
      service.connectorManifests.set(connectorId, {
        ...manifest,
        updatedAt: now,
        list: manifest.list ? { ...manifest.list, authRef: undefined } : manifest.list,
        poll: manifest.poll ? { ...manifest.poll, authRef: undefined } : manifest.poll,
        writeback: manifest.writeback ? { ...manifest.writeback, authRef: undefined } : manifest.writeback
      });
    }
    service.recordAudit("connector.auth", { actorId, metadata: { connectorId, status: "revoked", sessions: revoked.length } });
    service.persist();
    return revoked;
  }

export function connectorAuthStatus(service: any, connectorId?: string): ConnectorAuthSession[] {
    return [...service.connectorAuthSessions.values()]
      .filter((session) => !connectorId || session.connectorId === connectorId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
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
      for (const memory of report.memories) {
        const externalId = typeof memory.metadata.externalId === "string" ? memory.metadata.externalId : undefined;
        const event = externalId ? eventsByExternalId.get(externalId) : undefined;
        if (!event) continue;
        const reviewRequired = connectorReviewRequired(manifest, event);
        const visibility = connectorEventVisibility(event);
        const tags = connectorEventTags(manifest, event);
        if (!reviewRequired && !visibility && !tags.length) continue;
        service.store.update(memory.id, {
          beliefState: reviewRequired ? "needs_verification" : memory.beliefState,
          consent: visibility ? { ...memory.consent, visibility } : memory.consent,
          tags: [...new Set([...memory.tags, ...tags])],
          metadata: {
            ...memory.metadata,
            ...(reviewRequired ? { reviewQueue: { status: "pending", connectorId, reason: "connector_candidate_review" } } : {}),
            ...(visibility ? { channelVisibility: visibility } : {})
          }
        });
      }
      const record: ConnectorSyncRecord = {
        id: `sync_${contentHash(`${connectorId}:${Date.now()}:${service.connectorSyncRecords.length}`).slice(2)}`,
        connectorId,
        direction: "ingest",
        status: "applied",
        memoryIds: report.memories.map((memory) => memory.id),
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
      const record = service.syncConnectorEvents(connectorId, events, scope);
      record.responseStatusCode = response.status;
      record.request = request;
      record.payload = {
        ...(record.payload ?? {}),
        cursorBefore,
        cursorAfter: firstString(json.nextCursor, json.cursor),
        lastExternalUpdatedAt: json.lastExternalUpdatedAt,
        etag: json.etag,
        sourceVersion: json.sourceVersion
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

export function providerStatus(service: any): ProviderAdapterStatus {
    return {
      active: Boolean(service.defaultExtractor || service.defaultSummarizer || service.defaultVerifier || service.defaultReranker || service.defaultQueryExpander || service.defaultTranslator),
      command: process.env.MEMORY_INTELLIGENCE_COMMAND,
      timeoutMs: Number(process.env.MEMORY_INTELLIGENCE_TIMEOUT_MS ?? 3500),
      tasks: ["contradiction", "rerank", "verify", "summarize", "extract", "expand", "translate"],
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
