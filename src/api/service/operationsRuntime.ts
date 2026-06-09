import { createHmac } from "node:crypto";
import { AppendOnlyLogPersistenceAdapter, CassandraCompatiblePersistenceAdapter, CassandraRemotePersistenceAdapter, JsonFilePersistenceAdapter, PostgresCompatiblePersistenceAdapter, PostgresRemotePersistenceAdapter, SQLitePersistenceAdapter, sqliteAvailable } from "../persistence";
import type { AuditChainExport, AuditEvent, ConsentPolicy, Memory, OfflineOperation, StorageBackendStatus, SyncReport, TranslationReport, WebhookDelivery, WebhookRegistration } from "../../core";
import { contentHash, deterministicTranslate } from "./helpers";

export function translateText(service: any, text: string, sourceLanguage?: string, targetLanguage = "en"): TranslationReport {
    const provider = service.defaultTranslator?.translate({ text, sourceLanguage, targetLanguage });
    const translated = provider?.translated && provider.translated !== text ? provider.translated : deterministicTranslate(text, sourceLanguage, targetLanguage);
    const report: TranslationReport = {
      original: text,
      sourceLanguage,
      targetLanguage,
      translated,
      provider: provider?.translated && provider.translated !== text ? "json-command" : "deterministic",
      confidence: provider?.confidence ?? (translated === text ? 0.35 : 0.68)
    };
    service.recordAudit("provider.call", { metadata: { task: "translate", sourceLanguage, targetLanguage, provider: report.provider, confidence: report.confidence } });
    service.persist();
    return report;
  }

export function structuredLog(service: any, event: string, payload: Record<string, unknown> = {}): Record<string, unknown> {
    const record = {
      timestamp: new Date().toISOString(),
      level: payload.level ?? "info",
      event,
      traceId: payload.traceId ?? contentHash(`${event}:${Date.now()}`).slice(2, 14),
      service: "cognibrain",
      payload
    };
    service.recordAudit("provider.call", { metadata: { resource: "structured-log", event, traceId: record.traceId } });
    return record;
  }

export function deliverWebhookQueue(service: any, handler?: (webhook: WebhookRegistration, event: AuditEvent) => { ok: boolean; error?: string }): { delivered: number; failed: number; queued: number } {
    let delivered = 0;
    let failed = 0;
    for (const delivery of service.webhookDeliveries as WebhookDelivery[]) {
      if (delivery.status !== "queued" && delivery.status !== "failed") continue;
      if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt).getTime() > Date.now()) continue;
      const webhook = service.webhooks.get(delivery.webhookId);
      const event = (service.auditEvents as AuditEvent[]).find((item) => item.id === delivery.eventId);
      if (!webhook || !event || webhook.disabledAt) continue;
      const result = handler ? handler(webhook, event) : { ok: true };
      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      if (result.ok) {
        delivery.status = "delivered";
        delivery.lastError = undefined;
        delivered += 1;
      } else {
        delivery.status = "failed";
        delivery.lastError = result.error ?? "delivery failed";
        delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
        failed += 1;
      }
    }
    service.persist();
    return { delivered, failed, queued: (service.webhookDeliveries as WebhookDelivery[]).filter((delivery) => delivery.status === "queued").length };
  }

export async function deliverWebhookQueueHttp(service: any, fetchImpl: typeof fetch = fetch, timeoutMs = Number(process.env.MEMORY_WEBHOOK_TIMEOUT_MS ?? 10_000)): Promise<{ delivered: number; failed: number; queued: number }> {
    let delivered = 0;
    let failed = 0;
    for (const delivery of service.webhookDeliveries as WebhookDelivery[]) {
      if (delivery.status !== "queued" && delivery.status !== "failed") continue;
      if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt).getTime() > Date.now()) continue;
      const webhook = service.webhooks.get(delivery.webhookId);
      const event = (service.auditEvents as AuditEvent[]).find((item) => item.id === delivery.eventId);
      if (!webhook || !event || webhook.disabledAt) continue;
      const body = JSON.stringify({ deliveryId: delivery.id, event });
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "user-agent": "cognibrain-webhook/0.1",
        "x-cognibrain-delivery": delivery.id,
        "x-cognibrain-event": event.type
      };
      if (webhook.secretRef) {
        headers["x-cognibrain-signature"] = `sha256=${createHmac("sha256", webhook.secretRef).update(body).digest("hex")}`;
      }
      delivery.attempts += 1;
      delivery.lastAttemptAt = new Date().toISOString();
      try {
        const response = await fetchImpl(webhook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(Math.max(1, timeoutMs)) });
        delivery.lastStatusCode = response.status;
        if (response.ok) {
          delivery.status = "delivered";
          delivery.lastError = undefined;
          delivery.nextAttemptAt = undefined;
          delivered += 1;
        } else {
          delivery.status = "failed";
          delivery.lastError = `HTTP ${response.status}`;
          delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
          failed += 1;
        }
      } catch (error) {
        delivery.status = "failed";
        delivery.lastError = error instanceof Error ? error.message : "delivery failed";
        delivery.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * 2 ** delivery.attempts)).toISOString();
        failed += 1;
      }
    }
    service.persist();
    return { delivered, failed, queued: (service.webhookDeliveries as WebhookDelivery[]).filter((delivery) => delivery.status === "queued").length };
  }

