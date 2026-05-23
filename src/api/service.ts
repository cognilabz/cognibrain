import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  applyRedactionPolicy,
  extractAddOnlyMemories,
  healthReport,
  MemoryStore,
  normalizeLifecyclePolicy,
  normalizeRetrievalWeights,
  ReflectionEngine,
  RetrievalEngine,
  type LifecyclePolicy,
  type RedactionPolicy,
  type DomainModule
} from "../core";
import type {
  ExtractionReport,
  FeedbackEvent,
  Memory,
  MemoryExtractionEvent,
  MemoryInput,
  MetricsReport,
  RetrievalWeights,
  SearchOptions
} from "../core";

export interface MemoryServiceOptions {
  persistencePath?: string;
  autoDream?: {
    enabled?: boolean;
    intervalHours?: number;
    writeThreshold?: number;
  };
  retrievalWeights?: Partial<RetrievalWeights>;
  lifecyclePolicy?: Partial<LifecyclePolicy>;
  redactionPolicy?: RedactionPolicy;
  domainModule?: DomainModule;
}

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

interface PersistedMemoryFile {
  version: 1 | 2;
  memories: Memory[];
  maintenance: {
    users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
  };
  metrics?: MetricsReport;
  feedback?: FeedbackEvent[];
}

export class MemoryService {
  readonly store = new MemoryStore();
  readonly retrieval: RetrievalEngine;
  readonly reflection: ReflectionEngine;

  private readonly persistencePath?: string;
  private readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  private readonly redactionPolicy: RedactionPolicy;
  private readonly domainModule?: DomainModule;
  private maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  private feedbackEvents: FeedbackEvent[] = [];
  private metrics: MetricsReport = {
    memoriesAdded: 0,
    searches: 0,
    feedback: 0,
    dreams: 0,
    contradictionsResolved: 0,
    noHitSearches: 0,
    averageSearchResults: 0,
    averageQualityScore: 1
  };
  private dreaming = false;

  constructor(options: MemoryServiceOptions = {}) {
    this.persistencePath = options.persistencePath ? resolve(options.persistencePath) : undefined;
    this.autoDream = {
      enabled: options.autoDream?.enabled ?? false,
      intervalHours: options.autoDream?.intervalHours ?? 6,
      writeThreshold: options.autoDream?.writeThreshold ?? 12
    };
    this.domainModule = options.domainModule;
    this.redactionPolicy = options.redactionPolicy ?? options.domainModule?.redactionPolicy ?? { mode: process.env.MEMORY_REDACTION_MODE === "off" ? "off" : "redact" };
    this.retrieval = new RetrievalEngine(this.store, normalizeRetrievalWeights({ ...options.domainModule?.retrievalWeights, ...options.retrievalWeights }));
    this.reflection = new ReflectionEngine(this.store, normalizeLifecyclePolicy({ ...options.domainModule?.lifecyclePolicy, ...options.lifecyclePolicy }));
    this.load();
  }

  add(input: MemoryInput) {
    const enriched = this.domainModule?.enrich ? this.domainModule.enrich(input) : input;
    const checked = applyRedactionPolicy(enriched, this.redactionPolicy);
    if (checked.rejected || !checked.input) {
      throw new Error(`Memory rejected by redaction policy: ${checked.matches.map((match) => match.detector).join(", ")}`);
    }
    const memory = this.store.add(checked.input);
    if (memory.metadata.archivedOnWrite) this.store.archive(memory.id);
    this.metrics.memoriesAdded += 1;
    this.afterWrite(memory.userId);
    return memory;
  }

  extract(
    events: MemoryExtractionEvent[],
    scope: Pick<MemoryInput, "userId" | "agentId" | "sessionId" | "appId" | "orgId" | "projectId" | "runId">
  ): ExtractionReport {
    const inputs = extractAddOnlyMemories(events, scope);
    const memories = inputs.map((input) => this.add(input));
    const entityLinks: Record<string, string[]> = {};
    for (const memory of memories) {
      for (const entity of memory.entities) {
        entityLinks[entity] ??= [];
        entityLinks[entity].push(memory.id);
      }
    }
    return { memories, entityLinks };
  }

  list(userId?: string) {
    return this.store.list(userId);
  }

  get(id: string) {
    return this.store.get(id);
  }

  update(id: string, patch: Partial<MemoryInput>) {
    const memory = this.store.update(id, patch);
    this.afterWrite(memory.userId);
    return memory;
  }

  delete(id: string) {
    const memory = this.store.get(id);
    const deleted = this.store.delete(id);
    if (deleted) this.afterWrite(memory.userId);
    return deleted;
  }

  search(options: SearchOptions) {
    const results = this.retrieval.search(options);
    this.metrics.searches += 1;
    this.metrics.noHitSearches += results.length === 0 ? 1 : 0;
    this.metrics.averageSearchResults = rollingAverage(this.metrics.averageSearchResults, results.length, this.metrics.searches);
    this.persist();
    return results;
  }

