import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  applyRedactionPolicy,
  extractAddOnlyMemories,
  healthReport,
  IdentityResolver,
  MemoryStore,
  normalizeLifecyclePolicy,
  normalizeRetrievalWeights,
  runDomainEvaluation,
  ReflectionEngine,
  RetrievalEngine,
  type LifecyclePolicy,
  type RedactionPolicy,
  type DomainModule
} from "../core";
import type {
  DomainEvaluationReport,
  ExtractionReport,
  FeedbackEvent,
  IdentityLink,
  LearnedProfileReport,
  Memory,
  MemoryExtractionEvent,
  MemoryInput,
  MetricsReport,
  RetrievalProfile,
  RetrievalWeights,
  SearchOptions,
  TimelineReport
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
  retrievalProfiles?: RetrievalProfile[];
  identityLinks?: IdentityLink[];
  domainEvaluations?: DomainEvaluationReport[];
}

export class MemoryService {
  readonly store = new MemoryStore();
  readonly retrieval: RetrievalEngine;
  readonly reflection: ReflectionEngine;
  readonly identities = new IdentityResolver();

  private readonly persistencePath?: string;
  private readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  private readonly redactionPolicy: RedactionPolicy;
  private readonly domainModule?: DomainModule;
  private maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  private feedbackEvents: FeedbackEvent[] = [];
  private retrievalProfiles = new Map<string, RetrievalProfile>();
  private domainEvaluations: DomainEvaluationReport[] = [];
  private searchEvents: Array<{
    timestamp: string;
    userId: string;
    sessionId?: string;
    projectId?: string;
    resultCount: number;
    lowConfidence: boolean;
    queryHash: string;
  }> = [];
  private metrics: MetricsReport = {
    memoriesAdded: 0,
    searches: 0,
    feedback: 0,
    dreams: 0,
    contradictionsResolved: 0,
    noHitSearches: 0,
    averageSearchResults: 0,
    averageQualityScore: 1,
    dreamActions: {},
    sessions: {}
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
    const defaultWeights = normalizeRetrievalWeights({ ...options.domainModule?.retrievalWeights, ...options.retrievalWeights });
    this.retrievalProfiles.set("default", {
      id: "default",
      label: "Default benchmark profile",
      weights: defaultWeights,
      updatedAt: new Date().toISOString(),
      provenance: "constructor"
    });
    this.retrieval = new RetrievalEngine(this.store, defaultWeights);
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
    const existingHashes = new Set(this.store.list(scope.userId).map((memory) => memory.metadata.contentHash).filter(Boolean));
    const inputs = extractAddOnlyMemories(events, scope).filter((input) => {
      const hash = contentHash(`${input.content}:${input.source?.kind ?? ""}:${input.timestamp ?? ""}`);
      input.metadata = { ...(input.metadata ?? {}), contentHash: hash };
      return !existingHashes.has(hash);
    });
    const memories = inputs.map((input) => this.add(linkStateChange(input, this.store.list(scope.userId))));
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
    const profile = options.profileId ? this.retrievalProfiles.get(options.profileId) : this.profileFor(options);
    const linkedUserIds = options.includeLinkedIdentities ? this.identities.resolve(options.userId).filter((id) => id !== options.userId) : [];
    const results = this.retrieval.search({
      ...options,
      linkedUserIds,
      weights: options.weights ?? profile?.weights
    });
    this.metrics.searches += 1;
    this.metrics.noHitSearches += results.length === 0 ? 1 : 0;
    this.metrics.lowConfidenceSearches = (this.metrics.lowConfidenceSearches ?? 0) + (results.some((result) => result.decision === "warn" || result.decision === "review") ? 1 : 0);
    this.metrics.averageSearchResults = rollingAverage(this.metrics.averageSearchResults, results.length, this.metrics.searches);
    this.recordSessionMetrics(options, results.length);
    this.searchEvents.push({
      timestamp: new Date().toISOString(),
      userId: options.userId,
      sessionId: options.sessionId,
      projectId: options.projectId,
      resultCount: results.length,
      lowConfidence: results.some((result) => result.decision === "warn" || result.decision === "review"),
      queryHash: contentHash(options.query)
    });
    this.persist();
    return results;
  }

