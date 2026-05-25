import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { MemoryService } from "../api/service";
import { PostgresRemotePersistenceAdapter } from "../api/persistence";

interface PostgresLiveArtifact {
  schemaVersion: "1.0";
  generatedAt: string;
  container: {
    runtime: "apple-container" | "docker";
    name: string;
    image: string;
    reused: boolean;
  };
  acceptance: {
    startsWithPostgresBackend: boolean;
    multiUserIsolation: boolean;
    idempotentMigrations: boolean;
    benchmarkAgainstPostgres: boolean;
    indexedLexicalSearch: boolean;
    transactionRollback: boolean;
  };
  migration: {
    countBefore: number;
    countAfter: number;
    maxVersion: number;
  };
  benchmark: {
    writes: LatencyStats;
    searches: LatencyStats;
    failures: number;
  };
  storage: ReturnType<MemoryService["storageStatus"]>;
  isolation: {
    aliceAtlasRows: number;
    bobAtlasRows: number;
    bobBeaconSearchRows: number;
    bobSearchLeaks: number;
  };
  passed: boolean;
}

interface LatencyStats {
  count: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
}

const containerName = process.env.MEMORY_POSTGRES_CONTAINER_NAME ?? "cognibrain-planv1-postgres";
const image = process.env.MEMORY_POSTGRES_IMAGE ?? "docker.io/library/postgres:16-alpine";
let url = process.env.MEMORY_POSTGRES_URL ?? "postgresql://cognibrain:cognibrain@127.0.0.1:55432/cognibrain";
const outPath = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "artifacts/postgres-live.json";

const runtime = ensurePostgresContainer();
if (!process.env.MEMORY_POSTGRES_URL && runtime.runtime === "apple-container") {
  url = `postgresql://cognibrain:cognibrain@${containerAddress()}:5432/cognibrain`;
}
const psqlCommand = process.env.MEMORY_PSQL_COMMAND ?? firstExisting([
  "/opt/homebrew/opt/libpq/bin/psql",
  "/usr/local/opt/libpq/bin/psql",
  "psql"
]);
process.env.MEMORY_POSTGRES_CONTAINER_NAME = containerName;
process.env.MEMORY_PSQL_COMMAND = psqlCommand;
process.env.MEMORY_STORAGE_BACKEND = "postgres-remote";
process.env.MEMORY_POSTGRES_URL = url;

waitForPostgres();
resetSchema();

const adapter = new PostgresRemotePersistenceAdapter(url, { command: psqlCommand });
const storage = new MemoryService({ persistence: adapter }).storageStatus();
const startsWithPostgresBackend = storage.active === "postgres-remote";

const writeLatencies: number[] = [];
const searchLatencies: number[] = [];
let failures = 0;

try {
  const builder = new MemoryService();
  builder.add({
    userId: "alice",
    orgId: "org-a",
    projectId: "postgres-live",
    content: "Alice private Postgres memory says Atlas launch code is blue.",
    consent: { visibility: "private", allowTraining: false, deleteOnRequest: true },
    source: { kind: "human", confidence: 0.98 }
  });
  builder.add({
    userId: "bob",
    orgId: "org-b",
    projectId: "postgres-live",
    content: "Bob team Postgres memory says Beacon launch code is green.",
    consent: { visibility: "org", allowTraining: false, deleteOnRequest: true },
    source: { kind: "human", confidence: 0.96 }
  });

  for (let index = 0; index < 25; index += 1) {
    builder.add({
      userId: `bench-${index % 5}`,
      orgId: `org-${index % 3}`,
      projectId: "postgres-live",
      content: `Postgres live benchmark memory ${index} stores tenant ${index % 3} indexed tsvector proof.`,
      entities: ["postgres", "tsvector", `tenant-${index % 3}`],
      source: { kind: "tool", confidence: 0.9 }
    });
    const start = performance.now();
    adapter.save({ version: 2, memories: builder.store.export(), maintenance: { users: {} } });
    writeLatencies.push(performance.now() - start);
  }

  const searchService = new MemoryService({ persistence: new PostgresRemotePersistenceAdapter(url, { command: psqlCommand }) });
  for (let index = 0; index < 10; index += 1) {
    const start = performance.now();
    const results = searchService.search({
      userId: `bench-${index % 5}`,
      orgId: `org-${index % 3}`,
      projectId: "postgres-live",
      query: "indexed tsvector proof",
      limit: 3
    });
    if (!results.length) failures += 1;
    searchLatencies.push(performance.now() - start);
  }
} catch (error) {
  failures += 1;
  throw error;
}

