import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { tokenize } from "../core/text";
import type {
  DomainEvaluationReport,
  EpisodeRecord,
  EvidencePack,
  EntityRecord,
  FeedbackEvent,
  AgentRegistration,
  AuditEvent,
  Brain,
  ConnectorManifest,
  ConnectorAuthSession,
  ConnectorSyncRecord,
  IdentityLink,
  MarketplaceSubmission,
  MarketplaceModule,
  ManagedTenant,
  Memory,
  MemorySource,
  MetricsReport,
  OfflineOperation,
  PersonaProfile,
  MemoryPolicyRule,
  RetentionRule,
  RetrievalProfile,
  RetrievalTrainingSample,
  WebhookDelivery,
  WebhookRegistration
} from "../core";

export interface LexicalSearchOptions {
  memoryIds?: string[];
  limit?: number;
}

export interface LexicalSearchHit {
  memoryId: string;
  score: number;
  explanation?: string;
}

export interface PersistedMemoryFile {
  version: 1 | 2;
  memories: Memory[];
  episodes?: EpisodeRecord[];
  maintenance: {
    users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
  };
  metrics?: MetricsReport;
  feedback?: FeedbackEvent[];
  retrievalProfiles?: RetrievalProfile[];
  identityLinks?: IdentityLink[];
  domainEvaluations?: DomainEvaluationReport[];
  entityRecords?: EntityRecord[];
  trainingSamples?: RetrievalTrainingSample[];
  brains?: Brain[];
  sources?: MemorySource[];
  agents?: AgentRegistration[];
  personas?: PersonaProfile[];
  auditEvents?: AuditEvent[];
  webhooks?: WebhookRegistration[];
  webhookDeliveries?: WebhookDelivery[];
  marketplaceModules?: MarketplaceModule[];
  marketplaceSubmissions?: MarketplaceSubmission[];
  managedTenants?: ManagedTenant[];
  offlineOperations?: OfflineOperation[];
  connectorManifests?: ConnectorManifest[];
  connectorAuthSessions?: ConnectorAuthSession[];
  connectorSyncRecords?: ConnectorSyncRecord[];
  evidencePacks?: EvidencePack[];
  policyRules?: MemoryPolicyRule[];
  retentionRules?: RetentionRule[];
}

export interface MemoryPersistenceAdapter {
  readonly kind: string;
  load(): PersistedMemoryFile | Memory[] | undefined;
  save(payload: PersistedMemoryFile): void;
  capabilities?(): PersistenceCapabilities;
  lexicalSearch?(query: string, options?: LexicalSearchOptions): LexicalSearchHit[];
}

export interface PersistenceCapabilities {
  durable: boolean;
  distributedReady: boolean;
  transactional: boolean;
  appendOnly: boolean;
  sql: boolean;
  encryptedAtRest: boolean;
  migrationSafe: boolean;
  replication?: "none" | "logical" | "quorum" | "external";
  sharding?: "none" | "hash" | "range" | "external";
  lexical?: {
    strategy: "none" | "sqlite-fts5" | "postgres-tsvector" | "bm25-fallback";
    indexed: boolean;
    notes: string[];
  };
  vector?: {
    strategy: "none" | "in-memory" | "pgvector";
    indexed: boolean;
    notes: string[];
  };
  notes: string[];
}

export class JsonFilePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "json-file";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | Memory[] | undefined {
    if (!existsSync(this.path)) return undefined;
    const contents = readFileSync(this.path, "utf8").trim();
    if (!contents) return undefined;
    return JSON.parse(contents) as PersistedMemoryFile | Memory[];
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    renameSync(tempPath, this.path);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: false,
      transactional: true,
      appendOnly: false,
      sql: false,
      encryptedAtRest: false,
      migrationSafe: true,
      replication: "none",
      sharding: "none",
      lexical: { strategy: "bm25-fallback", indexed: false, notes: ["Uses in-process lexical scoring after JSON snapshot load."] },
      notes: ["Atomic snapshot writes for local-first desktop and CLI usage."]
    };
  }
}

