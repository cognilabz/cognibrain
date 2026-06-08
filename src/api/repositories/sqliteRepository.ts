import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { MemoryStore, asyncRepositoryFromSync, type AsyncClaimRepository, type AsyncConflictRepository, type AsyncConnectorSyncRepository, type AsyncDreamJobRepository, type AsyncEvidencePackRepository, type AsyncPolicyRepository, type AsyncTruthRepository, type AsyncUnitOfWork, type AsyncUnitOfWorkExecutor, type ClaimRecord, type ConflictSet, type ConnectorSyncState, type CurrentTruthDecision, type DreamJob, type EvidencePack, type Memory, type MemoryEvent, type MemoryEventJournal, type MemoryEventType, type MemoryFilter, type MemoryInput, type MemoryPatch, type MemoryPolicyRule, type MemoryRepository, type RepositoryStatePersistence, type RetentionRule, type UnitOfWork } from "../../core";

export class SQLiteMemoryRepository implements MemoryRepository, RepositoryStatePersistence, MemoryEventJournal, AsyncDreamJobRepository, AsyncUnitOfWorkExecutor {
  private readonly path: string;
  private database?: SQLiteDatabase;
  readonly store = new MemoryStore();
  readonly claimRepository: AsyncClaimRepository = {
    register: (claim) => this.registerClaim(claim),
    get: (id) => this.getClaim(id),
    list: (filter) => this.listClaims(filter)
  };
  readonly truthRepository: AsyncTruthRepository = {
    decide: (decision) => this.decide(decision),
    currentForClaim: (subject, predicate) => this.currentForClaim(subject, predicate)
  };
  readonly conflictRepository: AsyncConflictRepository = {
    save: (conflict) => this.saveConflict(conflict),
    get: (id) => this.getConflict(id),
    list: (filter) => this.listConflicts(filter)
  };
  readonly evidencePackRepository: AsyncEvidencePackRepository = {
    save: (pack) => this.saveEvidencePack(pack),
    get: (id) => this.getEvidencePack(id)
  };
  readonly connectorSyncRepository: AsyncConnectorSyncRepository = {
    save: (state) => this.saveConnectorSyncState(state),
    get: (connectorId) => this.getConnectorSyncState(connectorId)
  };
  readonly policyRepository: AsyncPolicyRepository = {
    savePolicy: (rule) => this.savePolicyRule(rule),
    saveRetention: (rule) => this.saveRetentionRule(rule)
  };
  readonly dreamJobRepository: AsyncDreamJobRepository = this;
  private loaded = false;
  private inTransaction = false;

  constructor(path: string) {
    this.path = resolve(path);
  }

  create(input: MemoryInput, _tx?: UnitOfWork): Memory {
    this.ensureLoaded();
    const memory = this.store.add(input);
    this.writeMemory(memory, "memory.created");
    return memory;
  }

  update(id: string, patch: MemoryPatch, _tx?: UnitOfWork): Memory {
    this.ensureLoaded();
    const memory = this.store.update(id, patch);
    this.writeMemory(memory, "memory.updated");
    return memory;
  }

  get(id: string): Memory {
    this.ensureLoaded();
    return this.store.get(id);
  }

  list(filter?: MemoryFilter | string): Memory[] {
    this.ensureLoaded();
    const normalized = typeof filter === "string" ? { userId: filter } : filter ?? {};
    let memories = this.store.list(normalized.userId);
    if (normalized.includeArchived === false) memories = memories.filter((memory) => !memory.archivedAt);
    if (normalized.limit !== undefined) memories = memories.slice(0, Math.max(0, normalized.limit));
    return memories;
  }

  delete(id: string, _tx?: UnitOfWork): boolean {
    this.ensureLoaded();
    const memory = this.store.get(id);
    const deleted = this.store.delete(id);
    if (!deleted) return false;
    this.withWriteTransaction(() => {
      const db = this.db();
      db.prepare("insert into persistence_events (created_at, event_type, memory_id, payload) values (?, ?, ?, ?)").run(nowIso(), "memory.deleted", id, JSON.stringify(memory));
      db.prepare("delete from entities where memory_id = ?").run(id);
      db.prepare("delete from relations where memory_id = ?").run(id);
      db.prepare("delete from memory_fts where id = ?").run(id);
      db.prepare("delete from memories where id = ?").run(id);
    });
    return true;
  }