const reloaded = new MemoryService({ persistence: new PostgresRemotePersistenceAdapter(url, { command: psqlCommand }) });
const aliceAtlasRows = psqlNumber("select count(*) from cognibrain_memories where user_id = 'alice' and org_id = 'org-a' and project_id = 'postgres-live' and content like '%Atlas launch code%'");
const bobAtlasRows = psqlNumber("select count(*) from cognibrain_memories where user_id = 'bob' and org_id = 'org-b' and project_id = 'postgres-live' and content like '%Atlas launch code%'");
const bobBeaconResults = reloaded.search({ userId: "bob", orgId: "org-b", projectId: "postgres-live", query: "Bob Beacon green Postgres", limit: 5 });
const bobSearchLeaks = bobBeaconResults.filter((result) => result.memory.userId !== "bob" || result.memory.orgId !== "org-b").length;
const multiUserIsolation = aliceAtlasRows === 1 &&
  bobAtlasRows === 0 &&
  bobBeaconResults.some((result) => result.memory.content.includes("Beacon launch code")) &&
  bobSearchLeaks === 0;

const migrationBefore = migrationStatus();
new MemoryService({ persistence: new PostgresRemotePersistenceAdapter(url, { command: psqlCommand }) }).storageStatus();
const migrationAfter = migrationStatus();
const idempotentMigrations = migrationBefore.count === migrationAfter.count && migrationBefore.maxVersion === migrationAfter.maxVersion;

const lexical = adapter.lexicalSearch("tsvector proof", { limit: 5 });
const indexedLexicalSearch = lexical.length > 0 && lexical[0].explanation === "postgres tsvector";
const rollbackProbeBefore = psqlNumber("select count(*) from cognibrain_memories where memory_id = 'rollback_probe'");
run(psqlCommand, [
  url,
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  "begin; insert into cognibrain_memories(memory_id, user_id, content, memory_type, layer, belief_state, visibility, created_at, updated_at, payload) values ('rollback_probe', 'rollback-user', 'rollback transaction probe', 'project', 'long_term', 'active', 'private', now(), now(), '{}'::jsonb); rollback;"
]);
const rollbackProbeAfter = psqlNumber("select count(*) from cognibrain_memories where memory_id = 'rollback_probe'");
const transactionRollback = rollbackProbeBefore === rollbackProbeAfter;

const artifact: PostgresLiveArtifact = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  container: {
    runtime: runtime.runtime,
    name: containerName,
    image,
    reused: runtime.reused
  },
  acceptance: {
    startsWithPostgresBackend,
    multiUserIsolation,
    idempotentMigrations,
    benchmarkAgainstPostgres: writeLatencies.length === 25 && searchLatencies.length === 10 && failures === 0,
    indexedLexicalSearch,
    transactionRollback
  },
  migration: {
    countBefore: migrationBefore.count,
    countAfter: migrationAfter.count,
    maxVersion: migrationAfter.maxVersion
  },
  benchmark: {
    writes: stats(writeLatencies),
    searches: stats(searchLatencies),
    failures
  },
  storage,
  isolation: {
    aliceAtlasRows,
    bobAtlasRows,
    bobBeaconSearchRows: bobBeaconResults.length,
    bobSearchLeaks
  },
  passed: false
};
artifact.passed = Object.values(artifact.acceptance).every(Boolean) && failures === 0;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify(artifact, null, 2));
if (!artifact.passed) process.exit(1);