export class AppendOnlyLogPersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "append-only-log";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | undefined {
    if (!existsSync(this.path)) return undefined;
    const lines = readFileSync(this.path, "utf8").split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const entry = JSON.parse(lines[index]) as { type?: string; payload?: PersistedMemoryFile };
        if (entry.type === "snapshot" && entry.payload) return entry.payload;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const entry = {
      type: "snapshot",
      timestamp: new Date().toISOString(),
      version: payload.version,
      payload
    };
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: true,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: false,
      migrationSafe: true,
      replication: "external",
      sharding: "none",
      lexical: { strategy: "bm25-fallback", indexed: false, notes: ["Uses in-process lexical scoring after append-log replay."] },
      notes: ["JSONL snapshots can be tailed, replicated, compacted, or replayed by SQL/cloud adapters."]
    };
  }
}

export class SQLitePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "sqlite";
  private readonly path: string;
  private database?: SQLiteDatabase;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | undefined {
    const db = this.db();
    const snapshot = this.latestSnapshot();
    const rows = db.prepare("select payload from memories order by updated_at desc").all() as Array<{ payload?: string }>;
    if (rows.length) {
      const auditRows = db.prepare("select payload from audit_events order by created_at asc").all() as Array<{ payload?: string }>;
      const contextRows = db.prepare("select payload from context_packs order by created_at desc").all() as Array<{ payload?: string }>;
      const profileRows = db.prepare("select payload from retrieval_profiles order by updated_at desc").all() as Array<{ payload?: string }>;
      const retentionRows = db.prepare("select payload from retention_rules order by updated_at desc").all() as Array<{ payload?: string }>;
      return {
        ...(snapshot ?? { version: 2 as const, maintenance: { users: {} }, memories: [] }),
        memories: rows.map((row) => JSON.parse(row.payload ?? "{}") as Memory),
        auditEvents: auditRows.map((row) => JSON.parse(row.payload ?? "{}") as AuditEvent),
        evidencePacks: contextRows.map((row) => JSON.parse(row.payload ?? "{}") as EvidencePack),
        retrievalProfiles: profileRows.map((row) => JSON.parse(row.payload ?? "{}") as RetrievalProfile),
        retentionRules: retentionRows.map((row) => JSON.parse(row.payload ?? "{}") as RetentionRule)
      };
    }
    return snapshot;
  }

  private latestSnapshot(): PersistedMemoryFile | undefined {
    const row = this.db()
      .prepare("select payload from memory_snapshots order by id desc limit 1")
      .get() as { payload?: string } | undefined;
    return row?.payload ? (JSON.parse(row.payload) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    const db = this.db();
    const serialized = JSON.stringify(payload);
    const createdAt = new Date().toISOString();
    const previousRows = db.prepare("select id, payload from memories").all() as Array<{ id: string; payload: string }>;
    const previous = new Map(previousRows.map((row) => [row.id, row.payload]));
    const nextIds = new Set(payload.memories.map((memory) => memory.id));
    db.exec("begin immediate");
    try {
      db.prepare("insert into memory_snapshots (created_at, version, payload) values (?, ?, ?)").run(createdAt, payload.version, serialized);
      db.prepare("insert into persistence_events (created_at, event_type, payload) values (?, ?, ?)").run(createdAt, "snapshot.compacted", serialized);
      for (const [id, oldPayload] of previous) {
        if (nextIds.has(id)) continue;
        db.prepare("insert into persistence_events (created_at, event_type, payload) values (?, ?, ?)").run(createdAt, "memory.deleted", oldPayload);
        db.prepare("delete from memories where id = ?").run(id);
        db.prepare("delete from memory_fts where id = ?").run(id);
      }
      for (const memory of payload.memories) {
        const memoryPayload = JSON.stringify(memory);
        const previousPayload = previous.get(memory.id);
        if (!previousPayload) {
          db.prepare("insert into persistence_events (created_at, event_type, payload) values (?, ?, ?)").run(createdAt, "memory.created", memoryPayload);
        } else if (previousPayload !== memoryPayload) {
          db.prepare("insert into persistence_events (created_at, event_type, payload) values (?, ?, ?)").run(createdAt, "memory.updated", memoryPayload);
        }
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
          memoryPayload
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
      }
      for (const event of payload.auditEvents ?? []) {
        db.prepare("insert or replace into audit_events (id, event_type, user_id, memory_id, actor_id, created_at, payload) values (?, ?, ?, ?, ?, ?, ?)").run(
          event.id,
          event.type,
          event.userId ?? null,
          event.memoryId ?? null,
          event.actorId ?? null,
          new Date(event.timestamp).toISOString(),
          JSON.stringify(event)
        );
      }
      for (const pack of payload.evidencePacks ?? []) {
        db.prepare("insert into context_packs (id, user_id, query, created_at, hash, payload) values (?, ?, ?, ?, ?, ?) on conflict(id) do update set user_id = excluded.user_id, query = excluded.query, created_at = excluded.created_at, hash = excluded.hash, payload = excluded.payload").run(pack.id, pack.userId, pack.query, pack.generatedAt, pack.hash, JSON.stringify(pack));
      }
      for (const profile of payload.retrievalProfiles ?? []) {
        db.prepare("insert into retrieval_profiles (id, label, updated_at, payload) values (?, ?, ?, ?) on conflict(id) do update set label = excluded.label, updated_at = excluded.updated_at, payload = excluded.payload").run(profile.id, profile.label, new Date(profile.updatedAt).toISOString(), JSON.stringify(profile));
      }
      for (const rule of payload.retentionRules ?? []) {
        db.prepare("insert into retention_rules (id, label, action, updated_at, payload) values (?, ?, ?, ?, ?) on conflict(id) do update set label = excluded.label, action = excluded.action, updated_at = excluded.updated_at, payload = excluded.payload").run(rule.id, rule.label, rule.action, new Date(rule.updatedAt).toISOString(), JSON.stringify(rule));
      }
      db.prepare("delete from memory_snapshots where id not in (select id from memory_snapshots order by id desc limit 20)").run();
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }

  lexicalSearch(query: string, options: LexicalSearchOptions = {}): LexicalSearchHit[] {
    const db = this.db();
    const match = ftsMatchQuery(query);
    if (!match) return [];
    const memoryIds = [...new Set(options.memoryIds ?? [])];
    const limit = Math.max(1, options.limit ?? 20);
    const sql = memoryIds.length
      ? `select id, bm25(memory_fts) as rank from memory_fts where memory_fts match ? and id in (${memoryIds.map(() => "?").join(",")}) order by rank limit ?`
      : "select id, bm25(memory_fts) as rank from memory_fts where memory_fts match ? order by rank limit ?";
    const rows = db.prepare(sql).all(...(memoryIds.length ? [match, ...memoryIds, limit] : [match, limit])) as Array<{ id: string; rank: number }>;
    const raw = rows.map((row, index) => ({
      memoryId: row.id,
      score: Math.max(0, -Number(row.rank)) || 1 / (index + 1),
      explanation: "fts5 bm25"
    }));
    const max = raw.reduce((current, hit) => Math.max(current, hit.score), 0);
    return raw.map((hit) => ({ ...hit, score: max ? hit.score / max : hit.score }));
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: false,
      transactional: true,
      appendOnly: true,
      sql: true,
      encryptedAtRest: false,
      migrationSafe: true,
      replication: "none",
      sharding: "none",
      lexical: { strategy: "sqlite-fts5", indexed: true, notes: ["memory_fts virtual table is refreshed transactionally with each snapshot.", "Retrieval can consume SQLite BM25 scores through the lexical provider hook."] },
      notes: [
        "SQLite DB-primary repository: memories, entities, relations, audit events, context packs, retrieval profiles and retention rules are row-upserted transactionally.",
        "Snapshots are retained only as backup/compaction artifacts; persistence_events records granular memory.created, memory.updated and memory.deleted entries."
      ]
    };
  }

  private db(): SQLiteDatabase {
    if (this.database) return this.database;
    mkdirSync(dirname(this.path), { recursive: true });
    const DatabaseSync = loadSQLite();
    this.database = new DatabaseSync(this.path);
    this.database.exec("pragma journal_mode = WAL");
    this.database.exec("pragma foreign_keys = ON");
    this.database.exec(`
      create table if not exists memory_snapshots (
        id integer primary key autoincrement,
        created_at text not null,
        version integer not null,
        payload text not null
      );
      create table if not exists persistence_events (
        id integer primary key autoincrement,
        created_at text not null,
        event_type text not null,
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
      create table if not exists audit_events (
        id text primary key,
        event_type text not null,
        user_id text,
        memory_id text,
        actor_id text,
        created_at text not null,
        payload text not null
      );
      create table if not exists context_packs (
        id text primary key,
        user_id text not null,
        query text not null,
        created_at text not null,
        hash text,
        payload text not null
      );
      create table if not exists retrieval_profiles (
        id text primary key,
        label text not null,
        updated_at text not null,
        payload text not null
      );
      create table if not exists retention_rules (
        id text primary key,
        label text not null,
        action text not null,
        updated_at text not null,
        payload text not null
      );
      create index if not exists idx_memory_snapshots_created_at on memory_snapshots(created_at);
      create index if not exists idx_persistence_events_created_at on persistence_events(created_at);
      create index if not exists idx_memories_user_id on memories(user_id);
      create index if not exists idx_memories_brain_id on memories(brain_id);
      create index if not exists idx_memories_source_id on memories(source_id);
      create index if not exists idx_memories_project_id on memories(project_id);
      create index if not exists idx_memories_org_id on memories(org_id);
      create index if not exists idx_memories_created_at on memories(created_at);
      create index if not exists idx_memories_valid_from on memories(valid_from);
      create index if not exists idx_memories_valid_until on memories(valid_until);
      create index if not exists idx_entities_entity on entities(entity);
      create index if not exists idx_entities_user_id on entities(user_id);
      create index if not exists idx_relations_type on relations(relation_type);
      create index if not exists idx_relations_target_id on relations(target_id);
      create index if not exists idx_audit_events_memory_id on audit_events(memory_id);
      create index if not exists idx_context_packs_user_id on context_packs(user_id);
      create virtual table if not exists memory_fts using fts5(id unindexed, content, entities);
    `);
    return this.database;
  }
}