  archive(id: string, _tx?: UnitOfWork): Memory {
    this.ensureLoaded();
    const memory = this.store.archive(id);
    this.writeMemory(memory, "memory.archived");
    return memory;
  }

  markAccessed(id: string, _tx?: UnitOfWork): Memory {
    this.ensureLoaded();
    const memory = this.store.markAccessed(id);
    this.writeMemory(memory, "memory.accessed");
    return memory;
  }

  import(memories: Memory[], _tx?: UnitOfWork): Memory[] {
    this.ensureLoaded();
    const imported = this.store.import(memories);
    for (const memory of imported) this.writeMemory(memory, "memory.imported");
    return imported;
  }

  export(): Memory[] {
    this.ensureLoaded();
    return this.store.export();
  }

  clear(): void {
    this.ensureLoaded();
    this.store.clear();
    this.withWriteTransaction(() => {
      const db = this.db();
      db.prepare("delete from entities").run();
      db.prepare("delete from relations").run();
      db.prepare("delete from memory_fts").run();
      db.prepare("delete from memories").run();
    });
  }

  createUnitOfWork(): AsyncUnitOfWork {
    const memoryRepository = asyncRepositoryFromSync(this);
    return {
      appendEvent: (event) => this.appendEvent(event),
      eventJournal: this,
      memoryRepository,
      claimRepository: this.claimRepository,
      conflictRepository: this.conflictRepository,
      truthRepository: this.truthRepository,
      evidencePackRepository: this.evidencePackRepository,
      dreamJobRepository: this.dreamJobRepository,
      connectorSyncRepository: this.connectorSyncRepository,
      policyRepository: this.policyRepository
    };
  }

