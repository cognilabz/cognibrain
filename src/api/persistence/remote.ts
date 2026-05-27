import { execFileSync } from "node:child_process";
import type { AuditEvent, EvidencePack, Memory } from "../../core";
import type { LexicalSearchHit, LexicalSearchOptions, MemoryPersistenceAdapter, PersistedMemoryFile, PersistenceCapabilities } from "./types";

export class PostgresRemotePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind: string;

  constructor(
    private readonly url: string,
    private readonly options: { command?: string; cockroach?: boolean } = {}
  ) {
    this.kind = options.cockroach ? "cockroach-remote" : "postgres-remote";
  }

  load(): PersistedMemoryFile | undefined {
    this.ensureSchema();
    const snapshotEncoded = this.psql("select payload_base64 from cognibrain_snapshots order by id desc limit 1").trim();
    const snapshot = snapshotEncoded ? (JSON.parse(Buffer.from(snapshotEncoded, "base64").toString("utf8")) as PersistedMemoryFile) : undefined;
    const memoryRows = this.psql("select encode(convert_to(payload::text, 'UTF8'), 'hex') from cognibrain_memories order by updated_at desc").trim();
    if (!memoryRows) return snapshot;
    const auditRows = this.psql("select encode(convert_to(payload::text, 'UTF8'), 'hex') from cognibrain_audit_events order by created_at asc").trim();
    const contextRows = this.psql("select encode(convert_to(payload::text, 'UTF8'), 'hex') from cognibrain_context_packs order by created_at desc").trim();
    return {
      ...(snapshot ?? { version: 2 as const, maintenance: { users: {} }, memories: [] }),
      memories: parseHexJsonLines<Memory>(memoryRows),
      auditEvents: parseHexJsonLines<AuditEvent>(auditRows),
      evidencePacks: parseHexJsonLines<EvidencePack>(contextRows)
    };
  }

  save(payload: PersistedMemoryFile): void {
    this.ensureSchema();
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    const previousIds = this.psql("select memory_id from cognibrain_memories").trim().split(/\r?\n/).filter(Boolean);
    const nextIds = new Set(payload.memories.map((memory) => memory.id));
    const deletedIds = previousIds.filter((id) => !nextIds.has(id));
    const memoryStatements = payload.memories.map((memory) => {
      const entityRows = memory.entities.map((entity) => `(${sqlString(memory.id)}, ${sqlString(entity)}, ${sqlString(memory.userId)}, now())`);
      const relationRows = memory.relations.map((relation) => `(
          ${sqlString(memory.id)},
          ${sqlString(relation.type)},
          ${sqlNullable(relation.sourceEntity)},
          ${sqlNullable(relation.targetId)},
          ${sqlNullable(relation.targetEntity)},
          ${relation.validFrom ? `${sqlString(new Date(relation.validFrom).toISOString())}::timestamptz` : "null"},
          ${relation.validUntil ? `${sqlString(new Date(relation.validUntil).toISOString())}::timestamptz` : "null"},
          ${sqlString(JSON.stringify(relation))}::jsonb
        )`);
      const memoryPayload = JSON.stringify(memory);
      return `
        insert into cognibrain_persistence_events(event_type, memory_id, payload_base64)
          values ((case when exists (select 1 from cognibrain_memories where memory_id = ${sqlString(memory.id)}) then 'memory.updated' else 'memory.created' end), ${sqlString(memory.id)}, '${Buffer.from(memoryPayload, "utf8").toString("base64")}');
        insert into cognibrain_memories (
          memory_id, user_id, brain_id, source_id, project_id, org_id, content, memory_type, layer,
          belief_state, visibility, created_at, updated_at, valid_from, valid_until, payload
        ) values (
          ${sqlString(memory.id)},
          ${sqlString(memory.userId)},
          ${sqlNullable(memory.brainId)},
          ${sqlNullable(memory.sourceId)},
          ${sqlNullable(memory.projectId)},
          ${sqlNullable(memory.orgId)},
          ${sqlString(memory.content)},
          ${sqlString(memory.type)},
          ${sqlString(memory.layer)},
          ${sqlString(memory.beliefState)},
          ${sqlString(memory.consent.visibility)},
          ${sqlString(new Date(memory.createdAt).toISOString())}::timestamptz,
          ${sqlString(new Date(memory.updatedAt).toISOString())}::timestamptz,
          ${memory.temporal.validFrom ? `${sqlString(new Date(memory.temporal.validFrom).toISOString())}::timestamptz` : "null"},
          ${memory.temporal.validUntil ? `${sqlString(new Date(memory.temporal.validUntil).toISOString())}::timestamptz` : "null"},
          ${sqlString(memoryPayload)}::jsonb
        )
        on conflict (memory_id) do update set
          user_id = excluded.user_id,
          brain_id = excluded.brain_id,
          source_id = excluded.source_id,
          project_id = excluded.project_id,
          org_id = excluded.org_id,
          content = excluded.content,
          memory_type = excluded.memory_type,
          layer = excluded.layer,
          belief_state = excluded.belief_state,
          visibility = excluded.visibility,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          valid_from = excluded.valid_from,
          valid_until = excluded.valid_until,
          payload = excluded.payload;
        delete from cognibrain_entities where memory_id = ${sqlString(memory.id)};
        delete from cognibrain_relations where memory_id = ${sqlString(memory.id)};
        ${entityRows.length ? `insert into cognibrain_entities(memory_id, entity, user_id, created_at) values ${entityRows.join(",")};` : ""}
        ${relationRows.length ? `insert into cognibrain_relations(memory_id, relation_type, source_entity, target_id, target_entity, valid_from, valid_until, payload) values ${relationRows.join(",")};` : ""}
      `;
    });
    const auditRows = (payload.auditEvents ?? []).map((event) => `(
      ${sqlString(event.id)},
      ${sqlString(event.type)},
      ${sqlNullable(event.userId)},
      ${sqlNullable(event.memoryId)},
      ${sqlNullable(event.actorId)},
      ${sqlString(new Date(event.timestamp).toISOString())}::timestamptz,
      ${sqlString(JSON.stringify(event))}::jsonb
    )`);
    const contextRows = (payload.evidencePacks ?? []).map((pack) => `(
      ${sqlString(pack.id)},
      ${sqlString(pack.userId)},
      ${sqlString(pack.query)},
      ${sqlString(new Date(pack.generatedAt).toISOString())}::timestamptz,
      ${sqlNullable(pack.hash)},
      ${sqlString(JSON.stringify(pack))}::jsonb
    )`);
    const deletedStatements = deletedIds.map((id) => `
      insert into cognibrain_persistence_events(event_type, memory_id, payload_base64)
        select 'memory.deleted', memory_id, replace(encode(convert_to(payload::text, 'UTF8'), 'base64'), E'\n', '')
        from cognibrain_memories where memory_id = ${sqlString(id)};
      delete from cognibrain_memories where memory_id = ${sqlString(id)};
    `);
    this.psql(`
      begin;
      insert into cognibrain_snapshots(version, payload_base64) values (${payload.version}, '${encoded}');
      insert into cognibrain_persistence_events(event_type, payload_base64) values ('snapshot.compacted', '${encoded}');
      ${deletedStatements.join("\n")}
      ${memoryStatements.join("\n")}
      ${auditRows.length ? `insert into cognibrain_audit_events(event_id, event_type, user_id, memory_id, actor_id, created_at, payload) values ${auditRows.join(",")} on conflict (event_id) do update set event_type = excluded.event_type, user_id = excluded.user_id, memory_id = excluded.memory_id, actor_id = excluded.actor_id, created_at = excluded.created_at, payload = excluded.payload;` : ""}
      ${contextRows.length ? `insert into cognibrain_context_packs(context_pack_id, user_id, query, created_at, hash, payload) values ${contextRows.join(",")} on conflict (context_pack_id) do update set user_id = excluded.user_id, query = excluded.query, created_at = excluded.created_at, hash = excluded.hash, payload = excluded.payload;` : ""}
      delete from cognibrain_snapshots where id not in (select id from cognibrain_snapshots order by id desc limit 20);
      commit;
    `);
  }

  lexicalSearch(query: string, options: LexicalSearchOptions = {}): LexicalSearchHit[] {
    this.ensureSchema();
    const limit = Math.max(1, options.limit ?? 20);
    const memoryIds = [...new Set(options.memoryIds ?? [])];
    const filter = memoryIds.length ? `and memory_id in (${memoryIds.map(sqlString).join(",")})` : "";
    const rows = this.psql(`
      select memory_id, ts_rank_cd(search_vector, plainto_tsquery('english', ${sqlString(query)})) as rank
      from cognibrain_memories
      where search_vector @@ plainto_tsquery('english', ${sqlString(query)})
      ${filter}
      order by rank desc, updated_at desc
      limit ${limit}
    `).trim();
    if (!rows) return [];
    const raw = rows.split(/\r?\n/).map((line, index) => {
      const [memoryId, rank] = line.split("|");
      return {
        memoryId,
        score: Number(rank) || 1 / (index + 1),
        explanation: "postgres tsvector"
      };
    });
    const max = raw.reduce((current, hit) => Math.max(current, hit.score), 0);
    return raw.map((hit) => ({ ...hit, score: max ? hit.score / max : hit.score }));
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: true,
      transactional: true,
      appendOnly: true,
      sql: true,
      encryptedAtRest: Boolean(process.env.MEMORY_ENCRYPTION_KEY),
      migrationSafe: true,
      replication: "logical",
      sharding: this.options.cockroach ? "external" : "hash",
      lexical: { strategy: "postgres-tsvector", indexed: true, notes: ["Remote driver maintains an indexed generated tsvector column for live Postgres lexical scoring."] },
      vector: { strategy: "pgvector", indexed: false, notes: ["Remote Postgres deployments can enable pgvector indexes for external embedding providers; embeddings stay optional and can be disabled by privacy policy."] },
      notes: [
        `${this.options.cockroach ? "CockroachDB" : "Postgres"} legacy remote persistence driver with transactional row-level memory upserts and append-only memory.created, memory.updated and memory.deleted events.`,
        "Use MEMORY_STORAGE_BACKEND=postgres-db-primary or postgres-production with MEMORY_POSTGRES_URL for the production MemoryRepository path; postgres-remote remains a compatibility adapter.",
        "Snapshots are retained as backup/compaction artifacts while cognibrain_memories is the durable source of truth."
      ]
    };
  }

  private ensureSchema(): void {
    this.psql(`
      create table if not exists cognibrain_schema_migrations (
        version integer primary key,
        name text not null,
        applied_at timestamptz not null default now()
      );
      create table if not exists cognibrain_snapshots (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        version integer not null,
        payload_base64 text not null
      );
      create table if not exists cognibrain_persistence_events (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        event_type text not null,
        memory_id text,
        payload_base64 text not null
      );
      alter table cognibrain_persistence_events add column if not exists memory_id text;
      create table if not exists cognibrain_memories (
        memory_id text primary key,
        user_id text not null,
        brain_id text,
        source_id text,
        project_id text,
        org_id text,
        content text not null,
        memory_type text not null,
        layer text not null,
        belief_state text not null,
        visibility text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        valid_from timestamptz,
        valid_until timestamptz,
        payload jsonb not null
      );
      alter table cognibrain_memories add column if not exists search_vector tsvector
        generated always as (to_tsvector('english', coalesce(content, ''))) stored;
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
      create table if not exists cognibrain_audit_events (
        event_id text primary key,
        event_type text not null,
        user_id text,
        memory_id text,
        actor_id text,
        created_at timestamptz not null,
        payload jsonb not null
      );
      create table if not exists cognibrain_context_packs (
        context_pack_id text primary key,
        user_id text not null,
        query text not null,
        created_at timestamptz not null,
        hash text,
        payload jsonb not null
      );
      create index if not exists idx_cognibrain_snapshots_created_at on cognibrain_snapshots(created_at);
      create index if not exists idx_cognibrain_events_created_at on cognibrain_persistence_events(created_at);
      create index if not exists idx_cognibrain_memories_user_id on cognibrain_memories(user_id);
      create index if not exists idx_cognibrain_memories_brain_id on cognibrain_memories(brain_id);
      create index if not exists idx_cognibrain_memories_source_id on cognibrain_memories(source_id);
      create index if not exists idx_cognibrain_memories_project_id on cognibrain_memories(project_id);
      create index if not exists idx_cognibrain_memories_org_id on cognibrain_memories(org_id);
      create index if not exists idx_cognibrain_memories_valid_from on cognibrain_memories(valid_from);
      create index if not exists idx_cognibrain_memories_valid_until on cognibrain_memories(valid_until);
      create index if not exists idx_cognibrain_memories_search_vector on cognibrain_memories using gin(search_vector);
      create index if not exists idx_cognibrain_entities_entity on cognibrain_entities(entity);
      create index if not exists idx_cognibrain_entities_user_id on cognibrain_entities(user_id);
      create index if not exists idx_cognibrain_relations_type on cognibrain_relations(relation_type);
      create index if not exists idx_cognibrain_relations_target_id on cognibrain_relations(target_id);
      create index if not exists idx_cognibrain_context_packs_user_id on cognibrain_context_packs(user_id);
      insert into cognibrain_schema_migrations(version, name) values
        (1, 'snapshot_event_tables'),
        (2, 'tenant_indexed_memory_tables'),
        (3, 'postgres_tsvector_lexical_index')
      on conflict (version) do nothing;
    `);
  }

  private psql(sql: string): string {
    const output = execFileSync(this.options.command ?? process.env.MEMORY_PSQL_COMMAND ?? "psql", [this.url, "-v", "ON_ERROR_STOP=1", "-At"], {
      encoding: "utf8",
      input: `set client_min_messages to warning;\n${sql}`,
      timeout: Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      maxBuffer: 10_000_000
    });
    return output.replace(/^(?:SET\r?\n)+/, "");
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullable(value: string | undefined): string {
  return value === undefined ? "null" : sqlString(value);
}

function parseBase64JsonLines<T>(rows: string): T[] {
  return rows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(Buffer.from(line, "base64").toString("utf8")) as T);
}

