import type {
  ClaimRecord,
  ConflictSet,
  ConnectorSyncState,
  CurrentTruthDecision,
  DreamJob,
  EvidencePack,
  Memory,
  MemoryInput,
  MemoryPolicyRule,
  RetentionRule
} from "./types";
import type { MemoryPatch, MemoryRepository } from "./storageAdapter";
import { MemoryStore } from "./store";

export type MemoryEventType =
  | "memory.created"
  | "memory.updated"
  | "memory.deleted"
  | "claim.registered"
  | "conflict.opened"
  | "current_truth.decided"
  | "context_pack.created"
  | "guard.blocked"
  | "correction.recorded"
  | "patch_evidence.created"
  | "dream.job_queued"
  | "dream.job_leased"
  | "dream.job_completed"
  | "connector.polled"
  | "source_ref.revalidated";

export interface MemoryEvent<TPayload = unknown> {
  id?: string;
  type: MemoryEventType;
  aggregateId?: string;
  occurredAt: string;
  payload: TPayload;
}

export interface MemoryEventJournal {
  appendEvent(event: MemoryEvent): Promise<MemoryEvent>;
  readEvents(filter?: { aggregateId?: string; type?: MemoryEventType; since?: string; limit?: number }): Promise<MemoryEvent[]>;
}

export interface MemoryProjectionReport {
  eventsRead: number;
  memoriesCreatedOrUpdated: number;
  memoriesDeleted: number;
  domainEventsApplied: number;
  ignoredEvents: number;
  errors: string[];
}

export interface DomainProjection {
  claims: ClaimRecord[];
  conflictSets: ConflictSet[];
  currentTruth: CurrentTruthDecision[];
  evidencePacks: EvidencePack[];
  dreamJobs: DreamJob[];
  connectorSyncStates: ConnectorSyncState[];
}

export interface MemoryProjectionResult {
  store: MemoryStore;
  domain: DomainProjection;
  report: MemoryProjectionReport;
}

export interface AsyncClaimRepository {
  register(claim: ClaimRecord): Promise<ClaimRecord>;
  get(id: string): Promise<ClaimRecord | undefined>;
  list(filter?: { subject?: string; predicate?: string; sourceMemoryId?: string }): Promise<ClaimRecord[]>;
}

export interface AsyncConflictRepository {
  save(conflict: ConflictSet): Promise<ConflictSet>;
  get(id: string): Promise<ConflictSet | undefined>;
  list(filter?: { status?: ConflictSet["status"] }): Promise<ConflictSet[]>;
}

export interface AsyncTruthRepository {
  decide(decision: CurrentTruthDecision): Promise<CurrentTruthDecision>;
  currentForClaim(subject: string, predicate: string): Promise<CurrentTruthDecision | undefined>;
}

export interface AsyncEvidencePackRepository {
  save(pack: EvidencePack): Promise<EvidencePack>;
  get(id: string): Promise<EvidencePack | undefined>;
}

export interface AsyncDreamJobRepository {
  queue(job: DreamJob): Promise<DreamJob>;
  claimDueJob(input: { workerId: string; now?: string; leaseMs?: number }): Promise<DreamJob | undefined>;
  completeJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob>;
  retryJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob>;
}

export interface AsyncConnectorSyncRepository {
  save(state: ConnectorSyncState): Promise<ConnectorSyncState>;
  get(connectorId: string): Promise<ConnectorSyncState | undefined>;
}

export interface AsyncPolicyRepository {
  savePolicy(rule: MemoryPolicyRule): Promise<MemoryPolicyRule>;
  saveRetention(rule: RetentionRule): Promise<RetentionRule>;
}

export interface AsyncMemoryRepository {
  create(input: MemoryInput): Promise<Memory>;
  update(id: string, patch: MemoryPatch): Promise<Memory>;
  get(id: string): Promise<Memory>;
  list(filter?: { userId?: string; includeArchived?: boolean; limit?: number }): Promise<Memory[]>;
  delete(id: string): Promise<boolean>;
}

export interface AsyncUnitOfWork {
  appendEvent(event: MemoryEvent): Promise<MemoryEvent>;
  eventJournal: MemoryEventJournal;
  memoryRepository: AsyncMemoryRepository;
  claimRepository: AsyncClaimRepository;
  conflictRepository: AsyncConflictRepository;
  truthRepository: AsyncTruthRepository;
  evidencePackRepository: AsyncEvidencePackRepository;
  dreamJobRepository: AsyncDreamJobRepository;
  connectorSyncRepository: AsyncConnectorSyncRepository;
  policyRepository: AsyncPolicyRepository;
}

