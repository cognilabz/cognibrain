import { execFileSync } from "node:child_process";
import { MemoryStore, type Memory, type MemoryFilter, type MemoryInput, type MemoryPatch, type MemoryRepository, type UnitOfWork } from "../../core";

export class PostgresMemoryRepository implements MemoryRepository {
  readonly store = new MemoryStore();
  private loaded = false;

  constructor(
    private readonly url: string,
    private readonly options: { command?: string; timeoutMs?: number } = {}
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
    this.psql(`
      begin;
      insert into cognibrain_persistence_events(event_type, memory_id, payload)
      values ('memory.deleted', ${sqlString(id)}, ${jsonb(memory)});
      delete from cognibrain_entities where memory_id = ${sqlString(id)};
      delete from cognibrain_relations where memory_id = ${sqlString(id)};
      delete from cognibrain_memories where memory_id = ${sqlString(id)};
      commit;
    `);
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
    this.psql(`
      begin;
      delete from cognibrain_entities;
      delete from cognibrain_relations;
      delete from cognibrain_memories;
      commit;
    `);
  }

  transaction<T>(operation: (tx: UnitOfWork) => T): T {
    this.ensureLoaded();
    return operation({ id: "postgres-command" });
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.ensureSchema();
    const rows = this.psql("select encode(convert_to(payload::text, 'UTF8'), 'base64') from cognibrain_memories order by updated_at desc;")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(Buffer.from(line, "base64").toString("utf8")) as Memory);
    if (rows.length) this.store.import(rows);
    this.loaded = true;
  }

  private writeMemory(memory: Memory, eventType: string): void {
    const entities = memory.entities.map((entity) => `(${sqlString(memory.id)}, ${sqlString(entity)}, ${sqlString(memory.userId)}, now())`).join(",");
    const relations = memory.relations.map((relation) => `(
      ${sqlString(memory.id)},
      ${sqlString(relation.type)},
      ${sqlNullable(relation.sourceEntity)},
      ${sqlNullable(relation.targetId)},
      ${sqlNullable(relation.targetEntity)},
      ${sqlNullable(relation.validFrom ? new Date(relation.validFrom).toISOString() : undefined)},
      ${sqlNullable(relation.validUntil ? new Date(relation.validUntil).toISOString() : undefined)},
      ${jsonb(relation)}
    )`).join(",");
    this.psql(`
      begin;
      insert into cognibrain_memories(
        memory_id, user_id, brain_id, source_id, project_id, org_id, content, memory_type, memory_layer,
        belief_state, visibility, created_at, updated_at, valid_from, valid_until, search_vector, payload
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
        ${sqlString(new Date(memory.createdAt).toISOString())},
        ${sqlString(new Date(memory.updatedAt).toISOString())},
        ${sqlNullable(memory.temporal.validFrom ? new Date(memory.temporal.validFrom).toISOString() : undefined)},
        ${sqlNullable(memory.temporal.validUntil ? new Date(memory.temporal.validUntil).toISOString() : undefined)},
        to_tsvector('simple', ${sqlString(`${memory.content} ${memory.entities.join(" ")}`)}),
        ${jsonb(memory)}
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
        payload = excluded.payload;
      delete from cognibrain_entities where memory_id = ${sqlString(memory.id)};
      ${entities ? `insert into cognibrain_entities(memory_id, entity, user_id, created_at) values ${entities};` : ""}
      delete from cognibrain_relations where memory_id = ${sqlString(memory.id)};
      ${relations ? `insert into cognibrain_relations(memory_id, relation_type, source_entity, target_id, target_entity, valid_from, valid_until, payload) values ${relations};` : ""}
      insert into cognibrain_persistence_events(event_type, memory_id, payload) values (${sqlString(eventType)}, ${sqlString(memory.id)}, ${jsonb(memory)});
      commit;
    `);
  }

  private ensureSchema(): void {
    this.psql(`
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
      create index if not exists idx_cognibrain_memories_user_id on cognibrain_memories(user_id);
      create index if not exists idx_cognibrain_memories_org_id on cognibrain_memories(org_id);
      create index if not exists idx_cognibrain_memories_project_id on cognibrain_memories(project_id);
      create index if not exists idx_cognibrain_memories_search_vector on cognibrain_memories using gin(search_vector);
      create index if not exists idx_cognibrain_entities_entity on cognibrain_entities(entity);
      create index if not exists idx_cognibrain_relations_type on cognibrain_relations(relation_type);
      insert into cognibrain_schema_migrations(version, name) values (10, 'postgres_memory_repository') on conflict(version) do nothing;
    `);
  }

  private psql(sql: string): string {
    return execFileSync(this.options.command ?? process.env.MEMORY_PSQL_COMMAND ?? "psql", [this.url, "-v", "ON_ERROR_STOP=1", "-At"], {
      encoding: "utf8",
      input: `set client_min_messages to warning;\n${sql}`,
      timeout: this.options.timeoutMs ?? Number(process.env.MEMORY_STORAGE_COMMAND_TIMEOUT_MS ?? 10_000),
      maxBuffer: 10_000_000
    }).replace(/^(?:SET\r?\n)+/, "");
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlNullable(value: string | undefined): string {
  return value === undefined ? "null" : sqlString(value);
}

function jsonb(value: unknown): string {
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString("base64");
  return `convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb`;
}
