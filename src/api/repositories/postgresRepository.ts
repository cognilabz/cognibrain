import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Pool, type PoolClient, type QueryResult } from "pg";
import { MemoryStore, type AsyncClaimRepository, type AsyncConflictRepository, type AsyncConnectorSyncRepository, type AsyncDreamJobRepository, type AsyncEvidencePackRepository, type AsyncPolicyRepository, type AsyncTruthRepository, type AsyncUnitOfWork, type AsyncUnitOfWorkExecutor, type ClaimRecord, type ConflictSet, type ConnectorSyncState, type CurrentTruthDecision, type DreamJob, type EvidencePack, type Memory, type MemoryEvent, type MemoryEventJournal, type MemoryEventType, type MemoryFilter, type MemoryInput, type MemoryPatch, type MemoryPolicyRule, type MemoryRepository, type RepositoryStatePersistence, type RetentionRule, type UnitOfWork } from "../../core";

export type PostgresRepositoryMigration = {
  version: number;
  name: string;
  checksum: string;
};

export type AsyncPostgresRepositoryOptions = {
  pool?: Pool;
  max?: number;
  enableRls?: boolean;
  statementTimeoutMs?: number;
  applicationName?: string;
};

const POSTGRES_MIGRATIONS: Array<Omit<PostgresRepositoryMigration, "checksum"> & { sql: string }> = [
  {
    version: 11,
    name: "postgres_pg_driver_repository",
    sql: `
      create table if not exists cognibrain_schema_migrations (
        version integer primary key,
        name text not null,
        checksum text,
        applied_at timestamptz not null default now()
      );
      create table if not exists cognibrain_persistence_events (
        id bigserial primary key,
        event_type text not null,
        memory_id text,
        created_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_memories (
        memory_id text primary key,
        user_id text not null,
        brain_id text,
        source_id text,
        project_id text,
        org_id text,
        tenant_id text,
        content text not null,
        memory_type text not null,
        memory_layer text not null,
        belief_state text not null,
        visibility text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        valid_from timestamptz,
        valid_until timestamptz,
        search_vector tsvector,
        payload jsonb not null
      );
      create table if not exists cognibrain_repository_state (
        key text primary key,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_entities (
        id bigserial primary key,
        memory_id text not null references cognibrain_memories(memory_id) on delete cascade,
        entity text not null,
        user_id text not null,
        created_at timestamptz not null default now()
      );
      create table if not exists cognibrain_relations (
        id bigserial primary key,
        memory_id text not null references cognibrain_memories(memory_id) on delete cascade,
        relation_type text not null,
        source_entity text,
        target_id text,
        target_entity text,
        valid_from timestamptz,
        valid_until timestamptz,
        payload jsonb not null
      );
      create table if not exists cognibrain_claims (
        claim_id text primary key,
        source_memory_id text,
        subject text,
        predicate text,
        object text,
        state text,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_conflict_sets (
        conflict_set_id text primary key,
        status text,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_claim_evidence (
        claim_id text not null,
        memory_id text not null,
        evidence_kind text,
        created_at timestamptz not null default now(),
        payload jsonb not null,
        primary key (claim_id, memory_id)
      );
      create table if not exists cognibrain_truth_resolutions (
        resolution_id text primary key,
        conflict_set_id text,
        selected_claim_id text,
        resolved_by text,
        reason text,
        created_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_current_truth (
        id text primary key,
        subject text not null,
        predicate text not null,
        selected_claim_id text,
        state text not null,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_dream_jobs (
        job_id text primary key,
        user_id text,
        org_id text,
        project_id text,
        status text,
        trigger text,
        mode text,
        queued_at timestamptz,
        priority integer,
        lease_owner text,
        lease_until timestamptz,
        attempt_count integer not null default 0,
        next_run_at timestamptz,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_dream_job_logs (
        id bigserial primary key,
        job_id text not null,
        level text not null,
        message text not null,
        created_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_connector_sync_states (
        connector_id text primary key,
        org_id text,
        project_id text,
        last_status text,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_evidence_packs (
        evidence_pack_id text primary key,
        user_id text,
        org_id text,
        project_id text,
        query text,
        created_at timestamptz,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_policy_rules (
        rule_id text primary key,
        org_id text,
        project_id text,
        label text,
        effect text,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_retention_rules (
        rule_id text primary key,
        org_id text,
        project_id text,
        label text,
        action text,
        updated_at timestamptz not null default now(),
        payload jsonb not null
      );
      create table if not exists cognibrain_audit_events (
        audit_event_id text primary key,
        event_type text,
        user_id text,
        org_id text,
        project_id text,
        memory_id text,
        actor_id text,
        created_at timestamptz,
        payload jsonb not null
      );
      create index if not exists idx_cognibrain_memories_user_id on cognibrain_memories(user_id);
      create index if not exists idx_cognibrain_memories_org_id on cognibrain_memories(org_id);
      create index if not exists idx_cognibrain_memories_project_id on cognibrain_memories(project_id);
      create index if not exists idx_cognibrain_memories_tenant_id on cognibrain_memories(tenant_id);
      create index if not exists idx_cognibrain_memories_search_vector on cognibrain_memories using gin(search_vector);
      create index if not exists idx_cognibrain_entities_entity on cognibrain_entities(entity);
      create index if not exists idx_cognibrain_relations_type on cognibrain_relations(relation_type);
    `
  },
  {
    version: 12,
    name: "postgres_optional_rls_scope_tables",
    sql: `
      alter table cognibrain_memories enable row level security;
      alter table cognibrain_evidence_packs enable row level security;
      alter table cognibrain_dream_jobs enable row level security;
      alter table cognibrain_policy_rules enable row level security;
      drop policy if exists cognibrain_memories_scope on cognibrain_memories;
      drop policy if exists cognibrain_evidence_scope on cognibrain_evidence_packs;
      drop policy if exists cognibrain_dream_jobs_scope on cognibrain_dream_jobs;
      drop policy if exists cognibrain_policy_rules_scope on cognibrain_policy_rules;
      create policy cognibrain_memories_scope on cognibrain_memories
        using (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true))
        with check (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true));
      create policy cognibrain_evidence_scope on cognibrain_evidence_packs
        using (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true))
        with check (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true));
      create policy cognibrain_dream_jobs_scope on cognibrain_dream_jobs
        using (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true))
        with check (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true));
      create policy cognibrain_policy_rules_scope on cognibrain_policy_rules
        using (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true))
        with check (coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true));
    `
  },
  {
    version: 13,
    name: "postgres_dream_job_leases",
    sql: `
      alter table cognibrain_dream_jobs add column if not exists priority integer;
      alter table cognibrain_dream_jobs add column if not exists lease_owner text;
      alter table cognibrain_dream_jobs add column if not exists lease_until timestamptz;
      alter table cognibrain_dream_jobs add column if not exists attempt_count integer not null default 0;
      alter table cognibrain_dream_jobs add column if not exists next_run_at timestamptz;
      create index if not exists idx_cognibrain_dream_jobs_lease on cognibrain_dream_jobs(status, next_run_at, lease_until);
    `
  }
];

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function truthDecisionId(subject: string, predicate: string): string {
  return `${subject}:${predicate}`.toLowerCase();
}

export class AsyncPostgresMemoryRepository implements RepositoryStatePersistence, MemoryEventJournal, AsyncDreamJobRepository, AsyncUnitOfWorkExecutor {
  readonly kind = "postgres-async-repository";
  readonly pool: Pool;
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
  private readonly ownsPool: boolean;
  private initialized = false;