export function storageStatus(service: any): StorageBackendStatus {
    const memory = {
      kind: "memory",
      durable: false,
      distributedReady: false,
      transactional: false,
      notes: ["Process-local adapter for tests and embedded runtimes."]
    };
    const json = { kind: "json-file", ...new JsonFilePersistenceAdapter(".memory-harness.json").capabilities() };
    const jsonl = { kind: "append-only-log", ...new AppendOnlyLogPersistenceAdapter(".memory-harness.jsonl").capabilities(), encryptedAppendLog: service.redactionPolicy.mode === "encrypt" };
    const postgres = { kind: "postgres-compatible", ...new PostgresCompatiblePersistenceAdapter(".memory-harness.postgres.json").capabilities() };
    const cockroach = { kind: "cockroach-compatible", ...new PostgresCompatiblePersistenceAdapter(".memory-harness.cockroach.json").capabilities(), notes: ["CockroachDB-compatible mode uses the PostgreSQL wire-protocol adapter and external quorum replication.", "Set MEMORY_STORAGE_BACKEND=cockroach with MEMORY_POSTGRES_URL in production."] };
    const cassandra = { kind: "cassandra-compatible", ...new CassandraCompatiblePersistenceAdapter(".memory-harness.cassandra.json").capabilities() };
    const postgresRemote = { kind: "postgres-remote", ...new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL ?? "postgres://user:pass@host:5432/cognibrain").capabilities() };
    const cockroachRemote = { kind: "cockroach-remote", ...new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL ?? "postgres://user:pass@host:26257/cognibrain", { cockroach: true }).capabilities() };
    const cassandraRemote = { kind: "cassandra-remote", ...new CassandraRemotePersistenceAdapter(process.env.MEMORY_CASSANDRA_CONTACT_POINT ?? "127.0.0.1").capabilities() };
    const sqlite = sqliteAvailable()
      ? { kind: "sqlite", ...new SQLitePersistenceAdapter(".memory-harness.sqlite").capabilities() }
      : {
          kind: "sqlite",
          durable: false,
          distributedReady: false,
          transactional: false,
          appendOnly: false,
          sql: true,
          encryptedAtRest: false,
          migrationSafe: false,
          lexical: { strategy: "none" as const, indexed: false, notes: ["SQLite FTS5 is unavailable in this Node runtime."] },
          vector: { strategy: "in-memory" as const, indexed: false, notes: ["Optional embedding providers can score vectors in memory for development without API keys."] },
          notes: ["Unavailable in this Node runtime; use Node with node:sqlite or another SQL adapter."]
        };
    const repositoryName = service.repository?.constructor?.name;
    const repositoryActive =
      repositoryName === "SQLiteMemoryRepository" ? "sqlite-repository"
        : repositoryName === "PostgresMemoryRepository" ? "postgres-repository"
          : undefined;
    return {
      active: service.persistence?.kind ?? repositoryActive ?? "memory",
      adapters: [memory, json, jsonl, sqlite, postgres, cockroach, cassandra, postgresRemote, cockroachRemote, cassandraRemote]
    };
  }

