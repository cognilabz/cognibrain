import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore, ReflectionEngine, RetrievalEngine, healthReport, tokenize, extractEntities } from "../src/core";
import { HarnessMemoryHook } from "../src/connectors/harnessHook";
import { MemoryService } from "../src/api/service";
import { createMemoryToolHandlers } from "../src/connectors/mcpHandlers";

describe("TypeScript memory core", () => {
  it("retrieves with trust-aware multi-signal ranking", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Project Atlas uses TypeScript and line citations.",
      entities: ["atlas", "typescript", "citations"],
      source: { kind: "human", confidence: 0.98 }
    });
    store.add({
      userId: "u1",
      content: "Transcript guessed Atlas uses Ruby.",
      entities: ["atlas", "ruby"],
      source: { kind: "transcript", confidence: 0.2 }
    });
    const results = new RetrievalEngine(store).search({ userId: "u1", query: "What does Atlas use?", limit: 2 });
    expect(results[0].memory.content).toContain("TypeScript");
    expect(results[0].signals.trust).toBeGreaterThan(results[1].signals.trust);
  });

  it("normalizes question helper words and everyday aliases for recall", () => {
    expect(tokenize("When did Melanie paint a sunrise?")).toEqual(["melanie", "paint", "sun"]);
    expect(tokenize("The kids and children de-stress by relaxing.")).toEqual(["child", "child", "relax", "relax"]);

    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Melanie shared a painting of a sunset over a lake.",
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2025-01-01T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Melanie said she did a horse painting recently.",
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2026-01-01T10:00:00.000Z"
    });

    const results = new RetrievalEngine(store).search({
      userId: "u1",
      query: "When did Melanie paint a sunrise?",
      limit: 2,
      now: new Date("2026-02-01T10:00:00.000Z")
    });

    expect(results[0].memory.content).toContain("sunset over a lake");
  });

  it("extracts lowercase compound entities for zero-dependency entity linking", () => {
    const entities = extractEntities("The operator gate blocks transcript injection until human verification.");
    expect(entities).toContain("operator gate");
    expect(entities).toContain("transcript injection");

    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "The operator gate blocks transcript injection until human verification.",
      source: { kind: "human", confidence: 0.96 }
    });
    const results = new RetrievalEngine(store).search({ userId: "u1", query: "What does the operator gate do?", limit: 1 });
    expect(results[0].memory.content).toContain("blocks transcript injection");
    expect(results[0].signals.entity).toBeGreaterThan(0);
  });

  it("extracts coding entities and normalizes common multilingual aliases", () => {
    expect(tokenize("Das Repo nutzt eine Datenbank und CLI modules.")).toContain("repository");
    expect(tokenize("Das Repo nutzt eine Datenbank und CLI modules.")).toContain("database");

    const entities = extractEntities("POST /v1/cache calls CacheClient.get and imports @scope/pkg.");
    expect(entities).toContain("post /v1/cache");
    expect(entities).toContain("cacheclient.get");
    expect(entities).toContain("@scope/pkg");
  });

  it("supports configurable retrieval weights", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Old trusted Atlas memory mentions release policy.",
      source: { kind: "human", confidence: 0.98 },
      timestamp: "2025-01-01T00:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Fresh low-trust Atlas note mentions release policy.",
      source: { kind: "agent", confidence: 0.45 },
      timestamp: "2026-05-01T00:00:00.000Z"
    });

    const trustFirst = new RetrievalEngine(store, { trust: 1, temporal: 0, semantic: 0, keyword: 0, entity: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "Atlas release policy",
      now: new Date("2026-05-02T00:00:00.000Z")
    });
    const recencyFirst = new RetrievalEngine(store, { trust: 0, temporal: 1, semantic: 0, keyword: 0, entity: 0, graph: 0, access: 0 }).search({
      userId: "u1",
      query: "Atlas release policy",
      now: new Date("2026-05-02T00:00:00.000Z")
    });

    expect(trustFirst[0].memory.content).toContain("Old trusted");
    expect(recencyFirst[0].memory.content).toContain("Fresh low-trust");
  });

  it("supports optional dynamic reranking before verification", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "Atlas stores cache entries in Redis.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-01T00:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas cache policy was discussed recently.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-20T00:00:00.000Z"
    });

    const results = new RetrievalEngine(store).search({ userId: "u1", query: "Redis cache", now: new Date("2026-05-21T00:00:00.000Z") });
    expect(results[0].memory.content).toContain("Redis");
    expect(results[0].explanation?.some((item) => item.includes("rerank coverage"))).toBe(true);
  });

  it("keeps scoped and private memories out of unrelated retrieval", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      sessionId: "s1",
      appId: "app-a",
      content: "Session s1 uses the private launch checklist.",
      consent: { visibility: "private" },
      source: { kind: "human", confidence: 0.96 }
    });
    store.add({
      userId: "u1",
      sessionId: "s2",
      appId: "app-a",
      content: "Session s2 uses the public launch checklist.",
      source: { kind: "human", confidence: 0.96 }
    });
    const retrieval = new RetrievalEngine(store);
    expect(retrieval.search({ userId: "u1", appId: "app-a", query: "launch checklist", includePrivate: false })).toHaveLength(1);
    expect(retrieval.search({ userId: "u1", sessionId: "s1", query: "private launch checklist", includePrivate: true })[0].memory.content).toContain("private");
  });

  it("enforces org visibility and retention before retrieval", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      orgId: "org-a",
      content: "Org A uses the shared rollout calendar.",
      consent: { visibility: "org" },
      source: { kind: "human", confidence: 0.96 }
    });
    store.add({
      userId: "u1",
      content: "Expired memory mentions the rollout calendar.",
      consent: { visibility: "user", retentionUntil: "2026-01-01T00:00:00.000Z" },
      source: { kind: "human", confidence: 0.96 },
      timestamp: "2025-12-01T00:00:00.000Z"
    });

    const retrieval = new RetrievalEngine(store);
    const now = new Date("2026-02-01T00:00:00.000Z");
    expect(retrieval.search({ userId: "u1", query: "rollout calendar", now })).toHaveLength(0);
    expect(retrieval.search({ userId: "u1", orgId: "org-b", query: "rollout calendar", now })).toHaveLength(0);
    expect(retrieval.search({ userId: "u1", orgId: "org-a", query: "rollout calendar", now })[0].memory.content).toContain("Org A");
  });

  it("demotes low-trust contradictions during reflection", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Mira prefers verbose reports.", source: { kind: "agent", confidence: 0.4 } });
    store.add({ userId: "u1", content: "Mira prefers concise reports.", source: { kind: "human", confidence: 0.99 } });
    const report = new ReflectionEngine(store).run("u1");
    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(store.list("u1").some((memory) => memory.trust < 0.5 || memory.archivedAt)).toBe(true);
    expect(report.lifecycle.qualityScore).toBeGreaterThan(0);
  });

  it("detects multilingual contradictions and supports an external contradiction classifier", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Mira nutzt Redis fuer Cache.", source: { kind: "agent", confidence: 0.5 } });
    store.add({ userId: "u1", content: "Mira nutzt Postgres fuer Cache.", source: { kind: "human", confidence: 0.99 } });

    const report = new ReflectionEngine(store, {
      contradictionDetector: {
        classify: () => ({ label: "contradiction", confidence: 0.91, reason: "external classifier conflict" })
      }
    }).run("u1");

    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(report.contradictions[0].detector).toBe("external");
    expect(report.contradictions[0].reason).toBe("external classifier conflict");
  });

  it("uses optional generated reflection summaries while preserving provenance", () => {
    const store = new MemoryStore();
    for (const content of ["Atlas requires API proof.", "Atlas requires browser proof.", "Atlas requires simulator proof."]) {
      store.add({ userId: "u1", content, tags: ["atlas"], source: { kind: "human", confidence: 0.95 } });
    }

    const report = new ReflectionEngine(store, {
      summarizer: {
        summarize: ({ theme }) => ({
          content: `Generated ${theme} summary with audit-safe provenance.`,
          confidence: 0.77,
          metadata: { provider: "test-summarizer" }
        })
      }
    }).run("u1");

    const summary = report.created.find((memory) => memory.metadata.dreamJob === "cluster-summary");
    expect(summary?.content).toContain("Generated atlas summary");
    expect(summary?.metadata.summaryMode).toBe("external");
    expect(summary?.metadata.summaryOf).toHaveLength(3);
  });

  it("schedules verification for time-sensitive stale memories", () => {
    const store = new MemoryStore();
    store.add({
      userId: "u1",
      content: "The current target repo is /old/path.",
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-01-01T00:00:00.000Z",
      temporal: { lastConfirmedAt: "2026-01-01T00:00:00.000Z" }
    });
    const report = new ReflectionEngine(store, { verificationAfterDays: 10 }).run("u1", new Date("2026-02-01T00:00:00.000Z"));
    const memory = store.list("u1")[0];
    expect(memory.temporal.verificationDueAt).toBeDefined();
    expect(report.lifecycle.actions.some((action) => action.includes("scheduled stale memory verification"))).toBe(true);
  });

  it("creates temporal and behavioral reflection memories from repeated evidence", () => {
    const store = new MemoryStore();
    for (const day of [1, 2, 3, 4]) {
      store.add({
        userId: "u1",
        content: `Mira prefers Thai food on Friday observation ${day}.`,
        source: { kind: "human", confidence: 0.94 },
        tags: ["preference", "mira"],
        timestamp: `2026-05-0${day}T12:00:00.000Z`
      });
    }
    const report = new ReflectionEngine(store).run("u1", new Date("2026-05-23T00:00:00.000Z"));
    expect(report.created.some((memory) => memory.metadata.dreamJob === "temporal-summary")).toBe(true);
    expect(report.created.some((memory) => memory.metadata.dreamJob === "behavior-pattern")).toBe(true);
  });

  it("runs a full dream lifecycle: summarize, fade, archive, reevaluate, and reorganize", () => {
    const store = new MemoryStore();
    const now = new Date("2026-05-22T10:00:00.000Z");
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires simulator proof.",
      tags: ["atlas", "release"],
      source: { kind: "human", confidence: 0.95 },
      timestamp: "2026-05-01T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires browser screenshots.",
      tags: ["atlas", "release"],
      source: { kind: "reviewed_code", confidence: 0.92 },
      timestamp: "2026-05-02T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Atlas release checklist requires backend evidence.",
      tags: ["atlas", "release"],
      source: { kind: "human", confidence: 0.94 },
      timestamp: "2026-05-03T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Run npm run verify before publishing a release.",
      tags: ["procedure", "release"],
      source: { kind: "human", confidence: 0.9 },
      timestamp: "2026-05-04T10:00:00.000Z"
    });
    store.add({
      userId: "u1",
      content: "Transcript guessed Atlas uses Perl.",
      tags: ["atlas"],
      source: { kind: "transcript", confidence: 0.1 },
      timestamp: "2025-11-01T10:00:00.000Z"
    });

    const report = new ReflectionEngine(store).run("u1", now);
    const memories = store.list("u1");

    const reflection = report.created.find((memory) => memory.layer === "reflection" && memory.content.includes("Reflection on atlas"));
    expect(reflection).toBeDefined();
    expect(reflection?.metadata.dreamedAt).toBe(now.toISOString());
    expect(report.lifecycle.summarized).toBeGreaterThan(0);
    expect(report.lifecycle.faded).toBeGreaterThan(0);
    expect(report.lifecycle.archived).toBeGreaterThan(0);
    expect(report.lifecycle.reorganized).toBeGreaterThan(0);
    expect(report.lifecycle.evaluated).toBe(5);
    expect(report.lifecycle.qualityScore).toBeGreaterThan(0.7);
    const procedure = memories.find((memory) => memory.content.includes("npm run verify") && memory.layer === "procedural");
    expect(procedure).toBeDefined();
    expect(procedure?.metadata.reorganizedAt).toBe(now.toISOString());
    expect(memories.some((memory) => memory.content.includes("Perl") && memory.archivedAt)).toBe(true);
  });

  it("supports harness before and after hooks", () => {
    const store = new MemoryStore();
    const retrieval = new RetrievalEngine(store);
    const api = {
      add: store.add.bind(store),
      search: (input: { userId: string; query: string; limit: number }) => retrieval.search(input)
    };
    store.add({ userId: "u1", content: "Use simulator proof for parity claims.", source: { kind: "human", confidence: 0.95 } });
    const hook = new HarnessMemoryHook(api);
    const prepared = hook.beforeLlmCall({ userId: "u1", prompt: "How do we claim parity?" });
    expect(prepared.memoryContext).toContain("simulator proof");
    hook.afterLlmCall({ userId: "u1", prompt: "How do we claim parity?" }, "Run simulator and cite evidence.");
    expect(store.list("u1").length).toBe(2);
  });

  it("keeps harness memory context inside the configured token budget", () => {
    const store = new MemoryStore();
    const retrieval = new RetrievalEngine(store);
    const api = {
      add: store.add.bind(store),
      search: (input: { userId: string; query: string; limit: number }) => retrieval.search(input)
    };
    store.add({
      userId: "u1",
      content: "Atlas migration requires simulator proof and backend evidence.",
      source: { kind: "human", confidence: 0.95 }
    });
    store.add({
      userId: "u1",
      content: "Atlas dashboard parity requires browser screenshots and interaction checks.",
      source: { kind: "human", confidence: 0.95 }
    });

    const hook = new HarnessMemoryHook(api, { maxMemories: 4, tokenBudget: 40 });
    const prepared = hook.beforeLlmCall({ userId: "u1", prompt: "Atlas proof" });

    expect(prepared.memories.length).toBeGreaterThan(1);
    expect(prepared.memoryContext).toContain("Atlas");
    expect(prepared.memoryContext).not.toContain("browser screenshots");
  });

  it("reports health metrics", () => {
    const store = new MemoryStore();
    store.add({ userId: "u1", content: "Pinned policy memory.", pinned: true, source: { kind: "human", confidence: 1 } });
    const health = healthReport(store, "u1");
    expect(health.healthScore).toBeGreaterThan(0.5);
    expect(health.active).toBe(1);
  });

  it("exposes MCP-compatible memory tool handlers", () => {
    const handlers = createMemoryToolHandlers(new MemoryService());
    const added = handlers.add({
      userId: "u1",
      content: "Codex should use LoCoMo evidence recall for certified memory benchmarks.",
      tags: ["benchmark", "locomo"],
      sourceKind: "human",
      sourceConfidence: 0.98
    });
    expect(added.content).toContain("LoCoMo");

    const search = handlers.search({ userId: "u1", query: "certified benchmark", limit: 3 });
    expect(search[0].memory.content).toContain("LoCoMo");

    const pack = handlers.contextPack({ userId: "u1", query: "LoCoMo", tokenBudget: 120 });
    expect(pack.context).toContain("LoCoMo");

    const health = handlers.health({ userId: "u1" });
    expect(health.active).toBe(1);

    const dream = handlers.dream({ userId: "u1" });
    expect(dream.lifecycle.evaluated).toBeGreaterThan(0);

    const maintenance = handlers.maintenance();
    expect(maintenance.enabled).toBe(false);
  });

  it("redacts sensitive writes, extracts add-only facts, records feedback, and reports metrics", () => {
    const service = new MemoryService({ redactionPolicy: { mode: "redact" } });
    const secret = service.add({
      userId: "u1",
      content: "Use token ghp_abcdefghijklmnopqrstuvwxyz123456 for tests.",
      source: { kind: "human", confidence: 0.95 }
    });
    expect(secret.content).toContain("[redacted:github-token]");
    expect(secret.metadata.privacy).toBeDefined();

    const extracted = service.extract(
      [
        { role: "user", content: "Atlas now uses Redis for cache. The API calls /v1/cache." },
        { role: "tool", content: "Verified npm test passed for Atlas." }
      ],
      { userId: "u1", sessionId: "s1", appId: "app-a" }
    );
    expect(extracted.memories.length).toBeGreaterThan(1);
    expect(Object.keys(extracted.entityLinks).length).toBeGreaterThan(0);

    const before = extracted.memories[0].importance;
    const updated = service.feedback({ memoryId: extracted.memories[0].id, kind: "helpful", userId: "u1" });
    expect(updated.importance).toBeGreaterThan(before);
    expect(service.metricsReport().feedback).toBe(1);
    expect(service.exportUser("u1").length).toBeGreaterThan(0);
  });

  it("persists memories and maintenance state across service restarts", () => {
    const dir = mkdtempSync(join(tmpdir(), "cognibrain-"));
    try {
      const dbPath = join(dir, "memory.json");
      const service = new MemoryService({
        persistencePath: dbPath,
        autoDream: { enabled: true, writeThreshold: 2, intervalHours: 6 }
      });

      service.add({
        userId: "u1",
        content: "Run npm test before merging memory changes.",
        source: { kind: "human", confidence: 0.96 },
        tags: ["procedure", "test"]
      });
      expect(service.maintenanceStatus().users.u1.writesSinceDream).toBe(1);

      service.add({
        userId: "u1",
        content: "Run npm run build before releasing memory changes.",
        source: { kind: "human", confidence: 0.96 },
        tags: ["procedure", "release"]
      });

      const status = service.maintenanceStatus().users.u1;
      expect(status.writesSinceDream).toBe(0);
      expect(status.lastDreamAt).toBeDefined();

      const reloaded = new MemoryService({ persistencePath: dbPath });
      expect(reloaded.search({ userId: "u1", query: "What should run before releasing?", limit: 1 })[0].memory.content).toContain("build");
      expect(reloaded.maintenanceStatus().users.u1.lastDreamAt).toBe(status.lastDreamAt);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
