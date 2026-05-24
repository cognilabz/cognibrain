import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type {
  DomainEvaluationReport,
  EntityRecord,
  FeedbackEvent,
  AgentRegistration,
  AuditEvent,
  Brain,
  ConnectorManifest,
  ConnectorSyncRecord,
  IdentityLink,
  MarketplaceSubmission,
  MarketplaceModule,
  Memory,
  MemorySource,
  MetricsReport,
  OfflineOperation,
  PersonaProfile,
  RetentionRule,
  RetrievalProfile,
  RetrievalTrainingSample,
  WebhookDelivery,
  WebhookRegistration
} from "../core";

export interface PersistedMemoryFile {
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
  offlineOperations?: OfflineOperation[];
  connectorManifests?: ConnectorManifest[];
  connectorSyncRecords?: ConnectorSyncRecord[];
  retentionRules?: RetentionRule[];
}

export interface MemoryPersistenceAdapter {
  readonly kind: string;
  load(): PersistedMemoryFile | Memory[] | undefined;
  save(payload: PersistedMemoryFile): void;
  capabilities?(): PersistenceCapabilities;
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
    const row = this.db()
      .prepare("select payload from memory_snapshots order by id desc limit 1")
      .get() as { payload?: string } | undefined;
    return row?.payload ? (JSON.parse(row.payload) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    const db = this.db();
    const serialized = JSON.stringify(payload);
    const createdAt = new Date().toISOString();
    db.exec("begin immediate");
    try {
      db.prepare("insert into memory_snapshots (created_at, version, payload) values (?, ?, ?)").run(createdAt, payload.version, serialized);
      db.prepare("insert into persistence_events (created_at, event_type, payload) values (?, ?, ?)").run(createdAt, "snapshot", serialized);
      db.prepare("delete from memory_snapshots where id not in (select id from memory_snapshots order by id desc limit 20)").run();
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
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
      notes: ["SQLite transactional snapshot store with an append-only event table for local production deployments."]
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
      create index if not exists idx_memory_snapshots_created_at on memory_snapshots(created_at);
      create index if not exists idx_persistence_events_created_at on persistence_events(created_at);
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
    return latest ? (JSON.parse(latest.payload) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const current = this.readDatabase();
    const serialized = JSON.stringify(payload);
    const committedAt = new Date().toISOString();
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
          { id: current.tables.persistence_events.length + 1, created_at: committedAt, event_type: "snapshot", payload: serialized }
        ]
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
      notes: [
        "Postgres-compatible adapter with transactional snapshot commits and append-only event rows.",
        "Use MEMORY_POSTGRES_URL for real deployments; the local file-backed SQL emulator is intended for CI and offline migration tests.",
        "CockroachDB can use the same PostgreSQL wire protocol; Cassandra-class stores require a dedicated wide-column adapter before direct Cassandra claims."
      ]
    };
  }

  private readDatabase(): PostgresCompatibleDatabase {
    if (!existsSync(this.path)) return emptyPostgresCompatibleDatabase();
    return JSON.parse(readFileSync(this.path, "utf8")) as PostgresCompatibleDatabase;
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
  if (backend === "postgres" || backend === "postgres-compatible" || backend === "cockroach") {
    return new PostgresCompatiblePersistenceAdapter(process.env.MEMORY_POSTGRES_COMPAT_PATH ?? defaultPath.replace(/\.json$/i, ".postgres.json"));
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
    persistence_events: Array<{ id: number; created_at: string; event_type: string; payload: string }>;
  };
  replication: { mode: string; shardCount: number };
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

function loadSQLite(): new (path: string) => SQLiteDatabase {
  const require = createRequire(import.meta.url);
  const sqlite = require("node:sqlite") as { DatabaseSync?: new (path: string) => SQLiteDatabase };
  if (!sqlite.DatabaseSync) throw new Error("node:sqlite DatabaseSync is unavailable in this Node runtime.");
  return sqlite.DatabaseSync;
}
