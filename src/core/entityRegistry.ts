import type { EntityMergeSuggestion, EntityRecord, GraphReport, Memory } from "./types";

export class EntityRegistry {
  private readonly aliases = new Map<string, string>();
  private readonly records = new Map<string, EntityRecord>();
  private readonly memoryIdSets = new Map<string, Set<string>>();

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
      const memoryIds = current?.memoryIds ?? [];
      const memoryIdSet = this.memoryIdsFor(entity, memoryIds);
      if (!memoryIdSet.has(memory.id)) {
        memoryIdSet.add(memory.id);
        memoryIds.push(memory.id);
      }
      this.records.set(entity, {
        id: `ent_${hash(entity).slice(0, 14)}`,
        canonical: entity,
        aliases: current?.aliases ?? aliasesFor(entity, this.aliases),
        memoryIds,
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
    this.memoryIdSets.clear();
    for (const record of records) {
      const canonical = normalizeEntity(record.canonical);
      const normalizedRecord = { ...record, canonical, aliases: record.aliases.map(normalizeEntity) };
      this.records.set(canonical, normalizedRecord);
      this.memoryIdSets.set(canonical, new Set(normalizedRecord.memoryIds));
      this.aliases.set(canonical, canonical);
      for (const alias of normalizedRecord.aliases) this.aliases.set(alias, canonical);
    }
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

  merge(canonical: string, aliases: string[], memories: Memory[] = []): EntityRecord {
    const target = normalizeEntity(canonical);
    this.aliases.set(target, target);
    for (const alias of aliases) this.aliases.set(normalizeEntity(alias), target);
    const relatedMemoryIds = memories
      .filter((memory) => memory.entities.some((entity) => this.canonicalize(entity) === target))
      .map((memory) => memory.id);
    const current = this.records.get(target);
    const now = new Date().toISOString();
    const record: EntityRecord = {
      id: current?.id ?? `ent_${hash(target).slice(0, 14)}`,
      canonical: target,
      aliases: aliasesFor(target, this.aliases),
      memoryIds: [...new Set([...(current?.memoryIds ?? []), ...relatedMemoryIds])],
      firstSeenAt: current?.firstSeenAt ?? now,
      lastSeenAt: now
    };
    this.records.set(target, record);
    this.memoryIdSets.set(target, new Set(record.memoryIds));
    return record;
  }

  split(canonical: string, aliases: string[]): EntityRecord | undefined {
    const target = normalizeEntity(canonical);
    for (const alias of aliases) {
      const normalized = normalizeEntity(alias);
      if (this.aliases.get(normalized) === target) this.aliases.delete(normalized);
    }
    const current = this.records.get(target);
    if (!current) return undefined;
    const updated = { ...current, aliases: aliasesFor(target, this.aliases), lastSeenAt: new Date().toISOString() };
    this.records.set(target, updated);
    return updated;
  }

  private memoryIdsFor(entity: string, current: string[]): Set<string> {
    const existing = this.memoryIdSets.get(entity);
    if (existing) return existing;
    const next = new Set(current);
    this.memoryIdSets.set(entity, next);
    return next;
  }

  suggestMerges(memories: Memory[] = []): EntityMergeSuggestion[] {
    const records = this.export();
    const suggestions: EntityMergeSuggestion[] = [];
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        const left = records[i];
        const right = records[j];
        const confidence = similarity(left.canonical, right.canonical);
        if (confidence < 0.72) continue;
        const canonical = left.memoryIds.length >= right.memoryIds.length ? left.canonical : right.canonical;
        const alias = canonical === left.canonical ? right.canonical : left.canonical;
        const memoryIds = memories
          .filter((memory) => memory.entities.includes(left.canonical) || memory.entities.includes(right.canonical))
          .map((memory) => memory.id);
        suggestions.push({
          canonical,
          alias,
          confidence,
          reason: "similar entity spelling or shared token shape",
          memoryIds: [...new Set(memoryIds)]
        });
      }
    }
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 25);
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

function similarity(left: string, right: string): number {
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.86;
  const leftTokens = new Set(left.split(/[\s._-]+/).filter(Boolean));
  const rightTokens = new Set(right.split(/[\s._-]+/).filter(Boolean));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const tokenScore = overlap / union;
  const distanceScore = 1 - levenshtein(left, right) / Math.max(left.length, right.length, 1);
  return Math.max(tokenScore, distanceScore);
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let before = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const old = previous[j];
      previous[j] = left[i - 1] === right[j - 1] ? before : Math.min(before, previous[j - 1], previous[j]) + 1;
      before = old;
    }
  }
  return previous[right.length];
}