export class PostgresCompatiblePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "postgres-compatible";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | undefined {
    if (!existsSync(this.path)) return undefined;
    const database = JSON.parse(readFileSync(this.path, "utf8")) as PostgresCompatibleDatabase;
    const latest = database.tables.memory_snapshots.at(-1);
    const snapshot = latest ? (JSON.parse(latest.payload) as PersistedMemoryFile) : undefined;
    if (!database.tables.memories?.length) return snapshot;
    return {
      ...(snapshot ?? { version: 2 as const, maintenance: { users: {} }, memories: [] }),
      memories: database.tables.memories.map((row) => JSON.parse(row.payload) as Memory),
      auditEvents: database.tables.audit_events?.map((row) => JSON.parse(row.payload) as AuditEvent) ?? snapshot?.auditEvents ?? [],
      evidencePacks: database.tables.context_packs?.map((row) => JSON.parse(row.payload) as EvidencePack) ?? snapshot?.evidencePacks ?? []
    };
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const current = this.readDatabase();
    const serialized = JSON.stringify(payload);
    const committedAt = new Date().toISOString();
    const previous = new Map((current.tables.memories ?? []).map((row) => [row.memory_id, row.payload]));
    const nextIds = new Set(payload.memories.map((memory) => memory.id));
    const deletedEvents = [...previous.entries()]
      .filter(([id]) => !nextIds.has(id))
      .map(([id, oldPayload], index) => ({ id: current.tables.persistence_events.length + index + 2, created_at: committedAt, event_type: "memory.deleted", payload: oldPayload, memory_id: id }));
    const memoryEvents = payload.memories.flatMap((memory, index) => {
      const memoryPayload = JSON.stringify(memory);
      const oldPayload = previous.get(memory.id);
      if (!oldPayload) return [{ id: current.tables.persistence_events.length + deletedEvents.length + index + 2, created_at: committedAt, event_type: "memory.created", payload: memoryPayload, memory_id: memory.id }];
      if (oldPayload !== memoryPayload) return [{ id: current.tables.persistence_events.length + deletedEvents.length + index + 2, created_at: committedAt, event_type: "memory.updated", payload: memoryPayload, memory_id: memory.id }];
      return [];
    });
    const next: PostgresCompatibleDatabase = {
      dialect: "postgres-compatible",
      committedAt,
      schemaVersion: 1,
      tables: {
        memory_snapshots: [
          ...current.tables.memory_snapshots,
          { id: current.tables.memory_snapshots.length + 1, created_at: committedAt, version: payload.version, payload: serialized }
        ].slice(-50),
        persistence_events: [
          ...current.tables.persistence_events,
          { id: current.tables.persistence_events.length + 1, created_at: committedAt, event_type: "snapshot.compacted", payload: serialized },
          ...deletedEvents,
          ...memoryEvents
        ],
        memories: payload.memories.map((memory) => ({
          memory_id: memory.id,
          user_id: memory.userId,
          brain_id: memory.brainId,
          source_id: memory.sourceId,
          project_id: memory.projectId,
          org_id: memory.orgId,
          content: memory.content,
          updated_at: new Date(memory.updatedAt).toISOString(),
          payload: JSON.stringify(memory)
        })),
        audit_events: (payload.auditEvents ?? []).map((event) => ({
          event_id: event.id,
          event_type: event.type,
          user_id: event.userId,
          memory_id: event.memoryId,
          actor_id: event.actorId,
          created_at: new Date(event.timestamp).toISOString(),
          payload: JSON.stringify(event)
        })),
        context_packs: (payload.evidencePacks ?? []).map((pack) => ({
          context_pack_id: pack.id,
          user_id: pack.userId,
          query: pack.query,
          created_at: new Date(pack.generatedAt).toISOString(),
          hash: pack.hash,
          payload: JSON.stringify(pack)
        }))
      },
      replication: {
        mode: process.env.MEMORY_STORAGE_REPLICATION_MODE ?? "logical",
        shardCount: Number(process.env.MEMORY_STORAGE_SHARDS ?? 1)
      }
    };
    const tempPath = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(next, null, 2));
    renameSync(tempPath, this.path);
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
      sharding: Number(process.env.MEMORY_STORAGE_SHARDS ?? 1) > 1 ? "hash" : "external",
      lexical: { strategy: "postgres-tsvector", indexed: false, notes: ["Postgres-compatible CI mode preserves the tsvector contract boundary; live tsvector indexing belongs to the remote driver deployment."] },
      notes: [
        "Postgres-compatible DB-primary emulator with row-level memory tables and append-only granular persistence events.",
        "Use MEMORY_POSTGRES_URL for real deployments; snapshots are backup/compaction artifacts instead of the primary write path.",
        "CockroachDB can use the same PostgreSQL wire protocol; Cassandra-class stores require a dedicated wide-column adapter before direct Cassandra claims."
      ]
    };
  }

  private readDatabase(): PostgresCompatibleDatabase {
    if (!existsSync(this.path)) return emptyPostgresCompatibleDatabase();
    return JSON.parse(readFileSync(this.path, "utf8")) as PostgresCompatibleDatabase;
  }
}