function parseHexJsonLines<T>(rows: string): T[] {
  return rows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(Buffer.from(line, "hex").toString("utf8")) as T);
}

export class CassandraRemotePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "cassandra-remote";

  constructor(
    private readonly contactPoint: string,
    private readonly options: { command?: string; keyspace?: string; args?: string[] } = {}
  ) {}

  load(): PersistedMemoryFile | undefined {
    this.ensureSchema();
    const output = this.cql(`select payload_base64 from ${this.keyspace()}.cognibrain_snapshots limit 1;`).trim();
    const encoded = output.split(/\r?\n/).find((line) => /^[A-Za-z0-9+/=]+$/.test(line.trim()))?.trim();
    return encoded ? (JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    this.ensureSchema();
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    const partition = partitionKey(payload, Math.max(1, Number(process.env.MEMORY_STORAGE_SHARDS ?? 1))).replace(/'/g, "''");
    const clustering = new Date().toISOString();
    this.cql(`insert into ${this.keyspace()}.cognibrain_snapshots(partition_key, clustering_key, version, payload_base64) values ('${partition}', '${clustering}', ${payload.version}, '${encoded}'); insert into ${this.keyspace()}.cognibrain_persistence_events(partition_key, clustering_key, event_type, payload_base64) values ('${partition}', '${clustering}#event', 'snapshot', '${encoded}');`);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: false,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: Boolean(process.env.MEMORY_ENCRYPTION_KEY),
      migrationSafe: true,
      replication: "quorum",
      sharding: "range",
      notes: [
        "Experimental Cassandra remote snapshot/event-journal path using cqlsh-compatible CQL.",
        "Do not treat Cassandra as a production query backend until a queryable repository is implemented.",
        "Consistency, replication and sharding are delegated to the configured Cassandra cluster for journal storage only."
      ]
    };
  }

  private ensureSchema(): void {
    this.cql(`
      create keyspace if not exists ${this.keyspace()} with replication = ${this.replicationClause()};
      create table if not exists ${this.keyspace()}.cognibrain_snapshots (
        partition_key text,
        clustering_key text,
        version int,
        payload_base64 text,
        primary key (partition_key, clustering_key)
      ) with clustering order by (clustering_key desc);
      create table if not exists ${this.keyspace()}.cognibrain_persistence_events (
        partition_key text,
        clustering_key text,
        event_type text,
        payload_base64 text,
        primary key (partition_key, clustering_key)
      ) with clustering order by (clustering_key desc);
    `);
  }

  private cql(cql: string): string {
    return execFileSync(this.options.command ?? process.env.MEMORY_CQLSH_COMMAND ?? "cqlsh", [this.contactPoint, ...(this.options.args ?? cqlshArgsFromEnv()), "-e", cql], {
      encoding: "utf8",
      timeout: Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      maxBuffer: 10_000_000
    });
  }

  private keyspace(): string {
    return (this.options.keyspace ?? process.env.MEMORY_CASSANDRA_KEYSPACE ?? "cognibrain").replace(/[^a-zA-Z0-9_]/g, "");
  }

  private replicationClause(): string {
    if (process.env.MEMORY_CASSANDRA_REPLICATION_CQL) return process.env.MEMORY_CASSANDRA_REPLICATION_CQL;
    const strategy = process.env.MEMORY_CASSANDRA_REPLICATION_STRATEGY ?? "SimpleStrategy";
    const factor = Math.max(1, Number(process.env.MEMORY_CASSANDRA_REPLICATION_FACTOR ?? 3));
    return `{'class': '${strategy.replace(/'/g, "''")}', 'replication_factor': ${factor}}`;
  }
}

function partitionKey(payload: PersistedMemoryFile, shardCount: number): string {
  const firstMemory = payload.memories[0];
  const anchor = firstMemory?.brainId ?? firstMemory?.userId ?? "global";
  let hash = 0;
  for (const char of anchor) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `${anchor}#${Math.abs(hash) % shardCount}`;
}

function cqlshArgsFromEnv(): string[] {
  return process.env.MEMORY_CQLSH_ARGS ? process.env.MEMORY_CQLSH_ARGS.split(/\s+/).filter(Boolean) : [];
}
