import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { tokenize } from "../../core/text";
import type { AuditEvent, EvidencePack, Memory, RetentionRule, RetrievalProfile } from "../../core";
import type { LexicalSearchHit, LexicalSearchOptions, MemoryPersistenceAdapter, PersistedMemoryFile, PersistenceCapabilities } from "./types";

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

function ftsMatchQuery(query: string): string {
  return [...new Set(tokenize(query))]
    .filter((token) => /^[\p{L}\p{N}-]+$/u.test(token))
    .slice(0, 12)
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" OR ");
}

function loadSQLite(): new (path: string) => SQLiteDatabase {
  const require = createRequire(import.meta.url);
  const sqlite = require("node:sqlite") as { DatabaseSync?: new (path: string) => SQLiteDatabase };
  if (!sqlite.DatabaseSync) throw new Error("node:sqlite DatabaseSync is unavailable in this Node runtime.");
  return sqlite.DatabaseSync;
}
