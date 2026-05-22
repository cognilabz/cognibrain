import type { Memory, MemoryInput, Provenance } from "./types";
import { extractEntities, tokenize, unique } from "./text";

const DEFAULT_SOURCE: Provenance = {
  kind: "agent",
  confidence: 0.55
};

const BASE_TRUST: Record<Provenance["kind"], number> = {
  human: 0.92,
  reviewed_code: 0.88,
  tool: 0.72,
  agent: 0.58,
  transcript: 0.42,
  import: 0.64
};

export class MemoryStore {
  private memories = new Map<string, Memory>();

  add(input: MemoryInput): Memory {
    const now = input.timestamp ? new Date(input.timestamp) : new Date();
    const source = input.source ?? DEFAULT_SOURCE;
    const entities = unique([...(input.entities ?? []), ...extractEntities(input.content)]);
    const tags = unique(input.tags ?? []);
    const memory: Memory = {
      id: makeId(),
      userId: input.userId,
      agentId: input.agentId,
      content: input.content.trim(),
      type: input.type ?? "project",
      layer: input.layer ?? "long_term",
      source,
      tags,
      entities,
      pinned: input.pinned ?? false,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      trust: clamp((BASE_TRUST[source.kind] + source.confidence) / 2),
      importance: this.estimateImportance(input.content, tags, source),
      accessCount: 0
    };
    this.memories.set(memory.id, memory);
    return memory;
  }

  update(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }): Memory {
    const memory = this.get(id);
    const content = patch.content?.trim() ?? memory.content;
    const updated: Memory = {
      ...memory,
      content,
      userId: patch.userId ?? memory.userId,
      agentId: patch.agentId ?? memory.agentId,
      type: patch.type ?? memory.type,
      layer: patch.layer ?? memory.layer,
      source: patch.source ?? memory.source,
      tags: patch.tags ? unique(patch.tags) : memory.tags,
      entities: patch.entities ? unique([...patch.entities, ...extractEntities(content)]) : memory.entities,
      pinned: patch.pinned ?? memory.pinned,
      metadata: patch.metadata ? { ...memory.metadata, ...patch.metadata } : memory.metadata,
      trust: patch.trust ?? memory.trust,
      importance: patch.importance ?? memory.importance,
      updatedAt: new Date()
    };
    this.memories.set(id, updated);
    return updated;
  }

  get(id: string): Memory {
    const memory = this.memories.get(id);
    if (!memory) throw new Error(`Memory not found: ${id}`);
    return memory;
  }

  delete(id: string): boolean {
    return this.memories.delete(id);
  }

  list(userId?: string): Memory[] {
    return [...this.memories.values()]
      .filter((memory) => !userId || memory.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  markAccessed(id: string): Memory {
    const memory = this.get(id);
    const updated = {
      ...memory,
      accessCount: memory.accessCount + 1,
      lastAccessedAt: new Date()
    };
    this.memories.set(id, updated);
    return updated;
  }

  archive(id: string): Memory {
    const memory = this.get(id);
    if (memory.pinned) return memory;
    const updated = { ...memory, archivedAt: new Date(), updatedAt: new Date() };
    this.memories.set(id, updated);
    return updated;
  }

  seed(inputs: MemoryInput[]): Memory[] {
    return inputs.map((input) => this.add(input));
  }

  import(memories: Memory[]): Memory[] {
    const restored = memories.map((memory) => ({
      ...memory,
      createdAt: new Date(memory.createdAt),
      updatedAt: new Date(memory.updatedAt),
      lastAccessedAt: memory.lastAccessedAt ? new Date(memory.lastAccessedAt) : undefined,
      archivedAt: memory.archivedAt ? new Date(memory.archivedAt) : undefined
    }));
    for (const memory of restored) this.memories.set(memory.id, memory);
    return restored;
  }

  export(): Memory[] {
    return this.list();
  }

  clear(): void {
    this.memories.clear();
  }

  private estimateImportance(content: string, tags: string[], source: Provenance): number {
    const density = Math.min(1, tokenize(content).length / 32);
    const tagBoost = Math.min(0.18, tags.length * 0.04);
    const sourceBoost = source.kind === "human" || source.kind === "reviewed_code" ? 0.15 : 0;
    return clamp(0.35 + density * 0.32 + tagBoost + sourceBoost);
  }
}

function makeId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