export function auditTrail(service: any, filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditEvent[] {
    return (service.auditEvents as AuditEvent[])
      .filter((event) => !filter.userId || event.userId === filter.userId)
      .filter((event) => !filter.memoryId || event.memoryId === filter.memoryId)
      .filter((event) => !filter.type || event.type === filter.type)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

export function auditChain(service: any, filter: { userId?: string; memoryId?: string; type?: AuditEvent["type"] } = {}): AuditChainExport {
    const events = (service.auditTrail(filter) as AuditEvent[])
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((event) => service.toJournalEvent(event));
    const replay = service.replayAuditEvents(events);
    return {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      eventCount: events.length,
      headHash: events.at(-1)?.hash,
      valid: replay.valid,
      events,
      replay
    };
  }

export function replayAuditState(service: any, events: AuditEvent[] = service.auditEvents): AuditChainExport["replay"] {
    return service.replayAuditEvents(events.map((event) => service.toJournalEvent(event)));
  }

export function updateConsent(service: any, memoryId: string, consent: Partial<ConsentPolicy>): Memory {
    const before = service.store.get(memoryId);
    const memory = service.store.update(memoryId, { consent });
    service.recordAudit("memory.consent", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId, metadata: { before, after: memory, beforeConsent: before.consent, afterConsent: memory.consent } });
    service.persist();
    return memory;
  }

export async function updateConsentAsync(service: any, memoryId: string, consent: Partial<ConsentPolicy>): Promise<Memory> {
    const before = service.store.get(memoryId);
    const memory = await service.updateAsync(memoryId, { consent });
    service.recordAudit("memory.consent", { userId: memory.userId, brainId: memory.brainId, sourceId: memory.sourceId, memoryId, metadata: { before, after: memory, beforeConsent: before.consent, afterConsent: memory.consent, productionUnitOfWork: Boolean(service.productionAsyncRepository?.executeUnitOfWork) } });
    return memory;
  }

export function revertMemory(service: any, memoryId: string, auditEventId?: string): Memory {
    const candidates = (service.auditEvents as AuditEvent[])
      .filter((event) => event.memoryId === memoryId && (event.type === "memory.update" || event.type === "memory.consent" || event.type === "memory.delete"))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const event = auditEventId ? candidates.find((candidate) => candidate.id === auditEventId) : candidates[0];
    const before = event?.metadata?.before as Memory | undefined;
    if (!event || !before) throw new Error(`No revert snapshot found for memory ${memoryId}`);
    const restored = service.restoreMemorySnapshot(before);
    service.recordAudit("memory.revert", { userId: restored.userId, brainId: restored.brainId, sourceId: restored.sourceId, memoryId, metadata: { revertedEventId: event.id } });
    service.persist();
    return restored;
  }

export async function revertMemoryAsync(service: any, memoryId: string, auditEventId?: string): Promise<Memory> {
    const candidates = (service.auditEvents as AuditEvent[])
      .filter((event) => event.memoryId === memoryId && (event.type === "memory.update" || event.type === "memory.consent" || event.type === "memory.delete"))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const event = auditEventId ? candidates.find((candidate) => candidate.id === auditEventId) : candidates[0];
    const before = event?.metadata?.before as Memory | undefined;
    if (!event || !before) throw new Error(`No revert snapshot found for memory ${memoryId}`);
    const restored = await service.updateAsync(before.id, before);
    service.recordAudit("memory.revert", { userId: restored.userId, brainId: restored.brainId, sourceId: restored.sourceId, memoryId, metadata: { revertedEventId: event.id, productionUnitOfWork: Boolean(service.productionAsyncRepository?.executeUnitOfWork) } });
    return restored;
  }

export function queueOfflineOperation(service: any, input: Omit<OfflineOperation, "id" | "occurredAt" | "status"> & { id?: string; occurredAt?: Date | string; status?: OfflineOperation["status"] }): OfflineOperation {
    const operation: OfflineOperation = {
      ...input,
      id: input.id ?? `op_${contentHash(`${input.type}:${input.userId}:${input.clientMutationId ?? Date.now()}`).slice(2)}`,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      status: input.status ?? "queued"
    };
    service.offlineOperations.push(operation);
    service.recordAudit("sync.queue", { userId: operation.userId, memoryId: operation.memoryId, metadata: { operationId: operation.id, type: operation.type } });
    service.persist();
    return operation;
  }

export function syncOfflineOperations(service: any): SyncReport {
    const applied: OfflineOperation[] = [];
    const conflicts: OfflineOperation[] = [];
    const failed: OfflineOperation[] = [];
    const remaining: OfflineOperation[] = [];
    for (const operation of service.offlineOperations as OfflineOperation[]) {
      if (operation.status !== "queued") {
        remaining.push(operation);
        continue;
      }
      const resolved = service.applyOfflineOperation(operation);
      if (resolved.status === "applied") applied.push(resolved);
      else if (resolved.status === "conflict") conflicts.push(resolved);
      else failed.push(resolved);
      if (resolved.status !== "applied") remaining.push(resolved);
    }
    service.offlineOperations = remaining;
    const report: SyncReport = {
      generatedAt: new Date().toISOString(),
      applied,
      conflicts,
      failed,
      remaining: [...service.offlineOperations]
    };
    service.recordAudit("sync.run", { metadata: { applied: applied.length, conflicts: conflicts.length, failed: failed.length, remaining: remaining.length } });
    service.persist();
    return report;
  }

export function syncStatus(service: any): { queued: OfflineOperation[]; counts: Record<OfflineOperation["status"], number> } {
    const counts: Record<OfflineOperation["status"], number> = { queued: 0, applied: 0, conflict: 0, failed: 0 };
    for (const operation of service.offlineOperations as OfflineOperation[]) counts[operation.status] += 1;
    return { queued: [...service.offlineOperations], counts };
  }