export class CassandraCompatiblePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "cassandra-compatible";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | undefined {
    if (!existsSync(this.path)) return undefined;
    const database = JSON.parse(readFileSync(this.path, "utf8")) as CassandraCompatibleDatabase;
    const latest = database.tables.snapshots.at(-1);
    return latest ? (JSON.parse(latest.payload) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const current = this.readDatabase();
    const committedAt = new Date().toISOString();
    const serialized = JSON.stringify(payload);
    const keyspace = process.env.MEMORY_CASSANDRA_KEYSPACE ?? current.keyspace;
    const shardCount = Math.max(1, Number(process.env.MEMORY_STORAGE_SHARDS ?? current.replication.shardCount ?? 1));
    const partition = partitionKey(payload, shardCount);
    const next: CassandraCompatibleDatabase = {
      dialect: "cassandra-compatible",
      keyspace,
      committedAt,
      schemaVersion: 1,
      tables: {
        snapshots: [
          ...current.tables.snapshots,
          {
            partition,
            clustering: committedAt,
            version: payload.version,
            payload: serialized
          }
        ].slice(-100),
        persistence_events: [
          ...current.tables.persistence_events,
          {
            partition,
            clustering: `${committedAt}#${current.tables.persistence_events.length + 1}`,
            event_type: "snapshot",
            payload: serialized
          }
        ]
      },
      replication: {
        strategy: process.env.MEMORY_CASSANDRA_REPLICATION_STRATEGY ?? current.replication.strategy,
        consistency: process.env.MEMORY_CASSANDRA_CONSISTENCY ?? current.replication.consistency,
        shardCount
      }
    };
    const tempPath = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(next, null, 2));
    renameSync(tempPath, this.path);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: true,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: Boolean(process.env.MEMORY_ENCRYPTION_KEY),
      migrationSafe: true,
      replication: "quorum",
      sharding: "range",
      notes: [
        "Cassandra-compatible wide-column adapter with partition/clustering keys and append-only snapshot events.",
        "The local file-backed emulator is intended for CI, migration tests, and package validation.",
        "Set MEMORY_STORAGE_BACKEND=cassandra with a production Cassandra driver boundary before remote cluster deployment."
      ]
    };
  }

  private readDatabase(): CassandraCompatibleDatabase {
    if (!existsSync(this.path)) return emptyCassandraCompatibleDatabase();
    return JSON.parse(readFileSync(this.path, "utf8")) as CassandraCompatibleDatabase;
  }
}

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
        `${this.options.cockroach ? "CockroachDB" : "Postgres"} remote DB-primary driver with transactional row-level memory upserts and append-only memory.created, memory.updated and memory.deleted events.`,
        "Set MEMORY_STORAGE_BACKEND=postgres-remote or cockroach-remote and MEMORY_POSTGRES_URL for production deployments.",
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
      distributedReady: true,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: Boolean(process.env.MEMORY_ENCRYPTION_KEY),
      migrationSafe: true,
      replication: "quorum",
      sharding: "range",
      notes: [
        "Cassandra remote driver using cqlsh-compatible CQL with append-only wide-column snapshot tables.",
        "Set MEMORY_STORAGE_BACKEND=cassandra-remote, MEMORY_CASSANDRA_CONTACT_POINT and MEMORY_CASSANDRA_KEYSPACE for production deployments.",
        "Consistency, replication and sharding are delegated to the configured Cassandra cluster."
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

export function createPersistenceFromEnv(defaultPath = ".memory-harness.json"): MemoryPersistenceAdapter {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if (backend === "jsonl" || backend === "append-only" || backend === "log") {
    return new AppendOnlyLogPersistenceAdapter(process.env.MEMORY_EVENT_LOG_PATH ?? ".memory-harness.jsonl");
  }
  if (backend === "sqlite" || backend === "sql") {
    return new SQLitePersistenceAdapter(process.env.MEMORY_SQLITE_PATH ?? defaultPath.replace(/\.json$/i, ".sqlite"));
  }
  if ((backend === "postgres-remote" || backend === "postgres-production") && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL);
  }
  if ((backend === "cockroach-remote" || backend === "cockroach-production") && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL, { cockroach: true });
  }
  if (backend === "postgres" || backend === "postgres-compatible" || backend === "cockroach") {
    return new PostgresCompatiblePersistenceAdapter(process.env.MEMORY_POSTGRES_COMPAT_PATH ?? defaultPath.replace(/\.json$/i, ".postgres.json"));
  }
  if ((backend === "cassandra-remote" || backend === "cassandra-production") && process.env.MEMORY_CASSANDRA_CONTACT_POINT) {
    return new CassandraRemotePersistenceAdapter(process.env.MEMORY_CASSANDRA_CONTACT_POINT);
  }
  if (backend === "cassandra" || backend === "cassandra-compatible" || backend === "wide-column") {
    return new CassandraCompatiblePersistenceAdapter(process.env.MEMORY_CASSANDRA_COMPAT_PATH ?? defaultPath.replace(/\.json$/i, ".cassandra.json"));
  }
  return new JsonFilePersistenceAdapter(defaultPath);
}