function ensurePostgresContainer(): { runtime: "apple-container" | "docker"; reused: boolean } {
  if (commandExists("container")) {
    run("container", ["system", "start"], { allowFailure: true });
    const inspected = run("container", ["inspect", containerName], { allowFailure: true });
    if (inspected.status === 0) {
      if (!inspected.stdout.includes('"status":"running"')) run("container", ["start", containerName]);
      return { runtime: "apple-container", reused: true };
    }
    run("container", [
      "run",
      "-d",
      "--name",
      containerName,
      "-e",
      "POSTGRES_PASSWORD=cognibrain",
      "-e",
      "POSTGRES_USER=cognibrain",
      "-e",
      "POSTGRES_DB=cognibrain",
      "-p",
      "55432:5432",
      image
    ]);
    return { runtime: "apple-container", reused: false };
  }
  if (commandExists("docker")) {
    const inspected = run("docker", ["inspect", containerName], { allowFailure: true });
    if (inspected.status === 0) {
      run("docker", ["start", containerName], { allowFailure: true });
      return { runtime: "docker", reused: true };
    }
    run("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "-e",
      "POSTGRES_PASSWORD=cognibrain",
      "-e",
      "POSTGRES_USER=cognibrain",
      "-e",
      "POSTGRES_DB=cognibrain",
      "-p",
      "55432:5432",
      image
    ]);
    return { runtime: "docker", reused: false };
  }
  throw new Error("No supported local container runtime found for Postgres live verification.");
}

function waitForPostgres(): void {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = run(psqlCommand, [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", "select 1"], { allowFailure: true, timeoutMs: 5000 });
    if (ready.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error("Postgres container did not become ready.");
}

function resetSchema(): void {
  run(psqlCommand, [
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    "drop table if exists cognibrain_context_packs, cognibrain_audit_events, cognibrain_relations, cognibrain_entities, cognibrain_memories, cognibrain_persistence_events, cognibrain_snapshots, cognibrain_schema_migrations cascade"
  ]);
}

function migrationStatus(): { count: number; maxVersion: number } {
  const output = run(psqlCommand, [
    url,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    "select count(*), coalesce(max(version), 0) from cognibrain_schema_migrations"
  ]).stdout.trim();
  const [count, maxVersion] = output.split("|").map(Number);
  return { count, maxVersion };
}

function psqlNumber(sql: string): number {
  const output = run(psqlCommand, [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]).stdout.trim();
  return Number(output);
}

function containerAddress(): string {
  const output = run("container", ["inspect", containerName]).stdout;
  const inspected = JSON.parse(output) as Array<{ networks?: Array<{ address?: string }> }>;
  const address = inspected[0]?.networks?.[0]?.address?.split("/")[0];
  if (!address) throw new Error(`Could not resolve IP address for container ${containerName}`);
  return address;
}

function stats(values: number[]): LatencyStats {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return {
    count: values.length,
    p50: round(percentile(0.5)),
    p95: round(percentile(0.95)),
    max: round(sorted.at(-1) ?? 0),
    mean: round(mean)
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function commandExists(command: string): boolean {
  return run("sh", ["-lc", `command -v ${command}`], { allowFailure: true }).status === 0;
}

function firstExisting(commands: string[]): string {
  for (const command of commands) {
    if (command.includes("/") ? existsSync(command) : commandExists(command)) return command;
  }
  throw new Error("psql is required for live Postgres verification. Install libpq or set MEMORY_PSQL_COMMAND.");
}

function run(command: string, args: string[], options: { allowFailure?: boolean; timeoutMs?: number } = {}): { status: number; stdout: string; stderr: string } {
  try {
    return {
      status: 0,
      stdout: execFileSync(command, args, { encoding: "utf8", maxBuffer: 20_000_000, timeout: options.timeoutMs ?? 30_000 }),
      stderr: ""
    };
  } catch (error) {
    const failure = error as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    if (!options.allowFailure) throw error;
    return {
      status: failure.status ?? 1,
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? failure.message ?? "")
    };
  }
}