  async executeUnitOfWork<T>(operation: (unitOfWork: AsyncUnitOfWork) => Promise<T>): Promise<T> {
    this.ensureLoaded();
    if (this.inTransaction) return operation(this.createUnitOfWork());
    const db = this.db();
    this.inTransaction = true;
    db.exec("begin immediate");
    try {
      const result = await operation(this.createUnitOfWork());
      db.exec("commit");
      return result;
    } catch (error) {
      db.exec("rollback");
      this.store.clear();
      this.loaded = false;
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  loadState(): unknown {
    this.db();
    const row = this.db().prepare("select payload from repository_state where key = ?").all("service_state")[0] as { payload?: string } | undefined;
    if (row?.payload) return JSON.parse(row.payload);
    return undefined;
  }

  saveState(state: unknown): void {
    this.withWriteTransaction(() => {
      const db = this.db();
      const now = nowIso();
      db.prepare("insert into repository_state (key, updated_at, payload) values (?, ?, ?) on conflict(key) do update set updated_at = excluded.updated_at, payload = excluded.payload")
        .run("service_state", now, JSON.stringify(state));
      const payload = state as {
        claims?: Array<{ id: string; sourceMemoryId?: string; subject?: string; predicate?: string; object?: string; state?: string }>;
        conflictSets?: Array<{ id: string; status?: string }>;
        dreamJobs?: Array<{ jobId: string; userId?: string; status?: string; trigger?: string; mode?: string; queuedAt?: string | Date; priority?: number; leaseOwner?: string; leaseUntil?: string | Date; attemptCount?: number; nextRunAt?: string | Date }>;
        connectorSyncStates?: Array<{ connectorId: string; lastStatus?: string }>;
        evidencePacks?: Array<{ id: string; userId?: string; query?: string; generatedAt?: string | Date }>;
        policyRules?: Array<{ id: string; label?: string; effect?: string }>;
        retentionRules?: Array<{ id: string; label?: string; action?: string }>;
      };
      replacePayloadTable(db, "claims", payload.claims ?? [], (claim) => [
        claim.id,
        claim.sourceMemoryId ?? null,
        claim.subject ?? null,
        claim.predicate ?? null,
        claim.object ?? null,
        claim.state ?? null,
        now,
        JSON.stringify(claim)
      ]);
      replacePayloadTable(db, "conflict_sets", payload.conflictSets ?? [], (set) => [
        set.id,
        set.status ?? null,
        now,
        JSON.stringify(set)
      ]);
      replacePayloadTable(db, "dream_jobs", payload.dreamJobs ?? [], (job) => [
        job.jobId,
        job.userId ?? null,
        job.status ?? null,
        job.trigger ?? null,
        job.mode ?? null,
        job.queuedAt ? new Date(job.queuedAt).toISOString() : now,
        job.priority ?? null,
        job.leaseOwner ?? null,
        job.leaseUntil ? new Date(job.leaseUntil).toISOString() : null,
        job.attemptCount ?? 0,
        job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        now,
        JSON.stringify(job)
      ]);
      replacePayloadTable(db, "connector_sync_states", payload.connectorSyncStates ?? [], (state) => [
        state.connectorId,
        state.lastStatus ?? null,
        now,
        JSON.stringify(state)
      ]);
      replacePayloadTable(db, "evidence_packs", payload.evidencePacks ?? [], (pack) => [
        pack.id,
        pack.userId ?? null,
        pack.query ?? null,
        pack.generatedAt ? new Date(pack.generatedAt).toISOString() : now,
        now,
        JSON.stringify(pack)
      ]);
      replacePayloadTable(db, "policy_rules", payload.policyRules ?? [], (rule) => [
        rule.id,
        rule.label ?? null,
        rule.effect ?? null,
        now,
        JSON.stringify(rule)
      ]);
      replacePayloadTable(db, "retention_rules", payload.retentionRules ?? [], (rule) => [
        rule.id,
        rule.label ?? null,
        rule.action ?? null,
        now,
        JSON.stringify(rule)
      ]);
    });
  }

  async appendEvent(event: MemoryEvent): Promise<MemoryEvent> {
    this.ensureLoaded();
    const stored = { ...event, id: event.id ?? `evt_${cryptoRandomId()}` };
    this.withWriteTransaction(() => {
      this.db().prepare("insert into persistence_events (created_at, event_type, memory_id, payload) values (?, ?, ?, ?)")
        .run(stored.occurredAt, stored.type, stored.aggregateId ?? null, JSON.stringify(stored));
    });
    return stored;
  }

  async readEvents(filter: { aggregateId?: string; type?: MemoryEventType; since?: string; limit?: number } = {}): Promise<MemoryEvent[]> {
    this.ensureLoaded();
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.aggregateId) {
      where.push("memory_id = ?");
      values.push(filter.aggregateId);
    }
    if (filter.type) {
      where.push("event_type = ?");
      values.push(filter.type);
    }
    if (filter.since) {
      where.push("created_at >= ?");
      values.push(filter.since);
    }
    const limit = filter.limit !== undefined ? ` limit ${Math.max(0, filter.limit)}` : "";
    const sql = `select payload, created_at, event_type, memory_id from persistence_events${where.length ? ` where ${where.join(" and ")}` : ""} order by created_at asc${limit}`;
    const rows = this.db().prepare(sql).all(...values) as Array<{ payload?: string; created_at: string; event_type: string; memory_id?: string | null }>;
    return rows.map((row) => {
      const payload = row.payload ? JSON.parse(row.payload) as Partial<MemoryEvent> : {};
      return {
        id: payload.id,
        type: (payload.type ?? row.event_type) as MemoryEventType,
        aggregateId: payload.aggregateId ?? row.memory_id ?? undefined,
        occurredAt: payload.occurredAt ?? row.created_at,
        payload: payload.payload ?? payload
      };
    });
  }

  async registerClaim(claim: ClaimRecord): Promise<ClaimRecord> {
    this.ensureLoaded();
    this.writeClaim(claim);
    await this.appendEvent({ type: "claim.registered", aggregateId: claim.id, occurredAt: nowIso(), payload: claim });
    return claim;
  }

  async listClaims(filter: { subject?: string; predicate?: string; sourceMemoryId?: string } = {}): Promise<ClaimRecord[]> {
    this.ensureLoaded();
    const where: string[] = [];
    const values: unknown[] = [];
    if (filter.subject) {
      where.push("subject = ?");
      values.push(filter.subject);
    }
    if (filter.predicate) {
      where.push("predicate = ?");
      values.push(filter.predicate);
    }
    if (filter.sourceMemoryId) {
      where.push("source_memory_id = ?");
      values.push(filter.sourceMemoryId);
    }
    const sql = `select payload from claims${where.length ? ` where ${where.join(" and ")}` : ""} order by updated_at desc`;
    const rows = this.db().prepare(sql).all(...values) as Array<{ payload?: string }>;
    return rows.map((row) => JSON.parse(row.payload ?? "{}") as ClaimRecord);
  }

  async getClaim(id: string): Promise<ClaimRecord | undefined> {
    this.ensureLoaded();
    const claimRow = this.db().prepare("select payload from claims where id = ?").all(id)[0] as { payload?: string } | undefined;
    return claimRow?.payload ? JSON.parse(claimRow.payload) as ClaimRecord : undefined;
  }

  async decide(decision: CurrentTruthDecision): Promise<CurrentTruthDecision> {
    this.ensureLoaded();
    const id = truthDecisionId(decision.subject, decision.predicate);
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into current_truth (id, subject, predicate, selected_claim_id, state, updated_at, payload)
        values (?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          subject = excluded.subject,
          predicate = excluded.predicate,
          selected_claim_id = excluded.selected_claim_id,
          state = excluded.state,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `).run(id, decision.subject, decision.predicate, decision.selectedClaimId ?? null, decision.state, nowIso(), JSON.stringify(decision));
    });
    await this.appendEvent({ type: "current_truth.decided", aggregateId: id, occurredAt: nowIso(), payload: decision });
    return decision;
  }

  async currentForClaim(subject: string, predicate: string): Promise<CurrentTruthDecision | undefined> {
    this.ensureLoaded();
    const row = this.db().prepare("select payload from current_truth where id = ?").all(truthDecisionId(subject, predicate))[0] as { payload?: string } | undefined;
    return row?.payload ? JSON.parse(row.payload) as CurrentTruthDecision : undefined;
  }

  async saveConflict(conflict: ConflictSet): Promise<ConflictSet> {
    this.ensureLoaded();
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into conflict_sets (id, status, updated_at, payload)
        values (?, ?, ?, ?)
        on conflict(id) do update set status = excluded.status, updated_at = excluded.updated_at, payload = excluded.payload
      `).run(conflict.id, conflict.status, nowIso(), JSON.stringify(conflict));
    });
    await this.appendEvent({ type: "conflict.opened", aggregateId: conflict.id, occurredAt: nowIso(), payload: conflict });
    return conflict;
  }

  async getConflict(id: string): Promise<ConflictSet | undefined> {
    this.ensureLoaded();
    const row = this.db().prepare("select payload from conflict_sets where id = ?").all(id)[0] as { payload?: string } | undefined;
    return row?.payload ? JSON.parse(row.payload) as ConflictSet : undefined;
  }

  async listConflicts(filter: { status?: ConflictSet["status"] } = {}): Promise<ConflictSet[]> {
    this.ensureLoaded();
    const rows = filter.status
      ? this.db().prepare("select payload from conflict_sets where status = ? order by updated_at desc").all(filter.status) as Array<{ payload?: string }>
      : this.db().prepare("select payload from conflict_sets order by updated_at desc").all() as Array<{ payload?: string }>;
    return rows.map((row) => JSON.parse(row.payload ?? "{}") as ConflictSet);
  }

  async saveEvidencePack(pack: EvidencePack): Promise<EvidencePack> {
    this.ensureLoaded();
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into evidence_packs (id, user_id, query, created_at, updated_at, payload)
        values (?, ?, ?, ?, ?, ?)
        on conflict(id) do update set user_id = excluded.user_id, query = excluded.query, created_at = excluded.created_at, updated_at = excluded.updated_at, payload = excluded.payload
      `).run(pack.id, pack.userId ?? null, pack.query ?? null, pack.generatedAt ? new Date(pack.generatedAt).toISOString() : nowIso(), nowIso(), JSON.stringify(pack));
    });
    await this.appendEvent({ type: "context_pack.created", aggregateId: pack.id, occurredAt: pack.generatedAt ?? nowIso(), payload: pack });
    return pack;
  }

  async getEvidencePack(id: string): Promise<EvidencePack | undefined> {
    this.ensureLoaded();
    const row = this.db().prepare("select payload from evidence_packs where id = ?").all(id)[0] as { payload?: string } | undefined;
    return row?.payload ? JSON.parse(row.payload) as EvidencePack : undefined;
  }

  async saveConnectorSyncState(state: ConnectorSyncState): Promise<ConnectorSyncState> {
    this.ensureLoaded();
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into connector_sync_states (connector_id, last_status, updated_at, payload)
        values (?, ?, ?, ?)
        on conflict(connector_id) do update set last_status = excluded.last_status, updated_at = excluded.updated_at, payload = excluded.payload
      `).run(state.connectorId, state.lastStatus, nowIso(), JSON.stringify(state));
    });
    await this.appendEvent({ type: "connector.polled", aggregateId: state.connectorId, occurredAt: nowIso(), payload: state });
    return state;
  }

  async getConnectorSyncState(connectorId: string): Promise<ConnectorSyncState | undefined> {
    this.ensureLoaded();
    const row = this.db().prepare("select payload from connector_sync_states where connector_id = ?").all(connectorId)[0] as { payload?: string } | undefined;
    return row?.payload ? JSON.parse(row.payload) as ConnectorSyncState : undefined;
  }

  async savePolicyRule(rule: MemoryPolicyRule): Promise<MemoryPolicyRule> {
    this.ensureLoaded();
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into policy_rules (id, label, effect, updated_at, payload)
        values (?, ?, ?, ?, ?)
        on conflict(id) do update set label = excluded.label, effect = excluded.effect, updated_at = excluded.updated_at, payload = excluded.payload
      `).run(rule.id, rule.label, rule.effect, nowIso(), JSON.stringify(rule));
    });
    return rule;
  }

  async saveRetentionRule(rule: RetentionRule): Promise<RetentionRule> {
    this.ensureLoaded();
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into retention_rules (id, label, action, updated_at, payload)
        values (?, ?, ?, ?, ?)
        on conflict(id) do update set label = excluded.label, action = excluded.action, updated_at = excluded.updated_at, payload = excluded.payload
      `).run(rule.id, rule.label, rule.action, nowIso(), JSON.stringify(rule));
    });
    return rule;
  }

  async queue(job: DreamJob): Promise<DreamJob> {
    this.ensureLoaded();
    const queued = {
      ...job,
      status: "queued" as const,
      priority: job.priority ?? 0,
      attemptCount: job.attemptCount ?? 0,
      nextRunAt: job.nextRunAt ?? job.queuedAt
    };
    this.writeDreamJob(queued);
    await this.appendEvent({ type: "dream.job_queued", aggregateId: queued.jobId, occurredAt: nowIso(), payload: queued });
    return queued;
  }

  async claimDueJob(input: { workerId: string; now?: string; leaseMs?: number }): Promise<DreamJob | undefined> {
    this.ensureLoaded();
    const now = input.now ?? nowIso();
    const leaseUntil = new Date(new Date(now).getTime() + (input.leaseMs ?? 5 * 60_000)).toISOString();
    const row = this.db().prepare(`
      select payload from dream_jobs
      where status in ('queued', 'retry_scheduled', 'retrying', 'running')
        and (next_run_at is null or next_run_at <= ?)
        and (lease_until is null or lease_until <= ?)
      order by coalesce(priority, 0) desc, queued_at asc
      limit 1
    `).all(now, now)[0] as { payload?: string } | undefined;
    if (!row?.payload) return undefined;
    const job = JSON.parse(row.payload) as DreamJob;
    const claimed: DreamJob = {
      ...job,
      status: "running",
      startedAt: job.startedAt ?? now,
      leaseOwner: input.workerId,
      leaseUntil,
      attemptCount: (job.attemptCount ?? 0) + 1
    };
    this.writeDreamJob(claimed);
    await this.appendEvent({ type: "dream.job_leased", aggregateId: claimed.jobId, occurredAt: now, payload: { jobId: claimed.jobId, leaseOwner: input.workerId, leaseUntil, attemptCount: claimed.attemptCount } });
    return claimed;
  }

  async completeJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob> {
    const job = this.getDreamJob(jobId);
    const completed: DreamJob = { ...job, ...patch, status: patch.status ?? "succeeded", finishedAt: patch.finishedAt ?? nowIso(), leaseOwner: undefined, leaseUntil: undefined };
    this.writeDreamJob(completed);
    await this.appendEvent({ type: "dream.job_completed", aggregateId: jobId, occurredAt: nowIso(), payload: completed });
    return completed;
  }

  async retryJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob> {
    const job = this.getDreamJob(jobId);
    const retryAt = patch.nextRunAt ?? new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.max(0, job.attemptCount ?? 0))).toISOString();
    const retry: DreamJob = { ...job, ...patch, status: "retry_scheduled", nextRunAt: retryAt, leaseOwner: undefined, leaseUntil: undefined };
    this.writeDreamJob(retry);
    await this.appendEvent({ type: "dream.job_queued", aggregateId: jobId, occurredAt: nowIso(), payload: retry });
    return retry;
  }

  transaction<T>(operation: (tx: UnitOfWork) => T): T {
    this.ensureLoaded();
    if (this.inTransaction) return operation({ id: "sqlite-nested" });
    const db = this.db();
    this.inTransaction = true;
    db.exec("begin immediate");
    try {
      const result = operation({ id: "sqlite" });
      db.exec("commit");
      return result;
    } catch (error) {
      db.exec("rollback");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    const rows = this.db().prepare("select payload from memories order by updated_at desc").all() as Array<{ payload?: string }>;
    if (rows.length) this.store.import(rows.map((row) => JSON.parse(row.payload ?? "{}") as Memory));
    this.loaded = true;
  }

  private writeMemory(memory: Memory, eventType: string): void {
    this.withWriteTransaction(() => {
      const createdAt = nowIso();
      const payload = JSON.stringify(memory);
      const db = this.db();
      db.prepare(`
        insert into memories (
          id, user_id, brain_id, source_id, project_id, org_id, content, type, layer,
          belief_state, visibility, created_at, updated_at, valid_from, valid_until, payload
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          user_id = excluded.user_id,
          brain_id = excluded.brain_id,
          source_id = excluded.source_id,
          project_id = excluded.project_id,
          org_id = excluded.org_id,
          content = excluded.content,
          type = excluded.type,
          layer = excluded.layer,
          belief_state = excluded.belief_state,
          visibility = excluded.visibility,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          valid_from = excluded.valid_from,
          valid_until = excluded.valid_until,
          payload = excluded.payload
      `).run(
        memory.id,
        memory.userId,
        memory.brainId ?? null,
        memory.sourceId ?? null,
        memory.projectId ?? null,
        memory.orgId ?? null,
        memory.content,
        memory.type,
        memory.layer,
        memory.beliefState,
        memory.consent.visibility,
        new Date(memory.createdAt).toISOString(),
        new Date(memory.updatedAt).toISOString(),
        memory.temporal.validFrom ? new Date(memory.temporal.validFrom).toISOString() : null,
        memory.temporal.validUntil ? new Date(memory.temporal.validUntil).toISOString() : null,
        payload
      );
      db.prepare("delete from memory_fts where id = ?").run(memory.id);
      db.prepare("insert into memory_fts (id, content, entities) values (?, ?, ?)").run(memory.id, memory.content, memory.entities.join(" "));
      db.prepare("delete from entities where memory_id = ?").run(memory.id);
      for (const entity of memory.entities) {
        db.prepare("insert into entities (memory_id, entity, user_id, created_at) values (?, ?, ?, ?)").run(memory.id, entity, memory.userId, createdAt);
      }
      db.prepare("delete from relations where memory_id = ?").run(memory.id);
      for (const relation of memory.relations) {
        db.prepare("insert into relations (memory_id, relation_type, source_entity, target_id, target_entity, valid_from, valid_until, payload) values (?, ?, ?, ?, ?, ?, ?, ?)").run(
          memory.id,
          relation.type,
          relation.sourceEntity ?? null,
          relation.targetId ?? null,
          relation.targetEntity ?? null,
          relation.validFrom ? new Date(relation.validFrom).toISOString() : null,
          relation.validUntil ? new Date(relation.validUntil).toISOString() : null,
          JSON.stringify(relation)
        );
      }
      db.prepare("insert into persistence_events (created_at, event_type, memory_id, payload) values (?, ?, ?, ?)").run(createdAt, eventType, memory.id, payload);
    });
  }

  private getDreamJob(jobId: string): DreamJob {
    this.ensureLoaded();
    const row = this.db().prepare("select payload from dream_jobs where job_id = ?").all(jobId)[0] as { payload?: string } | undefined;
    if (!row?.payload) throw new Error(`Dream job not found: ${jobId}`);
    return JSON.parse(row.payload) as DreamJob;
  }

  private writeDreamJob(job: DreamJob): void {
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into dream_jobs (job_id, user_id, status, trigger, mode, queued_at, priority, lease_owner, lease_until, attempt_count, next_run_at, updated_at, payload)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(job_id) do update set
          user_id = excluded.user_id,
          status = excluded.status,
          trigger = excluded.trigger,
          mode = excluded.mode,
          queued_at = excluded.queued_at,
          priority = excluded.priority,
          lease_owner = excluded.lease_owner,
          lease_until = excluded.lease_until,
          attempt_count = excluded.attempt_count,
          next_run_at = excluded.next_run_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `).run(
        job.jobId,
        job.userId,
        job.status,
        job.trigger,
        job.mode,
        new Date(job.queuedAt).toISOString(),
        job.priority ?? null,
        job.leaseOwner ?? null,
        job.leaseUntil ? new Date(job.leaseUntil).toISOString() : null,
        job.attemptCount ?? 0,
        job.nextRunAt ? new Date(job.nextRunAt).toISOString() : null,
        nowIso(),
        JSON.stringify(job)
      );
    });
  }

  private writeClaim(claim: ClaimRecord): void {
    this.withWriteTransaction(() => {
      this.db().prepare(`
        insert into claims (id, source_memory_id, subject, predicate, object, state, updated_at, payload)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          source_memory_id = excluded.source_memory_id,
          subject = excluded.subject,
          predicate = excluded.predicate,
          object = excluded.object,
          state = excluded.state,
          updated_at = excluded.updated_at,
          payload = excluded.payload
      `).run(
        claim.id,
        claim.sourceMemoryId ?? null,
        claim.subject ?? null,
        claim.predicate ?? null,
        claim.object ?? null,
        claim.state ?? null,
        nowIso(),
        JSON.stringify(claim)
      );
    });
  }

  private withWriteTransaction<T>(operation: () => T): T {
    if (this.inTransaction) return operation();
    const db = this.db();
    this.inTransaction = true;
    db.exec("begin immediate");
    try {
      const result = operation();
      db.exec("commit");
      return result;
    } catch (error) {
      db.exec("rollback");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }

  private db(): SQLiteDatabase {
    if (this.database) return this.database;
    mkdirSync(dirname(this.path), { recursive: true });
    const DatabaseSync = loadSQLite();
    this.database = new DatabaseSync(this.path);
    this.database.exec("pragma journal_mode = WAL");
    this.database.exec("pragma foreign_keys = ON");
    this.database.exec(`
      create table if not exists persistence_events (
        id integer primary key autoincrement,
        created_at text not null,
        event_type text not null,
        memory_id text,
        payload text not null
      );
      create table if not exists memories (
        id text primary key,
        user_id text not null,
        brain_id text,
        source_id text,
        project_id text,
        org_id text,
        content text not null,
        type text not null,
        layer text not null,
        belief_state text not null,
        visibility text not null,
        created_at text not null,
        updated_at text not null,
        valid_from text,
        valid_until text,
        payload text not null
      );
      create table if not exists relations (
        id integer primary key autoincrement,
        memory_id text not null,
        relation_type text not null,
        source_entity text,
        target_id text,
        target_entity text,
        valid_from text,
        valid_until text,
        payload text not null
      );
      create table if not exists entities (
        id integer primary key autoincrement,
        memory_id text not null,
        entity text not null,
        user_id text not null,
        created_at text not null
      );
      create virtual table if not exists memory_fts using fts5(id unindexed, content, entities);
      create table if not exists repository_state (
        key text primary key,
        updated_at text not null,
        payload text not null
      );
      create table if not exists claims (
        id text primary key,
        source_memory_id text,
        subject text,
        predicate text,
        object text,
        state text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists conflict_sets (
        id text primary key,
        status text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists current_truth (
        id text primary key,
        subject text not null,
        predicate text not null,
        selected_claim_id text,
        state text not null,
        updated_at text not null,
        payload text not null
      );
      create table if not exists dream_jobs (
        job_id text primary key,
        user_id text,
        status text,
        trigger text,
        mode text,
        queued_at text,
        priority integer,
        lease_owner text,
        lease_until text,
        attempt_count integer not null default 0,
        next_run_at text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists connector_sync_states (
        connector_id text primary key,
        last_status text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists evidence_packs (
        id text primary key,
        user_id text,
        query text,
        created_at text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists policy_rules (
        id text primary key,
        label text,
        effect text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists retention_rules (
        id text primary key,
        label text,
        action text,
        updated_at text not null,
        payload text not null
      );
    `);
    return this.database;
  }
}

export function sqliteRepositoryAvailable(): boolean {
  if (!("getBuiltinModule" in process)) return false;
  try {
    loadSQLite();
    return true;
  } catch {
    return false;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function truthDecisionId(subject: string, predicate: string): string {
  return `${subject}:${predicate}`.toLowerCase();
}

function cryptoRandomId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function replacePayloadTable<T>(db: SQLiteDatabase, table: string, rows: T[], valuesFor: (row: T) => unknown[]): void {
  db.prepare(`delete from ${table}`).run();
  const sql = table === "claims"
    ? "insert into claims (id, source_memory_id, subject, predicate, object, state, updated_at, payload) values (?, ?, ?, ?, ?, ?, ?, ?)"
    : table === "conflict_sets"
      ? "insert into conflict_sets (id, status, updated_at, payload) values (?, ?, ?, ?)"
      : table === "dream_jobs"
        ? "insert into dream_jobs (job_id, user_id, status, trigger, mode, queued_at, priority, lease_owner, lease_until, attempt_count, next_run_at, updated_at, payload) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        : table === "connector_sync_states"
          ? "insert into connector_sync_states (connector_id, last_status, updated_at, payload) values (?, ?, ?, ?)"
          : table === "evidence_packs"
            ? "insert into evidence_packs (id, user_id, query, created_at, updated_at, payload) values (?, ?, ?, ?, ?, ?)"
            : table === "policy_rules"
              ? "insert into policy_rules (id, label, effect, updated_at, payload) values (?, ?, ?, ?, ?)"
              : "insert into retention_rules (id, label, action, updated_at, payload) values (?, ?, ?, ?, ?)";
  const statement = db.prepare(sql);
  for (const row of rows) statement.run(...valuesFor(row));
}

function loadSQLite(): new (path: string) => SQLiteDatabase {
  const require = createRequire(import.meta.url);
  const sqlite = require("node:sqlite") as { DatabaseSync?: new (path: string) => SQLiteDatabase };
  if (!sqlite.DatabaseSync) throw new Error("node:sqlite DatabaseSync is not available in this Node runtime");
  return sqlite.DatabaseSync;
}

type SQLiteStatement = {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

type SQLiteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatement;
};