export function sqliteAvailable(): boolean {
  try {
    loadSQLite();
    return true;
  } catch {
    return false;
  }
}

type SQLiteStatement = {
  all(...values: unknown[]): unknown[];
  get(...values: unknown[]): unknown;
  run(...values: unknown[]): unknown;
};

type SQLiteDatabase = {
  exec(sql: string): unknown;
  prepare(sql: string): SQLiteStatement;
};

interface PostgresCompatibleDatabase {
  dialect: "postgres-compatible";
  committedAt: string;
  schemaVersion: 1;
  tables: {
    memory_snapshots: Array<{ id: number; created_at: string; version: number; payload: string }>;
    persistence_events: Array<{ id: number; created_at: string; event_type: string; payload: string; memory_id?: string }>;
    memories?: Array<{ memory_id: string; user_id: string; brain_id?: string; source_id?: string; project_id?: string; org_id?: string; content: string; updated_at: string; payload: string }>;
    audit_events?: Array<{ event_id: string; event_type: string; user_id?: string; memory_id?: string; actor_id?: string; created_at: string; payload: string }>;
    context_packs?: Array<{ context_pack_id: string; user_id: string; query: string; created_at: string; hash?: string; payload: string }>;
  };
  replication: { mode: string; shardCount: number };
}

interface CassandraCompatibleDatabase {
  dialect: "cassandra-compatible";
  keyspace: string;
  committedAt: string;
  schemaVersion: 1;
  tables: {
    snapshots: Array<{ partition: string; clustering: string; version: number; payload: string }>;
    persistence_events: Array<{ partition: string; clustering: string; event_type: string; payload: string }>;
  };
  replication: { strategy: string; consistency: string; shardCount: number };
}

