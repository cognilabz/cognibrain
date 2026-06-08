import { MemoryServicePersistence } from './memoryServicePersistence';
import { JsonFilePersistenceAdapter, createPersistenceFromEnv, createRepositoryFromEnv, redactionModeFromEnv } from './memoryServiceDeps';
import type { Memory, MemoryServiceOptions, PersistedMemoryFile } from './memoryServiceDeps';

export class MemoryService extends MemoryServicePersistence {}
export type { ConnectorWritebackInput, ConnectorWritebackOperation, ContextEnrichmentInput, MemoryMaintenanceStatus, MemoryServiceOptions } from './memoryServiceDeps';

function isPostgresRepositoryBackend(backend: string): boolean {
  return backend === "postgres-async" || backend === "postgres-production" || backend === "postgres-db-primary" || backend === "postgres-repository";
}

function isStrictDbPrimaryBackend(backend: string): boolean {
  return backend === "postgres-production" || backend === "postgres-db-primary";
}

export function createDefaultMemoryService() {
  const persistencePath = process.env.NODE_ENV === "test" ? undefined : process.env.MEMORY_DB_PATH ?? ".memory-harness.json";
  const autoDreamEnabled = process.env.MEMORY_AUTO_DREAM !== "false";
  const repository = persistencePath ? createRepositoryFromEnv(persistencePath) : undefined;
  const storageBackend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  const sqliteBackend = storageBackend === "sqlite" || storageBackend === "sql" || storageBackend === "sqlite-repository";
  const postgresRepositoryBackend = isPostgresRepositoryBackend(storageBackend);
  return new MemoryService({
    repository,
    persistence: persistencePath && !repository && !postgresRepositoryBackend ? (sqliteBackend ? new JsonFilePersistenceAdapter(persistencePath) : createPersistenceFromEnv(persistencePath)) : undefined,
    autoDream: {
      enabled: autoDreamEnabled,
      intervalHours: Number(process.env.MEMORY_DREAM_INTERVAL_HOURS ?? 6),
      writeThreshold: Number(process.env.MEMORY_DREAM_WRITE_THRESHOLD ?? 12)
    },
    configPath: process.env.MEMORY_CONFIG_PATH,
    redactionPolicy: {
      mode: redactionModeFromEnv(process.env.MEMORY_REDACTION_MODE),
      encryptionKey: process.env.MEMORY_ENCRYPTION_KEY,
      encryptionKeyId: process.env.MEMORY_ENCRYPTION_KEY_ID,
      encryptionKeyVersion: process.env.MEMORY_ENCRYPTION_KEY_VERSION
    }
  });
}

export async function createProductionMemoryService() {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if (isPostgresRepositoryBackend(backend) && process.env.MEMORY_POSTGRES_URL) {
    const { AsyncPostgresMemoryRepository } = await import("../repositories/postgresRepository");
    const asyncRepository = new AsyncPostgresMemoryRepository(process.env.MEMORY_POSTGRES_URL, { enableRls: process.env.MEMORY_POSTGRES_RLS === "true" });
    await asyncRepository.initialize();
    const loadedState = await createProductionPersistedFileFromRepository(asyncRepository, {
      allowServiceStateFallback: !isStrictDbPrimaryBackend(backend)
    });
    const service = createDefaultMemoryService();
    Object.defineProperty(service, "productionAsyncRepository", { value: asyncRepository, enumerable: false });
    if (loadedState && typeof loadedState === "object" && !Array.isArray(loadedState)) {
      service.importMemoryFile(loadedState as PersistedMemoryFile, { persist: false });
    }
    return service;
  }
  return createDefaultMemoryService();
}

export async function createProductionPersistedFileFromRepository(repository: {
  list(filter?: { userId?: string; includeArchived?: boolean; limit?: number }): Promise<Memory[]>;
  loadStateAsync?: () => Promise<unknown>;
}, options: { allowServiceStateFallback?: boolean } = {}): Promise<PersistedMemoryFile | undefined> {
  const memories = await repository.list({});
  if (memories.length > 0) {
    return {
      version: 2,
      memories
    } as PersistedMemoryFile;
  }
  if (options.allowServiceStateFallback === false) return undefined;
  const legacyState = await repository.loadStateAsync?.();
  return legacyState && typeof legacyState === "object" && !Array.isArray(legacyState)
    ? legacyState as PersistedMemoryFile
    : undefined;
}

export let defaultService = createDefaultMemoryService();

export async function initializeDefaultMemoryService(): Promise<MemoryService> {
  defaultService = await createProductionMemoryService();
  return defaultService;
}