  reflect(userId: string) {
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
    const report = this.reflection.run(userId);
    this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
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
    return { ...this.metrics, sessions: { ...(this.metrics.sessions ?? {}) }, dreamActions: { ...(this.metrics.dreamActions ?? {}) } };
  }

  setRetrievalProfile(profile: Omit<RetrievalProfile, "updatedAt" | "weights"> & { weights: Partial<RetrievalWeights>; updatedAt?: string }): RetrievalProfile {
    const saved: RetrievalProfile = {
      ...profile,
      weights: normalizeRetrievalWeights(profile.weights),
      updatedAt: profile.updatedAt ?? new Date().toISOString()
    };
    this.retrievalProfiles.set(saved.id, saved);
    this.persist();
    return saved;
  }

  getRetrievalProfiles(): RetrievalProfile[] {
    return [...this.retrievalProfiles.values()];
  }

  learnRetrievalProfile(id = "learned", label = "Learned feedback profile"): LearnedProfileReport {
    const positiveSignals: Partial<RetrievalWeights> = {};
    const negativeSignals: Partial<RetrievalWeights> = {};
    let samples = 0;
    for (const event of this.feedbackEvents) {
      const memory = safeGet(this.store, event.memoryId);
      if (!memory) continue;
      const bucket = event.kind === "helpful" || event.kind === "always_include" ? positiveSignals : event.kind === "wrong" || event.kind === "never_include" ? negativeSignals : undefined;
      if (!bucket) continue;
      samples += 1;
      bucket.trust = (bucket.trust ?? 0) + memory.trust;
      bucket.entity = (bucket.entity ?? 0) + Math.min(1, memory.entities.length / 5);
      bucket.temporal = (bucket.temporal ?? 0) + (memory.lastAccessedAt ? 0.6 : 0.2);
      bucket.access = (bucket.access ?? 0) + Math.min(1, Math.log1p(memory.accessCount) / 4);
    }
    const base = this.retrievalProfiles.get("default")?.weights ?? normalizeRetrievalWeights();
    const learned = { ...base };
    if (samples) {
      for (const key of Object.keys(base) as Array<keyof RetrievalWeights>) {
        learned[key] = Math.max(0.01, base[key] + ((positiveSignals[key] ?? 0) - (negativeSignals[key] ?? 0)) / Math.max(20, samples * 10));
      }
    }
    const profile = this.setRetrievalProfile({
      id,
      label,
      weights: learned,
      learned: true,
      trainingSamples: samples,
      benchmarkDelta: 0,
      provenance: "feedback coordinate update"
    });
    return { profile, samples, positiveSignals, negativeSignals };
  }

  linkIdentity(primaryUserId: string, linkedUserId: string, consentToken: string, consent: IdentityLink["consent"] = "user"): IdentityLink {
    const link = this.identities.link(primaryUserId, linkedUserId, consentToken, consent);
    this.persist();
    return link;
  }

  unlinkIdentity(id: string): IdentityLink {
    const link = this.identities.unlink(id);
    this.persist();
    return link;
  }

  timeline(userId: string): TimelineReport {
    const memories = this.store.list(userId).filter((memory) => !memory.archivedAt);
    const events = memories
      .map((memory) => ({
        memoryId: memory.id,
        content: memory.content,
        eventAt: memory.temporal.eventAt ?? memory.createdAt,
        validFrom: memory.temporal.validFrom,
        validUntil: memory.temporal.validUntil,
        supersededAt: memory.temporal.supersededAt,
        entities: memory.entities
      }))
      .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
    const periods = new Map<string, string[]>();
    for (const event of events) {
      const date = new Date(event.eventAt);
      const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      periods.set(period, [...(periods.get(period) ?? []), event.memoryId]);
    }
    const summaries = new Map(memories.filter((memory) => memory.metadata.period).map((memory) => [String(memory.metadata.period), memory.content]));
    return {
      userId,
      events,
      periods: [...periods.entries()].map(([period, memoryIds]) => ({ period, memoryIds, summary: summaries.get(period) }))
    };
  }

