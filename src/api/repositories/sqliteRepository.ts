import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { MemoryStore, type Memory, type MemoryFilter, type MemoryInput, type MemoryPatch, type MemoryRepository, type RepositoryStatePersistence, type UnitOfWork } from "../../core";

export class SQLiteMemoryRepository implements MemoryRepository, RepositoryStatePersistence {
  private readonly path: string;
  private database?: SQLiteDatabase;
  readonly store = new MemoryStore();
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
        dreamJobs?: Array<{ jobId: string; userId?: string; status?: string; trigger?: string; mode?: string; queuedAt?: string | Date }>;
        connectorSyncStates?: Array<{ connectorId: string; lastStatus?: string }>;
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
        now,
        JSON.stringify(job)
      ]);
      replacePayloadTable(db, "connector_sync_states", payload.connectorSyncStates ?? [], (state) => [
        state.connectorId,
        state.lastStatus ?? null,
        now,
        JSON.stringify(state)
      ]);
    });
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
      create table if not exists dream_jobs (
        job_id text primary key,
        user_id text,
        status text,
        trigger text,
        mode text,
        queued_at text,
        updated_at text not null,
        payload text not null
      );
      create table if not exists connector_sync_states (
        connector_id text primary key,
        last_status text,
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

function replacePayloadTable<T>(db: SQLiteDatabase, table: string, rows: T[], valuesFor: (row: T) => unknown[]): void {
  db.prepare(`delete from ${table}`).run();
  const sql = table === "claims"
    ? "insert into claims (id, source_memory_id, subject, predicate, object, state, updated_at, payload) values (?, ?, ?, ?, ?, ?, ?, ?)"
    : table === "conflict_sets"
      ? "insert into conflict_sets (id, status, updated_at, payload) values (?, ?, ?, ?)"
      : table === "dream_jobs"
        ? "insert into dream_jobs (job_id, user_id, status, trigger, mode, queued_at, updated_at, payload) values (?, ?, ?, ?, ?, ?, ?, ?)"
        : "insert into connector_sync_states (connector_id, last_status, updated_at, payload) values (?, ?, ?, ?)";
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
