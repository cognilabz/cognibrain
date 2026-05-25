import type { AuditEvent, Memory, MemoryInput } from "./types";
import { MemoryStore } from "./store";

export interface MemoryStorageAdapter {
  create(input: MemoryInput): Memory;
  get(id: string): Memory;
  update(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }): Memory;
  delete(id: string): boolean;
  archive(id: string): Memory;
  list(userId?: string): Memory[];
  searchIndexUpdate(memory: Memory): void;
  auditWrite(event: AuditEvent): void;
  transaction<T>(operation: () => T): T;
}

export class InMemoryStorageAdapter implements MemoryStorageAdapter {
  private readonly auditEvents: AuditEvent[] = [];

  constructor(readonly store = new MemoryStore()) {}

  create(input: MemoryInput): Memory {
    const memory = this.store.add(input);
    this.searchIndexUpdate(memory);
    return memory;
  }

  get(id: string): Memory {
    return this.store.get(id);
  }

  update(id: string, patch: Partial<MemoryInput> & { trust?: number; importance?: number }): Memory {
    const memory = this.store.update(id, patch);
    this.searchIndexUpdate(memory);
    return memory;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  archive(id: string): Memory {
    const memory = this.store.archive(id);
    this.searchIndexUpdate(memory);
    return memory;
  }

  list(userId?: string): Memory[] {
    return this.store.list(userId);
  }

  searchIndexUpdate(_memory: Memory): void {
    // The in-memory adapter updates indexes synchronously inside MemoryStore.
  }

  auditWrite(event: AuditEvent): void {
    this.auditEvents.push(event);
  }

  transaction<T>(operation: () => T): T {
    return operation();
  }

  auditTrail(): AuditEvent[] {
    return [...this.auditEvents];
  }
}