function emptyPostgresCompatibleDatabase(): PostgresCompatibleDatabase {
  return {
    dialect: "postgres-compatible",
    committedAt: new Date(0).toISOString(),
    schemaVersion: 1,
    tables: { memory_snapshots: [], persistence_events: [] },
    replication: { mode: "logical", shardCount: Number(process.env.MEMORY_STORAGE_SHARDS ?? 1) }
  };
}

function emptyCassandraCompatibleDatabase(): CassandraCompatibleDatabase {
  return {
    dialect: "cassandra-compatible",
    keyspace: process.env.MEMORY_CASSANDRA_KEYSPACE ?? "cognibrain",
    committedAt: new Date(0).toISOString(),
    schemaVersion: 1,
    tables: { snapshots: [], persistence_events: [] },
    replication: {
      strategy: process.env.MEMORY_CASSANDRA_REPLICATION_STRATEGY ?? "SimpleStrategy",
      consistency: process.env.MEMORY_CASSANDRA_CONSISTENCY ?? "QUORUM",
      shardCount: Math.max(1, Number(process.env.MEMORY_STORAGE_SHARDS ?? 1))
    }
  };
}

function partitionKey(payload: PersistedMemoryFile, shardCount: number): string {
  const firstMemory = payload.memories[0];
  const anchor = firstMemory?.brainId ?? firstMemory?.userId ?? "global";
  let hash = 0;
  for (const char of anchor) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `${anchor}#${Math.abs(hash) % shardCount}`;
}

function ftsMatchQuery(query: string): string {
  return [...new Set(tokenize(query))]
    .filter((token) => /^[\p{L}\p{N}-]+$/u.test(token))
    .slice(0, 12)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" OR ");
}

function cqlshArgsFromEnv(): string[] {
  return process.env.MEMORY_CQLSH_ARGS ? process.env.MEMORY_CQLSH_ARGS.split(/\s+/).filter(Boolean) : [];
}

function loadSQLite(): new (path: string) => SQLiteDatabase {
  const require = createRequire(import.meta.url);
  const sqlite = require("node:sqlite") as { DatabaseSync?: new (path: string) => SQLiteDatabase };
  if (!sqlite.DatabaseSync) throw new Error("node:sqlite DatabaseSync is unavailable in this Node runtime.");
  return sqlite.DatabaseSync;
}
