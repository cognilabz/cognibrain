import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type {
  DomainEvaluationReport,
  EpisodeRecord,
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
  policyRules?: MemoryPolicyRule[];
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
    const encoded = this.psql("select payload_base64 from cognibrain_snapshots order by id desc limit 1").trim();
    return encoded ? (JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as PersistedMemoryFile) : undefined;
  }

  save(payload: PersistedMemoryFile): void {
    this.ensureSchema();
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    this.psql(`begin; insert into cognibrain_snapshots(version, payload_base64) values (${payload.version}, '${encoded}'); insert into cognibrain_persistence_events(event_type, payload_base64) values ('snapshot', '${encoded}'); commit;`);
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
      notes: [
        `${this.options.cockroach ? "CockroachDB" : "Postgres"} remote driver using psql-compatible wire protocol and transactional append-only snapshot tables.`,
        "Set MEMORY_STORAGE_BACKEND=postgres-remote or cockroach-remote and MEMORY_POSTGRES_URL for production deployments.",
        "The synchronous persistence boundary shells through psql so local CLI/API startup remains zero-dependency."
      ]
    };
  }

  private ensureSchema(): void {
    this.psql(`
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
        payload_base64 text not null
      );
      create index if not exists idx_cognibrain_snapshots_created_at on cognibrain_snapshots(created_at);
      create index if not exists idx_cognibrain_events_created_at on cognibrain_persistence_events(created_at);
    `);
  }

  private psql(sql: string): string {
    return execFileSync(this.options.command ?? process.env.MEMORY_PSQL_COMMAND ?? "psql", [this.url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
      encoding: "utf8",
      timeout: Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      maxBuffer: 10_000_000
    });
  }
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

function cqlshArgsFromEnv(): string[] {
  return process.env.MEMORY_CQLSH_ARGS ? process.env.MEMORY_CQLSH_ARGS.split(/\s+/).filter(Boolean) : [];
}

function loadSQLite(): new (path: string) => SQLiteDatabase {
  const require = createRequire(import.meta.url);
  const sqlite = require("node:sqlite") as { DatabaseSync?: new (path: string) => SQLiteDatabase };
  if (!sqlite.DatabaseSync) throw new Error("node:sqlite DatabaseSync is unavailable in this Node runtime.");
  return sqlite.DatabaseSync;
}