  reflect(userId: string) {
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length);
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length);
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  feedback(event: FeedbackEvent): Memory {
    const memory = this.store.get(event.memoryId);
    const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString();
    const delta = feedbackDelta(event.kind);
    const updated = this.store.update(event.memoryId, {
      trust: clamp01(memory.trust + delta.trust),
      importance: clamp01(memory.importance + delta.importance),
      pinned: event.kind === "always_include" ? true : memory.pinned,
      consent:
        event.kind === "private"
          ? { ...memory.consent, visibility: "private" }
          : event.kind === "shareable"
            ? { ...memory.consent, visibility: "org" }
            : memory.consent,
      metadata: {
        feedback: [...((memory.metadata.feedback as unknown[]) ?? []), { ...event, timestamp }]
      }
    });
    this.feedbackEvents.push({ ...event, timestamp });
    this.metrics.feedback += 1;
    this.persist();
    return updated;
  }

  exportUser(userId: string): Memory[] {
    return this.store.list(userId);
  }

  deleteUser(userId: string): number {
    const memories = this.store.list(userId);
    for (const memory of memories) this.store.delete(memory.id);
    this.persist();
    return memories.length;
  }

  metricsReport(): MetricsReport {
    return { ...this.metrics };
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
    for (const userId of new Set(this.store.list().map((memory) => memory.userId))) {
      if (!this.isDreamDue(userId, now)) continue;
      this.runAutoDream(userId);
      dreamed.push(userId);
    }
    return dreamed;
  }

  private afterWrite(userId: string): void {
    const status = this.userMaintenance(userId);
    status.writesSinceDream += 1;
    if (this.autoDream.enabled && this.isDreamDue(userId)) this.runAutoDream(userId);
    this.persist();
  }

  private runAutoDream(userId: string): void {
    if (this.dreaming) return;
    this.dreaming = true;
    try {
      const report = this.reflection.run(userId);
      this.recordDream(report.lifecycle.qualityScore, report.contradictions.length);
      this.markDreamed(userId);
    } finally {
      this.dreaming = false;
    }
  }

  private recordDream(qualityScore: number, contradictions: number): void {
    this.metrics.dreams += 1;
    this.metrics.contradictionsResolved += contradictions;
    this.metrics.averageQualityScore = rollingAverage(this.metrics.averageQualityScore, qualityScore, this.metrics.dreams);
  }

  private isDreamDue(userId: string, now = new Date()): boolean {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return true;
    if (!status.lastDreamAt) return false;
    const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
    return ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0;
  }

  private markDreamed(userId: string): void {
    const status = this.userMaintenance(userId);
    status.lastDreamAt = new Date().toISOString();
    status.writesSinceDream = 0;
  }

  private userMaintenance(userId: string): { lastDreamAt?: string; writesSinceDream: number } {
    this.maintenance.users[userId] ??= { writesSinceDream: 0 };
    return this.maintenance.users[userId];
  }

  private load(): void {
    if (!this.persistencePath || !existsSync(this.persistencePath)) return;
    const contents = readFileSync(this.persistencePath, "utf8").trim();
    if (!contents) return;
    const raw = JSON.parse(contents) as PersistedMemoryFile | MemoryInput[];
    if (Array.isArray(raw)) {
      this.store.seed(raw);
      return;
    }
    this.maintenance = raw.maintenance ?? { users: {} };
    this.metrics = raw.metrics ?? this.metrics;
    this.feedbackEvents = raw.feedback ?? [];
    this.store.import(raw.memories ?? []);
  }

  private persist(): void {
    if (!this.persistencePath) return;
    mkdirSync(dirname(this.persistencePath), { recursive: true });
    const payload: PersistedMemoryFile = {
      version: 2,
      memories: this.store.export(),
      maintenance: this.maintenance,
      metrics: this.metrics,
      feedback: this.feedbackEvents
    };
    const tempPath = `${this.persistencePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    renameSync(tempPath, this.persistencePath);
  }
}

export function createDefaultMemoryService() {
  const persistencePath = process.env.NODE_ENV === "test" ? undefined : process.env.MEMORY_DB_PATH ?? ".memory-harness.json";
  const autoDreamEnabled = process.env.MEMORY_AUTO_DREAM !== "false";
  return new MemoryService({
    persistencePath,
    autoDream: {
      enabled: autoDreamEnabled,
      intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
      writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
    },
    redactionPolicy: { mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE) }
  });
}

function redactionModeFromEnv(value: string | undefined): RedactionPolicy["mode"] {
  if (value === "off" || value === "reject" || value === "archive") return value;
  return "redact";
}

function feedbackDelta(kind: FeedbackEvent["kind"]): { trust: number; importance: number } {
  switch (kind) {
    case "helpful":
      return { trust: 0.04, importance: 0.06 };
    case "always_include":
      return { trust: 0.06, importance: 0.12 };
    case "wrong":
      return { trust: -0.18, importance: -0.08 };
    case "stale":
      return { trust: -0.1, importance: -0.04 };
    case "never_include":
      return { trust: -0.25, importance: -0.18 };
    default:
      return { trust: 0, importance: 0 };
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rollingAverage(current: number, sample: number, count: number): number {
  return current + (sample - current) / Math.max(1, count);
}

export const defaultService = createDefaultMemoryService();
