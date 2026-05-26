import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Memory } from "../../core";
import type { MemoryPersistenceAdapter, PersistedMemoryFile, PersistenceCapabilities } from "./types";

export class JsonFilePersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "json-file";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | Memory[] | undefined {
    if (!existsSync(this.path)) return undefined;
    const contents = readFileSync(this.path, "utf8").trim();
    if (!contents) return undefined;
    return JSON.parse(contents) as PersistedMemoryFile | Memory[];
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, JSON.stringify(payload, null, 2));
    renameSync(tempPath, this.path);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: false,
      transactional: true,
      appendOnly: false,
      sql: false,
      encryptedAtRest: false,
      migrationSafe: true,
      replication: "none",
      sharding: "none",
      lexical: { strategy: "bm25-fallback", indexed: false, notes: ["Uses in-process lexical scoring after JSON snapshot load."] },
      notes: ["Atomic snapshot writes for local-first desktop and CLI usage."]
    };
  }
}

export class AppendOnlyLogPersistenceAdapter implements MemoryPersistenceAdapter {
  readonly kind = "append-only-log";
  private readonly path: string;

  constructor(path: string) {
    this.path = resolve(path);
  }

  load(): PersistedMemoryFile | undefined {
    if (!existsSync(this.path)) return undefined;
    const lines = readFileSync(this.path, "utf8").split(/\r?\n/).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const entry = JSON.parse(lines[index]) as { type?: string; payload?: PersistedMemoryFile };
        if (entry.type === "snapshot" && entry.payload) return entry.payload;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  save(payload: PersistedMemoryFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const entry = {
      type: "snapshot",
      timestamp: new Date().toISOString(),
      version: payload.version,
      payload
    };
    appendFileSync(this.path, `${JSON.stringify(entry)}\n`);
  }

  capabilities(): PersistenceCapabilities {
    return {
      durable: true,
      distributedReady: true,
      transactional: false,
      appendOnly: true,
      sql: false,
      encryptedAtRest: false,
      migrationSafe: true,
      replication: "external",
      sharding: "none",
      lexical: { strategy: "bm25-fallback", indexed: false, notes: ["Uses in-process lexical scoring after append-log replay."] },
      notes: ["JSONL snapshots can be tailed, replicated, compacted, or replayed by SQL/cloud adapters."]
    };
  }
}
