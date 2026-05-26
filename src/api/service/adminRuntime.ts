import type { Brain, Memory, MemorySource, PolicyDecision } from "../../core";
import { contentHash } from "./helpers";

export function exportUser(service: any, userId: string): Memory[] {
    const denied: PolicyDecision[] = [];
    const allowed = (service.store.list(userId) as Memory[]).filter((memory) => {
      const decision = service.evaluatePolicy("export", memory, { userId });
      if (decision.allowed) return true;
      denied.push(decision);
      return false;
    });
    if (denied.length) service.recordAudit("policy.violation", { userId, metadata: { operation: "export", denied: denied.length, decisions: denied } });
    return allowed;
  }

export function deleteUser(service: any, userId: string): number {
    const memories = service.store.list(userId) as Memory[];
    let deleted = 0;
    const denied: PolicyDecision[] = [];
    for (const memory of memories) {
      const decision = service.evaluatePolicy("delete", memory, { userId });
      if (!decision.allowed) {
        denied.push(decision);
        continue;
      }
      if (service.store.delete(memory.id)) deleted += 1;
    }
    if (denied.length) service.recordAudit("policy.violation", { userId, metadata: { operation: "delete", denied: denied.length, decisions: denied } });
    service.persist();
    return deleted;
  }

export function createBrain(service: any, input: Omit<Brain, "id" | "createdAt" | "updatedAt"> & { id?: string }): Brain {
    const now = new Date().toISOString();
    const brain: Brain = {
      ...input,
      id: input.id ?? `brain_${contentHash(`${input.ownerUserId}:${input.name}`).slice(2)}`,
      createdAt: now,
      updatedAt: now
    };
    service.brains.set(brain.id, brain);
    service.recordAudit("memory.write", { userId: brain.ownerUserId, brainId: brain.id, metadata: { resource: "brain", name: brain.name } });
    service.persist();
    return brain;
  }

export function listBrains(service: any): Brain[] {
    return [...service.brains.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

export function createSource(service: any, input: Omit<MemorySource, "id" | "createdAt" | "updatedAt"> & { id?: string }): MemorySource {
    if (!service.brains.has(input.brainId)) throw new Error(`Brain not found: ${input.brainId}`);
    const now = new Date().toISOString();
    const source: MemorySource = {
      ...input,
      id: input.id ?? `src_${contentHash(`${input.brainId}:${input.name}`).slice(2)}`,
      createdAt: now,
      updatedAt: now
    };
    service.sources.set(source.id, source);
    service.recordAudit("memory.write", { brainId: source.brainId, sourceId: source.id, metadata: { resource: "source", kind: source.kind } });
    service.persist();
    return source;
  }

export function listSources(service: any, brainId?: string): MemorySource[] {
    return ([...service.sources.values()] as MemorySource[]).filter((source) => !brainId || source.brainId === brainId).sort((a, b) => a.name.localeCompare(b.name));
  }

export function deleteSource(service: any, sourceId: string, actorId = "system"): { sourceId: string; affectedMemoryIds: string[] } {
    const source = service.sources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);
    service.sources.delete(sourceId);
    const timestamp = new Date().toISOString();
    const affectedMemoryIds: string[] = [];
    for (const memory of (service.store.list() as Memory[]).filter((item) => item.sourceId === sourceId)) {
      const updated = service.store.update(memory.id, {
        beliefState: "needs_verification",
        metadata: {
          ...memory.metadata,
          deletedSourceId: sourceId,
          deletedSourceName: source.name,
          sourceDeletedAt: timestamp,
          verificationReason: "source_deleted"
        }
      });
      affectedMemoryIds.push(updated.id);
      service.recordAudit("memory.update", { actorId, userId: updated.userId, brainId: updated.brainId, sourceId, memoryId: updated.id, metadata: { action: "source_deleted_revalidation", sourceName: source.name } });
    }
    service.recordAudit("memory.delete", { actorId, brainId: source.brainId, sourceId, metadata: { resource: "source", kind: source.kind, affectedMemoryIds } });
    service.persist();
    return { sourceId, affectedMemoryIds };
  }
