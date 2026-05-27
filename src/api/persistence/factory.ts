import type { MemoryPersistenceAdapter } from "./types";
import { AppendOnlyLogPersistenceAdapter, JsonFilePersistenceAdapter } from "./local";
import { SQLitePersistenceAdapter, sqliteAvailable } from "./sqlite";
import { CassandraCompatiblePersistenceAdapter, PostgresCompatiblePersistenceAdapter } from "./compatible";
import { CassandraRemotePersistenceAdapter, PostgresRemotePersistenceAdapter } from "./remote";

export function createPersistenceFromEnv(defaultPath = ".memory-harness.json"): MemoryPersistenceAdapter {
  const backend = process.env.MEMORY_STORAGE_BACKEND ?? "json";
  if (backend === "postgres-production" || backend === "postgres-db-primary" || backend === "postgres-async" || backend === "postgres-repository") {
    throw new Error(`${backend} is a DB-primary MemoryRepository backend; use MemoryService/createProductionMemoryService with MEMORY_POSTGRES_URL instead of the legacy persistence adapter factory.`);
  }
  if (backend === "jsonl" || backend === "append-only" || backend === "log") {
    return new AppendOnlyLogPersistenceAdapter(process.env.MEMORY_EVENT_LOG_PATH ?? ".memory-harness.jsonl");
  }
  if (backend === "sqlite" || backend === "sql") {
    return new SQLitePersistenceAdapter(process.env.MEMORY_SQLITE_PATH ?? defaultPath.replace(/\.json$/i, ".sqlite"));
  }
  if (backend === "postgres-remote" && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL);
  }
  if ((backend === "cockroach-remote" || backend === "cockroach-production") && process.env.MEMORY_POSTGRES_URL) {
    return new PostgresRemotePersistenceAdapter(process.env.MEMORY_POSTGRES_URL, { cockroach: true });
  }
  if (backend === "postgres" || backend === "postgres-compatible" || backend === "cockroach") {
    return new PostgresCompatiblePersistenceAdapter(process.env.MEMORY_POSTGRES_COMPAT_PATH ?? defaultPath.replace(/\.json$/i, ".postgres.json"));
  }
  if ((backend === "cassandra-remote" || backend === "cassandra-production") && process.env.MEMORY_CASSANDRA_CONTACT_POINT) {
    return new CassandraRemotePersistenceAdapter(process.env.MEMORY_CASSANDRA_CONTACT_POINT);
  }
  if (backend === "cassandra" || backend === "cassandra-compatible" || backend === "wide-column") {
    return new CassandraCompatiblePersistenceAdapter(process.env.MEMORY_CASSANDRA_COMPAT_PATH ?? defaultPath.replace(/\.json$/i, ".cassandra.json"));
  }
  return new JsonFilePersistenceAdapter(defaultPath);
}
