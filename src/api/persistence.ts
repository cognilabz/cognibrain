export type { LexicalSearchHit, LexicalSearchOptions, MemoryPersistenceAdapter, PersistedMemoryFile, PersistenceCapabilities } from "./persistence/types";
export { AppendOnlyLogPersistenceAdapter, JsonFilePersistenceAdapter } from "./persistence/local";
export { SQLitePersistenceAdapter, sqliteAvailable } from "./persistence/sqlite";
export { CassandraCompatiblePersistenceAdapter, PostgresCompatiblePersistenceAdapter } from "./persistence/compatible";
export { CassandraRemotePersistenceAdapter, PostgresRemotePersistenceAdapter } from "./persistence/remote";
export { createPersistenceFromEnv } from "./persistence/factory";
