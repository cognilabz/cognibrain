import type { AuditEvent, Memory, MemoryInput } from "./types";
import { MemoryStore } from "./store";

export interface UnitOfWork {
  readonly id?: string;
}

export type MemoryPatch = Partial<MemoryInput> & { trust?: number; importance?: number };

export interface MemoryFilter {
  userId?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface MemoryRepository {
  create(input: MemoryInput, tx?: UnitOfWork): Memory;
  update(id: string, patch: MemoryPatch, tx?: UnitOfWork): Memory;
  get(id: string, actor?: unknown): Memory;
  list(filter?: MemoryFilter | string, actor?: unknown): Memory[];
  delete(id: string, tx?: UnitOfWork): boolean;
  archive(id: string, tx?: UnitOfWork): Memory;
  markAccessed(id: string, tx?: UnitOfWork): Memory;
  import(memories: Memory[], tx?: UnitOfWork): Memory[];
  export(): Memory[];
  clear?(): void;
  transaction<T>(operation: (tx: UnitOfWork) => T): T;
}

export interface RepositoryStatePersistence {
  loadState?(): unknown;
  saveState?(state: unknown): void;
}

export interface MemoryStorageAdapter {
  create(input: MemoryInput): Memory;
  get(id: string): Memory;
  update(id: string, patch: MemoryPatch): Memory;
  delete(id: string): boolean;
  archive(id: string): Memory;
  list(userId?: string): Memory[];
  searchIndexUpdate(memory: Memory): void;
  auditWrite(event: AuditEvent): void;
  transaction<T>(operation: () => T): T;
}

export class InMemoryMemoryRepository implements MemoryRepository {
  constructor(readonly store = new MemoryStore()) {}

  create(input: MemoryInput, _tx?: UnitOfWork): Memory {
    return this.store.add(input);
  }

  update(id: string, patch: MemoryPatch, _tx?: UnitOfWork): Memory {
    return this.store.update(id, patch);
  }

  get(id: string, _actor?: unknown): Memory {
    return this.store.get(id);
  }

  list(filter?: MemoryFilter | string, _actor?: unknown): Memory[] {
    const normalized = typeof filter === "string" ? { userId: filter } : filter ?? {};
    let memories = this.store.list(normalized.userId);
    if (normalized.includeArchived === false) memories = memories.filter((memory) => !memory.archivedAt);
    if (normalized.limit !== undefined) memories = memories.slice(0, Math.max(0, normalized.limit));
    return memories;
  }

  delete(id: string, _tx?: UnitOfWork): boolean {
    return this.store.delete(id);
  }

  archive(id: string, _tx?: UnitOfWork): Memory {
    return this.store.archive(id);
  }

  markAccessed(id: string, _tx?: UnitOfWork): Memory {
    return this.store.markAccessed(id);
  }

  import(memories: Memory[], _tx?: UnitOfWork): Memory[] {
    return this.store.import(memories);
  }

  export(): Memory[] {
    return this.store.export();
  }

  clear(): void {
    this.store.clear();
  }

  transaction<T>(operation: (tx: UnitOfWork) => T): T {
    return operation({ id: "in-memory" });
  }
}

export class RepositoryBackedStorageAdapter implements MemoryStorageAdapter {
  private readonly auditEvents: AuditEvent[] = [];

  constructor(readonly repository: MemoryRepository) {}

  create(input: MemoryInput): Memory {
    const memory = this.repository.create(input);
    this.searchIndexUpdate(memory);
    return memory;
  }

  get(id: string): Memory {
    return this.repository.get(id);
  }

  update(id: string, patch: MemoryPatch): Memory {
    const memory = this.repository.update(id, patch);
    this.searchIndexUpdate(memory);
    return memory;
  }

  delete(id: string): boolean {
    return this.repository.delete(id);
  }

  archive(id: string): Memory {
    const memory = this.repository.archive(id);
    this.searchIndexUpdate(memory);
    return memory;
  }

  list(userId?: string): Memory[] {
    return this.repository.list(userId);
  }

  searchIndexUpdate(_memory: Memory): void {
    // The in-memory adapter updates indexes synchronously inside MemoryStore.
  }

  auditWrite(event: AuditEvent): void {
    this.auditEvents.push(event);
  }

  transaction<T>(operation: () => T): T {
    return this.repository.transaction(() => operation());
  }

  auditTrail(): AuditEvent[] {
    return [...this.auditEvents];
  }
}

export class InMemoryStorageAdapter extends RepositoryBackedStorageAdapter {
  readonly store: MemoryStore;

  constructor(store = new MemoryStore()) {
    super(new InMemoryMemoryRepository(store));
    this.store = store;
  }
}
