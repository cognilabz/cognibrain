import type { BeliefState, Memory, MemoryInput, MemoryScope, Provenance } from "./types";
import { extractEntities, tokenize, unique } from "./text";
import { DEFAULT_CONSENT } from "./config";

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
    const scope = memoryScope(input);
    const temporal = normalizeTemporal({ ...(input.temporal ?? {}), eventAt: input.temporal?.eventAt ?? input.timestamp });
    const confidence = clamp(input.confidence ?? source.confidence);
    const beliefState = input.beliefState ?? beliefStateFor({ temporal, metadata: input.metadata ?? {} });
    const memory: Memory = {
      schemaVersion: "2.0",
      id: makeId(),
      brainId: input.brainId,
      sourceId: input.sourceId,
      userId: input.userId,
      agentId: input.agentId,
      sessionId: input.sessionId,
      appId: input.appId,
      orgId: input.orgId,
      projectId: input.projectId,
      deviceId: input.deviceId,
      runId: input.runId,
      content: input.content.trim(),
      type: input.type ?? "project",
      layer: input.layer ?? "long_term",
      source,
      tags,
      entities,
      relations: uniqueRelations(input.relations ?? relationHints(input.content, entities)),
      consent: normalizeConsent(input.consent),
      temporal,
      scope,
      confidence,
      beliefState,
      provenance: { source, citations: citationsFor(source), extractedFromEpisodeId: typeof input.metadata?.episodeId === "string" ? input.metadata.episodeId : undefined, sourceRef: input.sourceRef },
      audit: [{ type: "created", at: now, actor: source.kind, nextState: beliefState }],
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
    const source = patch.source ?? memory.source;
    const temporal = patch.temporal ? normalizeTemporal({ ...memory.temporal, ...patch.temporal }) : memory.temporal;
    const scope = memoryScope({ ...memory, ...patch, userId: patch.userId ?? memory.userId });
    const nextState = patch.beliefState ?? beliefStateFor({ temporal, metadata: patch.metadata ? { ...memory.metadata, ...patch.metadata } : memory.metadata, archivedAt: memory.archivedAt });
    const audit = [...(memory.audit ?? [])];
    const now = new Date();
    if (nextState !== memory.beliefState) audit.push({ type: "state_changed", at: now, actor: source.kind, previousState: memory.beliefState, nextState });
    audit.push({ type: "updated", at: now, actor: source.kind });
    const updated: Memory = {
      ...memory,
      schemaVersion: "2.0",
      content,
      brainId: patch.brainId ?? memory.brainId,
      sourceId: patch.sourceId ?? memory.sourceId,
      userId: patch.userId ?? memory.userId,
      agentId: patch.agentId ?? memory.agentId,
      sessionId: patch.sessionId ?? memory.sessionId,
      appId: patch.appId ?? memory.appId,
      orgId: patch.orgId ?? memory.orgId,
      projectId: patch.projectId ?? memory.projectId,
      deviceId: patch.deviceId ?? memory.deviceId,
      runId: patch.runId ?? memory.runId,
      type: patch.type ?? memory.type,
      layer: patch.layer ?? memory.layer,
      source,
      tags: patch.tags ? unique(patch.tags) : memory.tags,
      entities: patch.entities ? unique([...patch.entities, ...extractEntities(content)]) : memory.entities,
      relations: patch.relations ? uniqueRelations(patch.relations) : memory.relations,
      consent: patch.consent ? normalizeConsent({ ...memory.consent, ...patch.consent }) : memory.consent,
      temporal,
      scope,
      confidence: patch.confidence !== undefined ? clamp(patch.confidence) : memory.confidence,
      beliefState: nextState,
      provenance: {
        source,
        citations: citationsFor(source),
        summaryOf: memory.summaryOf,
        extractedFromEpisodeId: typeof memory.metadata.episodeId === "string" ? memory.metadata.episodeId : undefined,
        sourceRef: patch.sourceRef ?? memory.provenance.sourceRef
      },
      audit,
      pinned: patch.pinned ?? memory.pinned,
      metadata: patch.metadata ? { ...memory.metadata, ...patch.metadata } : memory.metadata,
      trust: patch.trust ?? memory.trust,
      importance: patch.importance ?? memory.importance,
      updatedAt: now
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
      lastAccessedAt: new Date(),
      audit: [...(memory.audit ?? []), { type: "accessed" as const, at: new Date(), actor: "system" }]
    };
    this.memories.set(id, updated);
    return updated;
  }

  archive(id: string): Memory {
    const memory = this.get(id);
    if (memory.pinned) return memory;
    const now = new Date();
    const nextState = memory.beliefState === "active" ? "stale" : memory.beliefState;
    const updated = {
      ...memory,
      beliefState: nextState,
      archivedAt: now,
      updatedAt: now,
      audit: [...(memory.audit ?? []), { type: "archived" as const, at: now, actor: "system", previousState: memory.beliefState, nextState }]
    };
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
      archivedAt: memory.archivedAt ? new Date(memory.archivedAt) : undefined,
      consent: normalizeConsent(memory.consent),
      temporal: normalizeTemporal(memory.temporal),
      relations: uniqueRelations(memory.relations ?? []),
      schemaVersion: "2.0" as const,
      scope: memory.scope ?? memoryScope(memory),
      confidence: memory.confidence ?? memory.source.confidence,
      beliefState: memory.beliefState ?? beliefStateFor(memory),
      provenance: memory.provenance ?? { source: memory.source, citations: citationsFor(memory.source), summaryOf: memory.summaryOf },
      audit: memory.audit ?? [{ type: "created" as const, at: memory.createdAt, actor: memory.source.kind, nextState: memory.beliefState ?? "active" }]
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

function normalizeConsent(consent: Partial<Memory["consent"]> | undefined): Memory["consent"] {
  return {
    ...DEFAULT_CONSENT,
    ...(consent ?? {}),
    retentionUntil: consent?.retentionUntil ? new Date(consent.retentionUntil) : consent?.retentionUntil
  };
}

function normalizeTemporal(temporal: Partial<Memory["temporal"]> | undefined): Memory["temporal"] {
  return {
    ...(temporal ?? {}),
    eventAt: temporal?.eventAt ? new Date(temporal.eventAt) : undefined,
    validFrom: temporal?.validFrom ? new Date(temporal.validFrom) : undefined,
    validUntil: temporal?.validUntil ? new Date(temporal.validUntil) : undefined,
    supersededAt: temporal?.supersededAt ? new Date(temporal.supersededAt) : undefined,
    lastConfirmedAt: temporal?.lastConfirmedAt ? new Date(temporal.lastConfirmedAt) : undefined,
    verificationDueAt: temporal?.verificationDueAt ? new Date(temporal.verificationDueAt) : undefined
  };
}

function memoryScope(input: Partial<MemoryInput> & Pick<MemoryInput, "userId">): MemoryScope {
  return {
    brainId: input.brainId,
    sourceId: input.sourceId,
    userId: input.userId,
    agentId: input.agentId,
    sessionId: input.sessionId,
    appId: input.appId,
    orgId: input.orgId,
    projectId: input.projectId,
    deviceId: input.deviceId,
    runId: input.runId
  };
}

function citationsFor(source: Provenance): string[] {
  if (!source.uri) return [source.kind];
  const lines = source.lineStart ? `:${source.lineStart}${source.lineEnd && source.lineEnd !== source.lineStart ? `-${source.lineEnd}` : ""}` : "";
  return [`${source.uri}${lines}`];
}

function beliefStateFor(input: { temporal?: Memory["temporal"]; metadata?: Record<string, unknown>; archivedAt?: Date | string }): BeliefState {
  if (input.metadata?.retracted === true) return "retracted";
  if (typeof input.metadata?.contradiction === "string") return "contradicted";
  if (input.temporal?.supersededAt) return "superseded";
  const now = Date.now();
  if (input.temporal?.verificationDueAt && new Date(input.temporal.verificationDueAt).getTime() <= now) return "needs_verification";
  if (input.temporal?.validUntil && new Date(input.temporal.validUntil).getTime() < now) return "stale";
  if (input.archivedAt) return "stale";
  return "active";
}

function uniqueRelations(relations: Memory["relations"]): Memory["relations"] {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    const key = `${relation.type}:${relation.targetId ?? ""}:${relation.targetEntity ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function relationHints(content: string, entities: string[]): Memory["relations"] {
  const lower = content.toLowerCase();
  const relations: Memory["relations"] = [];
  const targets = entities.slice(0, 4);
  if (/\b(imports?|from)\b/.test(lower)) for (const targetEntity of targets) relations.push({ type: "imports", targetEntity, confidence: 0.6 });
  if (/\b(calls?|endpoint|api|request)\b/.test(lower)) for (const targetEntity of targets) relations.push({ type: "calls", targetEntity, confidence: 0.6 });
  if (/\b(depends on|requires|uses)\b/.test(lower)) for (const targetEntity of targets) relations.push({ type: "depends_on", targetEntity, confidence: 0.6 });
  return relations;
}

function makeId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
