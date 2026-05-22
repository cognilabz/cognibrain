import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { MemoryStore, ReflectionEngine, RetrievalEngine, healthReport } from "../core";
import type { Memory, MemoryInput, SearchOptions } from "../core";

export interface MemoryServiceOptions {
  persistencePath?: string;
  autoDream?: {
    enabled?: boolean;
    intervalHours?: number;
    writeThreshold?: number;
  };
}

export interface MemoryMaintenanceStatus {
  enabled: boolean;
  intervalHours: number;
  writeThreshold: number;
  users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
}

interface PersistedMemoryFile {
  version: 1;
  memories: Memory[];
  maintenance: {
    users: Record<string, { lastDreamAt?: string; writesSinceDream: number }>;
  };
}

export class MemoryService {
  readonly store = new MemoryStore();
  readonly retrieval = new RetrievalEngine(this.store);
  readonly reflection = new ReflectionEngine(this.store);

  private readonly persistencePath?: string;
  private readonly autoDream: Required<NonNullable<MemoryServiceOptions["autoDream"]>>;
  private maintenance: PersistedMemoryFile["maintenance"] = { users: {} };
  private dreaming = false;

  constructor(options: MemoryServiceOptions = {}) {
    this.persistencePath = options.persistencePath ? resolve(options.persistencePath) : undefined;
    this.autoDream = {
      enabled: options.autoDream?.enabled ?? false,
      intervalHours: options.autoDream?.intervalHours ?? 6,
      writeThreshold: options.autoDream?.writeThreshold ?? 12
    };
    this.load();
  }

  add(input: MemoryInput) {
    const memory = this.store.add(input);
    this.afterWrite(memory.userId);
    return memory;
  }

  list(userId?: string) {
    return this.store.list(userId);
  }

  get(id: string) {
    return this.store.get(id);
  }

  update(id: string, patch: Partial<MemoryInput>) {
    const memory = this.store.update(id, patch);
    this.afterWrite(memory.userId);
    return memory;
  }

  delete(id: string) {
    const memory = this.store.get(id);
    const deleted = this.store.delete(id);
    if (deleted) this.afterWrite(memory.userId);
    return deleted;
  }

  search(options: SearchOptions) {
    return this.retrieval.search(options);
  }

  reflect(userId: string) {
    const report = this.reflection.run(userId);
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  dream(userId: string) {
    const report = this.reflection.run(userId);
    this.markDreamed(userId);
    this.persist();
    return report;
  }

  health(userId?: string) {
    return healthReport(this.store, userId);
  }

  maintenanceStatus(): MemoryMaintenanceStatus {
    return {
      enabled: this.autoDream.enabled,
      intervalHours: this.autoDream.intervalHours,
      writeThreshold: this.autoDream.writeThreshold,
      users: Object.fromEntries(Object.entries(this.maintenance.users).map(([userId, status]) => [userId, { ...status }]))
    };
  }

  runDueDreams(now = new Date()): string[] {
    if (!this.autoDream.enabled) return [];
    const dreamed: string[] = [];
    for (const userId of new Set(this.store.list().map((memory) => memory.userId))) {
      if (!this.isDreamDue(userId, now)) continue;
      this.runAutoDream(userId);
      dreamed.push(userId);
    }
    return dreamed;
  }

  private afterWrite(userId: string): void {
    const status = this.userMaintenance(userId);
    status.writesSinceDream += 1;
    if (this.autoDream.enabled && this.isDreamDue(userId)) this.runAutoDream(userId);
    this.persist();
  }

  private runAutoDream(userId: string): void {
    if (this.dreaming) return;
    this.dreaming = true;
    try {
      this.reflection.run(userId);
      this.markDreamed(userId);
    } finally {
      this.dreaming = false;
    }
  }

  private isDreamDue(userId: string, now = new Date()): boolean {
    const status = this.userMaintenance(userId);
    if (status.writesSinceDream >= this.autoDream.writeThreshold) return true;
    if (!status.lastDreamAt) return false;
    const ageHours = (now.getTime() - new Date(status.lastDreamAt).getTime()) / 3_600_000;
    return ageHours >= this.autoDream.intervalHours && status.writesSinceDream > 0;
  }

  private markDreamed(userId: string): void {
    const status = this.userMaintenance(userId);
    status.lastDreamAt = new Date().toISOString();
    status.writesSinceDream = 0;
  }

  private userMaintenance(userId: string): { lastDreamAt?: string; writesSinceDream: number } {
    this.maintenance.users[userId] ??= { writesSinceDream: 0 };
    return this.maintenance.users[userId];
  }

  private load(): void {
    if (!this.persistencePath || !existsSync(this.persistencePath)) return;
    const raw = JSON.parse(readFileSync(this.persistencePath, "utf8")) as PersistedMemoryFile | MemoryInput[];
    if (Array.isArray(raw)) {
      this.store.seed(raw);
      return;
    }
    this.maintenance = raw.maintenance ?? { users: {} };
    this.store.import(raw.memories ?? []);
  }

  private persist(): void {
    if (!this.persistencePath) return;
    mkdirSync(dirname(this.persistencePath), { recursive: true });
    const payload: PersistedMemoryFile = {
      version: 1,
      memories: this.store.export(),
      maintenance: this.maintenance
    };
    const tempPath = `${this.persistencePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    renameSync(tempPath, this.persistencePath);
  }
}

export function createDefaultMemoryService() {
  const persistencePath = process.env.NODE_ENV === "test" ? undefined : process.env.MEMORY_DB_PATH ?? ".memory-harness.json";
  const autoDreamEnabled = process.env.MEMORY_AUTO_DREAM !== "false";
  return new MemoryService({
    persistencePath,
    autoDream: {
      enabled: autoDreamEnabled,
      intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
      writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
    }
  });
}

export const defaultService = createDefaultMemoryService();