export interface AsyncUnitOfWorkExecutor {
  createUnitOfWork(): AsyncUnitOfWork;
  executeUnitOfWork<T>(operation: (unitOfWork: AsyncUnitOfWork) => Promise<T>): Promise<T>;
}

export class InMemoryEventJournal implements MemoryEventJournal {
  private readonly events: MemoryEvent[] = [];

  async appendEvent(event: MemoryEvent): Promise<MemoryEvent> {
    const stored = { ...event, id: event.id ?? `evt_${this.events.length + 1}` };
    this.events.push(stored);
    return stored;
  }

  async readEvents(filter: { aggregateId?: string; type?: MemoryEventType; since?: string; limit?: number } = {}): Promise<MemoryEvent[]> {
    let events = this.events.slice();
    if (filter.aggregateId) events = events.filter((event) => event.aggregateId === filter.aggregateId);
    if (filter.type) events = events.filter((event) => event.type === filter.type);
    if (filter.since) events = events.filter((event) => event.occurredAt >= filter.since!);
    if (filter.limit !== undefined) events = events.slice(0, Math.max(0, filter.limit));
    return events;
  }
}

export class MemoryProjectionBuilder {
  constructor(private readonly journal: MemoryEventJournal) {}

  async rebuild(filter: { since?: string; limit?: number } = {}): Promise<MemoryProjectionResult> {
    const store = new MemoryStore();
    const domainMaps = {
      claims: new Map<string, ClaimRecord>(),
      conflictSets: new Map<string, ConflictSet>(),
      currentTruth: new Map<string, CurrentTruthDecision>(),
      evidencePacks: new Map<string, EvidencePack>(),
      dreamJobs: new Map<string, DreamJob>(),
      connectorSyncStates: new Map<string, ConnectorSyncState>()
    };
    const report: MemoryProjectionReport = {
      eventsRead: 0,
      memoriesCreatedOrUpdated: 0,
      memoriesDeleted: 0,
      domainEventsApplied: 0,
      ignoredEvents: 0,
      errors: []
    };
    const events = await this.journal.readEvents(filter);
    for (const event of events) {
      report.eventsRead += 1;
      if (event.type === "memory.created" || event.type === "memory.updated") {
        const memory = memoryFromEventPayload(event.payload);
        if (!memory) {
          report.errors.push(`missing memory payload for ${event.type}${event.aggregateId ? `:${event.aggregateId}` : ""}`);
          continue;
        }
        store.import([memory]);
        report.memoriesCreatedOrUpdated += 1;
        continue;
      }
      if (event.type === "memory.deleted") {
        const id = memoryIdFromEvent(event);
        if (!id) {
          report.errors.push(`missing memory id for memory.deleted event${event.id ? `:${event.id}` : ""}`);
          continue;
        }
        store.delete(id);
        report.memoriesDeleted += 1;
        continue;
      }
      const domainApplied = applyDomainEvent(domainMaps, event);
      if (domainApplied) {
        report.domainEventsApplied += 1;
        continue;
      }
      report.ignoredEvents += 1;
    }
    return {
      store,
      domain: {
        claims: [...domainMaps.claims.values()],
        conflictSets: [...domainMaps.conflictSets.values()],
        currentTruth: [...domainMaps.currentTruth.values()],
        evidencePacks: [...domainMaps.evidencePacks.values()],
        dreamJobs: [...domainMaps.dreamJobs.values()],
        connectorSyncStates: [...domainMaps.connectorSyncStates.values()]
      },
      report
    };
  }
}

export async function rebuildMemoryStoreFromEvents(journal: MemoryEventJournal, filter: { since?: string; limit?: number } = {}): Promise<MemoryProjectionResult> {
  return new MemoryProjectionBuilder(journal).rebuild(filter);
}

type DomainProjectionMaps = {
  claims: Map<string, ClaimRecord>;
  conflictSets: Map<string, ConflictSet>;
  currentTruth: Map<string, CurrentTruthDecision>;
  evidencePacks: Map<string, EvidencePack>;
  dreamJobs: Map<string, DreamJob>;
  connectorSyncStates: Map<string, ConnectorSyncState>;
};