  lifecyclePreview(userId: string, policy?: Partial<LifecyclePolicy>) {
    const normalized = normalizeLifecyclePolicy(policy);
    const now = new Date();
    return this.store.list(userId).map((memory) => {
      const ageDays = (now.getTime() - memory.createdAt.getTime()) / 86_400_000;
      const utility = memory.trust * memory.importance + Math.log1p(memory.accessCount) / normalized.accessBoostDivisor;
      return {
        memoryId: memory.id,
        action:
          memory.pinned || normalized.protectedSourceKinds.includes(memory.source.kind) || normalized.protectedLayers.includes(memory.layer)
            ? "protect"
            : ageDays > normalized.archiveAfterDays && utility < normalized.archiveUtilityThreshold
              ? "archive"
              : ageDays > normalized.fadeAfterDays && utility < normalized.fadeUtilityThreshold
                ? "fade"
                : "keep",
        utility
      };
    });
  }

  runDomainEvaluation(domain = this.domainModule): DomainEvaluationReport {
    if (!domain) throw new Error("No domain module configured");
    const report = runDomainEvaluation(domain);
    this.domainEvaluations.push(report);
    this.metrics.benchmarkRuns = (this.metrics.benchmarkRuns ?? 0) + 1;
    this.persist();
    return report;
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
      this.recordDream(report.lifecycle.qualityScore, report.contradictions.length, report.lifecycle.actions);
      this.markDreamed(userId);
    } finally {
      this.dreaming = false;
    }
  }

  private recordDream(qualityScore: number, contradictions: number, actions: string[] = []): void {
    this.metrics.dreams += 1;
    this.metrics.contradictionsResolved += contradictions;
    this.metrics.averageQualityScore = rollingAverage(this.metrics.averageQualityScore, qualityScore, this.metrics.dreams);
    this.metrics.dreamActions ??= {};
    for (const action of actions) {
      const key = action.split(" ").slice(0, 2).join(" ");
      this.metrics.dreamActions[key] = (this.metrics.dreamActions[key] ?? 0) + 1;
    }
  }

  private recordSessionMetrics(options: SearchOptions, resultCount: number): void {
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

  private profileFor(options: SearchOptions): RetrievalProfile | undefined {
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
    this.retrievalProfiles = new Map((raw.retrievalProfiles ?? []).map((profile) => [profile.id, profile]));
    if (!this.retrievalProfiles.has("default")) {
      this.retrievalProfiles.set("default", {
        id: "default",
        label: "Default benchmark profile",
        weights: normalizeRetrievalWeights(),
        updatedAt: new Date().toISOString(),
        provenance: "migration"
      });
    }
    this.identities.import(raw.identityLinks ?? []);
    this.domainEvaluations = raw.domainEvaluations ?? [];
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
      feedback: this.feedbackEvents,
      retrievalProfiles: [...this.retrievalProfiles.values()],
      identityLinks: this.identities.export(),
      domainEvaluations: this.domainEvaluations
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

function contentHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `c_${(hash >>> 0).toString(36)}`;
}

function safeGet(store: MemoryStore, id: string): Memory | undefined {
  try {
    return store.get(id);
  } catch {
    return undefined;
  }
}

function linkStateChange(input: MemoryInput, existing: Memory[]): MemoryInput {
  const subject = input.entities?.[0];
  if (!subject) return input;
  const prior = existing.find((memory) => !memory.archivedAt && memory.entities.includes(subject) && memory.content !== input.content);
  if (!prior) return input;
  const lower = input.content.toLowerCase();
  const relationType = /\b(no longer|instead|now|currently|nicht mehr|jetzt)\b/.test(lower) ? "supersedes" : undefined;
  if (!relationType) return input;
  return {
    ...input,
    relations: [...(input.relations ?? []), { type: relationType, targetId: prior.id, targetEntity: subject, confidence: 0.62 }],
    temporal: { ...(input.temporal ?? {}), validFrom: input.timestamp ?? new Date().toISOString() }
  };
}

export const defaultService = createDefaultMemoryService();
