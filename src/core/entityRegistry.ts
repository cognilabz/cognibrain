import type { EntityRecord, GraphReport, Memory } from "./types";

export class EntityRegistry {
  private readonly aliases = new Map<string, string>();
  private readonly records = new Map<string, EntityRecord>();

  constructor(aliasMap: Record<string, string[]> = {}) {
    this.configureAliases(aliasMap);
  }

  configureAliases(aliasMap: Record<string, string[]>): void {
    for (const [canonical, aliases] of Object.entries(aliasMap)) {
      const normalized = normalizeEntity(canonical);
      this.aliases.set(normalized, normalized);
      for (const alias of aliases) this.aliases.set(normalizeEntity(alias), normalized);
    }
  }

  canonicalize(entity: string): string {
    const normalized = normalizeEntity(entity);
    return this.aliases.get(normalized) ?? normalized;
  }

  ingest(memory: Memory): Memory {
    const now = memory.createdAt.toISOString();
    const entities = [...new Set(memory.entities.map((entity) => this.canonicalize(entity)).filter(Boolean))];
    for (const entity of entities) {
      const current = this.records.get(entity);
      this.records.set(entity, {
        id: `ent_${hash(entity).slice(0, 14)}`,
        canonical: entity,
        aliases: current?.aliases ?? aliasesFor(entity, this.aliases),
        memoryIds: [...new Set([...(current?.memoryIds ?? []), memory.id])],
        firstSeenAt: current?.firstSeenAt ?? now,
        lastSeenAt: now
      });
    }
    memory.entities = entities;
    memory.relations = memory.relations.map((relation) => ({
      ...relation,
      sourceEntity: relation.sourceEntity ? this.canonicalize(relation.sourceEntity) : relation.sourceEntity,
      targetEntity: relation.targetEntity ? this.canonicalize(relation.targetEntity) : relation.targetEntity,
      direction: relation.direction ?? "out"
    }));
    return memory;
  }

  import(records: EntityRecord[] = []): void {
    this.records.clear();
    for (const record of records) this.records.set(record.canonical, record);
  }

  export(): EntityRecord[] {
    return [...this.records.values()].sort((a, b) => a.canonical.localeCompare(b.canonical));
  }

  graph(memories: Memory[]): GraphReport {
    const byEntity = new Map(this.export().map((entity) => [entity.canonical, entity]));
    const edges: GraphReport["edges"] = [];
    for (const memory of memories) {
      for (const relation of memory.relations) {
        const targetEntity = relation.targetEntity ? this.canonicalize(relation.targetEntity) : undefined;
        edges.push({
          sourceMemoryId: memory.id,
          sourceEntity: relation.sourceEntity,
          targetMemoryId: relation.targetId,
          targetEntity,
          type: relation.type,
          direction: relation.direction ?? "out",
          confidence: relation.confidence ?? 0.5,
          validFrom: relation.validFrom,
          validUntil: relation.validUntil
        });
        if (targetEntity && !byEntity.has(targetEntity)) {
          byEntity.set(targetEntity, {
            id: `ent_${hash(targetEntity).slice(0, 14)}`,
            canonical: targetEntity,
            aliases: aliasesFor(targetEntity, this.aliases),
            memoryIds: [],
            firstSeenAt: memory.createdAt.toISOString(),
            lastSeenAt: memory.updatedAt.toISOString()
          });
        }
      }
    }
    return { entities: [...byEntity.values()].sort((a, b) => a.canonical.localeCompare(b.canonical)), edges };
  }
}

function normalizeEntity(entity: string): string {
  return entity.toLowerCase().replace(/\s+/g, " ").trim();
}

function aliasesFor(canonical: string, aliases: Map<string, string>): string[] {
  return [...aliases.entries()].filter(([, target]) => target === canonical).map(([alias]) => alias).filter((alias) => alias !== canonical).sort();
}

function hash(value: string): string {
  let hashValue = 2166136261;
  for (const char of value) {
    hashValue ^= char.charCodeAt(0);
    hashValue = Math.imul(hashValue, 16777619);
  }
  return (hashValue >>> 0).toString(36);
}
