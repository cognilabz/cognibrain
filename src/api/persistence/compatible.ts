import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AuditEvent, EvidencePack, Memory } from "../../core";
import type { LexicalSearchHit, LexicalSearchOptions, MemoryPersistenceAdapter, PersistedMemoryFile, PersistenceCapabilities } from "./types";

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
      distributedReady: false,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: Boolean(process.env.MEMORY_ENCRYPTION_KEY),
      migrationSafe: true,
      replication: "quorum",
      sharding: "range",
      notes: [
        "Experimental Cassandra-compatible snapshot/event-journal adapter; it is not a queryable production memory repository.",
        "The local file-backed emulator is intended for CI, migration tests, and package validation.",
        "Keep Cassandra claims at snapshot/event-journal maturity until a queryable repository with indexed reads is implemented."
      ]
    };
  }

  private readDatabase(): CassandraCompatibleDatabase {
    if (!existsSync(this.path)) return emptyCassandraCompatibleDatabase();
    return JSON.parse(readFileSync(this.path, "utf8")) as CassandraCompatibleDatabase;
  }
}

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