function applyDomainEvent(domainMaps: DomainProjectionMaps, event: MemoryEvent): boolean {
  if (event.type === "claim.registered" && isClaimRecord(event.payload)) {
    domainMaps.claims.set(event.payload.id, event.payload);
    return true;
  }
  if (event.type === "conflict.opened" && isConflictSet(event.payload)) {
    domainMaps.conflictSets.set(event.payload.id, event.payload);
    return true;
  }
  if (event.type === "current_truth.decided" && isCurrentTruthDecision(event.payload)) {
    domainMaps.currentTruth.set(truthDecisionId(event.payload.subject, event.payload.predicate), event.payload);
    return true;
  }
  if (event.type === "context_pack.created" && isEvidencePack(event.payload)) {
    domainMaps.evidencePacks.set(event.payload.id, event.payload);
    return true;
  }
  if ((event.type === "dream.job_queued" || event.type === "dream.job_leased" || event.type === "dream.job_completed") && isDreamJobPatch(event.payload, event.aggregateId)) {
    const jobId = event.payload.jobId ?? event.aggregateId!;
    const existing = domainMaps.dreamJobs.get(jobId);
    domainMaps.dreamJobs.set(jobId, { ...(existing ?? {}), ...event.payload, jobId } as DreamJob);
    return true;
  }
  if (event.type === "connector.polled" && isConnectorSyncState(event.payload)) {
    domainMaps.connectorSyncStates.set(event.payload.connectorId, event.payload);
    return true;
  }
  return false;
}

function memoryFromEventPayload(payload: unknown): Memory | undefined {
  if (isMemory(payload)) return payload;
  if (payload && typeof payload === "object") {
    const wrapped = payload as { memory?: unknown; payload?: unknown };
    if (isMemory(wrapped.memory)) return wrapped.memory;
    if (isMemory(wrapped.payload)) return wrapped.payload;
  }
  return undefined;
}

function memoryIdFromEvent(event: MemoryEvent): string | undefined {
  if (event.aggregateId) return event.aggregateId;
  const payload = event.payload;
  if (isMemory(payload)) return payload.id;
  if (payload && typeof payload === "object") {
    const candidate = payload as { id?: unknown; memoryId?: unknown; memory?: unknown };
    if (typeof candidate.memoryId === "string") return candidate.memoryId;
    if (typeof candidate.id === "string") return candidate.id;
    if (isMemory(candidate.memory)) return candidate.memory.id;
  }
  return undefined;
}

function isMemory(value: unknown): value is Memory {
  return Boolean(value && typeof value === "object" && typeof (value as Memory).id === "string" && typeof (value as Memory).userId === "string" && typeof (value as Memory).content === "string");
}

function isClaimRecord(value: unknown): value is ClaimRecord {
  return Boolean(value && typeof value === "object" && typeof (value as ClaimRecord).id === "string" && typeof (value as ClaimRecord).subject === "string" && typeof (value as ClaimRecord).predicate === "string");
}

function isConflictSet(value: unknown): value is ConflictSet {
  return Boolean(value && typeof value === "object" && typeof (value as ConflictSet).id === "string" && Array.isArray((value as ConflictSet).claimIds));
}

function isCurrentTruthDecision(value: unknown): value is CurrentTruthDecision {
  return Boolean(value && typeof value === "object" && typeof (value as CurrentTruthDecision).subject === "string" && typeof (value as CurrentTruthDecision).predicate === "string" && typeof (value as CurrentTruthDecision).state === "string");
}

function isEvidencePack(value: unknown): value is EvidencePack {
  return Boolean(value && typeof value === "object" && typeof (value as EvidencePack).id === "string" && typeof (value as EvidencePack).context === "string" && Array.isArray((value as EvidencePack).results));
}

function isDreamJobPatch(value: unknown, aggregateId?: string): value is Partial<DreamJob> & { jobId?: string } {
  return Boolean(value && typeof value === "object" && (typeof (value as DreamJob).jobId === "string" || typeof aggregateId === "string"));
}

function isConnectorSyncState(value: unknown): value is ConnectorSyncState {
  return Boolean(value && typeof value === "object" && typeof (value as ConnectorSyncState).connectorId === "string" && typeof (value as ConnectorSyncState).lastStatus === "string");
}

function truthDecisionId(subject: string, predicate: string): string {
  return `${subject}:${predicate}`.toLowerCase();
}

export function asyncRepositoryFromSync(repository: MemoryRepository): AsyncMemoryRepository {
  return {
    create: async (input) => repository.create(input),
    update: async (id, patch) => repository.update(id, patch),
    get: async (id) => repository.get(id),
    list: async (filter) => repository.list(filter),
    delete: async (id) => repository.delete(id)
  };
}