  constructor(private readonly url: string, private readonly options: AsyncPostgresRepositoryOptions = {}) {
    this.pool = options.pool ?? new Pool({
      connectionString: url,
      max: options.max ?? Number(process.env.MEMORY_POSTGRES_POOL_MAX ?? 10),
      statement_timeout: options.statementTimeoutMs ?? Number(process.env.MEMORY_POSTGRES_STATEMENT_TIMEOUT_MS ?? 15_000),
      application_name: options.applicationName ?? "cognibrain"
    });
    this.ownsPool = !options.pool;
  }

  static migrations(): PostgresRepositoryMigration[] {
    return POSTGRES_MIGRATIONS.map((migration) => ({
      version: migration.version,
      name: migration.name,
      checksum: checksumSql(migration.sql)
    }));
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.withClient(async (client) => {
      for (const migration of POSTGRES_MIGRATIONS) {
        if (migration.version === 12 && !this.rlsEnabled()) continue;
        await client.query(migration.sql);
        await client.query(
          "insert into cognibrain_schema_migrations(version, name, checksum) values ($1, $2, $3) on conflict(version) do update set name = excluded.name, checksum = excluded.checksum",
          [migration.version, migration.name, checksumSql(migration.sql)]
        );
      }
    });
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.ownsPool) await this.pool.end();
  }

  async create(input: MemoryInput): Promise<Memory> {
    const store = new MemoryStore();
    const memory = store.add(input);
    await this.upsertMemory(memory, "memory.created");
    return memory;
  }

  async update(id: string, patch: MemoryPatch): Promise<Memory> {
    const current = await this.get(id);
    const store = new MemoryStore();
    store.import([current]);
    const memory = store.update(id, patch);
    await this.upsertMemory(memory, "memory.updated");
    return memory;
  }

  async get(id: string): Promise<Memory> {
    await this.initialize();
    const row = await this.queryOne<{ payload: Memory }>("select payload from cognibrain_memories where memory_id = $1", [id]);
    if (!row) throw new Error(`Memory not found: ${id}`);
    return row.payload;
  }

  async list(filter: MemoryFilter = {}): Promise<Memory[]> {
    await this.initialize();
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.userId) {
      values.push(filter.userId);
      clauses.push(`user_id = $${values.length}`);
    }
    if (filter.includeArchived === false) clauses.push("(payload->>'archivedAt') is null");
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const limit = filter.limit !== undefined ? `limit ${Math.max(0, filter.limit)}` : "";
    const result = await this.pool.query<{ payload: Memory }>(`select payload from cognibrain_memories ${where} order by updated_at desc ${limit}`, values);
    return result.rows.map((row) => row.payload);
  }

  async import(memories: Memory[]): Promise<Memory[]> {
    await this.initialize();
    for (const memory of memories) await this.upsertMemory(memory, "memory.updated");
    return memories;
  }

  createUnitOfWork(): AsyncUnitOfWork {
    return {
      appendEvent: (event) => this.appendEvent(event),
      eventJournal: this,
      memoryRepository: this,
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
    return this.transaction((client) => operation(this.createClientUnitOfWork(client)));
  }

  private createClientUnitOfWork(client: PoolClient): AsyncUnitOfWork {
    const appendEvent = async (event: MemoryEvent): Promise<MemoryEvent> => {
      const stored = { ...event, id: event.id ?? `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
      await client.query(
        "insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)",
        [stored.type, stored.aggregateId ?? null, JSON.stringify(stored)]
      );
      return stored;
    };
    const memoryRepository = {
      create: async (input: MemoryInput): Promise<Memory> => {
        const store = new MemoryStore();
        const memory = store.add(input);
        await this.upsertMemoryWithClient(client, memory, "memory.created");
        return memory;
      },
      update: async (id: string, patch: MemoryPatch): Promise<Memory> => {
        const current = await memoryRepository.get(id);
        const store = new MemoryStore();
        store.import([current]);
        const memory = store.update(id, patch);
        await this.upsertMemoryWithClient(client, memory, "memory.updated");
        return memory;
      },
      get: async (id: string): Promise<Memory> => {
        const row = (await client.query<{ payload: Memory }>("select payload from cognibrain_memories where memory_id = $1", [id])).rows[0];
        if (!row) throw new Error(`Memory not found: ${id}`);
        return row.payload;
      },
      list: async (filter: MemoryFilter = {}): Promise<Memory[]> => {
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filter.userId) {
          values.push(filter.userId);
          clauses.push(`user_id = $${values.length}`);
        }
        if (filter.includeArchived === false) clauses.push("(payload->>'archivedAt') is null");
        const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
        const limit = filter.limit !== undefined ? `limit ${Math.max(0, filter.limit)}` : "";
        const result = await client.query<{ payload: Memory }>(`select payload from cognibrain_memories ${where} order by updated_at desc ${limit}`, values);
        return result.rows.map((row) => row.payload);
      },
      delete: async (id: string): Promise<boolean> => {
        const memory = await memoryRepository.get(id);
        await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", ["memory.deleted", id, JSON.stringify(memory)]);
        await client.query("delete from cognibrain_memories where memory_id = $1", [id]);
        return true;
      }
    };
    const claimRepository: AsyncClaimRepository = {
      register: async (claim) => {
        await client.query(
          "insert into cognibrain_claims(claim_id, source_memory_id, subject, predicate, object, state, updated_at, payload) values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb) on conflict(claim_id) do update set source_memory_id = excluded.source_memory_id, subject = excluded.subject, predicate = excluded.predicate, object = excluded.object, state = excluded.state, updated_at = excluded.updated_at, payload = excluded.payload",
          [claim.id, claim.sourceMemoryId ?? null, claim.subject ?? null, claim.predicate ?? null, claim.object ?? null, claim.state ?? null, JSON.stringify(claim)]
        );
        await appendEvent({ type: "claim.registered", aggregateId: claim.id, occurredAt: new Date().toISOString(), payload: claim });
        return claim;
      },
      get: async (id) => (await client.query<{ payload: ClaimRecord }>("select payload from cognibrain_claims where claim_id = $1", [id])).rows[0]?.payload,
      list: async (filter = {}) => {
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filter.subject) {
          values.push(filter.subject);
          clauses.push(`subject = $${values.length}`);
        }
        if (filter.predicate) {
          values.push(filter.predicate);
          clauses.push(`predicate = $${values.length}`);
        }
        if (filter.sourceMemoryId) {
          values.push(filter.sourceMemoryId);
          clauses.push(`source_memory_id = $${values.length}`);
        }
        const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
        return (await client.query<{ payload: ClaimRecord }>(`select payload from cognibrain_claims ${where} order by updated_at desc`, values)).rows.map((row) => row.payload);
      }
    };
    const truthRepository: AsyncTruthRepository = {
      decide: async (decision) => {
        const id = truthDecisionId(decision.subject, decision.predicate);
        await client.query(
          "insert into cognibrain_current_truth(id, subject, predicate, selected_claim_id, state, updated_at, payload) values ($1,$2,$3,$4,$5,now(),$6::jsonb) on conflict(id) do update set subject = excluded.subject, predicate = excluded.predicate, selected_claim_id = excluded.selected_claim_id, state = excluded.state, updated_at = excluded.updated_at, payload = excluded.payload",
          [id, decision.subject, decision.predicate, decision.selectedClaimId ?? null, decision.state, JSON.stringify(decision)]
        );
        await appendEvent({ type: "current_truth.decided", aggregateId: id, occurredAt: new Date().toISOString(), payload: decision });
        return decision;
      },
      currentForClaim: async (subject, predicate) => (await client.query<{ payload: CurrentTruthDecision }>("select payload from cognibrain_current_truth where id = $1", [truthDecisionId(subject, predicate)])).rows[0]?.payload
    };
    const conflictRepository: AsyncConflictRepository = {
      save: async (conflict) => {
        await client.query("insert into cognibrain_conflict_sets(conflict_set_id, status, updated_at, payload) values ($1,$2,now(),$3::jsonb) on conflict(conflict_set_id) do update set status = excluded.status, updated_at = excluded.updated_at, payload = excluded.payload", [conflict.id, conflict.status, JSON.stringify(conflict)]);
        await appendEvent({ type: "conflict.opened", aggregateId: conflict.id, occurredAt: new Date().toISOString(), payload: conflict });
        return conflict;
      },
      get: async (id) => (await client.query<{ payload: ConflictSet }>("select payload from cognibrain_conflict_sets where conflict_set_id = $1", [id])).rows[0]?.payload,
      list: async (filter = {}) => {
        const values = filter.status ? [filter.status] : [];
        const where = filter.status ? "where status = $1" : "";
        return (await client.query<{ payload: ConflictSet }>(`select payload from cognibrain_conflict_sets ${where} order by updated_at desc`, values)).rows.map((row) => row.payload);
      }
    };
    const evidencePackRepository: AsyncEvidencePackRepository = {
      save: async (pack) => {
        await client.query("insert into cognibrain_evidence_packs(evidence_pack_id, user_id, query, created_at, updated_at, payload) values ($1,$2,$3,$4,now(),$5::jsonb) on conflict(evidence_pack_id) do update set user_id = excluded.user_id, query = excluded.query, created_at = excluded.created_at, updated_at = excluded.updated_at, payload = excluded.payload", [pack.id, pack.userId ?? null, pack.query ?? null, pack.generatedAt ? iso(pack.generatedAt) : new Date().toISOString(), JSON.stringify(pack)]);
        await appendEvent({ type: "context_pack.created", aggregateId: pack.id, occurredAt: pack.generatedAt ?? new Date().toISOString(), payload: pack });
        return pack;
      },
      get: async (id) => (await client.query<{ payload: EvidencePack }>("select payload from cognibrain_evidence_packs where evidence_pack_id = $1", [id])).rows[0]?.payload
    };
    const connectorSyncRepository: AsyncConnectorSyncRepository = {
      save: async (state) => {
        await client.query("insert into cognibrain_connector_sync_states(connector_id, last_status, updated_at, payload) values ($1,$2,now(),$3::jsonb) on conflict(connector_id) do update set last_status = excluded.last_status, updated_at = excluded.updated_at, payload = excluded.payload", [state.connectorId, state.lastStatus, JSON.stringify(state)]);
        await appendEvent({ type: "connector.polled", aggregateId: state.connectorId, occurredAt: new Date().toISOString(), payload: state });
        return state;
      },
      get: async (connectorId) => (await client.query<{ payload: ConnectorSyncState }>("select payload from cognibrain_connector_sync_states where connector_id = $1", [connectorId])).rows[0]?.payload
    };
    const policyRepository: AsyncPolicyRepository = {
      savePolicy: async (rule) => {
        await client.query("insert into cognibrain_policy_rules(rule_id, label, effect, updated_at, payload) values ($1,$2,$3,now(),$4::jsonb) on conflict(rule_id) do update set label = excluded.label, effect = excluded.effect, updated_at = excluded.updated_at, payload = excluded.payload", [rule.id, rule.label, rule.effect, JSON.stringify(rule)]);
        return rule;
      },
      saveRetention: async (rule) => {
        await client.query("insert into cognibrain_retention_rules(rule_id, label, action, updated_at, payload) values ($1,$2,$3,now(),$4::jsonb) on conflict(rule_id) do update set label = excluded.label, action = excluded.action, updated_at = excluded.updated_at, payload = excluded.payload", [rule.id, rule.label, rule.action, JSON.stringify(rule)]);
        return rule;
      }
    };
    const dreamJobRepository: AsyncDreamJobRepository = {
      queue: async (job) => {
        const queued: DreamJob = { ...job, status: "queued", priority: job.priority ?? 0, attemptCount: job.attemptCount ?? 0, nextRunAt: job.nextRunAt ?? job.queuedAt };
        await this.writeDreamJobWithClient(client, queued);
        await appendEvent({ type: "dream.job_queued", aggregateId: queued.jobId, occurredAt: new Date().toISOString(), payload: queued });
        return queued;
      },
      claimDueJob: async (input) => {
        const now = input.now ?? new Date().toISOString();
        const leaseUntil = new Date(new Date(now).getTime() + (input.leaseMs ?? 5 * 60_000)).toISOString();
        const row = (await client.query<{ payload: DreamJob }>(`
          select payload from cognibrain_dream_jobs
          where status in ('queued', 'retry_scheduled', 'retrying', 'running')
            and (next_run_at is null or next_run_at <= $1)
            and (lease_until is null or lease_until <= $1)
          order by coalesce(priority, 0) desc, queued_at asc
          limit 1
          for update skip locked
        `, [now])).rows[0];
        if (!row?.payload) return undefined;
        const claimed: DreamJob = { ...row.payload, status: "running", startedAt: row.payload.startedAt ?? now, leaseOwner: input.workerId, leaseUntil, attemptCount: (row.payload.attemptCount ?? 0) + 1 };
        await this.writeDreamJobWithClient(client, claimed);
        await appendEvent({ type: "dream.job_leased", aggregateId: claimed.jobId, occurredAt: now, payload: { jobId: claimed.jobId, leaseOwner: input.workerId, leaseUntil, attemptCount: claimed.attemptCount } });
        return claimed;
      },
      completeJob: async (jobId, patch) => {
        const row = (await client.query<{ payload: DreamJob }>("select payload from cognibrain_dream_jobs where job_id = $1", [jobId])).rows[0];
        if (!row?.payload) throw new Error(`Dream job not found: ${jobId}`);
        const completed: DreamJob = { ...row.payload, ...patch, status: patch.status ?? "succeeded", finishedAt: patch.finishedAt ?? new Date().toISOString(), leaseOwner: undefined, leaseUntil: undefined };
        await this.writeDreamJobWithClient(client, completed);
        await appendEvent({ type: "dream.job_completed", aggregateId: jobId, occurredAt: new Date().toISOString(), payload: completed });
        return completed;
      },
      retryJob: async (jobId, patch) => {
        const row = (await client.query<{ payload: DreamJob }>("select payload from cognibrain_dream_jobs where job_id = $1", [jobId])).rows[0];
        if (!row?.payload) throw new Error(`Dream job not found: ${jobId}`);
        const retryAt = patch.nextRunAt ?? new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.max(0, row.payload.attemptCount ?? 0))).toISOString();
        const retry: DreamJob = { ...row.payload, ...patch, status: "retry_scheduled", nextRunAt: retryAt, leaseOwner: undefined, leaseUntil: undefined };
        await this.writeDreamJobWithClient(client, retry);
        await appendEvent({ type: "dream.job_queued", aggregateId: jobId, occurredAt: new Date().toISOString(), payload: retry });
        return retry;
      }
    };
    return {
      appendEvent,
      eventJournal: { appendEvent, readEvents: (filter) => this.readEvents(filter) },
      memoryRepository,
      claimRepository,
      conflictRepository,
      truthRepository,
      evidencePackRepository,
      dreamJobRepository,
      connectorSyncRepository,
      policyRepository
    };
  }

  async search(query: string, filter: MemoryFilter = {}): Promise<Memory[]> {
    await this.initialize();
    const values: unknown[] = [query];
    const clauses = ["search_vector @@ plainto_tsquery('simple', $1)"];
    if (filter.userId) {
      values.push(filter.userId);
      clauses.push(`user_id = $${values.length}`);
    }
    const limit = filter.limit !== undefined ? `limit ${Math.max(0, filter.limit)}` : "";
    const result = await this.pool.query<{ payload: Memory }>(
      `select payload from cognibrain_memories where ${clauses.join(" and ")} order by ts_rank(search_vector, plainto_tsquery('simple', $1)) desc, updated_at desc ${limit}`,
      values
    );
    return result.rows.map((row) => row.payload);
  }

  async delete(id: string): Promise<boolean> {
    const memory = await this.get(id);
    await this.transaction(async (client) => {
      await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", ["memory.deleted", id, JSON.stringify(memory)]);
      await client.query("delete from cognibrain_memories where memory_id = $1", [id]);
    });
    return true;
  }

  async markAccessed(id: string): Promise<Memory> {
    const memory = await this.get(id);
    const updated = { ...memory, lastAccessedAt: new Date() } as Memory;
    await this.upsertMemory(updated, "memory.accessed");
    return updated;
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    await this.initialize();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async loadStateAsync(): Promise<unknown> {
    await this.initialize();
    return (await this.queryOne<{ payload: unknown }>("select payload from cognibrain_repository_state where key = $1", ["service_state"]))?.payload;
  }

  async saveStateAsync(state: unknown): Promise<void> {
    await this.initialize();
    await this.pool.query("insert into cognibrain_repository_state(key, payload) values ($1, $2::jsonb) on conflict(key) do update set updated_at = now(), payload = excluded.payload", ["service_state", JSON.stringify(state)]);
  }

  async saveProjectionRowsAsync(state: {
    claims?: unknown[];
    conflictSets?: unknown[];
    dreamJobs?: unknown[];
    connectorSyncStates?: unknown[];
    evidencePacks?: unknown[];
    policyRules?: unknown[];
    retentionRules?: unknown[];
    auditEvents?: unknown[];
  }): Promise<void> {
    await this.initialize();
    const now = new Date().toISOString();
    await this.transaction(async (client) => {
      await this.replaceProjectionRows(client, "cognibrain_claims", state.claims || [], (claim) => [claim.id, claim.sourceMemoryId || null, claim.subject || null, claim.predicate || null, claim.object || null, claim.state || null, now, JSON.stringify(claim)]);
      await this.replaceProjectionRows(client, "cognibrain_conflict_sets", state.conflictSets || [], (set) => [set.id, set.status || null, now, JSON.stringify(set)]);
      await this.replaceProjectionRows(client, "cognibrain_dream_jobs", state.dreamJobs || [], (job) => [job.jobId, job.userId || null, job.status || null, job.trigger || null, job.mode || null, job.queuedAt ? iso(job.queuedAt) : now, job.priority ?? null, job.leaseOwner || null, job.leaseUntil ? iso(job.leaseUntil) : null, job.attemptCount ?? 0, job.nextRunAt ? iso(job.nextRunAt) : null, now, JSON.stringify(job)]);
      await this.replaceProjectionRows(client, "cognibrain_connector_sync_states", state.connectorSyncStates || [], (syncState) => [syncState.connectorId, syncState.lastStatus || null, now, JSON.stringify(syncState)]);
      await this.replaceProjectionRows(client, "cognibrain_evidence_packs", state.evidencePacks || [], (pack) => [pack.id, pack.userId || null, pack.query || null, pack.generatedAt ? iso(pack.generatedAt) : now, now, JSON.stringify(pack)]);
      await this.replaceProjectionRows(client, "cognibrain_policy_rules", state.policyRules || [], (rule) => [rule.id, rule.label || null, rule.effect || null, now, JSON.stringify(rule)]);
      await this.replaceProjectionRows(client, "cognibrain_retention_rules", state.retentionRules || [], (rule) => [rule.id, rule.label || null, rule.action || null, now, JSON.stringify(rule)]);
      await this.replaceProjectionRows(client, "cognibrain_audit_events", (state.auditEvents || []).filter((event: any) => event.id), (event) => [event.id, event.type || null, event.userId || null, event.memoryId || null, event.actorId || null, event.timestamp ? iso(event.timestamp) : now, JSON.stringify(event)]);
    });
  }

  private async replaceProjectionRows(client: PoolClient, table: string, rows: any[], valuesFor: (row: any) => unknown[]): Promise<void> {
    await client.query("delete from " + table);
    const sql = table === "cognibrain_claims"
      ? "insert into cognibrain_claims(claim_id, source_memory_id, subject, predicate, object, state, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)"
      : table === "cognibrain_conflict_sets"
        ? "insert into cognibrain_conflict_sets(conflict_set_id, status, updated_at, payload) values ($1,$2,$3,$4::jsonb)"
        : table === "cognibrain_dream_jobs"
          ? "insert into cognibrain_dream_jobs(job_id, user_id, status, trigger, mode, queued_at, priority, lease_owner, lease_until, attempt_count, next_run_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)"
          : table === "cognibrain_connector_sync_states"
            ? "insert into cognibrain_connector_sync_states(connector_id, last_status, updated_at, payload) values ($1,$2,$3,$4::jsonb)"
            : table === "cognibrain_evidence_packs"
              ? "insert into cognibrain_evidence_packs(evidence_pack_id, user_id, query, created_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6::jsonb)"
              : table === "cognibrain_policy_rules"
                ? "insert into cognibrain_policy_rules(rule_id, label, effect, updated_at, payload) values ($1,$2,$3,$4,$5::jsonb)"
                : table === "cognibrain_retention_rules"
                  ? "insert into cognibrain_retention_rules(rule_id, label, action, updated_at, payload) values ($1,$2,$3,$4,$5::jsonb)"
                  : "insert into cognibrain_audit_events(audit_event_id, event_type, user_id, memory_id, actor_id, created_at, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)";
    for (const row of rows) await client.query(sql, valuesFor(row));
  }

  async registerClaim(claim: ClaimRecord): Promise<ClaimRecord> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_claims(claim_id, source_memory_id, subject, predicate, object, state, updated_at, payload) values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb) on conflict(claim_id) do update set source_memory_id = excluded.source_memory_id, subject = excluded.subject, predicate = excluded.predicate, object = excluded.object, state = excluded.state, updated_at = excluded.updated_at, payload = excluded.payload",
      [claim.id, claim.sourceMemoryId ?? null, claim.subject ?? null, claim.predicate ?? null, claim.object ?? null, claim.state ?? null, JSON.stringify(claim)]
    );
    await this.appendEvent({ type: "claim.registered", aggregateId: claim.id, occurredAt: new Date().toISOString(), payload: claim });
    return claim;
  }

  async getClaim(id: string): Promise<ClaimRecord | undefined> {
    await this.initialize();
    return (await this.queryOne<{ payload: ClaimRecord }>("select payload from cognibrain_claims where claim_id = $1", [id]))?.payload;
  }

  async listClaims(filter: { subject?: string; predicate?: string; sourceMemoryId?: string } = {}): Promise<ClaimRecord[]> {
    await this.initialize();
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.subject) {
      values.push(filter.subject);
      clauses.push(`subject = $${values.length}`);
    }
    if (filter.predicate) {
      values.push(filter.predicate);
      clauses.push(`predicate = $${values.length}`);
    }
    if (filter.sourceMemoryId) {
      values.push(filter.sourceMemoryId);
      clauses.push(`source_memory_id = $${values.length}`);
    }
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await this.pool.query<{ payload: ClaimRecord }>(`select payload from cognibrain_claims ${where} order by updated_at desc`, values);
    return result.rows.map((row) => row.payload);
  }

  async decide(decision: CurrentTruthDecision): Promise<CurrentTruthDecision> {
    await this.initialize();
    const id = truthDecisionId(decision.subject, decision.predicate);
    await this.pool.query(
      "insert into cognibrain_current_truth(id, subject, predicate, selected_claim_id, state, updated_at, payload) values ($1,$2,$3,$4,$5,now(),$6::jsonb) on conflict(id) do update set subject = excluded.subject, predicate = excluded.predicate, selected_claim_id = excluded.selected_claim_id, state = excluded.state, updated_at = excluded.updated_at, payload = excluded.payload",
      [id, decision.subject, decision.predicate, decision.selectedClaimId ?? null, decision.state, JSON.stringify(decision)]
    );
    await this.appendEvent({ type: "current_truth.decided", aggregateId: id, occurredAt: new Date().toISOString(), payload: decision });
    return decision;
  }

  async currentForClaim(subject: string, predicate: string): Promise<CurrentTruthDecision | undefined> {
    await this.initialize();
    return (await this.queryOne<{ payload: CurrentTruthDecision }>("select payload from cognibrain_current_truth where id = $1", [truthDecisionId(subject, predicate)]))?.payload;
  }

  async saveConflict(conflict: ConflictSet): Promise<ConflictSet> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_conflict_sets(conflict_set_id, status, updated_at, payload) values ($1,$2,now(),$3::jsonb) on conflict(conflict_set_id) do update set status = excluded.status, updated_at = excluded.updated_at, payload = excluded.payload",
      [conflict.id, conflict.status, JSON.stringify(conflict)]
    );
    await this.appendEvent({ type: "conflict.opened", aggregateId: conflict.id, occurredAt: new Date().toISOString(), payload: conflict });
    return conflict;
  }

  async getConflict(id: string): Promise<ConflictSet | undefined> {
    await this.initialize();
    return (await this.queryOne<{ payload: ConflictSet }>("select payload from cognibrain_conflict_sets where conflict_set_id = $1", [id]))?.payload;
  }

  async listConflicts(filter: { status?: ConflictSet["status"] } = {}): Promise<ConflictSet[]> {
    await this.initialize();
    const values: unknown[] = [];
    const where = filter.status ? "where status = $1" : "";
    if (filter.status) values.push(filter.status);
    const result = await this.pool.query<{ payload: ConflictSet }>(`select payload from cognibrain_conflict_sets ${where} order by updated_at desc`, values);
    return result.rows.map((row) => row.payload);
  }

  async saveEvidencePack(pack: EvidencePack): Promise<EvidencePack> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_evidence_packs(evidence_pack_id, user_id, query, created_at, updated_at, payload) values ($1,$2,$3,$4,now(),$5::jsonb) on conflict(evidence_pack_id) do update set user_id = excluded.user_id, query = excluded.query, created_at = excluded.created_at, updated_at = excluded.updated_at, payload = excluded.payload",
      [pack.id, pack.userId ?? null, pack.query ?? null, pack.generatedAt ? iso(pack.generatedAt) : new Date().toISOString(), JSON.stringify(pack)]
    );
    await this.appendEvent({ type: "context_pack.created", aggregateId: pack.id, occurredAt: pack.generatedAt ?? new Date().toISOString(), payload: pack });
    return pack;
  }

  async getEvidencePack(id: string): Promise<EvidencePack | undefined> {
    await this.initialize();
    return (await this.queryOne<{ payload: EvidencePack }>("select payload from cognibrain_evidence_packs where evidence_pack_id = $1", [id]))?.payload;
  }

  async saveConnectorSyncState(state: ConnectorSyncState): Promise<ConnectorSyncState> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_connector_sync_states(connector_id, last_status, updated_at, payload) values ($1,$2,now(),$3::jsonb) on conflict(connector_id) do update set last_status = excluded.last_status, updated_at = excluded.updated_at, payload = excluded.payload",
      [state.connectorId, state.lastStatus, JSON.stringify(state)]
    );
    await this.appendEvent({ type: "connector.polled", aggregateId: state.connectorId, occurredAt: new Date().toISOString(), payload: state });
    return state;
  }

  async getConnectorSyncState(connectorId: string): Promise<ConnectorSyncState | undefined> {
    await this.initialize();
    return (await this.queryOne<{ payload: ConnectorSyncState }>("select payload from cognibrain_connector_sync_states where connector_id = $1", [connectorId]))?.payload;
  }

  async savePolicyRule(rule: MemoryPolicyRule): Promise<MemoryPolicyRule> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_policy_rules(rule_id, label, effect, updated_at, payload) values ($1,$2,$3,now(),$4::jsonb) on conflict(rule_id) do update set label = excluded.label, effect = excluded.effect, updated_at = excluded.updated_at, payload = excluded.payload",
      [rule.id, rule.label, rule.effect, JSON.stringify(rule)]
    );
    return rule;
  }

  async saveRetentionRule(rule: RetentionRule): Promise<RetentionRule> {
    await this.initialize();
    await this.pool.query(
      "insert into cognibrain_retention_rules(rule_id, label, action, updated_at, payload) values ($1,$2,$3,now(),$4::jsonb) on conflict(rule_id) do update set label = excluded.label, action = excluded.action, updated_at = excluded.updated_at, payload = excluded.payload",
      [rule.id, rule.label, rule.action, JSON.stringify(rule)]
    );
    return rule;
  }

  async appendEvent(event: MemoryEvent): Promise<MemoryEvent> {
    await this.initialize();
    const stored = { ...event, id: event.id ?? `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}` };
    await this.pool.query(
      "insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)",
      [stored.type, stored.aggregateId ?? null, JSON.stringify(stored)]
    );
    return stored;
  }

  async readEvents(filter: { aggregateId?: string; type?: MemoryEventType; since?: string; limit?: number } = {}): Promise<MemoryEvent[]> {
    await this.initialize();
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filter.aggregateId) {
      values.push(filter.aggregateId);
      clauses.push(`memory_id = $${values.length}`);
    }
    if (filter.type) {
      values.push(filter.type);
      clauses.push(`event_type = $${values.length}`);
    }
    if (filter.since) {
      values.push(filter.since);
      clauses.push(`created_at >= $${values.length}`);
    }
    const limit = filter.limit !== undefined ? ` limit ${Math.max(0, filter.limit)}` : "";
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await this.pool.query<{ event_type: string; memory_id?: string | null; created_at: string; payload: unknown }>(
      `select event_type, memory_id, created_at, payload from cognibrain_persistence_events ${where} order by created_at asc${limit}`,
      values
    );
    return result.rows.map((row) => {
      const payload = row.payload as Partial<MemoryEvent> | undefined;
      return {
        id: payload?.id,
        type: (payload?.type ?? row.event_type) as MemoryEventType,
        aggregateId: payload?.aggregateId ?? row.memory_id ?? undefined,
        occurredAt: payload?.occurredAt ?? new Date(row.created_at).toISOString(),
        payload: payload?.payload ?? payload
      };
    });
  }

  async queue(job: DreamJob): Promise<DreamJob> {
    await this.initialize();
    const queued: DreamJob = {
      ...job,
      status: "queued",
      priority: job.priority ?? 0,
      attemptCount: job.attemptCount ?? 0,
      nextRunAt: job.nextRunAt ?? job.queuedAt
    };
    await this.writeDreamJob(queued);
    await this.appendEvent({ type: "dream.job_queued", aggregateId: queued.jobId, occurredAt: new Date().toISOString(), payload: queued });
    return queued;
  }

  async claimDueJob(input: { workerId: string; now?: string; leaseMs?: number }): Promise<DreamJob | undefined> {
    await this.initialize();
    const now = input.now ?? new Date().toISOString();
    const leaseUntil = new Date(new Date(now).getTime() + (input.leaseMs ?? 5 * 60_000)).toISOString();
    return this.transaction(async (client) => {
      const row = (await client.query<{ payload: DreamJob }>(`
        select payload from cognibrain_dream_jobs
        where status in ('queued', 'retry_scheduled', 'retrying', 'running')
          and (next_run_at is null or next_run_at <= $1)
          and (lease_until is null or lease_until <= $1)
        order by coalesce(priority, 0) desc, queued_at asc
        limit 1
        for update skip locked
      `, [now])).rows[0];
      if (!row?.payload) return undefined;
      const claimed: DreamJob = {
        ...row.payload,
        status: "running",
        startedAt: row.payload.startedAt ?? now,
        leaseOwner: input.workerId,
        leaseUntil,
        attemptCount: (row.payload.attemptCount ?? 0) + 1
      };
      await this.writeDreamJobWithClient(client, claimed);
      await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", ["dream.job_leased", claimed.jobId, JSON.stringify({ jobId: claimed.jobId, leaseOwner: input.workerId, leaseUntil, attemptCount: claimed.attemptCount })]);
      return claimed;
    });
  }

  async completeJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob> {
    const job = await this.getDreamJob(jobId);
    const completed: DreamJob = { ...job, ...patch, status: patch.status ?? "succeeded", finishedAt: patch.finishedAt ?? new Date().toISOString(), leaseOwner: undefined, leaseUntil: undefined };
    await this.writeDreamJob(completed);
    await this.appendEvent({ type: "dream.job_completed", aggregateId: jobId, occurredAt: new Date().toISOString(), payload: completed });
    return completed;
  }

  async retryJob(jobId: string, patch: Partial<DreamJob>): Promise<DreamJob> {
    const job = await this.getDreamJob(jobId);
    const retryAt = patch.nextRunAt ?? new Date(Date.now() + Math.min(60_000, 1000 * 2 ** Math.max(0, job.attemptCount ?? 0))).toISOString();
    const retry: DreamJob = { ...job, ...patch, status: "retry_scheduled", nextRunAt: retryAt, leaseOwner: undefined, leaseUntil: undefined };
    await this.writeDreamJob(retry);
    await this.appendEvent({ type: "dream.job_queued", aggregateId: jobId, occurredAt: new Date().toISOString(), payload: retry });
    return retry;
  }

  private async getDreamJob(jobId: string): Promise<DreamJob> {
    await this.initialize();
    const row = await this.queryOne<{ payload: DreamJob }>("select payload from cognibrain_dream_jobs where job_id = $1", [jobId]);
    if (!row?.payload) throw new Error(`Dream job not found: ${jobId}`);
    return row.payload;
  }

  private async writeDreamJob(job: DreamJob): Promise<void> {
    await this.transaction((client) => this.writeDreamJobWithClient(client, job));
  }

  private async writeDreamJobWithClient(client: PoolClient, job: DreamJob): Promise<void> {
    const now = new Date().toISOString();
    await client.query(
      "insert into cognibrain_dream_jobs(job_id, user_id, status, trigger, mode, queued_at, priority, lease_owner, lease_until, attempt_count, next_run_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) on conflict(job_id) do update set user_id = excluded.user_id, status = excluded.status, trigger = excluded.trigger, mode = excluded.mode, queued_at = excluded.queued_at, priority = excluded.priority, lease_owner = excluded.lease_owner, lease_until = excluded.lease_until, attempt_count = excluded.attempt_count, next_run_at = excluded.next_run_at, updated_at = excluded.updated_at, payload = excluded.payload",
      [job.jobId, job.userId ?? null, job.status ?? null, job.trigger ?? null, job.mode ?? null, job.queuedAt ? iso(job.queuedAt) : now, job.priority ?? null, job.leaseOwner ?? null, job.leaseUntil ? iso(job.leaseUntil) : null, job.attemptCount ?? 0, job.nextRunAt ? iso(job.nextRunAt) : null, now, JSON.stringify(job)]
    );
  }

  loadState(): unknown {
    throw new Error("AsyncPostgresMemoryRepository requires loadStateAsync()");
  }

  saveState(_state: unknown): void {
    throw new Error("AsyncPostgresMemoryRepository requires saveStateAsync()");
  }

  private async upsertMemory(memory: Memory, eventType: string): Promise<void> {
    await this.transaction(async (client) => {
      await this.upsertMemoryWithClient(client, memory, eventType);
    });
  }

  private async upsertMemoryWithClient(client: PoolClient, memory: Memory, eventType: string): Promise<void> {
    await client.query({
      name: "cognibrain_async_upsert_memory_v1",
      text: `
        insert into cognibrain_memories(
          memory_id, user_id, brain_id, source_id, project_id, org_id, tenant_id, content, memory_type, memory_layer,
          belief_state, visibility, created_at, updated_at, valid_from, valid_until, search_vector, payload
        ) values (
          $1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, to_tsvector('simple', $16), $17::jsonb
        )
        on conflict(memory_id) do update set
          user_id = excluded.user_id,
          brain_id = excluded.brain_id,
          source_id = excluded.source_id,
          project_id = excluded.project_id,
          org_id = excluded.org_id,
          tenant_id = excluded.tenant_id,
          content = excluded.content,
          memory_type = excluded.memory_type,
          memory_layer = excluded.memory_layer,
          belief_state = excluded.belief_state,
          visibility = excluded.visibility,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          valid_from = excluded.valid_from,
          valid_until = excluded.valid_until,
          search_vector = excluded.search_vector,
          payload = excluded.payload
      `,
      values: [
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
        memory.consent?.visibility ?? "private",
        iso(memory.createdAt),
        iso(memory.updatedAt),
        memory.temporal?.validFrom ? iso(memory.temporal.validFrom) : null,
        memory.temporal?.validUntil ? iso(memory.temporal.validUntil) : null,
        `${memory.content} ${(memory.entities ?? []).join(" ")}`,
        JSON.stringify(memory)
      ]
    });
    await client.query("delete from cognibrain_entities where memory_id = $1", [memory.id]);
    for (const entity of memory.entities ?? []) await client.query("insert into cognibrain_entities(memory_id, entity, user_id) values ($1, $2, $3)", [memory.id, entity, memory.userId]);
    await client.query("delete from cognibrain_relations where memory_id = $1", [memory.id]);
    for (const relation of memory.relations ?? []) {
      await client.query(
        "insert into cognibrain_relations(memory_id, relation_type, source_entity, target_id, target_entity, valid_from, valid_until, payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
        [memory.id, relation.type, relation.sourceEntity ?? null, relation.targetId ?? null, relation.targetEntity ?? null, relation.validFrom ? iso(relation.validFrom) : null, relation.validUntil ? iso(relation.validUntil) : null, JSON.stringify(relation)]
      );
    }
    await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", [eventType, memory.id, JSON.stringify(memory)]);
  }

  private async queryOne<T extends Record<string, unknown>>(sql: string, values: unknown[]): Promise<T | undefined> {
    await this.initialize();
    const result: QueryResult<T> = await this.pool.query(sql, values);
    return result.rows[0];
  }

  private async withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }

  private rlsEnabled(): boolean {
    return this.options.enableRls ?? process.env.MEMORY_POSTGRES_RLS === "true";
  }
}

export class PostgresMemoryRepository implements MemoryRepository, RepositoryStatePersistence {
  readonly store = new MemoryStore();
  private loaded = false;
  private inTransaction = false;

  constructor(
    private readonly url: string,
    private readonly options: { timeoutMs?: number; enableRls?: boolean } = {}
  ) {}

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
    this.pg("deleteMemory", { id, memory });
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
    this.pg("clear", {});
  }

  transaction<T>(operation: (tx: UnitOfWork) => T): T {
    this.ensureLoaded();
    if (this.inTransaction) return operation({ id: "postgres-nested" });
    this.inTransaction = true;
    try {
      return operation({ id: "postgres-driver" });
    } finally {
      this.inTransaction = false;
    }
  }

  loadState(): unknown {
    this.ensureSchema();
    return this.pg("loadState", {}) as unknown;
  }

  saveState(state: unknown): void {
    this.ensureSchema();
    this.pg("saveState", { state });
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.ensureSchema();
    const rows = this.pg("loadMemories", {}) as Memory[];
    if (rows.length) this.store.import(rows);
    this.loaded = true;
  }

  private writeMemory(memory: Memory, eventType: string): void {
    this.pg("upsertMemory", { memory, eventType });
  }

  private ensureSchema(): void {
    this.pg("ensureSchema", {});
  }

  private pg(operation: string, payload: Record<string, unknown>): unknown {
    const input = JSON.stringify({
      operation,
      url: this.url,
      timeoutMs: this.options.timeoutMs ?? Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      enableRls: this.options.enableRls ?? process.env.MEMORY_POSTGRES_RLS === "true",
      payload
    });
    const output = execFileSync(process.execPath, ["-e", POSTGRES_WORKER], {
      encoding: "utf8",
      input,
      timeout: this.options.timeoutMs ?? Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      maxBuffer: 20_000_000
    });
    return output.trim() ? JSON.parse(output) : undefined;
  }
}

const POSTGRES_WORKER = String.raw`
const { Pool } = require("pg");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  runRequest().catch((error) => {
    process.stderr.write(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
});

async function runRequest() {
  const request = JSON.parse(input || "{}");
  const pool = new Pool({
    connectionString: request.url,
    max: 1,
    connectionTimeoutMillis: request.timeoutMs,
    idleTimeoutMillis: Math.max(1000, Math.min(request.timeoutMs || 10000, 5000))
  });
  const client = await pool.connect();
  try {
    let result;
    if (request.operation !== "ensureSchema") await ensureSchema(client, request.enableRls);
    switch (request.operation) {
      case "ensureSchema":
        await ensureSchema(client, request.enableRls);
        result = { ok: true };
        break;
      case "loadMemories":
        result = (await client.query("select payload from cognibrain_memories order by updated_at desc")).rows.map((row) => row.payload);
        break;
      case "upsertMemory":
        await upsertMemory(client, request.payload.memory, request.payload.eventType);
        result = { ok: true };
        break;
      case "deleteMemory":
        await deleteMemory(client, request.payload.id, request.payload.memory);
        result = { ok: true };
        break;
      case "clear":
        await tx(client, async () => {
          await client.query("delete from cognibrain_entities");
          await client.query("delete from cognibrain_relations");
          await client.query("delete from cognibrain_memories");
        });
        result = { ok: true };
        break;
      case "loadState":
        result = (await client.query("select payload from cognibrain_repository_state where key = $1", ["service_state"])).rows[0]?.payload;
        break;
      case "saveState":
        await saveState(client, request.payload.state);
        result = { ok: true };
        break;
      default:
        throw new Error("Unknown Postgres repository operation: " + request.operation);
    }
    process.stdout.write(JSON.stringify(result ?? null));
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureSchema(client, enableRls) {
  await client.query(\`
    create table if not exists cognibrain_schema_migrations (
      version integer primary key,
      name text not null,
      applied_at timestamptz not null default now()
    );
    create table if not exists cognibrain_persistence_events (
      id bigserial primary key,
      event_type text not null,
      memory_id text,
      created_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_memories (
      memory_id text primary key,
      user_id text not null,
      brain_id text,
      source_id text,
      project_id text,
      org_id text,
      content text not null,
      memory_type text not null,
      memory_layer text not null,
      belief_state text not null,
      visibility text not null,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      valid_from timestamptz,
      valid_until timestamptz,
      search_vector tsvector,
      payload jsonb not null
    );
    create table if not exists cognibrain_entities (
      id bigserial primary key,
      memory_id text not null references cognibrain_memories(memory_id) on delete cascade,
      entity text not null,
      user_id text not null,
      created_at timestamptz not null default now()
    );
    create table if not exists cognibrain_relations (
      id bigserial primary key,
      memory_id text not null references cognibrain_memories(memory_id) on delete cascade,
      relation_type text not null,
      source_entity text,
      target_id text,
      target_entity text,
      valid_from timestamptz,
      valid_until timestamptz,
      payload jsonb not null
    );
    create table if not exists cognibrain_repository_state (
      key text primary key,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_claims (
      claim_id text primary key,
      source_memory_id text,
      subject text,
      predicate text,
      object text,
      state text,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_conflict_sets (
      conflict_set_id text primary key,
      status text,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_dream_jobs (
      job_id text primary key,
      user_id text,
      status text,
      trigger text,
      mode text,
      queued_at timestamptz,
      priority integer,
      lease_owner text,
      lease_until timestamptz,
      attempt_count integer not null default 0,
      next_run_at timestamptz,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_connector_sync_states (
      connector_id text primary key,
      last_status text,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_evidence_packs (
      evidence_pack_id text primary key,
      user_id text,
      query text,
      created_at timestamptz,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_policy_rules (
      rule_id text primary key,
      label text,
      effect text,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_retention_rules (
      rule_id text primary key,
      label text,
      action text,
      updated_at timestamptz not null default now(),
      payload jsonb not null
    );
    create table if not exists cognibrain_audit_events (
      audit_event_id text primary key,
      event_type text,
      user_id text,
      memory_id text,
      actor_id text,
      created_at timestamptz,
      payload jsonb not null
    );
    create index if not exists idx_cognibrain_memories_user_id on cognibrain_memories(user_id);
    create index if not exists idx_cognibrain_memories_org_id on cognibrain_memories(org_id);
    create index if not exists idx_cognibrain_memories_project_id on cognibrain_memories(project_id);
    create index if not exists idx_cognibrain_memories_search_vector on cognibrain_memories using gin(search_vector);
    create index if not exists idx_cognibrain_entities_entity on cognibrain_entities(entity);
    create index if not exists idx_cognibrain_relations_type on cognibrain_relations(relation_type);
    insert into cognibrain_schema_migrations(version, name) values (11, 'postgres_pg_driver_repository') on conflict(version) do nothing;
  \`);
  if (enableRls) await enableRowLevelSecurity(client);
}

async function enableRowLevelSecurity(client) {
  await client.query("alter table cognibrain_memories enable row level security");
  await client.query("drop policy if exists cognibrain_memories_scope on cognibrain_memories");
    await client.query(\`
    create policy cognibrain_memories_scope on cognibrain_memories
    using (
      coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true)
    )
    with check (
      coalesce(current_setting('cognibrain.org_id', true), '') = '' or org_id = current_setting('cognibrain.org_id', true)
    )
    \`);
  await client.query("insert into cognibrain_schema_migrations(version, name) values (12, 'postgres_optional_rls') on conflict(version) do nothing");
}

async function upsertMemory(client, memory, eventType) {
  await tx(client, async () => {
    await client.query({
      name: "cognibrain_upsert_memory_v1",
      text: \`
        insert into cognibrain_memories(
          memory_id, user_id, brain_id, source_id, project_id, org_id, content, memory_type, memory_layer,
          belief_state, visibility, created_at, updated_at, valid_from, valid_until, search_vector, payload
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, to_tsvector('simple', $16), $17::jsonb
        )
        on conflict(memory_id) do update set
          user_id = excluded.user_id,
          brain_id = excluded.brain_id,
          source_id = excluded.source_id,
          project_id = excluded.project_id,
          org_id = excluded.org_id,
          content = excluded.content,
          memory_type = excluded.memory_type,
          memory_layer = excluded.memory_layer,
          belief_state = excluded.belief_state,
          visibility = excluded.visibility,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          valid_from = excluded.valid_from,
          valid_until = excluded.valid_until,
          search_vector = excluded.search_vector,
          payload = excluded.payload
      \`,
      values: [
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
        memory.consent?.visibility ?? "private",
        iso(memory.createdAt),
        iso(memory.updatedAt),
        memory.temporal?.validFrom ? iso(memory.temporal.validFrom) : null,
        memory.temporal?.validUntil ? iso(memory.temporal.validUntil) : null,
        memory.content + " " + (memory.entities ?? []).join(" "),
        JSON.stringify(memory)
      ]
    });
    await client.query("delete from cognibrain_entities where memory_id = $1", [memory.id]);
    for (const entity of memory.entities ?? []) {
      await client.query("insert into cognibrain_entities(memory_id, entity, user_id) values ($1, $2, $3)", [memory.id, entity, memory.userId]);
    }
    await client.query("delete from cognibrain_relations where memory_id = $1", [memory.id]);
    for (const relation of memory.relations ?? []) {
      await client.query(
        "insert into cognibrain_relations(memory_id, relation_type, source_entity, target_id, target_entity, valid_from, valid_until, payload) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)",
        [memory.id, relation.type, relation.sourceEntity ?? null, relation.targetId ?? null, relation.targetEntity ?? null, relation.validFrom ? iso(relation.validFrom) : null, relation.validUntil ? iso(relation.validUntil) : null, JSON.stringify(relation)]
      );
    }
    await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", [eventType, memory.id, JSON.stringify(memory)]);
  });
}

async function deleteMemory(client, id, memory) {
  await tx(client, async () => {
    await client.query("insert into cognibrain_persistence_events(event_type, memory_id, payload) values ($1, $2, $3::jsonb)", ["memory.deleted", id, JSON.stringify(memory)]);
    await client.query("delete from cognibrain_entities where memory_id = $1", [id]);
    await client.query("delete from cognibrain_relations where memory_id = $1", [id]);
    await client.query("delete from cognibrain_memories where memory_id = $1", [id]);
  });
}

async function saveState(client, state) {
  const now = new Date().toISOString();
  await tx(client, async () => {
    await client.query("insert into cognibrain_repository_state(key, updated_at, payload) values ($1, $2, $3::jsonb) on conflict(key) do update set updated_at = excluded.updated_at, payload = excluded.payload", ["service_state", now, JSON.stringify(state)]);
    await replaceRows(client, "cognibrain_claims", "claim_id", state.claims || [], (claim) => [claim.id, claim.sourceMemoryId || null, claim.subject || null, claim.predicate || null, claim.object || null, claim.state || null, now, JSON.stringify(claim)]);
    await replaceRows(client, "cognibrain_conflict_sets", "conflict_set_id", state.conflictSets || [], (set) => [set.id, set.status || null, now, JSON.stringify(set)]);
    await replaceRows(client, "cognibrain_dream_jobs", "job_id", state.dreamJobs || [], (job) => [job.jobId, job.userId || null, job.status || null, job.trigger || null, job.mode || null, job.queuedAt ? iso(job.queuedAt) : now, job.priority ?? null, job.leaseOwner || null, job.leaseUntil ? iso(job.leaseUntil) : null, job.attemptCount ?? 0, job.nextRunAt ? iso(job.nextRunAt) : null, now, JSON.stringify(job)]);
    await replaceRows(client, "cognibrain_connector_sync_states", "connector_id", state.connectorSyncStates || [], (syncState) => [syncState.connectorId, syncState.lastStatus || null, now, JSON.stringify(syncState)]);
    await replaceRows(client, "cognibrain_evidence_packs", "evidence_pack_id", state.evidencePacks || [], (pack) => [pack.id, pack.userId || null, pack.query || null, pack.generatedAt ? iso(pack.generatedAt) : now, now, JSON.stringify(pack)]);
    await replaceRows(client, "cognibrain_policy_rules", "rule_id", state.policyRules || [], (rule) => [rule.id, rule.label || null, rule.effect || null, now, JSON.stringify(rule)]);
    await replaceRows(client, "cognibrain_retention_rules", "rule_id", state.retentionRules || [], (rule) => [rule.id, rule.label || null, rule.action || null, now, JSON.stringify(rule)]);
    await replaceRows(client, "cognibrain_audit_events", "audit_event_id", (state.auditEvents || []).filter((event) => event.id), (event) => [event.id, event.type || null, event.userId || null, event.memoryId || null, event.actorId || null, event.timestamp ? iso(event.timestamp) : now, JSON.stringify(event)]);
  });
}

async function replaceRows(client, table, _idColumn, rows, valuesFor) {
  await client.query("delete from " + table);
  const sql = table === "cognibrain_claims"
    ? "insert into cognibrain_claims(claim_id, source_memory_id, subject, predicate, object, state, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)"
    : table === "cognibrain_conflict_sets"
      ? "insert into cognibrain_conflict_sets(conflict_set_id, status, updated_at, payload) values ($1,$2,$3,$4::jsonb)"
      : table === "cognibrain_dream_jobs"
      ? "insert into cognibrain_dream_jobs(job_id, user_id, status, trigger, mode, queued_at, priority, lease_owner, lease_until, attempt_count, next_run_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)"
        : table === "cognibrain_connector_sync_states"
          ? "insert into cognibrain_connector_sync_states(connector_id, last_status, updated_at, payload) values ($1,$2,$3,$4::jsonb)"
          : table === "cognibrain_evidence_packs"
            ? "insert into cognibrain_evidence_packs(evidence_pack_id, user_id, query, created_at, updated_at, payload) values ($1,$2,$3,$4,$5,$6::jsonb)"
            : table === "cognibrain_policy_rules"
              ? "insert into cognibrain_policy_rules(rule_id, label, effect, updated_at, payload) values ($1,$2,$3,$4,$5::jsonb)"
              : table === "cognibrain_retention_rules"
                ? "insert into cognibrain_retention_rules(rule_id, label, action, updated_at, payload) values ($1,$2,$3,$4,$5::jsonb)"
                : "insert into cognibrain_audit_events(audit_event_id, event_type, user_id, memory_id, actor_id, created_at, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)";
  for (const row of rows) await client.query(sql, valuesFor(row));
}

async function tx(client, fn) {
  await client.query("begin");
  try {
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function iso(value) {
  return new Date(value).toISOString();
}
`.replace(/\\`/g, "`");

function checksumSql(sql: string): string {
  return createHash("sha256").update(sql.replace(/\s+/g, " ").trim()).digest("hex");
}
